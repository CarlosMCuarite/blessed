-- ============================================================
-- CATÁLOGO DE IMÁGENES (GALERÍA) - BLESSED BARBER STUDIO
-- Ejecutar UNA VEZ en Supabase SQL Editor, después de
-- schema_profesional_v2.sql y 03_configuracion_sistema.sql.
-- El admin y el super_admin suben fotos desde el Panel y se
-- muestran públicamente en la página de Reservar.
-- ============================================================

-- Tabla del catálogo -------------------------------------------------
create table if not exists public.galeria (
  id bigint generated always as identity primary key,
  url text not null,
  titulo text,
  orden integer not null default 0,
  activo boolean not null default true,
  creado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_galeria_orden on public.galeria(orden, id);

alter table public.galeria enable row level security;

drop policy if exists galeria_public_select on public.galeria;
create policy galeria_public_select
on public.galeria
for select
to anon, authenticated
using (activo = true);

drop policy if exists galeria_staff_select on public.galeria;
create policy galeria_staff_select
on public.galeria
for select
to authenticated
using (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists galeria_admin_insert on public.galeria;
create policy galeria_admin_insert
on public.galeria
for insert
to authenticated
with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists galeria_admin_update on public.galeria;
create policy galeria_admin_update
on public.galeria
for update
to authenticated
using (public.current_user_role() in ('admin', 'super_admin'))
with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists galeria_admin_delete on public.galeria;
create policy galeria_admin_delete
on public.galeria
for delete
to authenticated
using (public.current_user_role() in ('admin', 'super_admin'));

grant select on public.galeria to anon, authenticated;
grant insert, update, delete on public.galeria to authenticated;
grant usage, select on sequence galeria_id_seq to authenticated;

-- Bucket de Storage para las fotos -----------------------------------
insert into storage.buckets (id, name, public)
values ('galeria', 'galeria', true)
on conflict (id) do nothing;

drop policy if exists galeria_storage_public_read on storage.objects;
create policy galeria_storage_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'galeria');

drop policy if exists galeria_storage_admin_write on storage.objects;
create policy galeria_storage_admin_write
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'galeria'
  and public.current_user_role() in ('admin', 'super_admin')
);

drop policy if exists galeria_storage_admin_update on storage.objects;
create policy galeria_storage_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'galeria'
  and public.current_user_role() in ('admin', 'super_admin')
)
with check (
  bucket_id = 'galeria'
  and public.current_user_role() in ('admin', 'super_admin')
);

drop policy if exists galeria_storage_admin_delete on storage.objects;
create policy galeria_storage_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'galeria'
  and public.current_user_role() in ('admin', 'super_admin')
);
