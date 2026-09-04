-- ================================================================
-- BARBERÍA PROFESIONAL V2 - ESQUEMA COMPLETO PARA PROYECTO NUEVO
-- ================================================================
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    create type public.rol_usuario as enum ('super_admin', 'admin', 'barbero');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_reserva') then
    create type public.estado_reserva as enum ('reservada', 'atendida');
  end if;
end $$;

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 2 and 100),
  rol public.rol_usuario not null,
  telefono text,
  fcm_token text, -- compatibilidad con MVP anterior
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.disponibilidad (
  id bigint generated always as identity primary key,
  barbero_id uuid not null references public.usuarios(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamptz not null default now(),
  constraint disponibilidad_1_hora check (hora_fin = hora_inicio + interval '1 hour'),
  constraint disponibilidad_unica unique (barbero_id, dia_semana, hora_inicio)
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.usuarios(id) on delete restrict,
  cliente_nombre text not null check (length(trim(cliente_nombre)) between 2 and 100),
  cliente_telefono text not null check (length(trim(cliente_telefono)) between 6 and 30),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado public.estado_reserva not null default 'reservada',
  created_at timestamptz not null default now(),
  constraint reserva_1_hora check (hora_fin = hora_inicio + interval '1 hour'),
  constraint reserva_slot_unico unique (barbero_id, fecha, hora_inicio)
);

-- V2: varios dispositivos por usuario.
create table if not exists public.dispositivos_usuario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  token text not null unique,
  plataforma text not null check (plataforma in ('android','ios')),
  activo boolean not null default true,
  ultimo_uso timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_disponibilidad_barbero
  on public.disponibilidad(barbero_id, dia_semana, hora_inicio);
create index if not exists idx_reservas_barbero_fecha
  on public.reservas(barbero_id, fecha, hora_inicio);
create index if not exists idx_dispositivos_usuario
  on public.dispositivos_usuario(usuario_id, activo);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_usuarios_updated_at on public.usuarios;
create trigger trg_usuarios_updated_at
before update on public.usuarios
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$
  select rol from public.usuarios
  where id = auth.uid() and activo = true
  limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.listar_barberos_publicos()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public
as $$
  select u.id, u.nombre
  from public.usuarios u
  where u.rol = 'barbero' and u.activo = true
  order by u.nombre;
$$;
revoke all on function public.listar_barberos_publicos() from public;
grant execute on function public.listar_barberos_publicos() to anon, authenticated;

create or replace function public.horarios_disponibles(
  p_barbero_id uuid,
  p_fecha date
)
returns table (hora_inicio time, hora_fin time)
language sql stable security definer set search_path = public
as $$
  select d.hora_inicio, d.hora_fin
  from public.disponibilidad d
  join public.usuarios u on u.id = d.barbero_id
  where d.barbero_id = p_barbero_id
    and u.rol = 'barbero'
    and u.activo = true
    and d.dia_semana = extract(dow from p_fecha)::smallint
    and p_fecha >= current_date
    and not exists (
      select 1 from public.reservas r
      where r.barbero_id = d.barbero_id
        and r.fecha = p_fecha
        and r.hora_inicio = d.hora_inicio
    )
  order by d.hora_inicio;
$$;
revoke all on function public.horarios_disponibles(uuid,date) from public;
grant execute on function public.horarios_disponibles(uuid,date) to anon, authenticated;

create or replace function public.crear_reserva_publica(
  p_barbero_id uuid,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_fecha date,
  p_hora_inicio time
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_hora_fin time;
begin
  if length(trim(p_cliente_nombre)) < 2 then
    raise exception 'Nombre inválido';
  end if;
  if length(trim(p_cliente_telefono)) < 6 then
    raise exception 'Teléfono inválido';
  end if;
  if p_fecha < current_date then
    raise exception 'No se puede reservar una fecha pasada';
  end if;

  select d.hora_fin into v_hora_fin
  from public.disponibilidad d
  join public.usuarios u on u.id = d.barbero_id
  where d.barbero_id = p_barbero_id
    and u.rol = 'barbero'
    and u.activo = true
    and d.dia_semana = extract(dow from p_fecha)::smallint
    and d.hora_inicio = p_hora_inicio
  limit 1;

  if v_hora_fin is null then
    raise exception 'Horario no disponible';
  end if;

  insert into public.reservas (
    barbero_id, cliente_nombre, cliente_telefono,
    fecha, hora_inicio, hora_fin
  )
  values (
    p_barbero_id, trim(p_cliente_nombre), trim(p_cliente_telefono),
    p_fecha, p_hora_inicio, v_hora_fin
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado';
end;
$$;
revoke all on function public.crear_reserva_publica(uuid,text,text,date,time) from public;
grant execute on function public.crear_reserva_publica(uuid,text,text,date,time) to anon, authenticated;

create or replace function public.registrar_dispositivo(
  p_token text,
  p_plataforma text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_plataforma not in ('android','ios') then raise exception 'Plataforma inválida'; end if;

  insert into public.dispositivos_usuario(usuario_id, token, plataforma, activo, ultimo_uso)
  values(auth.uid(), p_token, p_plataforma, true, now())
  on conflict(token) do update set
    usuario_id = excluded.usuario_id,
    plataforma = excluded.plataforma,
    activo = true,
    ultimo_uso = now();
end;
$$;
revoke all on function public.registrar_dispositivo(text,text) from public;
grant execute on function public.registrar_dispositivo(text,text) to authenticated;

create or replace function public.marcar_reserva_atendida(p_reserva_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.reservas r
  set estado = 'atendida'
  where r.id = p_reserva_id
    and (
      public.current_user_role() in ('admin','super_admin')
      or r.barbero_id = auth.uid()
    );

  if not found then raise exception 'Reserva no encontrada o sin permiso'; end if;
end;
$$;
revoke all on function public.marcar_reserva_atendida(uuid) from public;
grant execute on function public.marcar_reserva_atendida(uuid) to authenticated;

alter table public.usuarios enable row level security;
alter table public.disponibilidad enable row level security;
alter table public.reservas enable row level security;
alter table public.dispositivos_usuario enable row level security;

drop policy if exists usuarios_self_select on public.usuarios;
create policy usuarios_self_select on public.usuarios for select to authenticated
using (id = auth.uid() or public.current_user_role() in ('admin','super_admin'));

drop policy if exists disponibilidad_select on public.disponibilidad;
create policy disponibilidad_select on public.disponibilidad for select to authenticated
using (barbero_id = auth.uid() or public.current_user_role() in ('admin','super_admin'));

drop policy if exists disponibilidad_insert on public.disponibilidad;
create policy disponibilidad_insert on public.disponibilidad for insert to authenticated
with check (barbero_id = auth.uid() and public.current_user_role() = 'barbero');

drop policy if exists disponibilidad_delete on public.disponibilidad;
create policy disponibilidad_delete on public.disponibilidad for delete to authenticated
using (barbero_id = auth.uid() and public.current_user_role() = 'barbero');

drop policy if exists reservas_select on public.reservas;
create policy reservas_select on public.reservas for select to authenticated
using (public.current_user_role() in ('admin','super_admin') or barbero_id = auth.uid());

drop policy if exists dispositivos_self_select on public.dispositivos_usuario;
create policy dispositivos_self_select on public.dispositivos_usuario for select to authenticated
using (usuario_id = auth.uid());

revoke insert, update, delete on public.usuarios from anon, authenticated;
revoke insert, update, delete on public.reservas from anon, authenticated;
revoke insert, update, delete on public.dispositivos_usuario from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.usuarios to authenticated;
grant select, insert, delete on public.disponibilidad to authenticated;
grant select on public.reservas to authenticated;
grant select on public.dispositivos_usuario to authenticated;
