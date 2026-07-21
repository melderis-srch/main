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
    return `<img src="${logoDataUri}" alt="Surchérie" style="height:52px;display:block">`;
  }
  return `<div class="brand">Surch<span>ĕ</span>rie</div>
          <div class="brand-sub">Implantes quirúrgicos</div>`;
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

  const rowsHTML = rows.map((it, i) => {
    const cant = Number(it.cantidad) || 0;
    const unit = Number(it.precioUnitario) || 0;
    const lineTotal = cant * unit;
    const unitNeto = rate > 0 ? unit / (1 + rate) : unit;
    const lineNeto = unitNeto * cant;
    const lineIva = lineTotal - lineNeto;
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
        <td class="num">${sinCargo ? '—' : fmtMoney(unit)}</td>
        <td class="num soft">${sinCargo ? '—' : fmtMoney(unitNeto)}</td>
        <td class="num soft">${sinCargo || rate === 0 ? '—' : fmtMoney(lineIva)}</td>
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
  .brand{font-size:30px;font-weight:800;letter-spacing:-.5px;color:var(--orange);line-height:1}
  .brand span{font-style:normal}
  .brand-sub{font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#A08A7E;margin-top:6px}
  .docbox{min-width:210px;background:var(--blue-tint);border:1px solid var(--blue-line);border-radius:9px;padding:12px 16px;text-align:right}
  .docbox .lbl{font-size:10px;font-weight:800;letter-spacing:.2em;color:var(--blue)}
  .docbox .big{font-size:22px;font-weight:800;color:var(--ink);margin-top:1px}
  .docbox .row{display:flex;justify-content:space-between;gap:12px;font-size:11.5px;color:var(--soft);margin-top:6px}
  .docbox .row b{color:var(--ink);font-weight:700}
  .emisor{margin-top:16px;font-size:10.5px;color:var(--soft);line-height:1.7}
  .emisor b{color:var(--ink);font-weight:700}

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
    <div class="accent"></div>
    <div class="page">
      <div class="head">
        <div>${logoHTML(logoDataUri)}</div>
        <div class="docbox">
          <div class="lbl">PRESUPUESTO</div>
          <div class="big">N° ${esc(numero)}</div>
          <div class="row"><span>Fecha</span><b>${esc(fecha)}</b></div>
        </div>
      </div>

      <div class="emisor">
        <b>de Cobelli Gustavo y Salami Hugo S.H.</b> &nbsp;·&nbsp; San Martín 4041, 3000 Santa Fe &nbsp;·&nbsp; Tel/Fax (0342) 456 3173 &nbsp;·&nbsp; ventas@surcherie.com.ar<br>
        CUIT 30-70932838-3 &nbsp;·&nbsp; IVA Responsable Inscripto &nbsp;·&nbsp; Ing. Brutos CM 921-554855-1 &nbsp;·&nbsp; Inicio act. 09/2005 &nbsp;·&nbsp; <span style="color:#AAB1BC">No válido como factura</span>
      </div>

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
