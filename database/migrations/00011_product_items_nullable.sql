-- Corrección de 00008 (parte 2): PostgreSQL dejó las columnas de la antigua
-- PK como NOT NULL al crearla en 00008, y drop constraint no las revierte.
-- El modelo exige ambas columnas NULLables (el CHECK exige exactamente una).

-- +goose Up
alter table product_items
  alter column track_id drop not null,
  alter column media_asset_id drop not null;

-- +goose Down
-- Restaurar la antigua PK exige columnas NOT NULL; los ítems con una sola
-- referencia (válidos bajo el modelo) no caben en el esquema viejo: se
-- eliminan, coherente con lo que la forma anterior de la tabla permitía.
delete from product_items where track_id is null or media_asset_id is null;

alter table product_items
  alter column track_id set not null,
  alter column media_asset_id set not null;
