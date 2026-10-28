-- Acceso concedido (entitlements) y auditoría de operaciones sensibles
-- (modelo-datos-v2.md §4 y §5). Solo el backend concede acceso, de forma
-- idempotente: los índices únicos parciales impiden duplicar un acceso
-- vigente aunque una aprobación se repita.

-- +goose Up
create table entitlements (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references profiles (id) on delete cascade,
  order_item_id uuid        references order_items (id) on delete set null,
  track_id      uuid        references tracks (id) on delete cascade,
  media_asset_id uuid       references media_assets (id) on delete cascade,
  grant_source  text        not null check (grant_source in
                ('purchase', 'gift', 'creator_promo', 'redemption', 'manual')),
  granted_at    timestamptz not null default now(),
  valid_until   timestamptz,
  revoked_at    timestamptz,
  revoked_reason text,
  -- Un entitlement apunta exactamente a un objetivo de acceso.
  check (
    (track_id is not null)::int + (media_asset_id is not null)::int = 1
  )
);

create index entitlements_user_idx on entitlements (user_id, granted_at desc);
create index entitlements_track_idx on entitlements (track_id);

-- Sin duplicados de acceso vigente sobre la misma pista o el mismo activo.
create unique index entitlements_active_track_uidx
  on entitlements (user_id, track_id)
  where track_id is not null and revoked_at is null;
create unique index entitlements_active_asset_uidx
  on entitlements (user_id, media_asset_id)
  where media_asset_id is not null and revoked_at is null;

create table audit_events (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        references profiles (id) on delete set null,
  action      text        not null,
  entity_type text        not null,
  entity_id   text        not null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_events_entity_idx on audit_events (entity_type, entity_id, created_at desc);
create index audit_events_actor_idx on audit_events (actor_id, created_at desc);
create index audit_events_created_idx on audit_events (created_at desc);

-- +goose Down
drop table audit_events;
drop table entitlements;
