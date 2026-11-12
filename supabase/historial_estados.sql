-- Ejecuta este script UNA vez en Supabase: SQL Editor → New query → Run
-- Crea el historial de cambios de estado. El ESP32 NO necesita cambios:
-- la base de datos detecta sola cuándo cambia el estado y guarda la fecha y hora.

-- 1. Tabla del historial
create table if not exists public.historial_estados (
  id bigint generated always as identity primary key,
  espacio_id bigint not null default 1,
  estado_anterior smallint,
  estado smallint not null,
  distancia_cm real,
  cambiado_en timestamptz not null default now()
);

create index if not exists historial_estados_espacio_fecha_idx
  on public.historial_estados (espacio_id, cambiado_en desc);

-- 2. Permitir que la página web (publishable/anon key) lea el historial
alter table public.historial_estados enable row level security;

drop policy if exists "Leer historial de estados" on public.historial_estados;
create policy "Leer historial de estados"
  on public.historial_estados
  for select
  to anon, authenticated
  using (true);

-- 3. Trigger: cada vez que el ESP32 actualiza la fila, se compara el estado
--    nuevo con el anterior. Solo si es diferente se guarda un registro.
create or replace function public.registrar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.historial_estados (espacio_id, estado_anterior, estado, distancia_cm)
    values (new.id, old.estado, new.estado, new.distancia_cm);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registrar_cambio_estado on public.estacionamiento;

create trigger trg_registrar_cambio_estado
after update on public.estacionamiento
for each row
execute function public.registrar_cambio_estado();

-- 4. Primer registro con el estado actual, para que la gráfica tenga punto de partida
insert into public.historial_estados (espacio_id, estado, distancia_cm)
select id, estado, distancia_cm
from public.estacionamiento
where id = 1
  and not exists (select 1 from public.historial_estados where espacio_id = 1);

-- 5. Enviar los registros nuevos a la página en tiempo real
do $$
begin
  alter publication supabase_realtime add table public.historial_estados;
exception
  when duplicate_object then null;
end
$$;

-- (Opcional) Borrar registros de más de 30 días:
-- delete from public.historial_estados where cambiado_en < now() - interval '30 days';
