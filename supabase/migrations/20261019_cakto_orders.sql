-- Creative Tools / Cakto order evidence (no licence keys are issued by this migration).
-- Apply only to the owner-controlled Supabase project after testing the matching webhook.
-- Ref: https://docs.cakto.com.br/conceitos/webhooks
begin;

create table if not exists public.creative_tools_cakto_orders (
  order_id uuid primary key,
  product_id uuid not null,
  offer_id text not null,
  customer_email text not null,
  status text not null check (status in ('paid', 'refunded', 'chargeback')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.creative_tools_cakto_orders enable row level security;
revoke all on public.creative_tools_cakto_orders from anon, authenticated;

create or replace function public.record_creative_tools_cakto_order(
  p_order_id text,
  p_product_id text,
  p_offer_id text,
  p_customer_email text,
  p_event text
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  next_status text;
  effective_status text;
begin
  if p_event not in ('purchase_approved','refund','chargeback') then
    raise exception 'Unsupported event';
  end if;
  if length(coalesce(p_offer_id, '')) not between 4 and 100
     or length(coalesce(p_customer_email, '')) not between 3 and 254
     or p_customer_email not like '%@%.%' then
    raise exception 'Invalid order metadata';
  end if;
  next_status := case p_event when 'purchase_approved' then 'paid'
                  when 'refund' then 'refunded' else 'chargeback' end;

  insert into public.creative_tools_cakto_orders as previous
       (order_id, product_id, offer_id, customer_email, status)
  values (p_order_id::uuid, p_product_id::uuid, p_offer_id, lower(p_customer_email), next_status)
  on conflict (order_id) do update
    set status = case
       when previous.status = 'chargeback' or excluded.status = 'chargeback' then 'chargeback'
       when previous.status = 'refunded' or excluded.status = 'refunded' then 'refunded'
       else 'paid'
    end,
    updated_at = now()
    where previous.product_id = excluded.product_id
      and previous.offer_id = excluded.offer_id
  returning status into effective_status;

  if effective_status is null then raise exception 'Conflicting order identifiers'; end if;

  -- A late duplicate "purchase_approved" can never reactivate a refunded purchase.
  if effective_status in ('refunded','chargeback') then
    insert into public.creative_tools_cakto_revocations (order_id, event)
    values (p_order_id, case when effective_status = 'chargeback' then 'chargeback' else 'refund' end)
    on conflict (order_id) do update set event = excluded.event;
    update public.creative_tools_cakto_licenses
    set status = 'revoked'
    where order_id = p_order_id and status <> 'revoked';
  end if;
  return effective_status;
end;
$$;

revoke all on function public.record_creative_tools_cakto_order(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_creative_tools_cakto_order(text,text,text,text,text) to service_role;
commit;
