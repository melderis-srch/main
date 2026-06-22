'use client';
import { useState, useCallback } from 'react';
import { gasClient } from '../utils/gasClient';

export function useGASData() {
  const [data, setData] = useState({
    cirugias: [],
    consolidado: [],
    ventasCobros: [],
    gastosPagos: [],
    presupuestos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cirugias, consolidado, ventasCobros, gastosPagos, presupuestos] = await Promise.all([
        gasClient.getCirugias(),
        gasClient.getConsolidado(),
        gasClient.getVentasCobros(),
        gasClient.getGastosPagos(),
        gasClient.getPresupuestos(),
      ]);
      setData({ cirugias, consolidado, ventasCobros, gastosPagos, presupuestos });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refetch: fetchAll };
}
