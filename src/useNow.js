import { useEffect, useState } from 'react';

// Hora actual que se refresca cada `intervalMs`.
// Se usa solo en los componentes pequeños que muestran "hace X s",
// así el resto de la página no se vuelve a dibujar cada segundo.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
