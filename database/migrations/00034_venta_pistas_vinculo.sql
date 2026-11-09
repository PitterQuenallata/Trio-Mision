-- Fase 5: las canciones solo son gratis o Premium (suscripción). La venta de una
-- pista es un producto aparte, vinculado a una canción (tracks.song_id) con su
-- propio precio. La tienda solo vende pistas de grupos habilitados para vender.

-- +goose Up
alter table songs drop constraint songs_publication_access_check;
alter table songs add constraint songs_publication_access_check
  check (publication_access in ('free', 'premium'));

-- +goose Down
alter table songs drop constraint songs_publication_access_check;
alter table songs add constraint songs_publication_access_check
  check (publication_access in ('free', 'premium', 'purchase', 'creator'));
