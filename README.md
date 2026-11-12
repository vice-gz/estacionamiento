# Smart Parking - Dashboard IoT

Dashboard web para visualizar en tiempo real el estado de un estacionamiento usando React, Vite y Supabase Realtime.

## 1. Requisitos

- Node.js instalado
- Proyecto Supabase con la tabla `public.estacionamiento`
- La tabla debe tener el registro `id = 1`
- Realtime habilitado para la tabla
- Política RLS que permita SELECT al rol `anon`

Columnas utilizadas:
- `id`
- `distancia_cm`
- `estado`
- `led_verde`
- `led_rojo`
- `actualizado_en`

Estados esperados:
- `0`: Libre
- `1`: Precaución
- `2`: Ocupado
- `3`: Error

### Paso obligatorio en Supabase

Abre **SQL Editor → New query**, pega el contenido de `supabase/actualizado_en.sql` y pulsa **Run**.
Ese script crea un trigger que guarda la hora del servidor cada vez que el ESP32 actualiza la fila.
Sin él, `actualizado_en` nunca cambia y el dashboard parece no actualizarse.

### Historial de cambios de estado

Ejecuta también `supabase/historial_estados.sql` en el SQL Editor. Crea la tabla `historial_estados`
y un trigger que guarda la fecha y hora **solo cuando el estado cambia** (el ESP32 no necesita cambios).
El historial y su gráfica se ven en la página `/historial`.

## 2. Instalar y ejecutar

Abre una terminal en esta carpeta:

```bash
npm install
```

Copia `.env.example` como `.env` y rellena los datos:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_PUBLISHABLE_O_ANON_KEY
```

Puedes usar la publishable key actual de Supabase (o la anon key heredada). No uses `service_role` ni una secret key en el frontend.

Después ejecuta:

```bash
npm run dev
```

Vite mostrará una dirección local, normalmente `http://localhost:5173`.

## 3. Publicar en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel elige **Add New → Project**.
3. Importa el repositorio.
4. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Pulsa **Deploy**.

Si modificas las variables después del despliegue, vuelve a desplegar el proyecto.

## 4. Cómo se mantiene actualizado

- Supabase Realtime entrega cada cambio al instante (normalmente en menos de 1 s).
- Si el canal se cae, se reconecta solo (espera 2 s, 4 s, 8 s… hasta 30 s) y mientras tanto consulta la base cada 10 s.
- Al volver a la pestaña o desbloquear el celular, la página consulta de inmediato, porque el navegador móvil corta la conexión en segundo plano.
- "ESP32 sin señal" aparece si pasan más de 45 s sin datos (el ESP32 manda un respaldo cada 30 s).

## 5. Notas

- La página consulta primero el registro actual y luego escucha los cambios mediante Supabase Realtime.
- No necesita ThingSpeak; las gráficas e historial pueden permanecer allí.
- El navegador necesita Internet para recibir actualizaciones.
- El ESP32 sigue controlando sus LEDs localmente; el dashboard solo muestra los valores guardados en Supabase.
