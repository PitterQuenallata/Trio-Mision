-- Sprint 4B: cola de trabajos de media e importación editorial PDF→ChordPro.
-- Un staff (admin/vendedor) sube un PDF editorial de canciones/himnos: la API
-- crea un media_job encolado con el PDF como media_asset privado vinculado
-- (media_job_assets, role='input'). El worker (services/worker, misma cuenta
-- PostgreSQL api_app: decision documentada en services/worker/README.md) toma
-- el job con FOR UPDATE SKIP LOCKED, extrae el texto posicionado con
-- pdftotext -bbox (poppler) y convierte a ChordPro con un algoritmo
-- determinista (port de legacy/panelweb-triomision-lyrics/src/lib/pdfToCho.ts):
-- solo llena result_json. La publicación en catálogo/himnario es siempre
-- borrador (is_published=false) y exclusiva de la API, tras revisión humana
-- (importacion.publicada). Nada se publica sin revisión (modelo-datos-v2.md §3
-- y §5; result_json se añade aquí al diseño vigente de media_jobs).

-- +goose Up
create table media_jobs (
  id               uuid        primary key default gen_random_uuid(),
  job_type         text        not null check (job_type in ('pdf_chordpro')),
  parameters_json  jsonb       not null default '{}',
  tool_version     text,
  status           text        not null default 'queued'
                   check (status in ('queued', 'running', 'done', 'failed')),
  progress         smallint    not null default 0 check (progress between 0 and 100),
  error_code       text,
  -- Resultado del worker (canciones convertidas + índices ya publicados por
  -- la API). Lo escribe el worker al terminar; la API solo lo enriquece al
  -- publicar borradores aprobados (campo publicados).
  result_json      jsonb,
  created_by       uuid        not null references profiles (id) on delete restrict,
  idempotency_key  text        not null,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  unique (created_by, idempotency_key)
);

create index media_jobs_status_idx on media_jobs (status, created_at);
create index media_jobs_creador_idx on media_jobs (created_by, created_at desc);

-- El PDF de entrada (y futuros derivados) vive como media_assets privado; la
-- PK compuesta con el rol permite varios activos por job y rol.
create table media_job_assets (
  media_job_id      uuid        not null references media_jobs (id) on delete cascade,
  media_asset_id    uuid        not null references media_assets (id) on delete restrict,
  input_output_role text        not null check (input_output_role in ('input', 'output')),
  primary key (media_job_id, media_asset_id, input_output_role)
);

-- Grants mínimos: sin DELETE en ninguna de las dos tablas; media_job_assets es
-- append-only para la API (sin UPDATE). El worker comparte la cuenta api_app:
-- necesita SELECT/UPDATE de media_jobs y SELECT de media_job_assets y
-- media_assets, todos ya cubiertos por estos grants.
grant select, insert, update on media_jobs to api_app;
revoke delete on media_jobs from api_app;
grant select, insert on media_job_assets to api_app;
revoke delete, update on media_job_assets from api_app;

-- +goose Down
revoke delete on media_jobs from api_app;
revoke select, insert, update on media_jobs from api_app;
revoke delete, update on media_job_assets from api_app;
revoke select, insert on media_job_assets from api_app;
drop table media_job_assets;
drop table media_jobs;
