-- Sprint 3C.1: códigos de canje y redenciones. Conceden un período Premium
-- (subscription, grant_source=redemption) o entitlements de las pistas de un
-- paquete, sin pago, con vigencia, límites, idempotencia por usuario/código
-- y por clave de cliente, y trazabilidad hasta el efecto concedido
-- (modelo-datos-v2.md §4, docs/payments/README.md §4).

-- +goose Up
create table redemption_codes (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  description text,
  grant_type  text        not null check (grant_type in ('premium', 'package')),
  plan_id     uuid        references plans (id) on delete restrict,
  product_id  uuid        references products (id) on delete restrict,
  max_uses    integer     not null default 1 check (max_uses > 0),
  used_count  integer     not null default 0 check (used_count >= 0),
  starts_at   timestamptz,
  ends_at     timestamptz,
  active      boolean     not null default true,
  -- un código concede exactamente un beneficio: plan premium o paquete
  check ((grant_type = 'premium' and plan_id is not null and product_id is null)
      or (grant_type = 'package' and product_id is not null and plan_id is null)),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (used_count <= max_uses),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger redemption_codes_set_updated_at
  before update on redemption_codes
  for each row execute function set_updated_at();

create table redemptions (
  id              uuid        primary key default gen_random_uuid(),
  code_id         uuid        not null references redemption_codes (id) on delete cascade,
  user_id         uuid        not null references profiles (id) on delete cascade,
  idempotency_key text,
  -- Contenido congelado al canjear (pistas concedidas o plan), para auditoría.
  content_snapshot jsonb,
  created_at      timestamptz not null default now(),
  -- Idempotencia natural: el mismo usuario no canjea dos veces el mismo
  -- código ni consume dos usos; el reintento devuelve la redención original.
  unique (code_id, user_id),
  -- Idempotencia de cliente: la clave no se reutiliza con otro código.
  unique (user_id, idempotency_key)
);

create index redemptions_code_idx on redemptions (code_id, created_at desc);
create index redemption_codes_code_idx on redemption_codes (code);

-- Trazabilidad del efecto: suscripción o entitlements apuntan a la redención.
alter table subscriptions
  add column redemption_id uuid references redemptions (id) on delete set null;

create unique index subscriptions_redemption_uidx
  on subscriptions (redemption_id) where redemption_id is not null;

alter table entitlements
  add column redemption_id uuid references redemptions (id) on delete set null;

create index entitlements_redemption_idx on entitlements (redemption_id);

grant select, insert, update on redemption_codes to api_app;
grant select, insert on redemptions to api_app;
grant update on subscriptions, entitlements to api_app;
revoke delete on redemption_codes, redemptions from api_app;

-- +goose Down
revoke delete on redemption_codes, redemptions from api_app;
revoke update on subscriptions, entitlements from api_app;
revoke select, insert on redemptions from api_app;
revoke select, insert, update on redemption_codes from api_app;
drop index entitlements_redemption_idx;
alter table entitlements drop column redemption_id;
drop index subscriptions_redemption_uidx;
alter table subscriptions drop column redemption_id;
drop index redemption_codes_code_idx;
drop index redemptions_code_idx;
drop table redemptions;
drop trigger redemption_codes_set_updated_at on redemption_codes;
drop table redemption_codes;
