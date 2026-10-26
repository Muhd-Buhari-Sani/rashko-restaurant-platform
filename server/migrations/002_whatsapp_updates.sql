-- Consent is recorded per order, not per customer: someone may ask for updates on one
-- order and not the next. Default false, so a missing answer never counts as a yes.
alter table orders add column whatsapp_opt_in boolean not null default false;

create index if not exists notifications_order on notifications(order_id);
