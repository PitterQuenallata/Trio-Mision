-- GoTrue (supabase/auth) consulta sus tablas sin calificar el esquema
-- ("identities", "users", ...): el rol de conexión necesita auth en el
-- search_path. Se añade al final para no cambiar la resolución del esquema
-- public usada por la API y por goose.

-- +goose Up
ALTER ROLE CURRENT_USER SET search_path TO "$user", public, auth;

-- +goose Down
ALTER ROLE CURRENT_USER SET search_path TO "$user", public;
