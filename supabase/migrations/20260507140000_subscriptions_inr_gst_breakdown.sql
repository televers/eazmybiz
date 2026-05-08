-- INR checkout: store pre-tax subtotal and GST alongside total charged (order_amount_inr).

alter table public.subscriptions
  add column if not exists order_subtotal_inr numeric(12, 2),
  add column if not exists order_gst_inr numeric(12, 2);

comment on column public.subscriptions.order_amount_inr is 'Total INR charged (subtotal + GST), sent to Cashfree.';
comment on column public.subscriptions.order_subtotal_inr is 'Pre-tax sale amount (intro price) before 18% GST.';
comment on column public.subscriptions.order_gst_inr is '18% GST component on order_subtotal_inr.';
