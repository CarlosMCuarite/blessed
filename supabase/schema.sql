-- ============================================================
-- BARBERÍA MVP - SUPABASE / POSTGRESQL
-- Ejecutar completo en SQL Editor de Supabase
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TIPOS ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    create type public.rol_usuario as enum ('super_admin', 'admin', 'barbero');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_reserva') then
    create type public.estado_reserva as enum ('reservada', 'atendida');
  end if;
end $$;

-- ---------- TABLAS ----------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) >= 2),
  rol public.rol_usuario not null,
  telefono text,
  fcm_token text,
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

create index if not exists idx_disponibilidad_barbero
  on public.disponibilidad(barbero_id, dia_semana, hora_inicio);

create index if not exists idx_reservas_barbero_fecha
  on public.reservas(barbero_id, fecha, hora_inicio);

-- ---------- UPDATED_AT ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_usuarios_updated_at on public.usuarios;
create trigger trg_usuarios_updated_at
before update on public.usuarios
for each row execute function public.set_updated_at();

-- ---------- HELPERS DE SEGURIDAD ----------
-- SECURITY DEFINER evita recursión de RLS al consultar usuarios.
create or replace function public.current_user_role()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from public.usuarios
  where id = auth.uid() and activo = true
  limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- ---------- FUNCIONES PÚBLICAS SEGURAS ----------
-- Devuelve SOLO id/nombre de barberos activos. No expone teléfono ni FCM.
create or replace function public.listar_barberos_publicos()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.nombre
  from public.usuarios u
  where u.rol = 'barbero' and u.activo = true
  order by u.nombre;
$$;

revoke all on function public.listar_barberos_publicos() from public;
grant execute on function public.listar_barberos_publicos() to anon, authenticated;

-- Devuelve horarios configurados que todavía no están reservados.
create or replace function public.horarios_disponibles(
  p_barbero_id uuid,
  p_fecha date
)
returns table (hora_inicio time, hora_fin time)
language sql
stable
security definer
set search_path = public
as $$
  select d.hora_inicio, d.hora_fin
  from public.disponibilidad d
  join public.usuarios u
    on u.id = d.barbero_id
   and u.rol = 'barbero'
   and u.activo = true
  where d.barbero_id = p_barbero_id
    and d.dia_semana = extract(dow from p_fecha)::smallint
    and p_fecha >= current_date
    and not exists (
      select 1
      from public.reservas r
      where r.barbero_id = d.barbero_id
        and r.fecha = p_fecha
        and r.hora_inicio = d.hora_inicio
    )
  order by d.hora_inicio;
$$;

revoke all on function public.horarios_disponibles(uuid, date) from public;
grant execute on function public.horarios_disponibles(uuid, date) to anon, authenticated;

-- Reserva pública atómica.
-- Valida: fecha no pasada, barbero activo, slot configurado y libre.
create or replace function public.crear_reserva_publica(
  p_barbero_id uuid,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_fecha date,
  p_hora_inicio time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hora_fin time;
begin
  if p_fecha < current_date then
    raise exception 'No se puede reservar una fecha pasada';
  end if;

  select d.hora_fin
    into v_hora_fin
  from public.disponibilidad d
  join public.usuarios u
    on u.id = d.barbero_id
   and u.rol = 'barbero'
   and u.activo = true
  where d.barbero_id = p_barbero_id
    and d.dia_semana = extract(dow from p_fecha)::smallint
    and d.hora_inicio = p_hora_inicio
  limit 1;

  if v_hora_fin is null then
    raise exception 'Horario no disponible';
  end if;

  insert into public.reservas (
    barbero_id, cliente_nombre, cliente_telefono,
    fecha, hora_inicio, hora_fin, estado
  )
  values (
    p_barbero_id,
    trim(p_cliente_nombre),
    trim(p_cliente_telefono),
    p_fecha,
    p_hora_inicio,
    v_hora_fin,
    'reservada'
  )
  returning id into v_id;

  return v_id;

exception
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado por otra persona';
end;
$$;

revoke all on function public.crear_reserva_publica(uuid,text,text,date,time) from public;
grant execute on function public.crear_reserva_publica(uuid,text,text,date,time) to anon, authenticated;

-- Guardar el token FCM solo para el usuario autenticado.
create or replace function public.guardar_fcm_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  update public.usuarios
  set fcm_token = p_token, updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.guardar_fcm_token(text) from public;
grant execute on function public.guardar_fcm_token(text) to authenticated;

-- ---------- RLS ----------
alter table public.usuarios enable row level security;
alter table public.disponibilidad enable row level security;
alter table public.reservas enable row level security;

-- USUARIOS
drop policy if exists usuarios_self_select on public.usuarios;
create policy usuarios_self_select
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('admin', 'super_admin')
);

-- No damos UPDATE/INSERT/DELETE directo desde Flutter.
-- Crear/editar usuarios será responsabilidad del backend privilegiado.

-- DISPONIBILIDAD
drop policy if exists disponibilidad_barbero_select on public.disponibilidad;
create policy disponibilidad_barbero_select
on public.disponibilidad
for select
to authenticated
using (
  barbero_id = auth.uid()
  or public.current_user_role() in ('admin', 'super_admin')
);

drop policy if exists disponibilidad_barbero_insert on public.disponibilidad;
create policy disponibilidad_barbero_insert
on public.disponibilidad
for insert
to authenticated
with check (
  barbero_id = auth.uid()
  and public.current_user_role() = 'barbero'
);

drop policy if exists disponibilidad_barbero_update on public.disponibilidad;
create policy disponibilidad_barbero_update
on public.disponibilidad
for update
to authenticated
using (
  barbero_id = auth.uid()
  and public.current_user_role() = 'barbero'
)
with check (
  barbero_id = auth.uid()
  and public.current_user_role() = 'barbero'
);

drop policy if exists disponibilidad_barbero_delete on public.disponibilidad;
create policy disponibilidad_barbero_delete
on public.disponibilidad
for delete
to authenticated
using (
  barbero_id = auth.uid()
  and public.current_user_role() = 'barbero'
);

-- RESERVAS
-- No hay SELECT para anon: protege nombre/teléfono del cliente.
drop policy if exists reservas_admin_select on public.reservas;
create policy reservas_admin_select
on public.reservas
for select
to authenticated
using (
  public.current_user_role() in ('admin', 'super_admin')
  or barbero_id = auth.uid()
);

-- El INSERT público se hace únicamente mediante crear_reserva_publica().
-- Revocamos escritura directa a anon/authenticated.
revoke insert, update, delete on public.reservas from anon;
revoke insert, update, delete on public.reservas from authenticated;

-- Grants básicos.
grant usage on schema public to anon, authenticated;
grant select on public.usuarios to authenticated;
grant select, insert, update, delete on public.disponibilidad to authenticated;
grant select on public.reservas to authenticated;

-- ---------- CREAR PRIMER SUPER ADMIN ----------
-- PASO MANUAL:
-- 1) En Supabase > Authentication > Users, crea el usuario super admin.
-- 2) Copia su UUID.
-- 3) Ejecuta:
--
-- insert into public.usuarios (id, nombre, rol, telefono)
-- values ('UUID_DEL_AUTH_USER', 'Super Admin', 'super_admin', '999999999');
--
-- El resto de usuarios puede crearse desde el panel Admin usando el backend.
