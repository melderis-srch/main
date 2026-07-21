// ============================================================
// Generador de PDF del presupuesto (diseño profesional) + IVA
// ============================================================
// Diseño sobrio tipo documento comercial: sin colores fuertes,
// desglose por renglón y columnas Cant · Descripción · Unitario ·
// Unit. Neto · IVA · Total. El PDF se arma como HTML y se abre en una
// ventana de impresión (imprimir o guardar como PDF).
// ============================================================

// Alícuotas de IVA. El precio cargado es SIEMPRE el FINAL (con IVA);
// el desglose se calcula "hacia atrás" y de forma UNIFORME (misma
// alícuota para todo el presupuesto).
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

// Construye el HTML completo del presupuesto (diseño profesional).
export function buildPresupuestoHTML(p) {
  const {
    numero, fecha, cliente, cirugia, items, alicuotaId,
    condiciones, servicioIncluido, notas,
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
    if (it.marca) metaParts.push(`MARCA: ${esc(it.marca)}`);
    if (it.origen) metaParts.push(`ORIGEN: ${esc(it.origen)}`);
    const metaLine = metaParts.length ? `<div class="meta">${metaParts.join('&nbsp;&nbsp;&nbsp;')}</div>` : '';
    const altLine = it.alternativa ? `<div class="meta">ALTERNATIVA: ${esc(it.alternativa)}</div>` : '';
    const detLine = it.detalle ? `<div class="meta">${esc(it.detalle)}</div>` : '';
    return `
      <tr>
        <td class="c-cant">${cant}</td>
        <td class="c-desc">
          <div class="name">${esc(it.denominacion)}</div>
          ${metaLine}${altLine}${detLine}
        </td>
        <td class="num">${sinCargo ? '—' : fmtMoney(unit)}</td>
        <td class="num">${sinCargo ? '—' : fmtMoney(unitNeto)}</td>
        <td class="num">${sinCargo || rate === 0 ? '—' : fmtMoney(lineIva)}</td>
        <td class="num tot">${sinCargo ? 'Sin cargo' : fmtMoney(lineTotal)}</td>
      </tr>`;
  }).join('');

  const enLetras = 'SON ' + numeroALetras(t.total) + ' PESOS';
  const servicio = servicioIncluido || '';
  const notaExtra = notas || '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Presupuesto N° ${esc(numero)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35}
  .page{max-width:800px;margin:0 auto;padding:30px 34px}
  .num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}

  /* Encabezado */
  .hdr{display:flex;border:1px solid #222}
  .hdr .left{flex:1.15;padding:12px 16px;border-right:1px solid #222;text-align:center}
  .hdr .right{flex:1;padding:12px 16px}
  .brand{font-size:26px;font-weight:800;letter-spacing:-.5px}
  .brand .b1{color:#C0501E}.brand .b2{color:#26467F}
  .brand .sub{display:block;font-size:10px;font-weight:600;letter-spacing:.18em;color:#26467F;margin-top:-2px}
  .emisor{font-size:10.5px;color:#333;margin-top:8px;line-height:1.5}
  .emisor b{color:#111}
  .doc-title{font-size:19px;font-weight:800;letter-spacing:.04em;text-align:center}
  .doc-sub{font-size:10.5px;font-style:italic;text-align:center;color:#444;margin-bottom:10px}
  .doc-line{display:flex;justify-content:space-between;font-size:13px;padding:2px 0}
  .doc-line .k{font-weight:700}
  .fiscal{font-size:10px;color:#444;margin-top:8px;line-height:1.6;text-align:right}

  /* Partes */
  .parties{margin-top:14px;font-size:12px}
  .parties .row{display:flex;padding:1px 0}
  .parties .k{width:110px;font-weight:700}
  .parties .v{flex:1}

  /* Tabla */
  table.items{width:100%;border-collapse:collapse;margin-top:16px}
  table.items thead th{font-size:11px;font-weight:700;text-transform:none;color:#111;
    padding:6px 8px;border-top:1.5px solid #222;border-bottom:1.5px solid #222;text-align:left}
  table.items thead th.num{text-align:right}
  table.items tbody td{padding:8px 8px;border-bottom:1px solid #DADADA;vertical-align:top}
  .c-cant{width:36px;text-align:center;font-variant-numeric:tabular-nums}
  .c-desc .name{font-weight:700}
  .c-desc .meta{font-size:10.5px;color:#555;margin-top:2px;letter-spacing:.01em}
  td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  td.tot{font-weight:700}
  .rate-badge{font-size:9.5px;color:#666;margin-left:4px}

  /* Notas + totales */
  .foot{display:flex;justify-content:space-between;align-items:flex-start;margin-top:18px;gap:20px}
  .notas{flex:1;font-size:11px;color:#333;line-height:1.6}
  .notas .n{font-weight:700}
  .totbox{width:290px;border:1px solid #222}
  .totbox .tr{display:flex;justify-content:space-between;padding:6px 12px;font-size:12px}
  .totbox .tr .v{font-variant-numeric:tabular-nums;font-weight:600}
  .totbox .tr.sep{border-top:1px solid #CCC}
  .totbox .grand{border-top:1.5px solid #222;padding:9px 12px;display:flex;justify-content:space-between;align-items:center}
  .totbox .grand .gl{font-size:12.5px;font-weight:800;letter-spacing:.06em}
  .totbox .grand .gv{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}

  .enletras{margin-top:14px;font-size:11.5px;font-weight:700;border-top:1px solid #CCC;border-bottom:1px solid #CCC;padding:8px 0;text-transform:uppercase}

  .cond{display:flex;gap:28px;margin-top:16px;font-size:11px}
  .cond .item{display:flex;gap:8px}
  .cond .ck{font-weight:700}
  .servicio{margin-top:14px;font-size:11px;font-style:italic;color:#333;border-top:1px solid #EEE;padding-top:8px}
  .anmat{margin-top:16px;font-size:10px;color:#777;text-align:center}
  @media print{.page{padding:6px}}
</style></head>
<body>
  <div class="page">
    <div class="hdr">
      <div class="left">
        <div class="brand"><span class="b1">Surch</span><span class="b2">érie</span>
          <span class="sub">IMPLANTES QUIRÚRGICOS</span>
        </div>
        <div class="emisor">
          <b>de Cobelli Gustavo y Salami Hugo S.H.</b><br>
          San Martín 4041 · 3000 Santa Fe · Tel/Fax (0342) 456 3173<br>
          ventas@surcherie.com.ar<br>
          I.V.A. Responsable Inscripto
        </div>
      </div>
      <div class="right">
        <div class="doc-title">PRESUPUESTO</div>
        <div class="doc-sub">Documento NO válido como factura</div>
        <div class="doc-line"><span class="k">Número:</span><span>${esc(numero)}</span></div>
        <div class="doc-line"><span class="k">Fecha:</span><span>${esc(fecha)}</span></div>
        <div class="fiscal">
          Inicio de Actividades: 09/2005<br>
          C.U.I.T.: 30-70932838-3<br>
          Ingresos Brutos: CM 921-554855-1
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="row"><span class="k">Señor(es):</span><span class="v">${esc(cliente.denominacion || '')}${cliente.condicionIva ? ' — ' + esc(cliente.condicionIva) : ''}</span></div>
      <div class="row"><span class="k">Paciente:</span><span class="v">${esc(cirugia.paciente || '')}</span></div>
      <div class="row"><span class="k">Profesional:</span><span class="v">${esc(cirugia.medico || '')}</span></div>
      ${cliente.cuit ? `<div class="row"><span class="k">C.U.I.T.:</span><span class="v">${esc(cliente.cuit)}</span></div>` : ''}
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c-cant">Cant.</th>
          <th class="c-desc">Descripción</th>
          <th class="num">Unitario</th>
          <th class="num">Unit. Neto</th>
          <th class="num">IVA${rate > 0 ? ' ' + (rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%' : ''}</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>

    <div class="foot">
      <div class="notas">
        ${notaExtra ? `<div><span class="n">NOTA:</span> ${esc(notaExtra)}</div>` : ''}
        <div><span class="n">NOTA:</span> SE FACTURARÁ SEGÚN CONSUMO.</div>
      </div>
      <div class="totbox">
        <div class="tr"><span>Total Neto:</span><span class="v">${fmtMoney(t.neto)}</span></div>
        <div class="tr sep"><span>IVA${rate > 0 ? ' ' + (rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%' : ''}:</span><span class="v">${fmtMoney(t.iva)}</span></div>
        <div class="grand"><span class="gl">TOTAL:</span><span class="gv">$ ${fmtMoney(t.total)}</span></div>
      </div>
    </div>

    <div class="enletras">${esc(enLetras)}</div>

    <div class="cond">
      <div class="item"><span class="ck">Plazo de entrega:</span><span>${esc(cond.entrega || 'A convenir')}</span></div>
      <div class="item"><span class="ck">Mant. de la oferta:</span><span>${esc(cond.validez || '10 días')}</span></div>
      <div class="item"><span class="ck">Cond. de pago:</span><span>${esc(cond.pago || '30 días fecha factura')}</span></div>
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
