import { useEffect, useRef, useState } from 'react';
import { ESTADOS, ORDEN_ESTADOS, formatearDuracion, formatoFechaHora } from './estados';

const MARGEN = { top: 18, right: 18, bottom: 36 };
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const PASOS = [
  MINUTO, 5 * MINUTO, 15 * MINUTO, 30 * MINUTO,
  HORA, 3 * HORA, 6 * HORA, 12 * HORA,
  DIA, 2 * DIA, 7 * DIA, 14 * DIA, 30 * DIA,
];

const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function marcasTiempo(inicio, fin, maxMarcas) {
  const span = fin - inicio;
  const paso = PASOS.find((p) => span / p <= maxMarcas) ?? PASOS[PASOS.length - 1];
  // Alinear las marcas a la hora local (ej. 14:00, 15:00 o medianoche)
  const local = -new Date(inicio).getTimezoneOffset() * MINUTO;
  const marcas = [];
  for (let t = Math.ceil((inicio + local) / paso) * paso - local; t <= fin; t += paso) {
    marcas.push(t);
  }
  const conDia = span > 20 * HORA;
  const formato = (t) => {
    if (paso >= DIA) return fmtDia.format(t);
    if (!conDia) return fmtHora.format(t);
    return `${fmtDia.format(t)} ${fmtHora.format(t)}`;
  };
  return marcas.map((t) => ({ t, texto: formato(t) }));
}

/**
 * Gráfica escalonada del estado en el tiempo, al estilo de ThingSpeak.
 * segmentos: [{ inicio, fin, estado }]   puntos: [{ t, estado }]
 */
export default function GraficaEstados({ segmentos, puntos, inicio, fin }) {
  const contenedor = useRef(null);
  const [ancho, setAncho] = useState(640);
  const [cursor, setCursor] = useState(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      setAncho(Math.max(280, Math.round(entrada.contentRect.width)));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const angosto = ancho < 480;
  const alto = angosto ? 230 : 280;
  const izquierda = angosto ? 82 : 100;
  const anchoArea = ancho - izquierda - MARGEN.right;
  const altoArea = alto - MARGEN.top - MARGEN.bottom;
  const span = Math.max(1, fin - inicio);

  const x = (t) => izquierda + ((t - inicio) / span) * anchoArea;
  const y = (estado) => MARGEN.top + altoArea - (estado / 3) * altoArea;

  // Línea escalonada
  let trazo = '';
  segmentos.forEach((s, i) => {
    const anterior = segmentos[i - 1];
    trazo += !anterior || anterior.fin !== s.inicio
      ? `M${x(s.inicio)},${y(s.estado)}`
      : `V${y(s.estado)}`;
    trazo += `H${x(s.fin)}`;
  });

  const marcas = marcasTiempo(inicio, fin, Math.max(2, Math.floor(anchoArea / (angosto ? 80 : 110))));

  const moverCursor = (evento) => {
    const caja = evento.currentTarget.getBoundingClientRect();
    const px = ((evento.clientX - caja.left) / caja.width) * ancho;
    if (px < izquierda || px > izquierda + anchoArea) {
      setCursor(null);
      return;
    }
    const t = inicio + ((px - izquierda) / anchoArea) * span;
    const segmento = segmentos.find((s) => t >= s.inicio && t <= s.fin);
    setCursor(segmento ? { t, segmento } : null);
  };

  const idRecorte = 'recorte-grafica-estados';

  return (
    <div className="grafica" ref={contenedor}>
      {segmentos.length === 0 ? (
        <div className="grafica-vacia" style={{ height: alto }}>
          Sin cambios de estado en este rango.
        </div>
      ) : (
        <>
          <svg
            width={ancho}
            height={alto}
            viewBox={`0 0 ${ancho} ${alto}`}
            onPointerMove={moverCursor}
            onPointerDown={moverCursor}
            onPointerLeave={() => setCursor(null)}
            role="img"
            aria-label="Gráfica del estado del espacio a lo largo del tiempo"
          >
            <defs>
              <clipPath id={idRecorte}>
                <rect x={izquierda} y={MARGEN.top - 6} width={anchoArea} height={altoArea + 12} />
              </clipPath>
            </defs>

            {/* Líneas horizontales y etiquetas de cada estado */}
            {ORDEN_ESTADOS.map((estado) => (
              <g key={estado}>
                <line
                  className="grafica-guia"
                  x1={izquierda} x2={izquierda + anchoArea}
                  y1={y(estado)} y2={y(estado)}
                />
                {!angosto && <circle cx={izquierda - 12} cy={y(estado)} r={4} fill={ESTADOS[estado].color} />}
                <text
                  className="grafica-texto"
                  x={izquierda - (angosto ? 8 : 22)}
                  y={y(estado)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={angosto ? { fill: ESTADOS[estado].color } : undefined}
                >
                  {ESTADOS[estado].nombre}
                </text>
              </g>
            ))}

            {/* Eje de tiempo */}
            <line
              className="grafica-eje"
              x1={izquierda} x2={izquierda + anchoArea}
              y1={MARGEN.top + altoArea + 8} y2={MARGEN.top + altoArea + 8}
            />
            {marcas.map(({ t, texto }) => (
              <g key={t}>
                <line
                  className="grafica-eje"
                  x1={x(t)} x2={x(t)}
                  y1={MARGEN.top + altoArea + 8} y2={MARGEN.top + altoArea + 13}
                />
                <text className="grafica-texto" x={x(t)} y={alto - 6} textAnchor="middle">
                  {texto}
                </text>
              </g>
            ))}

            <g clipPath={`url(#${idRecorte})`}>
              <path className="grafica-linea" d={trazo} />
              {puntos.map((p) => (
                <circle
                  key={p.id ?? p.t}
                  className="grafica-punto"
                  cx={x(p.t)}
                  cy={y(p.estado)}
                  r={angosto ? 3.5 : 4}
                  fill={ESTADOS[p.estado]?.color ?? '#94a3b8'}
                />
              ))}
            </g>

            {cursor && (
              <line
                className="grafica-cursor"
                x1={x(cursor.t)} x2={x(cursor.t)}
                y1={MARGEN.top} y2={MARGEN.top + altoArea}
              />
            )}
          </svg>

          {cursor && (
            <div
              className="grafica-tooltip"
              style={{
                left: Math.min(Math.max(x(cursor.t), 90), ancho - 90),
              }}
            >
              <strong style={{ color: ESTADOS[cursor.segmento.estado]?.color }}>
                {ESTADOS[cursor.segmento.estado]?.nombre}
              </strong>
              <span>Desde {formatoFechaHora.format(cursor.segmento.inicio)}</span>
              <span>Duró {formatearDuracion(cursor.segmento.fin - cursor.segmento.inicio)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
