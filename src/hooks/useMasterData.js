'use client';
import { useState, useCallback, useEffect } from 'react';
import { gasV2 } from '../utils/gasClientV2';

// Trae TODO el estado de la planilla maestra ya unido por casoId, en una sola
// llamada (getBootstrap). Lo usan las vistas migradas al modelo v2.
//
// PERF: getBootstrap es pesado (lee toda la maestra). Para no pedirlo de nuevo
// en cada vista/navegación, cacheamos el resultado a nivel de módulo y
// deduplicamos las llamadas simultáneas. refetch(true) fuerza recarga (p.ej.
// después de guardar). El usuario puede recargar la página para datos frescos.

const EMPTY = {
  casos: [], presupuestos: [], cirugias: [], facturas: [],
  cobros: [], pagos: [], ordenes: [], consolidado: [],
};

let _cache = null;     // último resultado
let _inflight = null;  // promesa en curso (para deduplicar)

const asArr = (x) => (Array.isArray(x) ? x : []);

function fetchBootstrap(force) {
  if (_cache && !force) return Promise.resolve(_cache);
  if (!_inflight) {
    _inflight = gasV2.getBootstrap()
      .then((boot) => {
        const d = {
          casos:        asArr(boot.casos),
          presupuestos: asArr(boot.presupuestos),
          cirugias:     asArr(boot.cirugias),
          facturas:     asArr(boot.facturas),
          cobros:       asArr(boot.cobros),
          pagos:        asArr(boot.pagos),
          ordenes:      asArr(boot.ordenes),
          consolidado:  asArr(boot.consolidado),
        };
        _cache = d;
        _inflight = null;
        return d;
      })
      .catch((err) => { _inflight = null; throw err; });
  }
  return _inflight;
}

export function useMasterData() {
  const [data, setData] = useState(() => _cache || EMPTY);
  const [loading, setLoading] = useState(() => !_cache);
  const [error, setError] = useState(null);

  const load = useCallback(async (force) => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchBootstrap(!!force);
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (_cache) { setData(_cache); setLoading(false); }
    else load(false);
  }, [load]);

  return { data, loading, error, refetch: () => load(true) };
}
