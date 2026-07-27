// Cliente del backend v2 (planilla maestra + casoId).
// Convive con el cliente viejo (gasClient.js): las vistas ya migradas usan
// éste; las que faltan siguen con el viejo, hasta terminar la transición.
//
// URL en NEXT_PUBLIC_GAS_V2_URL (deploy de Code.v2.gs como Web App).
// Si no está seteada, cae al valor por defecto de abajo (el deploy actual),
// igual que hicimos con el módulo de recibos.
const V2_URL = process.env.NEXT_PUBLIC_GAS_V2_URL ||
  'https://script.google.com/macros/s/AKfycbwN251VD3Fmy1Y_U7M9YAaB2SCelbNVYyMciDdUetx8QQEsonv2pPf6gkISsVnDwYaCQg/exec';

// Timeout para no colgarse si Apps Script tarda demasiado.
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
  if (json.data && !Array.isArray(json.data) && typeof json.data === 'object' && json.data.error) {
    throw new Error(String(json.data.error));
  }
  return json.data;
}

async function v2Get(action) {
  return fetchJson(`${V2_URL}?action=${action}`);
}

async function v2Post(action, data) {
  return fetchJson(V2_URL, {
    method: 'POST',
    // text/plain evita el preflight CORS que Apps Script no responde.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data }),
  });
}

export const gasV2 = {
  // Una sola llamada trae todo el estado ya unido por casoId.
  getBootstrap: () => v2Get('getBootstrap'),

  // Cobros
  addCobro:    (data) => v2Post('addCobro', data),
  updateCobro: (rowIndex, fields) => v2Post('updateCobro', { rowIndex, fields }),
  registrarCobroCompleto: (data) => v2Post('registrarCobroCompleto', data),

  // Facturas
  addFactura:    (data) => v2Post('addFactura', data),
  updateFactura: (rowIndex, fields) => v2Post('updateFactura', { rowIndex, fields }),

  // Catálogos (Clientes / Productos en la maestra)
  getCatalogos:   () => v2Get('getCatalogos'),
  addProducto:    (data) => v2Post('addProducto', data),
  updateProducto: (rowIndex, fields) => v2Post('updateProducto', { rowIndex, fields }),
  addCliente:     (data) => v2Post('addCliente', data),
  updateCliente:  (rowIndex, fields) => v2Post('updateCliente', { rowIndex, fields }),
  importCatalogo: (data) => v2Post('importCatalogo', data),

  // Cirugías / presupuestos / pagos / OC (para las próximas vistas)
  addCirugia:       (data) => v2Post('addCirugia', data),
  updateCirugia:    (casoId, fields) => v2Post('updateCirugia', { casoId, fields }),
  addPresupuesto:   (data) => v2Post('addPresupuesto', data),
  updatePresupuesto:(rowIndex, fields) => v2Post('updatePresupuesto', { rowIndex, fields }),
  addPago:          (data) => v2Post('addPago', data),
  updatePago:       (rowIndex, fields) => v2Post('updatePago', { rowIndex, fields }),
  addOrden:         (data) => v2Post('addOrden', data),
  updateOrden:      (rowIndex, fields) => v2Post('updateOrden', { rowIndex, fields }),
};
