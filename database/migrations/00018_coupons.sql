-- Sprint 3C.1: cupones fijos/porcentuales con moneda, vigencia y límites
-- total/por usuario. Las órdenes conservan subtotal, descuento, total y la
-- referencia al cupón: el cálculo es exclusivamente backend y jamás produce
-- totales negativos (docs/payments/README.md §4). El cliente solo envía el
-- código; nunca decide el descuento.

-- +goose Up
create table coupons (
  id                 uuid        primary key default gen_random_uuid(),
  code               text        not null unique,
  description        text,
  discount_type      text        not null check (discount_type in ('percent', 'fixed')),
  percent_off        smallint    check (percent_off between 1 and 99),
  amount_minor       bigint      check (amount_minor > 0),
  currency           char(3),
  min_subtotal_minor bigint      not null default 0 check (min_subtotal_minor >= 0),
  max_uses_total     integer     check (max_uses_total > 0),
  max_uses_per_user  integer     not null default 1 check (max_uses_per_user > 0),
  used_count         integer     not null default 0 check (used_count >= 0),
  starts_at          timestamptz,
  ends_at            timestamptz,
  active             boolean     not null default true,
  -- exactamente una forma de descuento
  check ((discount_type = 'percent' and percent_off is not null and amount_minor is null)
      or (discount_type = 'fixed' and amount_minor is not null and percent_off is null)),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger coupons_set_updated_at
  before update on coupons
  for each row execute function set_updated_at();

-- Uso real por usuario y orden: soporta los límites y la auditoría de usos.
create table coupon_uses (
  coupon_id      uuid        not null references coupons (id) on delete cascade,
  user_id        uuid        not null references profiles (id) on delete cascade,
  order_id       uuid        not null references orders (id) on delete cascade,
  discount_minor bigint      not null check (discount_minor >= 0),
  created_at     timestamptz not null default now(),
  primary key (coupon_id, user_id, order_id)
);

-- Totales calculados en backend. Las órdenes históricas quedan con
-- subtotal = total y descuento 0.
alter table orders
  add column coupon_id      uuid references coupons (id) on delete set null,
  add column coupon_code    text,
  add column subtotal_minor bigint not null default 0,
  add column discount_minor bigint not null default 0;

update orders set subtotal_minor = total_minor where subtotal_minor = 0 and discount_minor = 0;

-- La invariante del dinero: descuento dentro del subtotal y total exacto.
-- El check histórico total_minor > 0 (00008) se conserva: un cupón que deje
-- el total en cero se rechaza al crear la orden (422), nunca se persiste.
alter table orders
  add constraint orders_totals_check check (discount_minor <= subtotal_minor),
  add constraint orders_total_exact_check check (total_minor = subtotal_minor - discount_minor);

create index orders_coupon_idx on orders (coupon_id);
create index coupons_code_idx on coupons (code);

grant select, insert, update on coupons to api_app;
grant select, insert on coupon_uses to api_app;
revoke delete on coupons, coupon_uses from api_app;

-- +goose Down
revoke select, insert on coupon_uses from api_app;
revoke select, insert, update on coupons from api_app;
alter table orders drop constraint orders_total_exact_check;
alter table orders drop constraint orders_totals_check;
drop index coupons_code_idx;
drop index orders_coupon_idx;
alter table orders drop column discount_minor, drop column subtotal_minor,
  drop column coupon_code, drop column coupon_id;
drop table coupon_uses;
drop trigger coupons_set_updated_at on coupons;
drop table coupons;
