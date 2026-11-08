-- Sprint 4C: tokens push (FCM) por dispositivo. Un dispositivo registrado
-- (Fase 3B) tiene como máximo un token activo: al rotar el token de FCM el
-- anterior se revoca. Un token pertenece a un único usuario (el registro de
-- un token ya ligado a otro usuario se rechaza). Cuando FCM responde que el
-- token ya no es válido (UNREGISTERED), el backend lo revoca en el acto
-- (modelo-datos-v2.md §5). Los tokens nunca se devuelven por la API.

-- +goose Up
create table push_tokens (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references profiles (id) on delete restrict,
  device_id      uuid        not null references devices (id) on delete restrict,
  token          text        not null unique,
  provider       text        not null default 'fcm' check (provider in ('fcm')),
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_reason text
);

-- Como máximo un token activo por dispositivo.
create unique index push_tokens_device_active_uidx
  on push_tokens (device_id) where revoked_at is null;

create index push_tokens_user_idx on push_tokens (user_id) where revoked_at is null;

grant select, insert, update on push_tokens to api_app;
revoke delete on push_tokens from api_app;

-- +goose Down
revoke delete on push_tokens from api_app;
revoke select, insert, update on push_tokens from api_app;
drop index push_tokens_user_idx;
drop index push_tokens_device_active_uidx;
drop table push_tokens;
