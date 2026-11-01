-- Sprint 3C.3: soporte. Tickets por categoría (pagos, descargas, permisos,
-- reclamo YouTube, otro) con mensajes y adjuntos privados en MinIO
-- (prefijo support/). Visible solo para el titular y staff; los adjuntos se
-- entregan con URL firmada breve tras verificar acceso y nunca van a logs.
-- Los mensajes son append-only para la API.

-- +goose Up
create table support_tickets (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references profiles (id) on delete restrict,
  categoria        text        not null
                   check (categoria in
                     ('pagos', 'descargas', 'permisos', 'reclamo_youtube', 'otro')),
  asunto           text        not null,
  estado           text        not null default 'abierto'
                   check (estado in ('abierto', 'en_atencion', 'resuelto', 'cerrado')),
  -- Contexto opcional vinculado a la cuenta del titular (se valida en API).
  order_id         uuid        references orders (id) on delete set null,
  license_grant_id uuid        references license_grants (id) on delete set null,
  -- Reclamos YouTube: URL y claim ID (la obligatoriedad se valida en la API
  -- para no requerir ALTER del dominio si la política evoluciona).
  youtube_url      text,
  youtube_claim_id text,
  idempotency_key  text        not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create trigger support_tickets_set_updated_at
  before update on support_tickets
  for each row execute function set_updated_at();

create index support_tickets_user_idx on support_tickets (user_id, created_at desc);
create index support_tickets_estado_idx on support_tickets (estado, created_at desc);
create index support_tickets_categoria_idx on support_tickets (categoria, created_at desc);

create table support_messages (
  id              uuid        primary key default gen_random_uuid(),
  ticket_id       uuid        not null references support_tickets (id) on delete restrict,
  author_id       uuid        not null references profiles (id) on delete restrict,
  author_kind     text        not null check (author_kind in ('usuario', 'staff')),
  cuerpo          text        not null,
  attachment_key  text,
  attachment_mime text,
  attachment_size bigint,
  created_at      timestamptz not null default now(),
  check (attachment_key is null or
         (attachment_mime is not null and attachment_size is not null and attachment_size > 0))
);

create index support_messages_ticket_idx on support_messages (ticket_id, created_at);

-- Privilegios mínimos: sin DELETE; sin UPDATE en la append-only
-- support_messages.
grant select, insert, update on support_tickets to api_app;
grant select, insert    on support_messages to api_app;
revoke delete on support_tickets, support_messages from api_app;
revoke update on support_messages from api_app;

-- +goose Down
revoke update on support_messages from api_app;
revoke delete on support_tickets, support_messages from api_app;
revoke select, insert    on support_messages from api_app;
revoke select, insert, update on support_tickets from api_app;

drop index support_messages_ticket_idx;
drop table support_messages;
drop trigger support_tickets_set_updated_at on support_tickets;
drop index support_tickets_categoria_idx;
drop index support_tickets_estado_idx;
drop index support_tickets_user_idx;
drop table support_tickets;
