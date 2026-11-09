-- Fase 5: administración de grupos. El admin habilita a un grupo para vender
-- pistas y fija su comisión (5 a 10 %). No hay suscripción por grupo: la
-- habilitación es una decisión manual del admin. Una comisión de 5 a 10 es
-- obligatoria mientras el grupo venda pistas.

-- +goose Up
alter table artists
  add column can_sell_tracks boolean not null default false,
  add column commission_pct  numeric(4,2),
  add constraint artists_commission_range
    check (commission_pct is null or commission_pct between 5 and 10),
  add constraint artists_sell_needs_commission
    check (not can_sell_tracks or commission_pct is not null);

-- +goose Down
alter table artists
  drop constraint artists_sell_needs_commission,
  drop constraint artists_commission_range,
  drop column commission_pct,
  drop column can_sell_tracks;
