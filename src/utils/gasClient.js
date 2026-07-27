const BASE_URL = process.env.NEXT_PUBLIC_GAS_URL;

const TIMEOUT_MS = 60000;
async function fetchJson(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder. Reintentá.');
    throw e;
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch (e) { throw new Error('Respuesta inesperada del servidor (¿sesión de Google vencida?). Reintentá.'); }
  if (!json.success) throw new Error(json.error || 'Error del servidor');
  // Algunos backends responden success:true pero con { error } adentro cuando
  // no reconocen la acción. Lo tratamos como error para no romper los .forEach/.map.
  if (json.data && !Array.isArray(json.data) && typeof json.data === 'object' && json.data.error) {
    throw new Error(String(json.data.error));
  }
  return json.data;
}

async function gasGet(action) {
  if (!BASE_URL) throw new Error('VITE_GAS_URL no configurada');
  return fetchJson(`${BASE_URL}?action=${action}`);
}

async function gasPost(action, data) {
  if (!BASE_URL) throw new Error('VITE_GAS_URL no configurada');
  return fetchJson(BASE_URL, {
    method: 'POST',
    // text/plain evita el preflight CORS (OPTIONS) que Apps Script no responde;
    // el backend igual parsea el body como JSON sin importar el Content-Type.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data }),
  });
}

export const gasClient = {
  getCirugias: () => gasGet('getCirugias'),
  getConsolidado: () => gasGet('getConsolidado'),
  getVentasCobros: () => gasGet('getVentasCobros'),
  getGastosPagos: () => gasGet('getGastosPagos'),
  getPresupuestos: () => gasGet('getPresupuestos'),

  updateCobrado: (rowIndex, fechaCobro) =>
    gasPost('updateCobrado', { rowIndex, fechaCobro }),

  updatePagado: (rowIndex) =>
    gasPost('updatePagado', { rowIndex }),

  addCirugia: (data) =>
    gasPost('addCirugia', data),

  registrarCobro: (data) =>
    gasPost('registrarCobro', data),

  updateCirugia: (rowIndex, fields) => gasPost('updateCirugia', { rowIndex, fields }),
  updateCobro: (rowIndex, fields) => gasPost('updateCobro', { rowIndex, fields }),
  updateGasto: (rowIndex, fields) => gasPost('updateGasto', { rowIndex, fields }),
  registrarGasto: (data) => gasPost('registrarGasto', data),

  addPresupuesto: (data) => gasPost('addPresupuesto', data),
  updatePresupuesto: (rowIndex, fields) => gasPost('updatePresupuesto', { rowIndex, fields }),
};
