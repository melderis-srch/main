// ============================================================
// Generador de PDF del presupuesto (diseño v4) + cálculo de IVA
// ============================================================
// El PDF se arma como HTML y se abre en una ventana de impresión;
// desde ahí se imprime o se guarda como PDF. No depende del backend.
// ============================================================

// Alícuotas de IVA disponibles en el selector del presupuesto.
// El precio que se carga es SIEMPRE el FINAL (con IVA incluido);
// el desglose se calcula "hacia atrás" y de forma UNIFORME sobre el
// total, sin mirar el gravado producto por producto (decisión de negocio).
export const ALICUOTAS = [
  { id: 'ri21',   label: 'Responsable Inscripto 21%',   rate: 0.21,  condicion: 'Responsable Inscripto' },
  { id: 'ri105',  label: 'Responsable Inscripto 10,5%', rate: 0.105, condicion: 'Responsable Inscripto' },
  { id: 'ri0',    label: 'Responsable Inscripto 0%',    rate: 0,     condicion: 'Responsable Inscripto' },
  { id: 'exento', label: 'Exento',                      rate: 0,     condicion: 'Exento' },
  { id: 'cf',     label: 'Consumidor Final',            rate: 0,     condicion: 'Consumidor Final' },
];

export function alicuotaById(id) {
  return ALICUOTAS.find((a) => a.id === id) || ALICUOTAS[0];
}

// Formato de moneda argentino con centavos: 1800000.01 → "1.800.000,01"
export function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Calcula totales del presupuesto a partir de los renglones y la alícuota.
// Cada renglón: { cantidad, precioUnitario } con precioUnitario = precio FINAL.
export function calcularTotales(items, alicuotaId) {
  const alic = alicuotaById(alicuotaId);
  const total = items.reduce((s, it) => {
    const cant = Number(it.cantidad) || 0;
    const pu = Number(it.precioUnitario) || 0;
    return s + cant * pu;
  }, 0);
  const neto = alic.rate > 0 ? total / (1 + alic.rate) : total;
  const iva = total - neto;
  return { total, neto, iva, rate: alic.rate, alic };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Construye el HTML completo del presupuesto (diseño v4).
export function buildPresupuestoHTML(p) {
  const {
    numero, fecha, cliente, cirugia, items, alicuotaId,
    condiciones, servicioIncluido,
  } = p;
  const t = calcularTotales(items, alicuotaId);
  const nItems = items.length;
  const showIva = t.rate > 0;

  const rowsHTML = items.map((it) => {
    const cant = Number(it.cantidad) || 0;
    const pu = Number(it.precioUnitario) || 0;
    const sub = cant * pu;
    const sinCargo = pu === 0;
    const meta = [];
    if (it.marca)   meta.push(`<span class="m"><span class="k">Marca</span><span class="v">${esc(it.marca)}</span></span>`);
    if (it.origen)  meta.push(`<span class="m"><span class="k">Origen</span><span class="v">${esc(it.origen)}</span></span>`);
    const alt = it.alternativa
      ? `<span class="m alt"><span class="k">Alternativa</span><span class="v">${esc(it.alternativa)}</span></span>` : '';
    const extra = it.detalle ? `<div class="d-extra">${esc(it.detalle)}</div>` : '';
    return `
      <tr>
        <td class="c-cant">${cant.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="c-cod">${esc(it.codigo || '')}</td>
        <td class="c-prod">
          <div class="d-name">${esc(it.denominacion || '')}</div>
          ${meta.length ? `<div class="d-meta">${meta.join('')}</div>` : ''}
          ${alt ? `<div class="d-meta">${alt}</div>` : ''}
          ${extra}
        </td>
        <td class="c-pu">${sinCargo ? '0,00' : fmtMoney(pu)}</td>
        <td class="c-sub ${sinCargo ? 'sincargo' : ''}">${sinCargo ? 'Sin cargo' : fmtMoney(sub)}</td>
      </tr>`;
  }).join('');

  const cond = condiciones || {};
  const servicio = servicioIncluido || 'Instrumental y descartables en quirófano · Asistencia técnica de instrumentador quirúrgico en cirugía.';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Presupuesto N° ${esc(numero)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --paper:#fff; --panel:#F5F7FB; --ink:#1B2230; --muted:#6E7686;
    --line:#E4E8F0; --line-strong:#D2D9E6;
    --blue:#2F55B0; --blue-soft:#E9EEFA; --blue-line:#C3D2F0; --blue-deep:#22448F;
    --orange:#D65E29; --orange-soft:#FBECE1; --orange-line:#F1CBB0; --ok:#2E7D5B;
  }
  html,body{background:#fff;color:var(--ink);font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.4}
  .page{max-width:820px;margin:0 auto;padding:34px 40px}
  .head{display:flex;justify-content:space-between;align-items:flex-start}
  .brand{font-size:34px;font-weight:800;letter-spacing:-.5px}
  .brand .b1{color:var(--orange)} .brand .b2{color:var(--blue)}
  .doc-meta{text-align:right}
  .doc-meta .lbl{font-size:12px;font-weight:700;letter-spacing:.22em;color:var(--blue)}
  .doc-meta .num{font-size:26px;font-weight:800}
  .doc-meta .fecha{font-size:12px;color:var(--muted);margin-top:2px}
  .noval{display:inline-block;margin-top:8px;font-size:10px;font-weight:700;letter-spacing:.08em;
    color:var(--muted);border:1px dashed var(--line-strong);border-radius:4px;padding:4px 10px}
  .emisor{margin-top:8px}
  .emisor .name{font-weight:700}
  .emisor .addr{color:#4A4740;font-size:12px}
  .fiscal{margin-top:16px;display:flex;flex-wrap:wrap;gap:6px 22px;font-size:11.5px;color:#4A4740}
  .fiscal b{color:var(--ink)}
  .rule{height:3px;background:var(--blue);border-radius:2px;margin:14px 0 18px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
  .card .lbl{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);margin-bottom:8px}
  .card .big{font-size:17px;font-weight:700}
  .card .sub{font-size:12.5px;color:#4A4740;margin-top:2px}
  .card .doc{font-size:12.5px;color:#4A4740;margin-top:6px}
  .card .doc span{color:var(--muted)}
  .card .pill-iva{display:inline-block;margin-top:10px;font-size:11.5px;font-weight:700;color:var(--blue);
    background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:20px;padding:3px 12px}
  .kv{display:flex;gap:8px;font-size:12.5px;margin-top:6px}
  .kv .k{color:var(--muted);min-width:78px} .kv .v{font-weight:700}
  table.items{width:100%;border-collapse:collapse;margin-top:22px}
  table.items thead th{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);
    text-align:left;padding:0 10px 8px;border-bottom:1px solid var(--line-strong)}
  table.items th.c-pu,table.items th.c-sub{text-align:right}
  table.items td{padding:12px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  .c-cant{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
  .c-cod{color:var(--muted);font-variant-numeric:tabular-nums}
  .d-name{font-weight:700}
  .d-extra{font-size:12px;color:#4A4740;margin-top:4px}
  .d-meta{margin-top:8px;display:flex;flex-wrap:wrap;gap:4px 22px;font-size:11.5px;color:#4A4740}
  .d-meta .m .k{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:7px}
  .d-meta .m .v{color:#3D3833}
  .d-meta .m.alt{padding-left:14px;border-left:2px solid var(--orange-line)}
  .d-meta .m.alt .k{color:var(--orange)}
  .c-pu,.c-sub{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .c-sub{font-weight:700}
  .c-sub.sincargo{color:var(--ok)}
  .servicio{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:14px;
    background:var(--blue-soft);border:1px solid var(--blue-line);border-left:4px solid var(--blue);
    border-radius:8px;padding:12px 16px}
  .servicio .sv-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue)}
  .servicio .sv-txt{font-size:12px;color:#3A4360;line-height:1.4;margin-top:3px}
  .servicio .sv-tag{font-size:11px;font-weight:700;color:var(--ok);white-space:nowrap}
  .totales{margin-top:22px;margin-left:auto;width:340px}
  .totales .trow{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:#4A4740}
  .totales .trow .v{font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink)}
  .grand{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:14px 18px;
    background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:10px}
  .grand .gl{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}
  .grand .gv{font-size:22px;font-weight:800;color:var(--blue-deep);font-variant-numeric:tabular-nums}
  .cond{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:34px;padding-top:18px;border-top:1px solid var(--line)}
  .cond .ct{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:4px}
  .cond .cv{font-size:12.5px;color:#3D3833}
  .anmat{margin-top:24px;padding-top:14px;border-top:1px solid var(--line);text-align:center;font-size:11px;color:var(--muted)}
  @media print{.page{padding:0}}
</style></head>
<body>
  <div class="page">
    <div class="head">
      <div>
        <div class="brand"><span class="b1">Surch</span><span class="b2">ĕrie</span></div>
        <div class="emisor">
          <div class="name">de Cobelli Gustavo y Salami Hugo S.H.</div>
          <div class="addr">San Martín 4041 · 3000 Santa Fe · Tel/Fax (0342) 456 3173</div>
          <div class="addr">ventas@surcherie.com.ar</div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="lbl">PRESUPUESTO</div>
        <div class="num">N° ${esc(numero)}</div>
        <div class="fecha">Fecha <b>${esc(fecha)}</b></div>
        <div class="noval">NO VÁLIDO COMO FACTURA</div>
      </div>
    </div>

    <div class="fiscal">
      <span><b>IVA</b> Responsable Inscripto</span>
      <span><b>CUIT</b> 30-70932838-3</span>
      <span><b>Ing. Brutos</b> CM 921-554855-1</span>
      <span><b>Inicio act.</b> 01/09/2005</span>
    </div>

    <div class="rule"></div>

    <div class="parties">
      <div class="card">
        <div class="lbl">Cliente</div>
        <div class="big">${esc(cliente.denominacion || '—')}</div>
        ${cliente.direccion ? `<div class="sub">${esc(cliente.direccion)}${cliente.localidad ? ' — ' + esc(cliente.localidad) : ''}</div>` : ''}
        ${cliente.cuit ? `<div class="doc"><span>CUIT</span> &nbsp;${esc(cliente.cuit)}</div>` : ''}
        ${cliente.condicionIva ? `<div class="pill-iva">Condición IVA: ${esc(cliente.condicionIva)}</div>` : ''}
      </div>
      <div class="card">
        <div class="lbl">Cirugía</div>
        <div class="big">${esc(cirugia.paciente || '—')}</div>
        ${cirugia.medico ? `<div class="doc"><span>Médico</span> &nbsp;${esc(cirugia.medico)}</div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c-cant">Cant.</th>
          <th class="c-cod">Cód.</th>
          <th class="c-prod">Producto</th>
          <th class="c-pu">P. Unitario</th>
          <th class="c-sub">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>

    ${servicio ? `
    <div class="servicio">
      <div>
        <div class="sv-lbl">Servicio incluido</div>
        <div class="sv-txt">${esc(servicio)}</div>
      </div>
      <span class="sv-tag">Sin cargo</span>
    </div>` : ''}

    <div class="totales">
      <div class="trow"><span>Subtotal (${nItems} ${nItems === 1 ? 'ítem' : 'ítems'})</span><span class="v">${fmtMoney(t.total)}</span></div>
      ${showIva ? `
      <div class="trow"><span>Neto gravado</span><span class="v">${fmtMoney(t.neto)}</span></div>
      <div class="trow"><span>IVA ${(t.rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span><span class="v">${fmtMoney(t.iva)}</span></div>` : ''}
      <div class="grand"><span class="gl">Total</span><span class="gv">$ ${fmtMoney(t.total)}</span></div>
    </div>

    <div class="cond">
      <div><div class="ct">Plazo de entrega</div><div class="cv">${esc(cond.entrega || 'A coordinar con el cirujano interviniente.')}</div></div>
      <div><div class="ct">Mantenimiento de la oferta</div><div class="cv">${esc(cond.validez || '15 días corridos desde la fecha.')}</div></div>
      <div><div class="ct">Condiciones de pago</div><div class="cv">${esc(cond.pago || '30 días fecha factura.')}</div></div>
    </div>

    <div class="anmat">Establecimiento habilitado por ANMAT · Disposición N.° 9212/15 · Hoja 1 de 1</div>
  </div>
</body></html>`;
}

// Abre el presupuesto en una ventana nueva y dispara el diálogo de impresión
// (desde ahí se guarda como PDF).
export function imprimirPresupuesto(p) {
  const html = buildPresupuestoHTML(p);
  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para imprimir el presupuesto.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Pequeño delay para que renderice antes de imprimir.
  setTimeout(() => { try { w.print(); } catch (e) { /* noop */ } }, 350);
}
