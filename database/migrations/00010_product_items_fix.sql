-- Corrección de 00008: la PK compuesta (product_id, track_id, media_asset_id)
-- hacía NOT NULL a media_asset_id, pero el CHECK del modelo exige ítems con
-- exactamente una referencia (una pista sin asset es válido). Se reemplaza la
-- PK por índices únicos parciales, uno por tipo de contenido.

-- +goose Up
alter table product_items drop constraint product_items_pkey;

create unique index product_items_track_uidx
  on product_items (product_id, track_id)
  where track_id is not null;
create unique index product_items_asset_uidx
  on product_items (product_id, media_asset_id)
  where media_asset_id is not null;

-- +goose Down
drop index product_items_asset_uidx;
drop index product_items_track_uidx;
alter table product_items add primary key (product_id, track_id, media_asset_id);
