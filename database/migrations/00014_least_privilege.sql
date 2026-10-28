-- Privilegios mínimos para las cuentas diarias. Los logins se crean mediante
-- scripts/db-security.sh con secretos locales; estos roles NOLOGIN agrupan grants.
-- API no necesita leer auth ni modificar estructura; GoTrue administra su esquema.

-- +goose Up
-- +goose StatementBegin
do $$
begin
  if not exists (select from pg_roles where rolname = 'api_app') then
    create role api_app nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'gotrue_app') then
    create role gotrue_app nologin;
  end if;
end
$$;
-- +goose StatementEnd

grant usage on schema public to api_app;
grant select, insert, update, delete on all tables in schema public to api_app;
grant usage, select on all sequences in schema public to api_app;

revoke all on schema auth from api_app;
revoke all on all tables in schema auth from api_app;
revoke all on all sequences in schema auth from api_app;
revoke insert, update, delete on staff_roles, artist_members from api_app;
revoke delete on orders, order_items, payment_attempts, payment_evidence, entitlements from api_app;
revoke update, delete on audit_events from api_app;

alter default privileges in schema public
  grant select, insert, update, delete on tables to api_app;
alter default privileges in schema public
  grant usage, select on sequences to api_app;

-- GoTrue debe ser propietario de sus objetos para ejecutar sus migraciones.
grant create on schema public to gotrue_app;
alter schema auth owner to gotrue_app;

-- +goose StatementBegin
do $$
declare
  obj record;
begin
  for obj in select tablename from pg_tables where schemaname = 'auth' loop
    execute format('alter table auth.%I owner to gotrue_app', obj.tablename);
  end loop;
  for obj in select sequencename from pg_sequences where schemaname = 'auth' loop
    execute format('alter sequence auth.%I owner to gotrue_app', obj.sequencename);
  end loop;
end
$$;
-- +goose StatementEnd

grant all on all tables in schema auth to gotrue_app;
grant all on all sequences in schema auth to gotrue_app;
alter default privileges in schema auth grant all on tables to gotrue_app;
alter default privileges in schema auth grant all on sequences to gotrue_app;

-- +goose StatementBegin
do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'schema_migrations') then
    alter table public.schema_migrations owner to gotrue_app;
  end if;
end
$$;
-- +goose StatementEnd

-- +goose Down
alter default privileges in schema public revoke all on tables from api_app;
alter default privileges in schema public revoke all on sequences from api_app;
alter default privileges in schema auth revoke all on tables from gotrue_app;
alter default privileges in schema auth revoke all on sequences from gotrue_app;
revoke all on schema public from api_app;
revoke all on all tables in schema public from api_app;
revoke all on all sequences in schema public from api_app;
-- Los roles y la propiedad de auth se conservan para que un down/up sea posible
-- sin borrar logins ni historial. 00004 elimina el esquema en un reset completo.
