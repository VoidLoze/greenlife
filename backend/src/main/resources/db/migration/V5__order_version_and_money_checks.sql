-- Optimistic locking for orders: two admins (or a double tap) can no longer cancel the same order twice
-- and return its stock to the shelf twice, nor overwrite each other's status.
alter table orders add column version bigint not null default 0;

create index orders_created_idx on orders (created_at desc);

-- A checkout retried after a timeout (slow mobile network) returns the order already placed instead of a twin.
alter table orders add column idempotency_key varchar(64);
create unique index orders_idempotency_idx on orders (idempotency_key) where idempotency_key is not null;

alter table orders
    add constraint orders_payment_chk check (payment_method in ('CASH', 'KASPI', 'CARD_TRANSFER')),
    add constraint orders_money_chk check (items_total >= 0 and savings_total >= 0 and delivery_fee >= 0 and total >= 0);

alter table order_items
    add constraint order_items_money_chk check (unit_price >= 0 and retail_price >= 0);

-- A zero price would hand the product out for free.
alter table products
    drop constraint products_price_chk,
    drop constraint products_partner_price_chk,
    add constraint products_price_chk check (price is null or price > 0),
    add constraint products_partner_price_chk check (partner_price is null or partner_price > 0),
    add constraint products_old_price_chk check (old_price is null or old_price > 0);
