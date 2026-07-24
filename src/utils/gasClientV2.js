// Cliente del backend v2 (planilla maestra + casoId).
// Convive con el cliente viejo (gasClient.js): las vistas ya migradas usan
// éste; las que faltan siguen con el viejo, hasta terminar la transición.
//
// URL en NEXT_PUBLIC_GAS_V2_URL (deploy de Code.v2.gs como Web App).
// Si no está seteada, cae al valor por defecto de abajo (el deploy actual),
// igual que hicimos con el módulo de recibos.
const V2_URL = process.env.NEXT_PUBLIC_GAS_V2_URL ||
  'https://script.google.com/macros/s/AKfycbwN251VD3Fmy1Y_U7M9YAaB2SCelbNVYyMciDdUetx8QQEsonv2pPf6gkISsVnDwYaCQg/exec';

async function v2Get(action) {
  const res = await fetch(`${V2_URL}?action=${action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

async function v2Post(action, data) {
  const res = await fetch(V2_URL, {
    method: 'POST',
    // text/plain evita el preflight CORS que Apps Script no responde.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error del servidor');
  return json.data;
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
