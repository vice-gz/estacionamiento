export const ESTADOS = {
  0: { nombre: 'Libre', color: '#4ade80', clase: 'free' },
  1: { nombre: 'Precaución', color: '#fbbf24', clase: 'warning' },
  2: { nombre: 'Ocupado', color: '#fb7185', clase: 'occupied' },
  3: { nombre: 'Sin lectura', color: '#94a3b8', clase: 'error' },
};

export const ORDEN_ESTADOS = [0, 1, 2, 3];

export function etiquetaEstado(estado) {
  return ESTADOS[estado]?.nombre ?? '—';
}

export function formatearDuracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

export const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const formatoHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
