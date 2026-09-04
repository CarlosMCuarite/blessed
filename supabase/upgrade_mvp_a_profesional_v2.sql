-- ================================================================
-- MIGRACIÓN MVP -> PROFESIONAL V2
-- Ejecutar SOLO si ya corriste el schema.sql del MVP anterior.
-- ================================================================

create table if not exists public.dispositivos_usuario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  token text not null unique,
  plataforma text not null check (plataforma in ('android','ios')),
  activo boolean not null default true,
  ultimo_uso timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_dispositivos_usuario
  on public.dispositivos_usuario(usuario_id, activo);

alter table public.dispositivos_usuario enable row level security;

drop policy if exists dispositivos_self_select on public.dispositivos_usuario;
create policy dispositivos_self_select
on public.dispositivos_usuario
for select to authenticated
using (usuario_id = auth.uid());

revoke insert, update, delete on public.dispositivos_usuario from anon, authenticated;
grant select on public.dispositivos_usuario to authenticated;

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

-- Migrar token antiguo, si existe.
insert into public.dispositivos_usuario(usuario_id, token, plataforma)
select id, fcm_token, 'android'
from public.usuarios
where fcm_token is not null and length(fcm_token) > 10
on conflict(token) do nothing;
