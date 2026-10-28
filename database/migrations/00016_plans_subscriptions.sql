-- Sprint 3C.1: planes Premium y suscripciones temporales. Premium se calcula
-- desde períodos de suscripción (nunca un booleano permanente) y no concede
-- audio descargable ni licencias adicionales (modelo-datos-v2.md §4,
-- docs/payments/README.md). Los orígenes posibles son compra (order_item) o
-- canje (redemption, FK en 00019).

-- +goose Up
create table plans (
  id            uuid        primary key default gen_random_uuid(),
  code          text        not null unique,
  name          text        not null,
  description   text,
  duration_days integer     not null check (duration_days > 0),
  benefits      jsonb       not null default '{}',
  active        boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on plans
  for each row execute function set_updated_at();

create table subscriptions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references profiles (id) on delete cascade,
  plan_id        uuid        not null references plans (id) on delete restrict,
  order_item_id  uuid        references order_items (id) on delete set null,
  status         text        not null default 'active'
                 check (status in ('active', 'revoked', 'cancelled')),
  grant_source   text        not null
                 check (grant_source in ('purchase', 'redemption', 'gift', 'manual')),
  period_start   timestamptz not null,
  period_end     timestamptz not null,
  check (period_end > period_start),
  revoked_at     timestamptz,
  revoked_reason text,
  created_at     timestamptz not null default now()
);

-- Ni una doble aprobación ni un canje repetido duplican un período concedido
-- por el mismo ítem de orden; el período vigente se extiende al comprar de nuevo.
create unique index subscriptions_order_item_uidx
  on subscriptions (order_item_id) where order_item_id is not null;

create index subscriptions_user_idx on subscriptions (user_id, period_end desc);

grant select, insert, update on plans to api_app;
grant select, insert, update on subscriptions to api_app;
revoke delete on plans, subscriptions from api_app;

-- +goose Down
revoke select, insert, update on subscriptions from api_app;
revoke select, insert, update on plans from api_app;
drop index subscriptions_user_idx;
drop index subscriptions_order_item_uidx;
drop table subscriptions;
drop trigger plans_set_updated_at on plans;
drop table plans;
