-- La API no debe consultar auth.users: conserva únicamente el correo público
-- del perfil necesario para compras y revisión staff. Credenciales y sesiones
-- permanecen exclusivamente en GoTrue.

-- +goose Up
alter table profiles add column email text;

-- +goose StatementBegin
do $$
begin
  if exists (select from pg_tables where schemaname = 'auth' and tablename = 'users') then
    update profiles p
    set email = au.email
    from auth.users au
    where au.id = p.id and p.email is null;
  end if;
end
$$;
-- +goose StatementEnd

create unique index profiles_email_uidx on profiles (email) where email is not null;

-- +goose Down
drop index profiles_email_uidx;
alter table profiles drop column email;
