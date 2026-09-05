-- ============================================================
-- CONFIGURACIÓN CENTRAL DEL SISTEMA BLESSED
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- Es compatible con el esquema profesional actual.
-- ============================================================

create table if not exists public.configuracion_sistema (
  id smallint primary key default 1 check (id = 1),
  nombre_negocio text not null default 'Blessed Barber Studio',
  subtitulo text not null default 'Barber • Studio',
  telefono text not null default '',
  whatsapp text not null default '',
  direccion text not null default '',
  horario text not null default 'Atención con reserva previa',
  hero_titulo text not null default 'TU ESTILO, TU MEJOR VERSIÓN',
  hero_subtitulo text not null default 'Reserva con tu barbero favorito, elige un horario disponible y confirma tu cita en segundos.',
  home_cta text not null default 'RESERVA TU CITA',
  color_primario text not null default '#11100f',
  color_acento text not null default '#b89454',
  logo_url text not null default '/assets/logo_blessed.png',
  banner_principal_url text not null default '/assets/banner_dark.png',
  banner_secundario_url text not null default '/assets/banner_light.png',
  updated_at timestamptz not null default now()
);

insert into public.configuracion_sistema (id)
values (1)
on conflict (id) do nothing;

alter table public.configuracion_sistema enable row level security;

drop policy if exists configuracion_public_select on public.configuracion_sistema;
create policy configuracion_public_select
on public.configuracion_sistema
for select
to anon, authenticated
using (true);

drop policy if exists configuracion_super_admin_update on public.configuracion_sistema;
create policy configuracion_super_admin_update
on public.configuracion_sistema
for update
to authenticated
using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

grant select on public.configuracion_sistema to anon, authenticated;
grant update on public.configuracion_sistema to authenticated;

create or replace function public.configuracion_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_configuracion_updated_at on public.configuracion_sistema;
create trigger trg_configuracion_updated_at
before update on public.configuracion_sistema
for each row execute function public.configuracion_set_updated_at();
