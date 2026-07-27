'use client';
import { useState, useCallback, useEffect } from 'react';
import { gasV2 } from '../utils/gasClientV2';

// Trae TODO el estado de la planilla maestra ya unido por casoId, en una sola
// llamada (getBootstrap). Lo usan las vistas ya migradas al modelo v2.
// Devuelve: casos, presupuestos, cirugias, facturas, cobros, pagos, ordenes,
// consolidado, además de loading/error/refetch.
export function useMasterData() {
  const [data, setData] = useState({
    casos: [], presupuestos: [], cirugias: [], facturas: [],
    cobros: [], pagos: [], ordenes: [], consolidado: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const boot = await gasV2.getBootstrap();
      const asArr = (x) => (Array.isArray(x) ? x : []);
      setData({
        casos:        asArr(boot.casos),
        presupuestos: asArr(boot.presupuestos),
        cirugias:     asArr(boot.cirugias),
        facturas:     asArr(boot.facturas),
        cobros:       asArr(boot.cobros),
        pagos:        asArr(boot.pagos),
        ordenes:      asArr(boot.ordenes),
        consolidado:  asArr(boot.consolidado),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
