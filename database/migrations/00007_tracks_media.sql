-- Grabaciones y media: pistas (tracks), activos de almacenamiento y su
-- relación publicada (modelo-datos-v2.md §3). Los binarios viven en S3;
-- los jobs de procesamiento (media_jobs) llegan con el worker en Fase 4.

-- +goose Up
create table tracks (
  id            uuid        primary key default gen_random_uuid(),
  artist_id     uuid        not null references artists (id) on delete restrict,
  song_id       uuid        references songs (id) on delete set null,
  title         text        not null,
  description   text,
  track_type    text        not null default 'audio'
                check (track_type in ('audio', 'video', 'backing_track')),
  is_published  boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create trigger tracks_set_updated_at
  before update on tracks
  for each row execute function set_updated_at();

create table media_assets (
  id                uuid        primary key default gen_random_uuid(),
  storage_key       text        not null unique,
  media_type        text        not null check (media_type in ('audio', 'image', 'pdf', 'other')),
  mime_type         text        not null,
  byte_size         bigint      not null check (byte_size > 0),
  checksum_sha256   text        not null,
  duration_ms       integer     check (duration_ms > 0),
  codec             text,
  sample_rate       integer     check (sample_rate > 0),
  channels          smallint    check (channels > 0),
  visibility        text        not null check (visibility in ('public', 'private')),
  processing_status text        not null default 'ready'
                    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create table track_media (
  track_id       uuid        not null references tracks (id) on delete cascade,
  media_asset_id uuid        not null references media_assets (id) on delete restrict,
  role           text        not null check (role in
                 ('master', 'preview', 'instrumental', 'vocal', 'accompaniment', 'stem', 'practice_mix')),
  is_published   boolean     not null default false,
  created_at     timestamptz not null default now(),
  primary key (track_id, media_asset_id, role)
);

-- Índices: FKs y lecturas publicadas.
create index tracks_artist_idx on tracks (artist_id) where deleted_at is null;
create index tracks_song_idx on tracks (song_id) where deleted_at is null;
create index tracks_published_idx on tracks (artist_id, title)
  where is_published and deleted_at is null;
create index track_media_asset_idx on track_media (media_asset_id);
create index media_assets_visibility_idx on media_assets (visibility) where deleted_at is null;

-- +goose Down
drop table track_media;
drop table media_assets;
drop trigger tracks_set_updated_at on tracks;
drop table tracks;
