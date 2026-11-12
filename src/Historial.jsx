import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CarFront, Download, History, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useHistorial } from './useHistorial';
import { useNow } from './useNow';
import GraficaEstados from './GraficaEstados';
import {
  ESTADOS, ORDEN_ESTADOS, etiquetaEstado, formatearDuracion, formatoFechaHora,
} from './estados';

const RANGOS = [
  { id: '1h', texto: '1 h', ms: 60 * 60 * 1000 },
  { id: '24h', texto: '24 h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', texto: '7 días', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'todo', texto: 'Todo', ms: null },
];

const FILAS_POR_PAGINA = 50;

const TEXTO_CONEXION = {
  connected: 'En tiempo real',
  connecting: 'Conectando…',
  disconnected: 'Sin tiempo real',
  configuration: 'Falta configuración',
};

/* Convierte la lista de cambios en tramos continuos para la gráfica */
function construirLinea(eventos, previo, rangoMs, ahora) {
  const lista = eventos
    .map((e) => ({ ...e, t: Date.parse(e.cambiado_en) }))
    .filter((e) => !Number.isNaN(e.t))
    .sort((a, b) => a.t - b.t);

  const ultimo = lista[lista.length - 1];
  const fin = Math.max(ahora, ultimo?.t ?? 0);
  const inicio = rangoMs ? ahora - rangoMs : lista[0]?.t ?? ahora - 60 * 60 * 1000;

  let estadoInicial = previo ? previo.estado : null;
  const visibles = [];
  for (const e of lista) {
    if (e.t < inicio) estadoInicial = e.estado;
    else visibles.push(e);
  }

  const segmentos = [];
  let cursorT = inicio;
  let cursorEstado = estadoInicial;
  for (const e of visibles) {
    if (cursorEstado !== null && e.t > cursorT) {
      segmentos.push({ inicio: cursorT, fin: e.t, estado: cursorEstado });
    }
    cursorT = Math.max(cursorT, e.t);
    cursorEstado = e.estado;
  }
  if (cursorEstado !== null && fin > cursorT) {
    segmentos.push({ inicio: cursorT, fin, estado: cursorEstado });
  }

  return { inicio, fin, segmentos, visibles };
}

function fechaLocalCSV(t) {
  const d = new Date(t);
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

function descargarCSV(filas, nombre) {
  const encabezado = 'fecha_hora,estado_anterior,estado,distancia_cm\n';
  const cuerpo = filas
    .map((f) => [
      fechaLocalCSV(f.t),
      f.estado_anterior === null ? '' : etiquetaEstado(f.estado_anterior),
      etiquetaEstado(f.estado),
      f.distancia_cm ?? '',
    ].join(','))
    .join('\n');
  const archivo = new Blob(['\ufeff' + encabezado + cuerpo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Insignia({ estado }) {
  if (estado === null || estado === undefined) {
    return <span className="insignia insignia-inicio">Inicio</span>;
  }
  return <span className={`insignia ${ESTADOS[estado]?.clase ?? 'error'}`}>{etiquetaEstado(estado)}</span>;
}

function formatearDistancia(valor) {
  const n = Number(valor);
  return valor === null || valor === undefined || !Number.isFinite(n) || n < 0 ? '--' : `${n.toFixed(1)} cm`;
}

export default function Historial() {
  const [rangoId, setRangoId] = useState('24h');
  const [filasVisibles, setFilasVisibles] = useState(FILAS_POR_PAGINA);
  const rango = RANGOS.find((r) => r.id === rangoId);

  const { eventos, previo, cargando, error, truncado, conexion } = useHistorial(rango.ms);
  const ahora = useNow(10000);

  useEffect(() => {
    document.title = 'Historial | Smart Parking';
  }, []);

  useEffect(() => {
    setFilasVisibles(FILAS_POR_PAGINA);
  }, [rangoId]);

  const { inicio, fin, segmentos, visibles } = useMemo(
    () => construirLinea(eventos, previo, rango.ms, ahora),
    [eventos, previo, rango.ms, ahora]
  );

  // Tiempo total en cada estado dentro del rango
  const tiempos = useMemo(() => {
    const total = segmentos.reduce((suma, s) => suma + (s.fin - s.inicio), 0);
    return ORDEN_ESTADOS.map((estado) => {
      const ms = segmentos
        .filter((s) => s.estado === estado)
        .reduce((suma, s) => suma + (s.fin - s.inicio), 0);
      return { estado, ms, porcentaje: total ? (ms / total) * 100 : 0 };
    });
  }, [segmentos]);

  // Tabla: más reciente primero, con cuánto duró cada estado
  const filas = useMemo(
    () => visibles
      .map((e, i) => ({ ...e, duracion: (visibles[i + 1]?.t ?? null) !== null ? visibles[i + 1].t - e.t : null }))
      .reverse(),
    [visibles]
  );

  const vacio = !cargando && eventos.length === 0 && !previo;

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Volver al monitor">
          <div className="brand-mark"><CarFront size={22} strokeWidth={2.2} /></div>
          <div>
            <span className="brand-name">SMART PARKING</span>
            <span className="brand-subtitle">HISTORIAL</span>
          </div>
        </a>
        <div className={`connection-pill ${conexion}`} role="status">
          {conexion === 'connected' ? <Wifi size={15} /> : conexion === 'disconnected' ? <WifiOff size={15} /> : <RefreshCw size={15} className="spin" />}
          <span>{TEXTO_CONEXION[conexion]}</span>
        </div>
      </header>

      <section className="intro">
        <a className="page-link" href="/"><ArrowLeft size={16} /> Volver al monitor</a>
        <div className="eyebrow"><History size={15} /> REGISTRO DE CAMBIOS</div>
        <h1>Historial de <span>estados</span></h1>
        <p>Cada vez que el espacio cambia de estado se guarda el día y la hora exactos.</p>
      </section>

      {conexion === 'configuration' && (
        <div className="notice notice-warning">
          Configura las variables de Supabase en el archivo <code>.env</code> para ver el historial.
        </div>
      )}
      {error && <div className="notice notice-warning">{error}</div>}
      {truncado && (
        <div className="notice notice-warning">
          Hay muchos cambios en este rango: se muestran los 2000 más recientes.
        </div>
      )}

      <div className="barra-rango">
        <div className="segmentado" role="group" aria-label="Rango de tiempo">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === rangoId ? 'activo' : ''}
              aria-pressed={r.id === rangoId}
              onClick={() => setRangoId(r.id)}
            >
              {r.texto}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="boton-secundario"
          disabled={visibles.length === 0}
          onClick={() => descargarCSV(visibles, `historial-estacionamiento-${rangoId}.csv`)}
        >
          <Download size={16} /> CSV
        </button>
      </div>

      <section className="panel panel-grafica">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">ESPACIO #01</span>
            <h3>Estado a lo largo del tiempo</h3>
          </div>
          <span className="contador-cambios">
            {cargando ? 'Cargando…' : `${visibles.length} ${visibles.length === 1 ? 'cambio' : 'cambios'}`}
          </span>
        </div>
        {vacio ? (
          <div className="grafica-vacia">
            Aún no hay cambios registrados. Ejecuta <code>supabase/historial_estados.sql</code> y espera a que el estado cambie.
          </div>
        ) : (
          <GraficaEstados segmentos={segmentos} puntos={visibles} inicio={inicio} fin={fin} />
        )}
      </section>

      <section className="tiempos-grid">
        {tiempos.map(({ estado, ms, porcentaje }) => (
          <article key={estado} className="tiempo-card">
            <div className="tiempo-cabecera">
              <span className="tiempo-punto" style={{ background: ESTADOS[estado].color }} />
              <span>{ESTADOS[estado].nombre}</span>
            </div>
            <strong>{porcentaje.toFixed(0)}%</strong>
            <small>{formatearDuracion(ms)}</small>
            <div className="tiempo-barra">
              <span style={{ width: `${porcentaje}%`, background: ESTADOS[estado].color }} />
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DETALLE</span>
            <h3>Cambios registrados</h3>
          </div>
        </div>

        {filas.length === 0 ? (
          <p className="tabla-vacia">{cargando ? 'Cargando…' : 'No hay cambios en este rango.'}</p>
        ) : (
          <>
            <div className="tabla-cambios" role="table" aria-label="Cambios de estado">
              <div className="fila-cambio encabezado" role="row">
                <span role="columnheader">Fecha y hora</span>
                <span role="columnheader">Cambio</span>
                <span role="columnheader">Distancia</span>
                <span role="columnheader">Duración</span>
              </div>
              {filas.slice(0, filasVisibles).map((f) => (
                <div className="fila-cambio" role="row" key={f.id ?? f.t}>
                  <span role="cell" className="celda-fecha">{formatoFechaHora.format(f.t)}</span>
                  <span role="cell" className="celda-cambio">
                    <Insignia estado={f.estado_anterior} />
                    <span className="flecha" aria-hidden="true">→</span>
                    <Insignia estado={f.estado} />
                  </span>
                  <span role="cell" className="celda-dato" data-etiqueta="Distancia">{formatearDistancia(f.distancia_cm)}</span>
                  <span role="cell" className="celda-dato" data-etiqueta="Duración">
                    {f.duracion === null ? 'En curso' : formatearDuracion(f.duracion)}
                  </span>
                </div>
              ))}
            </div>
            {filas.length > filasVisibles && (
              <button
                type="button"
                className="boton-secundario boton-mas"
                onClick={() => setFilasVisibles((n) => n + FILAS_POR_PAGINA)}
              >
                Mostrar más ({filas.length - filasVisibles} restantes)
              </button>
            )}
          </>
        )}
      </section>

      <footer className="footer">
        <span>SMART PARKING <span className="footer-separator">/</span> PROYECTO IoT</span>
        <span>Historial de estados</span>
      </footer>
    </main>
  );
}
