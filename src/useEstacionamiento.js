import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';

const COLUMNS = 'id, distancia_cm, estado, led_verde, led_rojo, actualizado_en';

// Solo se consulta periódicamente mientras el tiempo real está caído
const POLL_MS = 10000;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

function sameRow(a, b) {
  if (!a || !b) return false;
  return (
    a.distancia_cm === b.distancia_cm &&
    a.estado === b.estado &&
    a.led_verde === b.led_verde &&
    a.led_rojo === b.led_rojo &&
    a.actualizado_en === b.actualizado_en
  );
}

/**
 * Lee el registro del estacionamiento y lo mantiene al día:
 * - Supabase Realtime para recibir cada cambio al instante.
 * - Reconexión automática con espera creciente si el canal se cae.
 * - Consulta inmediata al volver a la pestaña o recuperar Internet
 *   (en el celular el navegador corta la conexión al bloquear la pantalla).
 * - Consulta cada 10 s solo mientras no haya tiempo real.
 */
export function useEstacionamiento(id = 1) {
  const [data, setData] = useState(null);
  const [connection, setConnection] = useState(
    supabaseConfigured ? 'connecting' : 'configuration'
  );
  const [error, setError] = useState('');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;

    let alive = true;
    let channel = null;
    let generation = 0;
    let subscribed = false;
    let attempts = 0;
    let retryTimer = null;
    let pollTimer = null;

    const fetchRow = async () => {
      const { data: row, error: fetchError } = await supabase
        .from('estacionamiento')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;

      if (fetchError) {
        setError(`No se pudieron leer los datos: ${fetchError.message}`);
        return;
      }
      if (row) {
        setData((previous) => (sameRow(previous, row) ? previous : row));
      }
    };

    const startPolling = () => {
      if (!pollTimer) pollTimer = setInterval(fetchRow, POLL_MS);
    };

    const stopPolling = () => {
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const scheduleRetry = () => {
      if (retryTimer) return;
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempts);
      attempts += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (alive) subscribe();
      }, delay);
    };

    function subscribe() {
      generation += 1;
      const myGeneration = generation;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      subscribed = false;
      setConnection('connecting');

      channel = supabase
        .channel(`estacionamiento-${id}-${myGeneration}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'estacionamiento',
            filter: `id=eq.${id}`,
          },
          (payload) => {
            if (!alive || myGeneration !== generation) return;
            if (payload.new && Object.keys(payload.new).length > 0) {
              setData((previous) => ({ ...(previous ?? {}), ...payload.new }));
              setLastEventAt(Date.now());
              setPulse((value) => value + 1);
              setError('');
            }
          }
        )
        .subscribe((status) => {
          // Ignora avisos de canales viejos que ya se reemplazaron
          if (!alive || myGeneration !== generation) return;

          if (status === 'SUBSCRIBED') {
            subscribed = true;
            attempts = 0;
            setConnection('connected');
            setError('');
            stopPolling();
            fetchRow(); // por si hubo cambios mientras se conectaba
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            subscribed = false;
            setConnection('disconnected');
            setError('Se perdió el tiempo real. Reintentando y consultando cada 10 s…');
            startPolling();
            scheduleRetry();
          }
        });
    }

    const refreshNow = () => {
      if (document.visibilityState !== 'visible') return;
      fetchRow();
      if (!subscribed) {
        clearTimeout(retryTimer);
        retryTimer = null;
        attempts = 0;
        subscribe();
      }
    };

    fetchRow();
    subscribe();

    document.addEventListener('visibilitychange', refreshNow);
    window.addEventListener('online', refreshNow);

    return () => {
      alive = false;
      clearTimeout(retryTimer);
      stopPolling();
      document.removeEventListener('visibilitychange', refreshNow);
      window.removeEventListener('online', refreshNow);
      if (channel) supabase.removeChannel(channel);
    };
  }, [id]);

  return { data, connection, error, lastEventAt, pulse };
}
