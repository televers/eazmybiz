-- Cashfree PG: subscription checkout rows (INR first). Webhook updates status via service role.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.account_entitlements (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  target_plan public.plan_tier not null check (target_plan in ('pro', 'max')),
  order_amount_inr numeric(12, 2) not null,
  currency text not null default 'INR' check (currency = 'INR'),
  cashfree_order_id text not null,
  cashfree_payment_id text,
  payment_session_id text,
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'cancelled', 'expired', 'user_dropped')
  ),
  webhook_type text,
  webhook_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cashfree_order_id)
);

create index if not exists subscriptions_entitlement_id_idx on public.subscriptions (entitlement_id);
create index if not exists subscriptions_owner_user_id_idx on public.subscriptions (owner_user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

alter table public.subscriptions enable row level security;

create policy subscriptions_select_own on public.subscriptions
  for select using (owner_user_id = auth.uid());

create policy subscriptions_insert_own on public.subscriptions
  for insert with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.account_entitlements ae
      where ae.id = entitlement_id
        and ae.owner_user_id = auth.uid()
    )
  );

revoke all on public.subscriptions from public;
grant select, insert on public.subscriptions to authenticated;
