-- Rol `postgres` esperado por las migraciones de GoTrue (supabase/auth),
-- que hacen GRANT ... TO postgres. En la plataforma Supabase ese rol existe;
-- en PostgreSQL vanilla hay que crearlo. Sin esto GoTrue falla en
-- 20240612123726_enable_rls_update_grants.

-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres LOGIN SUPERUSER;
  END IF;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    -- GoTrue otorga GRANT SELECT ... TO postgres: hay que revocar antes.
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth FROM postgres;
    REVOKE ALL PRIVILEGES ON SCHEMA auth FROM postgres;
    DROP ROLE postgres;
  END IF;
END
$$;
-- +goose StatementEnd
