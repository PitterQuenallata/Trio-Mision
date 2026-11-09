-- Fase 5: tipo de lanzamiento. Un álbum puede ser álbum, EP o sencillo (un
-- lanzamiento de una sola canción). El tipo es informativo: no cambia accesos.

-- +goose Up
alter table albums
  add column tipo text not null default 'album'
    check (tipo in ('album', 'ep', 'sencillo'));

-- +goose Down
alter table albums drop column tipo;
