-- Sprint 3C.2: grants de licencia. Los crea la aprobación del pago (y solo
-- ella) desde el license_snapshot congelado en la orden: transaccional,
-- auditada e idempotente. Una licencia jamás crea entitlements de audio ni
-- períodos Premium; los conceptos siguen separados (modelo-datos-v2.md §3-4,
-- docs/payments/README.md §1).

-- +goose Up
create table license_grants (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references profiles (id) on delete restrict,
  track_id          uuid        not null references tracks (id) on delete restrict,
  -- Trazabilidad hasta la compra que la concedió (índice único parcial,
  -- mismo patrón que subscriptions_order_item_uidx: la doble aprobación y la
  -- carrera de dos clics no duplican la licencia del mismo ítem de orden).
  order_item_id     uuid        references order_items (id) on delete set null,
  license_option_id uuid        references track_license_options (id) on delete set null,
  terms_version_id  uuid        references license_terms_versions (id) on delete set null,
  -- Usos y condiciones aceptadas, congelados desde el snapshot de la orden:
  -- {use_code, monto_minor, moneda}.
  accepted_uses     jsonb       not null,
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz
);

create unique index license_grants_order_item_uidx
  on license_grants (order_item_id) where order_item_id is not null;

create index license_grants_user_idx on license_grants (user_id, granted_at desc);
create index license_grants_track_idx on license_grants (track_id);

grant select, insert, update on license_grants to api_app;
revoke delete on license_grants from api_app;

-- +goose Down
revoke delete on license_grants from api_app;
revoke select, insert, update on license_grants from api_app;
drop index license_grants_track_idx;
drop index license_grants_user_idx;
drop index license_grants_order_item_uidx;
drop table license_grants;
