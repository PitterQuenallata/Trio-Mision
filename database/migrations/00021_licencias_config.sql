-- Sprint 3C.2: licencias y permisos adicionales por pista. Perfil de
-- permisos por artista (plantilla editable), opciones elegibles por pista con
-- precio, términos versionados (append-only: versionar = insertar fila) y
-- aceptaciones del comprador registradas en la orden (modelo-datos-v2.md §3,
-- docs/alcance/README.md §4). Los grants efectivos llegan en 00022.

-- +goose Up
create table artist_license_profiles (
  artist_id           uuid        primary key references artists (id) on delete cascade,
  default_permissions jsonb       not null default '{}',
  updated_at          timestamptz not null default now()
);

create trigger artist_license_profiles_set_updated_at
  before update on artist_license_profiles
  for each row execute function set_updated_at();

-- La oferta efectiva por pista: una pista es elegible cuando tiene al menos
-- una opción habilitada (y la pista está publicada). Las pistas sin
-- autorización suficiente no ofrecen permisos: simplemente no tienen opciones.
create table track_license_options (
  id                  uuid        primary key default gen_random_uuid(),
  track_id            uuid        not null references tracks (id) on delete cascade,
  use_code            text        not null
                      check (use_code in ('practica', 'interpretacion', 'grabacion_vocal',
                                          'publicacion', 'monetizacion')),
  add_on_amount_minor bigint      not null check (add_on_amount_minor > 0),
  currency            char(3)     not null,
  enabled             boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (track_id, use_code)
);

create trigger track_license_options_set_updated_at
  before update on track_license_options
  for each row execute function set_updated_at();

create index track_license_options_track_enabled_idx
  on track_license_options (track_id) where enabled;

create table license_terms_versions (
  id            uuid        primary key default gen_random_uuid(),
  artist_id     uuid        not null references artists (id) on delete cascade,
  version_label text        not null,
  terms_text    text        not null,
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index license_terms_versions_artist_idx
  on license_terms_versions (artist_id, published_at desc);

create table license_acceptances (
  id               uuid        primary key default gen_random_uuid(),
  order_id         uuid        not null references orders (id) on delete cascade,
  terms_version_id uuid        not null references license_terms_versions (id) on delete restrict,
  user_id          uuid        not null references profiles (id) on delete cascade,
  accepted_at      timestamptz not null default now(),
  -- Una orden registra una sola aceptación por versión de términos, aunque
  -- incluya varias licencias del mismo artista.
  unique (order_id, terms_version_id)
);

create index license_acceptances_user_idx on license_acceptances (user_id);

grant select, insert, update on artist_license_profiles to api_app;
grant select, insert, update on track_license_options to api_app;
grant select, insert on license_terms_versions to api_app;
grant select, insert on license_acceptances to api_app;
revoke delete on artist_license_profiles, track_license_options from api_app;
revoke update, delete on license_terms_versions, license_acceptances from api_app;

-- +goose Down
revoke update, delete on license_acceptances, license_terms_versions from api_app;
revoke delete on track_license_options, artist_license_profiles from api_app;
revoke select, insert on license_acceptances from api_app;
revoke select, insert on license_terms_versions from api_app;
revoke select, insert, update on track_license_options from api_app;
revoke select, insert, update on artist_license_profiles from api_app;
drop index license_acceptances_user_idx;
drop table license_acceptances;
drop index license_terms_versions_artist_idx;
drop table license_terms_versions;
drop index track_license_options_track_enabled_idx;
drop trigger track_license_options_set_updated_at on track_license_options;
drop table track_license_options;
drop trigger artist_license_profiles_set_updated_at on artist_license_profiles;
drop table artist_license_profiles;
