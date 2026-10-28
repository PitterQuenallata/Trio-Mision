-- Núcleo de identidad y autorización (modelo-datos-v2.md §2.2).
-- GoTrue conserva credenciales y sesiones; profiles.id es FK lógica a
-- auth.users(id), que existirá cuando se levante GoTrue (Fase 3).

-- +goose Up
-- +goose StatementBegin
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
-- +goose StatementEnd

create table profiles (
  id           uuid        primary key, -- FK lógica a auth.users(id)
  display_name text,
  avatar_key   text,
  is_banned    boolean     not null default false,
  ban_reason   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create table staff_roles (
  user_id    uuid        not null references profiles (id) on delete cascade,
  role       text        not null check (role in ('admin', 'editor', 'vendedor')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- +goose Down
drop table staff_roles;
drop trigger profiles_set_updated_at on profiles;
drop table profiles;
drop function set_updated_at();
