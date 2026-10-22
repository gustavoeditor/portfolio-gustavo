-- GUSTAVO® · Contas de cliente + pedidos Cakto + licenças (Creative Tools / Creative Hub)
-- Aplicar UMA vez no SQL Editor do projeto Supabase usado pelo site.
-- Idempotente: pode ser executada de novo sem perder dados.
-- Tabelas novas (prefixo creative_) para não colidir com experimentos anteriores (PR #61/#66).
-- Nada aqui é acessível pelo navegador: RLS ligado, sem policies, funções só para service_role.
begin;

create extension if not exists pgcrypto;

create table if not exists public.creative_orders (
  order_id          uuid primary key,
  product           text not null check (product ~ '^[a-z0-9-]{3,40}$'),
  cakto_product_id  uuid not null,
  offer_id          text not null check (length(offer_id) between 3 and 100),
  customer_email    text not null check (customer_email = lower(customer_email) and length(customer_email) between 3 and 254),
  status            text not null check (status in ('paid','refunded','chargedback')),
  amount_cents      integer check (amount_cents is null or amount_cents between 1 and 100000000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists creative_orders_email_idx on public.creative_orders (customer_email, product, created_at desc);

create table if not exists public.creative_licenses (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.creative_orders(order_id) on delete cascade,
  product         text not null,
  customer_email  text not null,
  key_hash        text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  key_hint        text not null check (key_hint ~ '^[A-Za-z0-9_-]{4}$'),
  status          text not null default 'active' check (status in ('active','revoked')),
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);
create index if not exists creative_licenses_email_idx on public.creative_licenses (customer_email, product, status);

alter table public.creative_orders   enable row level security;
alter table public.creative_licenses enable row level security;
revoke all on public.creative_orders, public.creative_licenses from public, anon, authenticated;

-- Webhook Cakto → pedido. Idempotente por order_id. Estorno/chargeback nunca volta a "paid".
create or replace function public.record_cakto_order(
  p_order_id text, p_product text, p_cakto_product_id text, p_offer_id text,
  p_customer_email text, p_event text, p_amount_cents integer
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  next_status text;
  final_status text;
begin
  next_status := case p_event when 'purchase_approved' then 'paid'
                              when 'refund' then 'refunded'
                              when 'chargeback' then 'chargedback' end;
  if next_status is null then raise exception 'Unsupported event'; end if;

  insert into public.creative_orders as o
    (order_id, product, cakto_product_id, offer_id, customer_email, status, amount_cents)
  values (p_order_id::uuid, p_product, p_cakto_product_id::uuid, p_offer_id, lower(trim(p_customer_email)), next_status, p_amount_cents)
  on conflict (order_id) do update
    set status = case
          when o.status = 'chargedback' or excluded.status = 'chargedback' then 'chargedback'
          when o.status = 'refunded'    or excluded.status = 'refunded'    then 'refunded'
          else 'paid' end,
        amount_cents = coalesce(o.amount_cents, excluded.amount_cents),
        updated_at = now()
    where o.product = excluded.product and o.cakto_product_id = excluded.cakto_product_id
  returning status into final_status;

  if final_status is null then raise exception 'Conflicting order identifiers'; end if;

  if final_status <> 'paid' then
    update public.creative_licenses
       set status = 'revoked', revoked_at = now()
     where order_id = p_order_id::uuid and status = 'active';
  end if;
  return final_status;
end;
$$;

-- Biblioteca do cliente (e-mail já confirmado pelo Supabase Auth no servidor).
create or replace function public.account_library(p_email text)
returns table (order_id uuid, product text, status text, amount_cents integer, purchased_at timestamptz,
               license_hint text, license_created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select o.order_id, o.product, o.status, o.amount_cents, o.created_at,
         l.key_hint, l.created_at
    from public.creative_orders o
    left join lateral (
      select key_hint, created_at from public.creative_licenses
       where order_id = o.order_id and status = 'active'
       order by created_at desc limit 1
    ) l on true
   where o.customer_email = lower(trim(p_email))
   order by o.created_at desc
   limit 50;
$$;

-- Gera (ou troca) a chave de licença do cliente. Só o hash é guardado; a chave aparece uma vez.
-- Retorna o order_id usado, ou null se o e-mail não tiver compra paga do produto.
create or replace function public.issue_license(p_email text, p_product text, p_key_hash text, p_key_hint text)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  paid_order uuid;
  normalized text := lower(trim(p_email));
begin
  select order_id into paid_order from public.creative_orders
   where customer_email = normalized and product = p_product and status = 'paid'
   order by created_at desc limit 1;
  if paid_order is null then return null; end if;

  update public.creative_licenses set status = 'revoked', revoked_at = now()
   where customer_email = normalized and product = p_product and status = 'active';

  insert into public.creative_licenses (order_id, product, customer_email, key_hash, key_hint)
  values (paid_order, p_product, normalized, p_key_hash, p_key_hint);
  return paid_order;
end;
$$;

-- Usado pelo download do Creative Hub (chave de licença) e pelo download do site (e-mail logado).
create or replace function public.license_is_valid(p_key_hash text, p_product text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.creative_licenses l
      join public.creative_orders o on o.order_id = l.order_id
     where l.key_hash = p_key_hash and l.product = p_product
       and l.status = 'active' and o.status = 'paid');
$$;

create or replace function public.email_has_paid_order(p_email text, p_product text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from public.creative_orders
                  where customer_email = lower(trim(p_email)) and product = p_product and status = 'paid');
$$;

revoke all on function public.record_cakto_order(text,text,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.account_library(text)                                    from public, anon, authenticated;
revoke all on function public.issue_license(text,text,text,text)                        from public, anon, authenticated;
revoke all on function public.license_is_valid(text,text)                               from public, anon, authenticated;
revoke all on function public.email_has_paid_order(text,text)                           from public, anon, authenticated;
grant execute on function public.record_cakto_order(text,text,text,text,text,text,integer) to service_role;
grant execute on function public.account_library(text)                                    to service_role;
grant execute on function public.issue_license(text,text,text,text)                        to service_role;
grant execute on function public.license_is_valid(text,text)                               to service_role;
grant execute on function public.email_has_paid_order(text,text)                           to service_role;
grant select, insert, update on public.creative_orders, public.creative_licenses to service_role;

commit;
