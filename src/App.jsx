import {
  Activity, CarFront, Wifi, WifiOff, RefreshCw,
  CircleCheck, AlertTriangle, ShieldAlert, Clock3,
  Lightbulb, RadioTower, Cpu,
} from 'lucide-react';
import { useEstacionamiento } from './useEstacionamiento';
import { useNow } from './useNow';

// Deben coincidir con DISTANCIA_OCUPADO y DISTANCIA_LIBRE del ESP32
const DISTANCIA_OCUPADO = 20;
const DISTANCIA_LIBRE = 100;
const GAUGE_MAX = 150;

// El ESP32 manda un respaldo cada 30 s aunque no haya cambios.
// Si pasan más de 45 s sin datos, se considera sin señal.
const ESP32_TIMEOUT_MS = 30000;

const STATUS = {
  loading: {
    label: 'Cargando…',
    description: 'Leyendo el estado del espacio.',
    className: 'loading',
    Icon: RefreshCw,
  },
  0: {
    label: 'Libre',
    description: 'El espacio está disponible.',
    className: 'free',
    Icon: CircleCheck,
  },
  1: {
    label: 'Precaución',
    description: 'Hay un vehículo acercándose al sensor.',
    className: 'warning',
    Icon: AlertTriangle,
  },
  2: {
    label: 'Ocupado',
    description: 'El espacio está ocupado.',
    className: 'occupied',
    Icon: ShieldAlert,
  },
  3: {
    label: 'Sin lectura',
    description: 'El sensor no está devolviendo una distancia válida.',
    className: 'error',
    Icon: AlertTriangle,
  },
};

const CONNECTION_TEXT = {
  connected: 'En tiempo real',
  connecting: 'Conectando…',
  disconnected: 'Reconectando…',
  configuration: 'Falta configuración',
};

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

function toNumber(value) {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number) ? number : null;
}

function formatDistance(value) {
  const number = toNumber(value);
  return number === null || number < 0 ? '--' : number.toFixed(1);
}

function formatDate(timestamp) {
  if (!timestamp) return 'Sin datos todavía';
  return dateFormatter.format(new Date(timestamp));
}

function formatAgo(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return 'Justo ahora';
  if (seconds < 60) return `Hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

function parseTime(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/* ---------- Componentes que se refrescan cada segundo ---------- */

function LastUpdate({ timestamp }) {
  const now = useNow(1000);
  return (
    <>
      <div className="updated-value">
        <Clock3 size={17} />
        <span>{timestamp ? formatAgo(now - timestamp) : 'Sin datos todavía'}</span>
      </div>
      <p className="metric-caption">{timestamp ? formatDate(timestamp) : 'Esperando al ESP32'}</p>
    </>
  );
}

function DeviceLine({ timestamp }) {
  const now = useNow(1000);
  const online = timestamp !== null && now - timestamp < ESP32_TIMEOUT_MS;
  return (
    <div className="system-line">
      <span className={`system-dot ${online ? 'online' : 'offline'}`} />
      <div>
        <strong>{online ? 'ESP32 en línea' : 'ESP32 sin señal'}</strong>
        <small>
          {timestamp === null
            ? 'Todavía no se reciben datos del microcontrolador'
            : online
              ? 'Enviando lecturas con normalidad'
              : `Último dato ${formatAgo(now - timestamp).toLowerCase()}`}
        </small>
      </div>
    </div>
  );
}

/* ---------- Componentes estáticos ---------- */

function DistanceGauge({ distance }) {
  const value = toNumber(distance);
  const valid = value !== null && value >= 0;
  const percent = valid ? (Math.min(value, GAUGE_MAX) / GAUGE_MAX) * 100 : 0;

  return (
    <div
      className="gauge"
      role="meter"
      aria-label="Distancia al vehículo"
      aria-valuemin={0}
      aria-valuemax={GAUGE_MAX}
      aria-valuenow={valid ? Math.min(value, GAUGE_MAX) : undefined}
    >
      <div className="gauge-track">
        <span className="gauge-zone zone-occupied" style={{ width: `${(DISTANCIA_OCUPADO / GAUGE_MAX) * 100}%` }} />
        <span
          className="gauge-zone zone-warning"
          style={{ width: `${((DISTANCIA_LIBRE - DISTANCIA_OCUPADO) / GAUGE_MAX) * 100}%` }}
        />
        <span className="gauge-zone zone-free" />
        {valid && <span className="gauge-marker" style={{ left: `${percent}%` }} />}
      </div>
      <div className="gauge-labels">
        <span style={{ left: `${(DISTANCIA_OCUPADO / GAUGE_MAX) * 100}%` }}>{DISTANCIA_OCUPADO}</span>
        <span style={{ left: `${(DISTANCIA_LIBRE / GAUGE_MAX) * 100}%` }}>{DISTANCIA_LIBRE}</span>
        <span>{GAUGE_MAX}+</span>
      </div>
    </div>
  );
}

function Indicator({ label, state, color }) {
  const text = { on: 'Encendido', off: 'Apagado', blink: 'Parpadeando' }[state];
  return (
    <div className="indicator-row">
      <div className="indicator-label">
        <span className={`led-dot ${color} ${state !== 'off' ? 'is-on' : ''} ${state === 'blink' ? 'is-blinking' : ''}`} />
        <span>{label}</span>
      </div>
      <span className={`indicator-state ${state === 'off' ? 'off' : 'on'}`}>{text}</span>
    </div>
  );
}

function ConnectionIcon({ connection }) {
  if (connection === 'connected') return <Wifi size={15} />;
  if (connection === 'disconnected') return <WifiOff size={15} />;
  return <RefreshCw size={15} className={connection === 'connecting' ? 'spin' : ''} />;
}

/* ---------- Página ---------- */

export default function App() {
  const { data, connection, error, lastEventAt, pulse } = useEstacionamiento(1);

  const estado = data ? Number(data.estado) : null;
  const statusInfo = data ? STATUS[estado] || STATUS[3] : STATUS.loading;
  const StatusIcon = statusInfo.Icon;
  const connectionText = CONNECTION_TEXT[connection];

  // Momento del último dato: la hora del servidor o, si no existe, la de llegada
  const serverTime = parseTime(data?.actualizado_en);
  const lastActivity = serverTime || lastEventAt
    ? Math.max(serverTime ?? 0, lastEventAt ?? 0)
    : null;

  const ledVerde = !data?.led_verde ? 'off' : estado === 1 ? 'blink' : 'on';
  const ledRojo = data?.led_rojo ? 'on' : 'off';

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Smart Parking inicio">
          <div className="brand-mark"><CarFront size={22} strokeWidth={2.2} /></div>
          <div>
            <span className="brand-name">SMART PARKING</span>
            <span className="brand-subtitle">MONITOR IoT</span>
          </div>
        </a>

        <div className={`connection-pill ${connection}`} role="status">
          <ConnectionIcon connection={connection} />
          <span>{connectionText}</span>
        </div>
      </header>

      <section className="intro">
        <div className="eyebrow"><Activity size={15} /> SISTEMA DE MONITOREO</div>
        <h1>Estacionamiento <span>inteligente</span></h1>
        <p>Consulta el estado del espacio y las lecturas del sensor en tiempo real.</p>
      </section>

      {connection === 'configuration' && (
        <div className="notice notice-warning">
          Configura las variables de Supabase en el archivo <code>.env</code> para conectar el dashboard.
        </div>
      )}
      {error && connection !== 'configuration' && (
        <div className="notice notice-warning">{error}</div>
      )}

      <section className={`status-card ${statusInfo.className}`}>
        {/* Destello breve cada vez que llega un dato nuevo */}
        {pulse > 0 && <span key={pulse} className="update-flash" aria-hidden="true" />}

        <div className="status-card-top">
          <div className="status-heading" aria-live="polite">
            <span className="section-kicker">ESTADO DEL ESPACIO</span>
            <h2>{statusInfo.label}</h2>
            <p>{statusInfo.description}</p>
          </div>
          <div className="status-symbol">
            <StatusIcon size={34} strokeWidth={1.8} className={statusInfo.className === 'loading' ? 'spin' : ''} />
          </div>
        </div>
        <div className="status-card-bottom">
          <span><span className="pulse-dot" /> ESTADO ACTUAL</span>
          <span>ESPACIO #01</span>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card distance-card">
          <div className="metric-top">
            <div>
              <span className="section-kicker">DISTANCIA DETECTADA</span>
              <div className="metric-value">
                {formatDistance(data?.distancia_cm)}
                <small>cm</small>
              </div>
            </div>
            <div className="metric-icon"><RadioTower size={22} /></div>
          </div>
          <DistanceGauge distance={data?.distancia_cm} />
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <div className="metric-body">
              <span className="section-kicker">ÚLTIMA ACTUALIZACIÓN</span>
              <LastUpdate timestamp={lastActivity} />
            </div>
            <div className="metric-icon"><RefreshCw size={20} /></div>
          </div>
        </article>
      </section>

      <section className="lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">SALIDAS DEL SISTEMA</span>
              <h3>Indicadores LED</h3>
            </div>
            <div className="panel-icon"><Lightbulb size={19} /></div>
          </div>
          <div className="indicators">
            <Indicator label="LED verde" state={ledVerde} color="green" />
            <Indicator label="LED rojo" state={ledRojo} color="red" />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ESTADO DE COMUNICACIÓN</span>
              <h3>Conexión del sistema</h3>
            </div>
            <div className="panel-icon"><Cpu size={19} /></div>
          </div>
          <div className="system-line">
            <span className={`system-dot ${connection === 'connected' ? 'online' : 'offline'}`} />
            <div>
              <strong>Supabase: {connectionText.toLowerCase()}</strong>
              <small>
                {connection === 'connected'
                  ? 'Los cambios llegan al instante'
                  : 'Consultando la base de datos mientras se recupera la conexión'}
              </small>
            </div>
          </div>
          <DeviceLine timestamp={lastActivity} />
        </article>
      </section>

      <footer className="footer">
        <span>SMART PARKING <span className="footer-separator">/</span> PROYECTO IoT</span>
        <span>Monitoreo de estacionamiento</span>
      </footer>
    </main>
  );
}
