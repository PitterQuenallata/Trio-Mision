-- Sprint 3B: registro de dispositivos (API, sin sync offline) y gestión de
-- membresías por artista desde la API. Los dispositivos no forman parte de
-- profiles (modelo-datos-v2.md §6): se registran aquí y atarán en Fase 4 las
-- licencias de descarga offline y los tokens push. Jamás se guardan tokens de
-- sesión ni secretos de dispositivo.

-- +goose Up
create table devices (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references profiles (id) on delete cascade,
  install_id     text        not null,
  platform       text        not null check (platform in
                 ('android', 'ios', 'windows', 'macos', 'linux', 'web')),
  app_version    text        not null,
  device_name    text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_reason text,
  -- Un mismo identificador de instalación no se repite por usuario; si el
  -- cliente se reinstala, genera un install_id nuevo.
  unique (user_id, install_id)
);

create index devices_user_idx on devices (user_id, last_seen_at desc);

-- La gestión de membresías por artista pasa por la API (manager asigna roles
-- de su artista), así que api_app vuelve a tener DML sobre artist_members.
-- Los roles staff siguen restringidos: se asignan solo por SQL (db-staff).
grant select, insert, update, delete on devices to api_app;
grant insert, update, delete on artist_members to api_app;

-- +goose Down
revoke insert, update, delete on artist_members from api_app;
revoke select, insert, update, delete on devices from api_app;
drop index devices_user_idx;
drop table devices;
