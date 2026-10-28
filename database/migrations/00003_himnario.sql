-- Himnario versionado (modelo-datos-v2.md §2.4). El número y el título
-- pertenecen al himno; cada versión guarda su propio contenido ChordPro.

-- +goose Up
create table hymn_collections (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null unique,
  name          text        not null,
  edition_label text,
  language_code text        not null default 'es',
  created_at    timestamptz not null default now()
);

create table hymns (
  id            uuid        primary key default gen_random_uuid(),
  collection_id uuid        not null references hymn_collections (id) on delete cascade,
  hymn_number   integer     not null,
  title         text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (collection_id, hymn_number)
);

create trigger hymns_set_updated_at
  before update on hymns
  for each row execute function set_updated_at();

create table hymn_versions (
  id                uuid        primary key default gen_random_uuid(),
  hymn_id           uuid        not null references hymns (id) on delete cascade,
  version_code      text        not null, -- chords_full | verse_chorus
  chord_scope       text        not null
                    check (chord_scope in ('full_song', 'verse_chorus', 'lyrics_only')),
  arrangement_label text,
  content_format    text        not null default 'chordpro' check (content_format = 'chordpro'),
  chordpro          text        not null,
  original_key      text,
  capo              smallint,
  source_revision   text,
  is_published      boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (hymn_id, version_code)
);

create trigger hymn_versions_set_updated_at
  before update on hymn_versions
  for each row execute function set_updated_at();

create index hymns_collection_idx on hymns (collection_id, hymn_number)
  where deleted_at is null;
create index hymns_updated_idx on hymns (updated_at) where deleted_at is null;
create index hymn_versions_hymn_idx on hymn_versions (hymn_id)
  where deleted_at is null;
create index hymn_versions_published_idx on hymn_versions (hymn_id)
  where is_published and deleted_at is null;

-- +goose Down
drop table hymn_versions;
drop table hymns;
drop table hymn_collections;
