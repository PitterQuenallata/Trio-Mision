-- Gestión de roles por administración (Fase 5). Solo admin puede crear staff
-- y managers; la API llama a estas funciones, y la cuenta api_app no recibe
-- INSERT/DELETE sobre staff_roles ni artist_members (00014 se mantiene).
--
-- Las funciones son SECURITY DEFINER: se ejecutan con los privilegios del
-- dueño de la migración, por eso validan dentro de la base (rol válido,
-- perfil existente, artista existente y no quitar el último admin).
-- La comprobación de que quien llama es admin la hace la API (authz).

-- +goose Up
-- +goose StatementBegin
create or replace function admin_set_staff_role(p_user uuid, p_role text, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('admin', 'editor', 'vendedor') then
    raise exception 'rol_invalido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into staff_roles (user_id, role) values (p_user, p_role)
    on conflict (user_id, role) do nothing;
  else
    if p_role = 'admin' and exists (
      select 1 from staff_roles where user_id = p_user and role = 'admin'
    ) then
      -- Bloquea los admins existentes para que dos revocaciones simultáneas no
      -- dejen el sistema sin admin.
      perform 1 from staff_roles where role = 'admin' for update;
      if (select count(*) from staff_roles where role = 'admin') <= 1 then
        raise exception 'ultimo_admin' using errcode = 'P0001';
      end if;
    end if;
    delete from staff_roles where user_id = p_user and role = p_role;
  end if;
end;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
create or replace function admin_set_artist_manager(p_user uuid, p_artist uuid, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = p_user) then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  if not exists (select 1 from artists where id = p_artist) then
    raise exception 'artista_inexistente' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into artist_members (artist_id, user_id, member_role) values (p_artist, p_user, 'manager')
    on conflict (artist_id, user_id) do update set member_role = 'manager';
  else
    -- Solo quita la membresía de manager; un member del mismo artista se conserva.
    delete from artist_members
    where artist_id = p_artist and user_id = p_user and member_role = 'manager';
  end if;
end;
$$;
-- +goose StatementEnd

revoke all on function admin_set_staff_role(uuid, text, boolean) from public;
revoke all on function admin_set_artist_manager(uuid, uuid, boolean) from public;
grant execute on function admin_set_staff_role(uuid, text, boolean) to api_app;
grant execute on function admin_set_artist_manager(uuid, uuid, boolean) to api_app;

-- +goose Down
drop function if exists admin_set_artist_manager(uuid, uuid, boolean);
drop function if exists admin_set_staff_role(uuid, text, boolean);
