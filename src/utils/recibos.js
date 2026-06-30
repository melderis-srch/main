// Enlace al módulo de recibos (Web App de Apps Script desplegada aparte).
// Se configura con NEXT_PUBLIC_RECIBOS_URL en .env.local — ver .env.example.
const RECIBOS_URL = process.env.NEXT_PUBLIC_RECIBOS_URL;

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
