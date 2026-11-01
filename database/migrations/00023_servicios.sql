-- Sprint 3C.3: servicios de composición/producción por encargo
-- (modelo-datos-v2.md §5, docs/alcance/README.md §5). Flujo:
-- solicitud → cotización → aceptación (proyecto con snapshot) → comprobante
-- → entrega. NO es checkout de tienda: jamás crean suscripciones Premium ni
-- licencias; el único efecto de acceso permitido es el entitlement de la
-- pista entregada (grant_source='service', idempotente por el índice parcial
-- existente entitlements_active_track_uidx).

-- +goose Up
create table service_requests (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles (id) on delete restrict,
  tipo            text        not null
                  check (tipo in ('composicion', 'produccion', 'arreglo')),
  titulo          text        not null,
  descripcion     text        not null,
  referencias     jsonb       not null default '{}',
  estado          text        not null default 'nueva'
                  check (estado in
                    ('nueva', 'en_revision', 'cotizada', 'aceptada', 'rechazada', 'cancelada')),
  idempotency_key text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- La idempotencia de creación es por (usuario, clave de cliente).
  unique (user_id, idempotency_key)
);

create trigger service_requests_set_updated_at
  before update on service_requests
  for each row execute function set_updated_at();

create index service_requests_user_idx on service_requests (user_id, created_at desc);
create index service_requests_estado_idx on service_requests (estado, created_at desc);

-- Una solicitud admite re-cotizaciones; solo una cotización aceptada
-- (garantizado con el proyecto, unique por quote_id).
create table service_quotes (
  id           uuid        primary key default gen_random_uuid(),
  request_id   uuid        not null references service_requests (id) on delete restrict,
  staff_id     uuid        not null references profiles (id) on delete restrict,
  amount_minor bigint      not null check (amount_minor > 0),
  currency     char(3)     not null,
  terms_text   text        not null,
  estado       text        not null default 'enviada'
               check (estado in ('enviada', 'aceptada', 'rechazada')),
  created_at   timestamptz not null default now()
);

create index service_quotes_request_idx on service_quotes (request_id, created_at desc);

create table service_projects (
  id             uuid        primary key default gen_random_uuid(),
  request_id     uuid        not null references service_requests (id) on delete restrict,
  quote_id       uuid        not null unique references service_quotes (id) on delete restrict,
  user_id        uuid        not null references profiles (id) on delete restrict,
  -- Monto y moneda congelados de la cotización aceptada.
  amount_minor   bigint      not null check (amount_minor > 0),
  currency       char(3)     not null,
  quote_snapshot jsonb       not null,
  estado         text        not null default 'en_curso'
                 check (estado in ('en_curso', 'entregado', 'cerrado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger service_projects_set_updated_at
  before update on service_projects
  for each row execute function set_updated_at();

create index service_projects_user_idx on service_projects (user_id, created_at desc);

-- Entregas del proyecto: append-only para la API. Cada entrega es exactamente
-- una pista vendida (vincula el acceso del cliente) o un archivo privado en
-- MinIO (stems, partituras, PDFs), nunca ambas ni ninguna.
create table service_deliverables (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references service_projects (id) on delete restrict,
  staff_id   uuid        not null references profiles (id) on delete restrict,
  titulo     text        not null,
  nota       text,
  track_id   uuid        references tracks (id) on delete restrict,
  file_key   text,
  mime       text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  check ((track_id is not null)::int + (file_key is not null)::int = 1),
  check (file_key is null or
         (mime is not null and size_bytes is not null and size_bytes > 0))
);

create index service_deliverables_project_idx on service_deliverables (project_id, created_at desc);

-- Comprobante del pago acordado: mismo patrón que la tienda (multipart
-- ≤ 5 MiB, MIME detectado por contenido) pero SIN efectos de acceso:
-- confirmarlo no concede entitlements, suscripciones ni licencias.
create table service_payments (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references service_projects (id) on delete restrict,
  user_id     uuid        not null references profiles (id) on delete restrict,
  receipt_key text        not null,
  mime        text        not null,
  size_bytes  bigint      not null check (size_bytes > 0),
  estado      text        not null default 'in_review'
              check (estado in ('in_review', 'confirmed', 'rejected')),
  reviewed_by uuid        references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index service_payments_project_idx on service_payments (project_id, created_at desc);
create index service_payments_estado_idx on service_payments (estado, created_at desc);

-- La entrega de una pista vendida concede su entitlement con origen 'service'.
-- Se amplía el catálogo del CHECK sin tocar migraciones aplicadas (drop/add
-- del constraint en la misma migración).
alter table entitlements drop constraint entitlements_grant_source_check;
alter table entitlements add constraint entitlements_grant_source_check
  check (grant_source in
    ('purchase', 'gift', 'creator_promo', 'redemption', 'manual', 'service'));

-- Privilegios mínimos: sin DELETE en ninguna tabla nueva; sin UPDATE en la
-- append-only service_deliverables.
grant select, insert, update on service_requests to api_app;
grant select, insert, update on service_quotes to api_app;
grant select, insert, update on service_projects to api_app;
grant select, insert    on service_deliverables to api_app;
grant select, insert, update on service_payments to api_app;
revoke delete on service_requests, service_quotes, service_projects,
  service_deliverables, service_payments from api_app;
revoke update on service_deliverables from api_app;

-- +goose Down
revoke update on service_deliverables from api_app;
revoke delete on service_requests, service_quotes, service_projects,
  service_deliverables, service_payments from api_app;
revoke select, insert, update on service_payments from api_app;
revoke select, insert    on service_deliverables from api_app;
revoke select, insert, update on service_projects from api_app;
revoke select, insert, update on service_quotes from api_app;
revoke select, insert, update on service_requests from api_app;

-- El CHECK de grant_source queda con el catálogo amplio: re-strecharlo
-- aquí fallaría (23514) cuando ya existen entitlements con origen
-- 'service' (estado normal tras usar la API), y 00009 —que crea
-- entitlements— se elimina inmediatamente después en cualquier reset
-- completo.
-- La reversibilidad de la migración no se ve afectada: ninguna otra
-- migración anterior modifica este constraint.

drop index service_payments_estado_idx;
drop index service_payments_project_idx;
drop table service_payments;
drop index service_deliverables_project_idx;
drop table service_deliverables;
drop trigger service_projects_set_updated_at on service_projects;
drop index service_projects_user_idx;
drop table service_projects;
drop index service_quotes_request_idx;
drop table service_quotes;
drop trigger service_requests_set_updated_at on service_requests;
drop index service_requests_estado_idx;
drop index service_requests_user_idx;
drop table service_requests;
