import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';

const COLUMNAS = 'id, estado_anterior, estado, distancia_cm, cambiado_en';
const LIMITE = 2000;

/**
 * Lee los cambios de estado de un rango de tiempo y agrega en vivo
 * los que llegan por Supabase Realtime.
 * rangoMs = null significa "todo el historial".
 */
export function useHistorial(rangoMs, espacioId = 1) {
  const [eventos, setEventos] = useState([]);
  const [previo, setPrevio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [truncado, setTruncado] = useState(false);
  const [conexion, setConexion] = useState(
    supabaseConfigured ? 'connecting' : 'configuration'
  );

  useEffect(() => {
    if (!supabaseConfigured) {
      setCargando(false);
      return undefined;
    }

    let vivo = true;

    const cargar = async () => {
      const desde = rangoMs ? new Date(Date.now() - rangoMs).toISOString() : null;

      let consulta = supabase
        .from('historial_estados')
        .select(COLUMNAS)
        .eq('espacio_id', espacioId)
        .order('cambiado_en', { ascending: false })
        .limit(LIMITE);
      if (desde) consulta = consulta.gte('cambiado_en', desde);

      // Estado que tenía el espacio justo antes del rango (para iniciar la línea)
      const consultaPrevio = desde
        ? supabase
            .from('historial_estados')
            .select(COLUMNAS)
            .eq('espacio_id', espacioId)
            .lt('cambiado_en', desde)
            .order('cambiado_en', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [resultado, resultadoPrevio] = await Promise.all([consulta, consultaPrevio]);
      if (!vivo) return;

      if (resultado.error) {
        setError(`No se pudo leer el historial: ${resultado.error.message}`);
      } else {
        setError('');
        setEventos(resultado.data.slice().reverse());
        setTruncado(resultado.data.length === LIMITE);
        setPrevio(resultadoPrevio.data ?? null);
      }
      setCargando(false);
    };

    setCargando(true);
    cargar();

    const canal = supabase
      .channel(`historial-${espacioId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'historial_estados',
          filter: `espacio_id=eq.${espacioId}`,
        },
        (payload) => {
          if (!vivo || !payload.new) return;
          setEventos((anteriores) =>
            anteriores.some((e) => e.id === payload.new.id)
              ? anteriores
              : [...anteriores, payload.new]
          );
        }
      )
      .subscribe((estado) => {
        if (!vivo) return;
        if (estado === 'SUBSCRIBED') setConexion('connected');
        else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') {
          setConexion('disconnected');
        }
      });

    // En el celular la conexión se corta en segundo plano: recargar al volver
    const alVolver = () => {
      if (document.visibilityState === 'visible') cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);

    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
      supabase.removeChannel(canal);
    };
  }, [rangoMs, espacioId]);

  return { eventos, previo, cargando, error, truncado, conexion };
}
