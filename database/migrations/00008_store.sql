-- Tienda y pagos manuales: productos, ofertas, órdenes con snapshots,
-- intentos de pago idempotentes y comprobantes privados
-- (modelo-datos-v2.md §4, docs/payments/README.md).

-- +goose Up
create table products (
  id            uuid        primary key default gen_random_uuid(),
  artist_id     uuid        references artists (id) on delete set null,
  product_type  text        not null check (product_type in ('track', 'album', 'catalog')),
  title         text        not null,
  description   text,
  active        boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create table product_items (
  product_id     uuid        not null references products (id) on delete cascade,
  track_id       uuid        references tracks (id) on delete restrict,
  media_asset_id uuid        references media_assets (id) on delete restrict,
  sort_order     smallint    not null default 0,
  -- Un ítem de paquete referencia exactamente un contenido.
  check (
    (track_id is not null)::int + (media_asset_id is not null)::int = 1
  ),
  primary key (product_id, track_id, media_asset_id)
);

create table offers (
  id            uuid        primary key default gen_random_uuid(),
  product_id    uuid        not null references products (id) on delete cascade,
  amount_minor  bigint      not null check (amount_minor > 0),
  currency      char(3)     not null,
  sales_channel text        not null default 'web' check (sales_channel in ('web', 'manual')),
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean     not null default false,
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  created_at    timestamptz not null default now()
);

-- Índice para lecturas de ofertas activas en la tienda; la vigencia
-- (starts_at/ends_at) se filtra en la consulta porque now() no es inmutable.
create index offers_active_idx on offers (product_id) where active;

create table orders (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles (id) on delete restrict,
  status          text        not null default 'pending'
                  check (status in ('pending', 'paid', 'cancelled', 'expired')),
  total_minor     bigint      not null check (total_minor > 0),
  currency        char(3)     not null,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,
  paid_at         timestamptz,
  -- Un mismo cliente no duplica una orden por reintento de red.
  unique (user_id, idempotency_key)
);

create index orders_user_idx on orders (user_id, created_at desc);

create table order_items (
  id                uuid        primary key default gen_random_uuid(),
  order_id          uuid        not null references orders (id) on delete cascade,
  product_id        uuid        references products (id) on delete set null,
  offer_id          uuid        references offers (id) on delete set null,
  track_id          uuid        references tracks (id) on delete set null,
  product_snapshot  jsonb       not null,
  content_snapshot  jsonb       not null,
  license_snapshot  jsonb,
  quantity          smallint    not null default 1 check (quantity > 0),
  unit_amount_minor bigint      not null check (unit_amount_minor > 0),
  line_total_minor  bigint      not null check (line_total_minor > 0)
);

create index order_items_order_idx on order_items (order_id);
create index order_items_track_idx on order_items (track_id);

create table payment_attempts (
  id                      uuid        primary key default gen_random_uuid(),
  order_id                uuid        not null references orders (id) on delete cascade,
  provider                text        not null check (provider in ('qr', 'transfer')),
  status                  text        not null default 'awaiting_evidence'
                          check (status in ('awaiting_evidence', 'in_review', 'confirmed', 'rejected')),
  amount_minor            bigint      not null check (amount_minor > 0),
  currency                char(3)     not null,
  provider_transaction_id text,
  provider_status         text,
  idempotency_key         text        not null unique,
  raw_payload             jsonb,
  created_at              timestamptz not null default now(),
  confirmed_at            timestamptz
);

create index payment_attempts_order_idx on payment_attempts (order_id, created_at desc);
create index payment_attempts_status_idx on payment_attempts (status, created_at desc);

create table payment_evidence (
  id                  uuid        primary key default gen_random_uuid(),
  payment_attempt_id  uuid        not null unique references payment_attempts (id) on delete cascade,
  private_storage_key text        not null,
  reviewed_by         uuid        references profiles (id) on delete set null,
  review_status       text        not null default 'pending'
                      check (review_status in ('pending', 'approved', 'rejected')),
  review_comment      text,
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz
);

-- +goose Down
drop table payment_evidence;
drop table payment_attempts;
drop table order_items;
drop table orders;
drop table offers;
drop table product_items;
drop trigger products_set_updated_at on products;
drop table products;
