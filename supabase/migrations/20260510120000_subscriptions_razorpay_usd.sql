-- Razorpay (international USD) alongside Cashfree INR.

alter table public.subscriptions
  add column if not exists payment_provider text;

update public.subscriptions set payment_provider = 'cashfree' where payment_provider is null;

alter table public.subscriptions alter column payment_provider set not null;
alter table public.subscriptions alter column payment_provider set default 'cashfree';

alter table public.subscriptions drop constraint if exists subscriptions_payment_provider_check;
alter table public.subscriptions add constraint subscriptions_payment_provider_check check (payment_provider in ('cashfree', 'razorpay'));

comment on column public.subscriptions.payment_provider is 'checkout gateway: cashfree (INR) or razorpay (USD international).';

alter table public.subscriptions alter column cashfree_order_id drop not null;
alter table public.subscriptions alter column order_amount_inr drop not null;

alter table public.subscriptions
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists order_subtotal_usd numeric(12, 2),
  add column if not exists order_amount_usd numeric(12, 2);

comment on column public.subscriptions.razorpay_order_id is 'Razorpay order id returned by Orders API.';
comment on column public.subscriptions.razorpay_payment_id is 'Razorpay payment id once captured.';
comment on column public.subscriptions.order_subtotal_usd is 'USD plan amount (no VAT in-app).';
comment on column public.subscriptions.order_amount_usd is 'Total USD charged (same as subtotal unless fees apply).';

alter table public.subscriptions drop constraint if exists subscriptions_currency_check;
alter table public.subscriptions add constraint subscriptions_currency_check check (currency in ('INR', 'USD'));

drop index if exists subscriptions_razorpay_order_id_key;
create unique index subscriptions_razorpay_order_id_key on public.subscriptions (razorpay_order_id)
  where razorpay_order_id is not null;

alter table public.subscriptions drop constraint if exists subscriptions_gateway_row_check;
alter table public.subscriptions add constraint subscriptions_gateway_row_check check (
  (payment_provider = 'cashfree' and cashfree_order_id is not null and currency = 'INR' and order_amount_inr is not null)
  or (
    payment_provider = 'razorpay'
    and razorpay_order_id is not null
    and currency = 'USD'
    and order_amount_usd is not null
    and order_subtotal_usd is not null
    and cashfree_order_id is null
  )
);
