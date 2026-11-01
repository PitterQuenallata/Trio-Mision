-- Revisión Sprint 3C.3: una carrera de dos subidas concurrentes de comprobante
-- podía dejar dos pagos in_review del mismo proyecto (el insert con
-- "where not exists" no se serializa). El índice único parcial lo garantiza
-- en base, con el mismo patrón que license_grants_order_item_uidx.

-- +goose Up
create unique index service_payments_in_review_uidx
  on service_payments (project_id) where estado = 'in_review';

-- +goose Down
drop index service_payments_in_review_uidx;
