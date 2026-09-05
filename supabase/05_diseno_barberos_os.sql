-- ============================================================
-- BLESSED - DISEÑO BARBEROS OS / MÓDULOS DE BARBERÍA
-- SOLO: reservas, calendario, barberos, servicios, galería,
-- horarios, usuarios, seguridad y configuración.
-- NO CREA productos, inventario, facturación, gastos ni IA.
-- ============================================================

alter table public.usuarios
  add column if not exists foto_url text,
  add column if not exists especialidad text,
  add column if not exists bio text;

create table if not exists public.servicios (
  id bigint generated always as identity primary key,
  nombre text not null check (length(trim(nombre)) between 2 and 120),
  descripcion text,
  precio numeric(10,2) not null default 0 check (precio >= 0),
  duracion_min integer not null default 60 check (duracion_min between 15 and 240),
  categoria text not null default 'Barbería',
  foto_url text,
  destacado boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.servicios enable row level security;

drop policy if exists servicios_public_select on public.servicios;
create policy servicios_public_select on public.servicios
for select to anon, authenticated using (activo = true);

drop policy if exists servicios_staff_select on public.servicios;
create policy servicios_staff_select on public.servicios
for select to authenticated using (public.current_user_role() in ('admin','super_admin'));

drop policy if exists servicios_staff_insert on public.servicios;
create policy servicios_staff_insert on public.servicios
for insert to authenticated with check (public.current_user_role() in ('admin','super_admin'));

drop policy if exists servicios_staff_update on public.servicios;
create policy servicios_staff_update on public.servicios
for update to authenticated
using (public.current_user_role() in ('admin','super_admin'))
with check (public.current_user_role() in ('admin','super_admin'));

drop policy if exists servicios_staff_delete on public.servicios;
create policy servicios_staff_delete on public.servicios
for delete to authenticated using (public.current_user_role() in ('admin','super_admin'));

grant select on public.servicios to anon, authenticated;
grant insert, update, delete on public.servicios to authenticated;
grant usage, select on sequence public.servicios_id_seq to authenticated;

create or replace function public.servicios_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists trg_servicios_updated_at on public.servicios;
create trigger trg_servicios_updated_at
before update on public.servicios
for each row execute function public.servicios_set_updated_at();

alter table public.reservas
  add column if not exists servicio_id bigint references public.servicios(id) on delete set null,
  add column if not exists notas text;

create index if not exists idx_reservas_servicio on public.reservas(servicio_id);

create or replace function public.listar_servicios_publicos()
returns table (
  id bigint,
  nombre text,
  descripcion text,
  precio numeric,
  duracion_min integer,
  categoria text,
  foto_url text,
  destacado boolean
)
language sql stable security definer set search_path=public
as $$
  select s.id,s.nombre,s.descripcion,s.precio,s.duracion_min,s.categoria,s.foto_url,s.destacado
  from public.servicios s
  where s.activo=true
  order by s.destacado desc,s.orden,s.nombre;
$$;

revoke all on function public.listar_servicios_publicos() from public;
grant execute on function public.listar_servicios_publicos() to anon,authenticated;

drop function if exists public.listar_barberos_publicos();

create function public.listar_barberos_publicos()
returns table (
  id uuid,
  nombre text,
  telefono text,
  foto_url text,
  especialidad text,
  bio text
)
language sql stable security definer set search_path=public
as $$
  select u.id,u.nombre,u.telefono,u.foto_url,u.especialidad,u.bio
  from public.usuarios u
  where u.rol='barbero' and u.activo=true
  order by u.nombre;
$$;

revoke all on function public.listar_barberos_publicos() from public;
grant execute on function public.listar_barberos_publicos() to anon,authenticated;

create or replace function public.crear_reserva_publica_v2(
  p_servicio_id bigint,
  p_barbero_id uuid,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_fecha date,
  p_hora_inicio time,
  p_notas text default null
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_id uuid;
  v_hora_fin time;
begin
  if length(trim(p_cliente_nombre))<2 then raise exception 'Nombre inválido'; end if;
  if length(trim(p_cliente_telefono))<6 then raise exception 'Teléfono inválido'; end if;
  if p_fecha<current_date then raise exception 'No se puede reservar una fecha pasada'; end if;

  if not exists(select 1 from public.servicios where id=p_servicio_id and activo=true) then
    raise exception 'Servicio no disponible';
  end if;

  select d.hora_fin into v_hora_fin
  from public.disponibilidad d
  join public.usuarios u on u.id=d.barbero_id
  where d.barbero_id=p_barbero_id
    and u.rol='barbero'
    and u.activo=true
    and d.dia_semana=extract(dow from p_fecha)::smallint
    and d.hora_inicio=p_hora_inicio
  limit 1;

  if v_hora_fin is null then raise exception 'Horario no disponible'; end if;

  insert into public.reservas(
    barbero_id,servicio_id,cliente_nombre,cliente_telefono,
    fecha,hora_inicio,hora_fin,notas
  )
  values(
    p_barbero_id,p_servicio_id,trim(p_cliente_nombre),trim(p_cliente_telefono),
    p_fecha,p_hora_inicio,v_hora_fin,nullif(trim(coalesce(p_notas,'')),'')
  )
  returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception 'Ese horario acaba de ser reservado';
end;
$$;

revoke all on function public.crear_reserva_publica_v2(bigint,uuid,text,text,date,time,text) from public;
grant execute on function public.crear_reserva_publica_v2(bigint,uuid,text,text,date,time,text) to anon,authenticated;

alter table public.configuracion_sistema
  add column if not exists nombre_sistema text not null default 'Blessed',
  add column if not exists slogan text not null default 'Tu estilo, tu mejor versión',
  add column if not exists ciudad text not null default 'Perú',
  add column if not exists instagram_url text not null default '',
  add column if not exists facebook_url text not null default '',
  add column if not exists tiktok_url text not null default '',
  add column if not exists maps_url text not null default '',
  add column if not exists portal_nombre text not null default 'Blessed Barber Studio',
  add column if not exists portal_tagline text not null default '✂ Reserva tu cita aquí',
  add column if not exists catalogo_titulo text not null default 'Servicios Blessed',
  add column if not exists catalogo_subtitulo text not null default 'Cortes, barba y cuidado profesional.',
  add column if not exists login_titulo text not null default 'Bienvenido',
  add column if not exists login_subtitulo text not null default 'Ingresa con tu correo y contraseña.',
  add column if not exists color_secundario text not null default '#111827',
  add column if not exists mostrar_barber_pole boolean not null default true,
  add column if not exists barber_pole_color1 text not null default '#111111',
  add column if not exists barber_pole_color2 text not null default '#B89454',
  add column if not exists barber_pole_color3 text not null default '#F6F2EA',
  add column if not exists barber_pole_speed text not null default '1.35',
  add column if not exists bg_grad_color1 text not null default '#111111',
  add column if not exists bg_grad_color2 text not null default '#3F3A34',
  add column if not exists bg_grad_color3 text not null default '#D5BD8A',
  add column if not exists bg_anim_speed text not null default '16';
