-- Sprint 4A: licencias de descarga offline. Un dispositivo registrado (Fase 3B)
-- atará licencias temporales de reproducción cifrada offline para las pistas
-- a las que el usuario tiene acceso vigente (entitlement activo o Premium
-- activo). La licencia offline jamás habilita la descarga del master por la
-- vía de la tienda: solo la reproducción en el cliente. Renovables
-- (expires_at = ahora + 30 días) y revocables en cascada con el dispositivo
-- o con el entitlement que las originó (modelo-datos-v2.md §5).

-- +goose Up
create table offline_downloads (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references profiles (id) on delete restrict,
  device_id     uuid        not null references devices (id) on delete restrict,
  track_id      uuid        not null references tracks (id) on delete restrict,
  origen        text        not null check (origen in ('entitlement', 'premium')),
  granted_at    timestamptz not null default now(),
  -- Licencia temporal: se renueva con cada solicitud del dispositivo.
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  revoked_reason text
);

-- Una licencia vigente por (dispositivo, pista): la re-solicitud renueva
-- en vez de duplicar (mismo patrón de índice único parcial del proyecto).
create unique index offline_downloads_device_track_uidx
  on offline_downloads (device_id, track_id) where revoked_at is null;

create index offline_downloads_user_idx on offline_downloads (user_id, granted_at desc);
create index offline_downloads_device_idx on offline_downloads (device_id, granted_at desc);

grant select, insert, update on offline_downloads to api_app;
revoke delete on offline_downloads from api_app;

-- +goose Down
revoke delete on offline_downloads from api_app;
revoke select, insert, update on offline_downloads from api_app;
drop index offline_downloads_device_idx;
drop index offline_downloads_user_idx;
drop index offline_downloads_device_track_uidx;
drop table offline_downloads;
