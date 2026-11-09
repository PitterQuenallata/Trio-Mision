-- Fase 5: desactivar una membresía de grupo sin borrarla. Una membresía inactiva
-- no da acceso al contenido del grupo ni al panel; se conserva para reactivarla.
-- Un grupo debe conservar al menos un manager activo (regla en la API).

-- +goose Up
alter table artist_members add column activo boolean not null default true;

-- +goose Down
alter table artist_members drop column activo;
