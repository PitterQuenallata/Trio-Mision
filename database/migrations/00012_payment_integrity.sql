-- Integridad de pagos: idempotencia por orden y una sola confirmación por orden.
-- La titularidad sigue normalizada: payment_attempts -> orders -> profiles.

-- +goose Up
alter table payment_attempts
  drop constraint if exists payment_attempts_idempotency_key_key;

create unique index payment_attempts_order_idempotency_uidx
  on payment_attempts (order_id, idempotency_key);

create unique index payment_attempts_one_confirmed_per_order_uidx
  on payment_attempts (order_id)
  where status = 'confirmed';

-- +goose Down
drop index payment_attempts_one_confirmed_per_order_uidx;
drop index payment_attempts_order_idempotency_uidx;

-- La forma nueva admite la misma clave en órdenes distintas. Si ya existen esos
-- datos, restaurar el UNIQUE global sería imposible sin borrar historial; en ese
-- caso el down conserva los datos y el up posterior tolera la restricción ausente.
-- +goose StatementBegin
do $$
begin
  if not exists (
    select 1 from payment_attempts
    group by idempotency_key having count(*) > 1
  ) then
    alter table payment_attempts
      add constraint payment_attempts_idempotency_key_key unique (idempotency_key);
  end if;
end $$;
-- +goose StatementEnd
