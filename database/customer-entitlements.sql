-- Creative Tools customer entitlements (TEST purchase phase).
-- Apply in the connected Supabase project SQL Editor before enabling account login.
-- NEVER put the service-role key into HTML or frontend JS.
create table if not exists public.customer_entitlements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null check (product_id = 'creative-tools'),
 stripe_session_id text not null unique check (stripe_session_id ~ '^cs_test_[A-Za-z0-9_]{15,200}$'),
 stripe_payment_intent text not null check (stripe_payment_intent ~ '^pi_[A-Za-z0-9_]{12,}$'),
 price_cents integer not null check (price_cents between 100 and 1000000),
 currency text not null default 'brl' check (currency = 'brl'),
 status text not null default 'active' check (status in ('active','revoked')),
 purchased_at timestamptz not null default now()
);
create index if not exists customer_entitlements_user_purchased_idx
 on public.customer_entitlements (user_id, purchased_at desc);
alter table public.customer_entitlements enable row level security;
revoke all on public.customer_entitlements from public, anon, authenticated;
grant select on public.customer_entitlements to authenticated;
-- Server-only writer: the service_role API key must never be available to browsers.
grant select, insert, update on public.customer_entitlements to service_role;
drop policy if exists "Read only own purchased products" on public.customer_entitlements;
create policy "Read only own purchased products"
 on public.customer_entitlements for select to authenticated
 using (user_id = (select auth.uid()));
-- No client-side inserts/updates/deletes. Grants are issued only after server-side
-- Stripe payment verification using a Supabase service-role credential.
