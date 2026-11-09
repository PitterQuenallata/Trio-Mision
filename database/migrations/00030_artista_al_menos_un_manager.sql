-- Un artista debe conservar al menos un manager (la misma regla que el
-- endpoint de miembros). Reemplaza admin_set_artist_manager de la 00029
-- añadiendo esa comprobación al quitar un manager. Bloquea la fila del artista
-- para que dos revocaciones simultáneas no dejen el artista sin manager.

-- +goose Up
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
  -- Bloquea el artista: serializa las operaciones sobre sus managers.
  perform 1 from artists where id = p_artist for update;
  if not found then
    raise exception 'artista_inexistente' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into artist_members (artist_id, user_id, member_role) values (p_artist, p_user, 'manager')
    on conflict (artist_id, user_id) do update set member_role = 'manager';
  else
    if exists (
      select 1 from artist_members
      where artist_id = p_artist and user_id = p_user and member_role = 'manager'
    ) then
      if (select count(*) from artist_members
          where artist_id = p_artist and member_role = 'manager') <= 1 then
        raise exception 'sin_manager' using errcode = 'P0001';
      end if;
      delete from artist_members
      where artist_id = p_artist and user_id = p_user and member_role = 'manager';
    end if;
  end if;
end;
$$;
-- +goose StatementEnd

-- +goose Down
-- Restaura la versión de la 00029 (sin la comprobación de último manager).
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
    delete from artist_members
    where artist_id = p_artist and user_id = p_user and member_role = 'manager';
  end if;
end;
$$;
-- +goose StatementEnd
