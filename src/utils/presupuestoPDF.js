// ============================================================
// Generador de PDF del presupuesto (diseño profesional) + IVA
// ============================================================
// Documento comercial claro y estructurado: encabezado con panel de
// datos, tarjeta de cliente/paciente, tabla con encabezado marcado,
// desglose por renglón (Cant · Descripción · Unitario · Unit. Neto ·
// IVA · Total), total destacado e importe en letras. El PDF se arma
// como HTML y se abre en una ventana de impresión.
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

// Totales del presupuesto. precioUnitario = precio NETO (sin IVA); el IVA se
// SUMA sobre el neto (total = neto + iva).
export function calcularTotales(items, alicuotaId) {
  const alic = alicuotaById(alicuotaId);
  const neto = items.reduce((s, it) => {
    return s + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0);
  }, 0);
  const iva = neto * alic.rate;
  const total = neto + iva;
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

// Ícono de columna vertebral (vértebras azul → naranja), recreado en SVG.
function spineSVG() {
  const N = 9;
  let vert = '';
  for (let i = 0; i < N; i++) {
    const cy = 9 + i * 8.6;
    const cx = 26 + Math.sin(i / (N - 1) * Math.PI) * 4; // leve curva en S
    const w = 10 - Math.abs(i - (N - 1) / 2) * 0.6;      // vértebras más anchas al centro
    const h = 3.1;
    // "moño" (bowtie): dos triángulos que se tocan en el centro
    vert += `<path d="M${(cx - w).toFixed(1)},${(cy - h).toFixed(1)} L${cx.toFixed(1)},${cy.toFixed(1)} L${(cx - w).toFixed(1)},${(cy + h).toFixed(1)} Z"/>`;
    vert += `<path d="M${(cx + w).toFixed(1)},${(cy - h).toFixed(1)} L${cx.toFixed(1)},${cy.toFixed(1)} L${(cx + w).toFixed(1)},${(cy + h).toFixed(1)} Z"/>`;
  }
  return `<svg width="46" height="86" viewBox="0 0 52 86" style="display:block;flex:none">
    <defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2B4C9B"/><stop offset=".42" stop-color="#3E6DB2"/>
      <stop offset=".5" stop-color="#E0611F"/><stop offset="1" stop-color="#E0611F"/>
    </linearGradient></defs>
    <g fill="url(#spg)">${vert}</g>
  </svg>`;
}

// Logo: si p.logoDataUri está seteado (URL o data URI), se usa esa imagen;
// si no, recreación vectorial.
function logoHTML(logoDataUri) {
  if (logoDataUri) {
    return `<img src="${logoDataUri}" alt="Surchérie" crossorigin="anonymous" style="height:64px;display:block">`;
  }
  return `<div class="logo">
      ${spineSVG()}
      <div>
        <div class="brand">Surch<span>ĕ</span>rie</div>
        <div class="brand-sub">Implantes quirúrgicos</div>
      </div>
    </div>`;
}

// Construye el HTML completo del presupuesto (diseño profesional).
export function buildPresupuestoHTML(p) {
  const {
    numero, fecha, cliente, cirugia, items, alicuotaId,
    condiciones, servicioIncluido, notas, logoDataUri,
  } = p;
  const t = calcularTotales(items, alicuotaId);
  const rate = t.rate;
  const cond = condiciones || {};
  const rows = items.filter((it) => it.denominacion);
  const ivaLbl = rate > 0 ? ' ' + (rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%' : '';

  const pctLbl = rate > 0 ? (rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%' : '—';
  const rowsHTML = rows.map((it, i) => {
    const cant = Number(it.cantidad) || 0;
    const unit = Number(it.precioUnitario) || 0; // neto por unidad
    const lineNeto = cant * unit;
    const lineIva = lineNeto * rate;
    const lineTotal = lineNeto + lineIva;
    const sinCargo = unit === 0;
    const metaParts = [];
    if (it.marca) metaParts.push(`<b>Marca</b> ${esc(it.marca)}`);
    if (it.origen) metaParts.push(`<b>Origen</b> ${esc(it.origen)}`);
    const metaLine = metaParts.length ? `<div class="meta">${metaParts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>` : '';
    const altLine = it.alternativa ? `<div class="meta"><b>Alternativa</b> ${esc(it.alternativa)}</div>` : '';
    const detLine = it.detalle ? `<div class="meta">${esc(it.detalle)}</div>` : '';
    return `
      <tr class="${i % 2 ? 'zebra' : ''}">
        <td class="c-cant">${cant}</td>
        <td class="c-desc">
          <div class="name">${esc(it.denominacion)}</div>
          ${metaLine}${altLine}${detLine}
        </td>
        <td class="num">${sinCargo ? '—' : fmtMoney(lineNeto)}</td>
        <td class="num soft">${sinCargo || rate === 0 ? '—' : fmtMoney(lineIva)}</td>
        <td class="num soft">${sinCargo || rate === 0 ? '—' : pctLbl}</td>
        <td class="num tot ${sinCargo ? 'sincargo' : ''}">${sinCargo ? 'Sin cargo' : fmtMoney(lineTotal)}</td>
      </tr>`;
  }).join('');

  const enLetras = 'Son ' + numeroALetras(t.total) + ' pesos';
  const servicio = servicioIncluido || '';
  const notaExtra = notas || '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Presupuesto N° ${esc(numero)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --ink:#1F2733; --soft:#5B6472; --faint:#8A93A0;
    --blue:#2F55B0; --blue-dark:#213E7E; --blue-tint:#EEF2FB; --blue-line:#D3DEF3;
    --line:#E6E9EF; --zebra:#FAFBFD; --orange:#D65E29; --ok:#1F7A52;
  }
  html,body{background:#fff;color:var(--ink);font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.4;-webkit-font-smoothing:antialiased}
  .sheet{max-width:820px;margin:0 auto}
  .accent{height:5px;background:var(--blue)}
  .page{padding:34px 40px 40px}
  .num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
  .soft{color:var(--soft)}

  /* Encabezado */
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
  .logo{display:flex;align-items:center;gap:12px}
  .brand{font-size:34px;font-weight:800;letter-spacing:-1px;color:var(--orange);line-height:1}
  .brand span{font-style:normal}
  .brand-sub{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#7A8087;margin-top:4px}
  .docmeta{text-align:right;white-space:nowrap}
  .docmeta .lbl{font-size:10px;font-weight:800;letter-spacing:.22em;color:var(--blue)}
  .docmeta .big{font-size:24px;font-weight:800;color:var(--ink);margin-top:1px}
  .docmeta .fecha{font-size:11.5px;color:var(--soft);margin-top:2px}
  .docmeta .fecha b{color:var(--ink);font-weight:700}
  .docmeta .noval{display:inline-block;margin-top:9px;font-size:9px;font-weight:700;letter-spacing:.06em;color:var(--faint);border:1px dashed #C7CDD6;border-radius:4px;padding:4px 9px}
  .emisor-block{margin-top:12px;font-size:10.5px;color:var(--soft);line-height:1.6}
  .emisor-block b{color:var(--ink);font-weight:700;font-size:11.5px}
  .fiscal{display:flex;flex-wrap:wrap;gap:6px 26px;margin-top:14px;font-size:10.5px;color:var(--soft)}
  .fiscal b{color:var(--ink);font-weight:700}
  .rule{height:3px;background:var(--blue);border-radius:2px;margin:15px 0 2px}

  /* Tarjeta partes */
  .parties{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:0;margin-top:18px;
    background:var(--zebra);border:1px solid var(--line);border-radius:9px;overflow:hidden}
  .party{padding:13px 16px;border-right:1px solid var(--line)}
  .party:last-child{border-right:none}
  .party .k{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--blue);margin-bottom:5px}
  .party .v{font-size:14px;font-weight:700;line-height:1.25}
  .party .x{font-size:11px;color:var(--soft);margin-top:3px}

  /* Tabla */
  table.items{width:100%;border-collapse:collapse;margin-top:22px}
  table.items thead th{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue-dark);
    background:var(--blue-tint);text-align:left;padding:9px 12px;border-top:1px solid var(--blue-line);border-bottom:1px solid var(--blue-line)}
  table.items thead th.num{text-align:right}
  table.items thead th:first-child{border-top-left-radius:7px}
  table.items thead th:last-child{border-top-right-radius:7px}
  table.items tbody td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tr.zebra td{background:var(--zebra)}
  td.c-cant{width:44px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums}
  .c-desc .name{font-size:12.5px;font-weight:700}
  .c-desc .meta{font-size:10.5px;color:var(--soft);margin-top:3px}
  .c-desc .meta b{color:var(--faint);font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.04em}
  td.num{padding-left:14px}
  td.tot{font-weight:700}
  td.tot.sincargo{color:var(--ok)}

  /* Pie: notas + totales */
  .foot{display:flex;justify-content:space-between;align-items:flex-start;margin-top:22px;gap:32px}
  .notas{flex:1;font-size:11px;color:var(--soft);line-height:1.7}
  .notas b{color:var(--ink)}
  .enletras{margin-top:12px;background:#F6F8FC;border:1px solid var(--line);border-radius:7px;padding:9px 12px;
    font-size:11px;font-weight:600;color:#3A4250;text-transform:uppercase;letter-spacing:.02em}
  .totales{width:296px;border:1px solid var(--line);border-radius:9px;overflow:hidden}
  .totales .tr{display:flex;justify-content:space-between;padding:9px 16px;font-size:12.5px;color:var(--soft)}
  .totales .tr + .tr{border-top:1px solid var(--line)}
  .totales .tr .v{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink)}
  .totales .grand{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--blue);color:#fff}
  .totales .grand .gl{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
  .totales .grand .gv{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}

  /* Condiciones */
  .cond{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px;padding-top:16px;border-top:1px solid var(--line)}
  .cond .k{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);margin-bottom:4px}
  .cond .v{font-size:12px}
  .servicio{margin-top:16px;font-size:10.5px;font-style:italic;color:var(--faint)}
  .anmat{margin-top:8px;font-size:9.5px;color:#AAB1BC;text-align:center;letter-spacing:.02em}
  @media print{.page{padding:22px 26px}}
</style></head>
<body>
  <div class="sheet">
    <div class="page">
      <div class="head">
        <div>
          ${logoHTML(logoDataUri)}
          <div class="emisor-block">
            <b>de Cobelli Gustavo y Salami Hugo S.H.</b><br>
            San Martín 4041 · 3000 Santa Fe · Tel/Fax (0342) 456 3173<br>
            ventas@surcherie.com.ar
          </div>
        </div>
        <div class="docmeta">
          <div class="lbl">PRESUPUESTO</div>
          <div class="big">N° ${esc(numero)}</div>
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
        <div class="party">
          <div class="k">Cliente</div>
          <div class="v">${esc(cliente.denominacion || '—')}</div>
          ${cliente.cuit ? `<div class="x">CUIT ${esc(cliente.cuit)}</div>` : ''}
          ${cliente.condicionIva ? `<div class="x">${esc(cliente.condicionIva)}</div>` : ''}
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
            <th class="num">Unit. Neto</th>
            <th class="num">IVA</th>
            <th class="num">%</th>
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
  // Esperar a que carguen las imágenes (el logo viene por URL) antes de imprimir.
  let printed = false;
  const doPrint = () => { if (printed) return; printed = true; try { w.print(); } catch (e) { /* noop */ } };
  const imgs = w.document.images;
  if (imgs && imgs.length) {
    let pending = imgs.length;
    const one = () => { if (--pending <= 0) setTimeout(doPrint, 150); };
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) one();
      else { imgs[i].onload = one; imgs[i].onerror = one; }
    }
    setTimeout(doPrint, 2500); // respaldo por si alguna imagen no carga
  } else {
    setTimeout(doPrint, 300);
  }
}
