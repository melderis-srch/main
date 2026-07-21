// ============================================================
// Generador de PDF del presupuesto (diseño minimalista) + IVA
// ============================================================
// Estética limpia y elegante: mucho aire, hairlines finas, sin
// recuadros ni colores fuertes. Estructura profesional: columnas
// Cant · Descripción · Unitario · Unit. Neto · IVA · Total, desglose
// por renglón e importe en letras. El PDF se arma como HTML y se abre
// en una ventana de impresión (imprimir o guardar como PDF).
// ============================================================

// Alícuotas de IVA. El precio cargado es SIEMPRE el FINAL (con IVA);
// el desglose se calcula "hacia atrás" y de forma UNIFORME.
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

// Totales del presupuesto. precioUnitario = precio FINAL (con IVA).
export function calcularTotales(items, alicuotaId) {
  const alic = alicuotaById(alicuotaId);
  const total = items.reduce((s, it) => {
    return s + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0);
  }, 0);
  const neto = alic.rate > 0 ? total / (1 + alic.rate) : total;
  const iva = total - neto;
  return { total, neto, iva, rate: alic.rate, alic };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Número a letras (español, para la línea "Son:") ──
function numeroALetras(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'CERO';
  const UNI = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const DEC = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function menor1000(x) {
    if (x === 0) return '';
    if (x === 100) return 'CIEN';
    let out = '';
    const c = Math.floor(x / 100), resto = x % 100;
    if (c) out += CEN[c] + ' ';
    if (resto < 30) out += UNI[resto];
    else {
      const d = Math.floor(resto / 10), u = resto % 10;
      out += DEC[d] + (u ? ' Y ' + UNI[u] : '');
    }
    return out.trim();
  }
  let out = '';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  if (millones) out += (millones === 1 ? 'UN MILLON' : menor1000(millones) + ' MILLONES') + ' ';
  if (miles) out += (miles === 1 ? 'MIL' : menor1000(miles) + ' MIL') + ' ';
  if (resto) out += menor1000(resto);
  return out.trim();
}

// Logo: si p.logoDataUri está seteado, se usa esa imagen; si no, wordmark.
function logoHTML(logoDataUri) {
  if (logoDataUri) {
    return `<img src="${logoDataUri}" alt="Surchérie" style="height:46px;display:block">`;
  }
  return `<div class="brand"><span class="b1">Surch</span><span class="b2">ĕrie</span></div>
          <div class="brand-sub">Implantes quirúrgicos</div>`;
}

// Construye el HTML completo del presupuesto (diseño minimalista).
export function buildPresupuestoHTML(p) {
  const {
    numero, fecha, cliente, cirugia, items, alicuotaId,
    condiciones, servicioIncluido, notas, logoDataUri,
  } = p;
  const t = calcularTotales(items, alicuotaId);
  const rate = t.rate;
  const cond = condiciones || {};
  const rows = items.filter((it) => it.denominacion);

  const rowsHTML = rows.map((it) => {
    const cant = Number(it.cantidad) || 0;
    const unit = Number(it.precioUnitario) || 0;
    const lineTotal = cant * unit;
    const unitNeto = rate > 0 ? unit / (1 + rate) : unit;
    const lineNeto = unitNeto * cant;
    const lineIva = lineTotal - lineNeto;
    const sinCargo = unit === 0;
    const metaParts = [];
    if (it.marca) metaParts.push(esc(it.marca));
    if (it.origen) metaParts.push(esc(it.origen));
    const metaLine = metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : '';
    const altLine = it.alternativa ? `<div class="meta alt">Alternativa: ${esc(it.alternativa)}</div>` : '';
    const detLine = it.detalle ? `<div class="meta">${esc(it.detalle)}</div>` : '';
    return `
      <tr>
        <td class="c-cant">${cant}</td>
        <td class="c-desc">
          <div class="name">${esc(it.denominacion)}</div>
          ${metaLine}${altLine}${detLine}
        </td>
        <td class="num">${sinCargo ? '—' : fmtMoney(unit)}</td>
        <td class="num muted">${sinCargo ? '—' : fmtMoney(unitNeto)}</td>
        <td class="num muted">${sinCargo || rate === 0 ? '—' : fmtMoney(lineIva)}</td>
        <td class="num tot">${sinCargo ? 'Sin cargo' : fmtMoney(lineTotal)}</td>
      </tr>`;
  }).join('');

  const enLetras = 'Son ' + numeroALetras(t.total) + ' pesos';
  const servicio = servicioIncluido || '';
  const notaExtra = notas || '';
  const ivaLbl = rate > 0 ? ' ' + (rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%' : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Presupuesto N° ${esc(numero)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;color:#22262E;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.4;-webkit-font-smoothing:antialiased}
  .page{max-width:800px;margin:0 auto;padding:46px 44px}
  .muted{color:#8A9099}
  .num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}

  /* Encabezado */
  .head{display:flex;justify-content:space-between;align-items:flex-start}
  .brand{font-size:27px;font-weight:800;letter-spacing:-.5px;line-height:1}
  .brand .b1{color:#D65E29}.brand .b2{color:#D65E29}
  .brand-sub{font-size:9px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#96877E;margin-top:5px}
  .doc{text-align:right}
  .doc .lbl{font-size:10px;font-weight:700;letter-spacing:.24em;color:#9AA0A8}
  .doc .num-big{font-size:23px;font-weight:800;margin-top:2px}
  .doc .fecha{font-size:12px;color:#8A9099;margin-top:2px}
  .emisor{margin-top:14px;font-size:10.5px;color:#8A9099;line-height:1.6}
  .hair{height:1px;background:#ECEEF1;margin:16px 0 0}

  /* Partes */
  .parties{display:flex;gap:48px;margin-top:22px}
  .party .k{font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#A2A8B0;margin-bottom:5px}
  .party .v{font-size:14px;font-weight:700}
  .party .x{font-size:11.5px;color:#8A9099;margin-top:3px}

  /* Tabla */
  table.items{width:100%;border-collapse:collapse;margin-top:30px}
  table.items thead th{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#A2A8B0;
    text-align:left;padding:0 0 10px;border-bottom:1px solid #E3E6EA}
  table.items thead th.num{text-align:right}
  table.items tbody td{padding:14px 0;border-bottom:1px solid #F1F3F5;vertical-align:top}
  td.c-cant{width:42px;font-weight:700;font-variant-numeric:tabular-nums}
  td.c-desc{padding-right:20px}
  .c-desc .name{font-size:13px;font-weight:700}
  .c-desc .meta{font-size:11px;color:#8A9099;margin-top:3px}
  .c-desc .meta.alt{color:#B4744C}
  table.items td.num{padding-left:14px}
  td.tot{font-weight:700}
  .c-sincargo{color:#2E7D5B}

  /* Totales */
  .foot{display:flex;justify-content:space-between;align-items:flex-start;margin-top:26px;gap:30px}
  .notas{flex:1;font-size:11px;color:#8A9099;line-height:1.7;padding-top:4px}
  .notas b{color:#5A6068}
  .totales{width:300px}
  .totales .tr{display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;color:#6A7079}
  .totales .tr .v{font-variant-numeric:tabular-nums;font-weight:600;color:#22262E}
  .totales .grand{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:12px;border-top:1.5px solid #22262E}
  .totales .grand .gl{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6A7079}
  .totales .grand .gv{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}

  .enletras{margin-top:16px;font-size:11px;font-style:italic;color:#8A9099}

  .cond{display:flex;gap:40px;margin-top:34px;padding-top:18px;border-top:1px solid #ECEEF1}
  .cond .k{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#A2A8B0;margin-bottom:4px}
  .cond .v{font-size:12px}
  .servicio{margin-top:18px;font-size:10.5px;font-style:italic;color:#9AA0A8}
  .anmat{margin-top:8px;font-size:9.5px;color:#B2B7BE;text-align:center;letter-spacing:.02em}
  @media print{.page{padding:10px}}
</style></head>
<body>
  <div class="page">
    <div class="head">
      <div>${logoHTML(logoDataUri)}</div>
      <div class="doc">
        <div class="lbl">PRESUPUESTO</div>
        <div class="num-big">N° ${esc(numero)}</div>
        <div class="fecha">${esc(fecha)}</div>
      </div>
    </div>
    <div class="emisor">
      de Cobelli Gustavo y Salami Hugo S.H. &nbsp;·&nbsp; San Martín 4041, 3000 Santa Fe &nbsp;·&nbsp; Tel/Fax (0342) 456 3173 &nbsp;·&nbsp; ventas@surcherie.com.ar<br>
      CUIT 30-70932838-3 &nbsp;·&nbsp; IVA Responsable Inscripto &nbsp;·&nbsp; Ing. Brutos CM 921-554855-1 &nbsp;·&nbsp; Inicio act. 09/2005 &nbsp;·&nbsp; <span style="color:#B2B7BE">No válido como factura</span>
    </div>
    <div class="hair"></div>

    <div class="parties">
      <div class="party">
        <div class="k">Cliente</div>
        <div class="v">${esc(cliente.denominacion || '—')}</div>
        ${cliente.condicionIva ? `<div class="x">${esc(cliente.condicionIva)}</div>` : ''}
        ${cliente.cuit ? `<div class="x">CUIT ${esc(cliente.cuit)}</div>` : ''}
      </div>
      <div class="party">
        <div class="k">Paciente</div>
        <div class="v">${esc(cirugia.paciente || '—')}</div>
      </div>
      <div class="party">
        <div class="k">Profesional</div>
        <div class="v">${esc(cirugia.medico || '—')}</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c-cant">Cant.</th>
          <th class="c-desc">Descripción</th>
          <th class="num">Unitario</th>
          <th class="num">Unit. Neto</th>
          <th class="num">IVA${ivaLbl}</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>

    <div class="foot">
      <div class="notas">
        ${notaExtra ? `<div><b>Nota:</b> ${esc(notaExtra)}</div>` : ''}
        <div><b>Nota:</b> Se facturará según consumo.</div>
        <div class="enletras">${esc(enLetras)}</div>
      </div>
      <div class="totales">
        <div class="tr"><span>Neto gravado</span><span class="v">${fmtMoney(t.neto)}</span></div>
        <div class="tr"><span>IVA${ivaLbl}</span><span class="v">${fmtMoney(t.iva)}</span></div>
        <div class="grand"><span class="gl">Total</span><span class="gv">$ ${fmtMoney(t.total)}</span></div>
      </div>
    </div>

    <div class="cond">
      <div><div class="k">Plazo de entrega</div><div class="v">${esc(cond.entrega || 'A convenir')}</div></div>
      <div><div class="k">Mantenimiento de la oferta</div><div class="v">${esc(cond.validez || '10 días')}</div></div>
      <div><div class="k">Condiciones de pago</div><div class="v">${esc(cond.pago || '30 días fecha factura')}</div></div>
    </div>

    ${servicio ? `<div class="servicio">${esc(servicio)}</div>` : ''}
    <div class="anmat">Establecimiento habilitado por ANMAT · Disposición N.° 9212/15</div>
  </div>
</body></html>`;
}

// Abre el presupuesto en una ventana nueva y dispara la impresión.
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
  setTimeout(() => { try { w.print(); } catch (e) { /* noop */ } }, 350);
}
