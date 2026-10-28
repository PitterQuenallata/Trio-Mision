-- Esquema de GoTrue (supabase/auth v2.197.0). Las migraciones de GoTrue
-- crean sus tablas (auth.users, auth.refresh_tokens, ...) al arrancar el
-- contenedor, pero no el esquema: debe existir de antemano. Las credenciales
-- viven solo en GoTrue; profiles.id mantiene una FK lógica a auth.users(id).

-- +goose Up
CREATE SCHEMA IF NOT EXISTS auth;

-- +goose Down
DROP SCHEMA IF EXISTS auth CASCADE;
-- El registro de migraciones de GoTrue vive en public.schema_migrations;
-- sin quitarlo, tras un reset GoTrue creería que ya migró y no recrearía
-- sus tablas al reiniciarse.
DROP TABLE IF EXISTS public.schema_migrations;
