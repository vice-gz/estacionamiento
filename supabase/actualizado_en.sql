-- Ejecuta este script UNA vez en Supabase: SQL Editor → New query → Run

-- 1. Columna con la hora de la última actualización (se omite si ya existe)
alter table public.estacionamiento
  add column if not exists actualizado_en timestamptz not null default now();

-- 2. Trigger: cada vez que el ESP32 hace PATCH, se guarda la hora del servidor.
--    Sin esto, "actualizado_en" nunca cambia y el dashboard parece congelado.
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_estacionamiento_actualizado on public.estacionamiento;

create trigger trg_estacionamiento_actualizado
before update on public.estacionamiento
for each row
execute function public.set_actualizado_en();

-- 3. Asegurar que la tabla emite cambios por Realtime (no falla si ya estaba)
do $$
begin
  alter publication supabase_realtime add table public.estacionamiento;
exception
  when duplicate_object then null;
end
$$;
