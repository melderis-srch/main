const BASE_URL = process.env.NEXT_PUBLIC_GAS_URL;

async function gasGet(action) {
  if (!BASE_URL) throw new Error('VITE_GAS_URL no configurada');
  const url = `${BASE_URL}?action=${action}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

async function gasPost(action, data) {
  if (!BASE_URL) throw new Error('VITE_GAS_URL no configurada');
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

export const gasClient = {
  getCirugias: () => gasGet('getCirugias'),
  getConsolidado: () => gasGet('getConsolidado'),
  getVentasCobros: () => gasGet('getVentasCobros'),
  getGastosPagos: () => gasGet('getGastosPagos'),

  updateCobrado: (rowIndex, fechaCobroReal) =>
    gasPost('updateCobrado', { rowIndex, fechaCobroReal }),

  updatePagado: (rowIndex) =>
    gasPost('updatePagado', { rowIndex }),

  addCirugia: (data) =>
    gasPost('addCirugia', data),

  registrarCobro: (data) =>
    gasPost('registrarCobro', data),
};
