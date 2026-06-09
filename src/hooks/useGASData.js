import { useState, useCallback } from 'react';
import { gasClient } from '../utils/gasClient';

export function useGASData() {
  const [data, setData] = useState({
    cirugias: [],
    consolidado: [],
    ventasCobros: [],
    gastosPagos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cirugias, consolidado, ventasCobros, gastosPagos] = await Promise.all([
        gasClient.getCirugias(),
        gasClient.getConsolidado(),
        gasClient.getVentasCobros(),
        gasClient.getGastosPagos(),
      ]);
      setData({ cirugias, consolidado, ventasCobros, gastosPagos });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refetch: fetchAll };
}
