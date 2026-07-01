// Enlace al módulo de recibos (Web App de Apps Script desplegada aparte).
// Se configura con NEXT_PUBLIC_RECIBOS_URL en .env.local — ver .env.example.
//
// IMPORTANTE: las env vars NEXT_PUBLIC_* se resuelven en tiempo de BUILD, no de
// runtime. Si cambiás la URL hay que rebuildeaar (npm run build) para que la tome.
// Por eso dejamos un valor por defecto: si el build no tomó la env var, el botón
// igual funciona con este deployment. Al redeployar el GAS de recibos y obtener
// una URL nueva, actualizá NEXT_PUBLIC_RECIBOS_URL y rebuildeá, o cambiá este valor.
const RECIBOS_URL_DEFAULT =
  'https://script.google.com/macros/s/AKfycby2hO_vIEh_OXSeRaRnGXsL085NkYjosOSw83N4xQF51DLgusiuaO_Jtaw-AweHRsAP/exec';
const RECIBOS_URL = process.env.NEXT_PUBLIC_RECIBOS_URL || RECIBOS_URL_DEFAULT;

// ¿Está configurada la URL del módulo de recibos?
export function recibosConfigurado() {
  return !!RECIBOS_URL;
}

// Construye la URL del recibo para una factura, con el N° precargado.
export function urlRecibo(nroFactura) {
  if (!RECIBOS_URL) return null;
  const sep = RECIBOS_URL.includes('?') ? '&' : '?';
  return `${RECIBOS_URL}${sep}factura=${encodeURIComponent((nroFactura ?? '').toString().trim())}`;
}

// Abre el módulo de recibos en una pestaña nueva con la factura ya cargada.
// Devuelve false si falta configurar NEXT_PUBLIC_RECIBOS_URL.
export function abrirRecibo(nroFactura) {
  const url = urlRecibo(nroFactura);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
