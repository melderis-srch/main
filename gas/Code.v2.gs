// ============================================================
// Surcherie — Backend v2 (Planilla Maestra + casoId)
// ============================================================
// Reescritura del backend contra UNA sola planilla maestra, con:
//   - casoId como clave de todo el pipeline (fin del match por nombre)
//   - helpers robustos de booleano / fecha / monto
//   - una única función de normalización de estado
//   - Consolidado calculado por código (fuente única de métricas)
//
// NO reemplaza todavía a Code.gs en producción. Se despliega recién
// cuando la planilla maestra exista y la migración se haya corrido.
// Ver docs/planilla-maestra.md.
// ============================================================

// ---- Config ------------------------------------------------
// ID de la planilla maestra.
var MASTER_SHEET_ID = '1XO6UFDUSvrjw8KeFKxswWZt4rZTFpbNyXNBd6YBuBFE';

// IDs viejos (solo para el script de migración de una sola corrida).
var OLD_CIRUGIAS_ID    = '1ZMNbsQRzzJScaIP2JB7tJmy8cEafVqHuCDgZGOiFq-M';
var OLD_FINANCIERO_ID  = '1Qy7ylSFMy8-zOCMuGS7B6JUQ8K2BisuDX1WFB5bO-9E';
var OLD_PRESUPUESTOS_ID = '1nFTSrRaonn6Mpu_CiBpkKX54c_Dbu_DWWzFlz5tSm5U';

var SHEETS = {
  casos:        'Casos',
  presupuestos: 'Presupuestos',
  cirugias:     'Cirugias',
  facturas:     'Facturas',
  cobros:       'Cobros',
  pagos:        'Pagos',
  ordenes:      'OrdenesCompra',
  usuarios:     'Usuarios',
  config:       '_config'
};

// ============================================================
// HTTP
// ============================================================
function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function doOptions(e) {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;
    if      (action === 'getBootstrap')    result = getBootstrap();
    else if (action === 'getCasos')        result = getCasos();
    else if (action === 'getPresupuestos') result = getPresupuestos();
    else if (action === 'getCirugias')     result = getCirugias();
    else if (action === 'getFacturas')     result = getFacturas();
    else if (action === 'getCobros')       result = getCobros();
    else if (action === 'getPagos')        result = getPagos();
    else if (action === 'getOrdenes')      result = getOrdenes();
    else if (action === 'getConsolidado')  result = getConsolidado();
    else result = { error: 'Accion no reconocida: ' + action };
    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    var data   = body.data;
    var result;
    switch (action) {
      case 'addPresupuesto':    result = addPresupuesto(data); break;
      case 'updatePresupuesto': result = updatePresupuesto(data.rowIndex, data.fields); break;
      case 'addCirugia':        result = addCirugia(data); break;
      case 'updateCirugia':     result = updateCirugia(data.casoId, data.fields); break;
      case 'addFactura':        result = addFactura(data); break;
      case 'updateFactura':     result = updateFactura(data.rowIndex, data.fields); break;
      case 'addCobro':          result = addCobro(data); break;
      case 'updateCobro':       result = updateCobro(data.rowIndex, data.fields); break;
      case 'registrarCobroCompleto': result = registrarCobroCompleto(data); break;
      case 'addPago':           result = addPago(data); break;
      case 'updatePago':        result = updatePago(data.rowIndex, data.fields); break;
      case 'addOrden':          result = addOrden(data); break;
      case 'updateOrden':       result = updateOrden(data.rowIndex, data.fields); break;
      default: result = { error: 'Accion no reconocida: ' + action };
    }
    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// HELPERS — planilla / hojas
// ============================================================
function master() {
  return SpreadsheetApp.openById(MASTER_SHEET_ID);
}
function sheet(name) {
  var sh = master().getSheetByName(name);
  if (!sh) throw new Error('No se encontró la hoja "' + name + '"');
  return sh;
}
// Lee una hoja como array de objetos usando la fila 1 como encabezados.
// Devuelve { rows: [{_row, campo...}], headers: [...] }
function readSheet(name) {
  var sh = sheet(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 1) return { rows: [], headers: [] };
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var raw = values[i];
    if (raw.every(function (c) { return c === '' || c === null; })) continue;
    var obj = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = raw[c];
    rows.push(obj);
  }
  return { rows: rows, headers: headers };
}
// Devuelve el índice de columna (1-based) de un header dado.
function colOf(headers, name) {
  var idx = headers.indexOf(name);
  return idx === -1 ? -1 : idx + 1;
}
// Escribe un objeto de campos en una fila existente, respetando headers.
function writeFields(name, rowIndex, fields) {
  var sh = sheet(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  for (var key in fields) {
    var col = colOf(headers, key);
    if (col !== -1) sh.getRange(rowIndex, col).setValue(coerceForWrite(key, fields[key]));
  }
  touch(name, rowIndex, headers);
  return rowIndex;
}
// Agrega una fila a partir de un objeto de campos, respetando headers.
function appendObject(name, obj) {
  var sh = sheet(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var row = headers.map(function (h) {
    return obj[h] !== undefined ? coerceForWrite(h, obj[h]) : '';
  });
  sh.appendRow(row);
  return sh.getLastRow();
}
// Marca actualizadoEl si la hoja tiene esa columna.
function touch(name, rowIndex, headers) {
  var col = colOf(headers, 'actualizadoEl');
  if (col !== -1) sheet(name).getRange(rowIndex, col).setValue(new Date());
}

// ============================================================
// HELPERS — robustez de tipos (arregla "no se lee/carga bien")
// ============================================================
function parseBool(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined || v === '') return false;
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'VERDADERO' || s === 'SI' || s === 'SÍ' ||
         s === 'X' || s === '1' || s === 'OK';
}
function parseMoney(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  var s = String(v).replace(/\$/g, '').replace(/AR\$?/gi, '').trim();
  if (s.indexOf(',') !== -1) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s.replace(/\./g, '')) || 0;
}
// Valida que un valor sea un monto numérico; tira error si no.
function requireMoney(label, v) {
  if (v === '' || v === null || v === undefined) return '';
  var n = parseMoney(v);
  if (isNaN(n)) throw new Error('El campo "' + label + '" no es un monto válido: ' + v);
  return n;
}
function parseFechaFlexible(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  var s = String(val).trim();
  var parts = s.split('/');
  if (parts.length === 3) {
    var d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return isNaN(d.getTime()) ? null : d;
  }
  var d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2;
}
// Serializa fechas a ISO (yyyy-MM-dd) para el front; el resto tal cual.
function toISO(val) {
  var d = parseFechaFlexible(val);
  if (!d) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
// Al escribir: fechas → Date real, montos → number, resto → tal cual.
var DATE_FIELDS  = ['fechaCotizacion','fechaAutorizacion','fechaCx','fechaFactura',
  'fechaEntrega','fechaCobroEsperada','fechaCobroReal','fechaCobroCheque',
  'fechaEmision','fechaPago','fechaPagoEcheq','creadoEl','actualizadoEl'];
var MONEY_FIELDS = ['precioCotizacion','precioMejora','montoFacturado','montoCobrado',
  'valorImplantes','valorDescartables','valorLogistica','correccionGastos',
  'valorTotalCostos','montoPresupuesto','retencionesOtros','retGanancias','retIIBB',
  'retSuss','retSellados','monto','precioUnitario'];
var BOOL_FIELDS  = ['pagado','saldado','realizada'];
function coerceForWrite(key, value) {
  if (DATE_FIELDS.indexOf(key) !== -1)  { var d = parseFechaFlexible(value); return d || ''; }
  if (MONEY_FIELDS.indexOf(key) !== -1) { return value === '' || value == null ? '' : parseMoney(value); }
  if (BOOL_FIELDS.indexOf(key) !== -1)  { return parseBool(value); }
  return value;
}
function mesLabel(dateOrStr) {
  var d = parseFechaFlexible(dateOrStr);
  if (!d) return '';
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
    'Septiembre','Octubre','Noviembre','Diciembre'];
  return MESES[d.getMonth()] + ' ' + d.getFullYear();
}
function ym(dateOrStr) {
  var d = parseFechaFlexible(dateOrStr);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM') : '';
}
function normalizeNombre(s) {
  return String(s || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u')
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

// ============================================================
// HELPERS — estado (única fuente de la regla de negocio)
// ============================================================
var ESTADOS_PRESUP = {
  'AUTORIZADA':'Autorizada', 'COTIZADA':'Cotizada', 'PERDIDA':'Perdida',
  'BAJA':'Baja', 'RECHAZADA':'Rechazada', 'NO AUTORIZADA':'Rechazada'
};
function normalizarEstadoPresup(raw) {
  var k = String(raw || '').trim().toUpperCase();
  return ESTADOS_PRESUP[k] || (k ? 'Cotizada' : '');
}
function clasificacionPresup(estadoNorm, fechaCx) {
  if (estadoNorm === 'Perdida' || estadoNorm === 'Baja' || estadoNorm === 'Rechazada') return 'rechazado';
  if (estadoNorm === 'Autorizada' && parseFechaFlexible(fechaCx)) return 'convertido';
  return 'pendiente';
}
// Estado del caso a partir de sus datos agregados.
function estadoCaso(caso, facturasDelCaso, cobrosDelCaso) {
  var netoFacturado = facturasDelCaso.reduce(function (s, f) { return s + parseMoney(f.montoFacturado); }, 0);
  var totalCobrado  = cobrosDelCaso.reduce(function (s, c) { return s + parseMoney(c.montoCobrado); }, 0);
  if (facturasDelCaso.length > 0) {
    if (totalCobrado > 0 && totalCobrado >= netoFacturado && netoFacturado > 0) return 'cobrado';
    if (totalCobrado > 0) return 'cobrado parcial';
    return 'facturado';
  }
  if (parseFechaFlexible(caso.fechaCx)) return 'realizado';
  if (caso.fechaAutorizacion) return 'autorizado';
  return 'cotizado';
}

// ============================================================
// HELPERS — IDs correlativos (con lock, desde _config)
// ============================================================
function nextId(prefix, seqKey) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet(SHEETS.config);
    var data = sh.getDataRange().getValues(); // col A=clave, B=valor
    var year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
    var key = seqKey + '_' + year;
    var rowIdx = -1, current = 0;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === key) { rowIdx = i + 1; current = Number(data[i][1]) || 0; break; }
    }
    var next = current + 1;
    if (rowIdx === -1) sh.appendRow([key, next]);
    else sh.getRange(rowIdx, 2).setValue(next);
    var padded = ('0000' + next).slice(-4);
    return prefix + '-' + year + '-' + padded;
  } finally {
    lock.releaseLock();
  }
}
function nextCasoId()   { return nextId('CX', 'casoSeq'); }
function nextPresupId() { return nextId('PR', 'presupSeq'); }
function nextCobroId()  { return nextId('CO', 'cobroSeq'); }
function nextOcId()     { return nextId('OC', 'ocSeq'); }

// ============================================================
// READ — con join por casoId
// ============================================================
// Una sola llamada que trae todo el estado ya unido, para el front.
function getBootstrap() {
  var casos        = readSheet(SHEETS.casos).rows;
  var presupuestos = readSheet(SHEETS.presupuestos).rows;
  var cirugias     = readSheet(SHEETS.cirugias).rows;
  var facturas     = readSheet(SHEETS.facturas).rows;
  var cobros       = readSheet(SHEETS.cobros).rows;
  var pagos        = readSheet(SHEETS.pagos).rows;
  var ordenes      = readSheet(SHEETS.ordenes).rows;

  var facturasByCaso = groupBy(facturas, 'casoId');
  var cobrosByCaso   = groupBy(cobros, 'casoId');
  var cirugiaByCaso  = indexBy(cirugias, 'casoId');

  // Enriquecer cada caso con su estado y datos espejo.
  var casosOut = casos.map(function (c) {
    var fs = facturasByCaso[c.casoId] || [];
    var cs = cobrosByCaso[c.casoId] || [];
    return {
      casoId:            c.casoId,
      paciente:          c.paciente || '',
      medico:            c.medico || '',
      obraSocial:        c.obraSocial || '',
      sanatorio:         c.sanatorio || '',
      material:          c.material || '',
      fechaCotizacion:   toISO(c.fechaCotizacion),
      fechaAutorizacion: toISO(c.fechaAutorizacion),
      fechaCx:           toISO(c.fechaCx),
      mes:               mesLabel(c.fechaCx),
      presupuestoId:     c.presupuestoId || '',
      estadoCaso:        estadoCaso(c, fs, cs),
      _row:              c._row
    };
  });

  return {
    casos:        casosOut,
    presupuestos: presupuestos.map(mapPresup),
    cirugias:     cirugias.map(mapCirugia),
    facturas:     facturas.map(mapFactura),
    cobros:       cobros.map(mapCobro),
    pagos:        pagos.map(mapPago),
    ordenes:      ordenes.map(mapOrden),
    consolidado:  computeConsolidado(casosOut, facturas, cobros, pagos)
  };
}

function groupBy(rows, key) {
  var m = {};
  rows.forEach(function (r) { var k = r[key]; if (!k) return; (m[k] = m[k] || []).push(r); });
  return m;
}
function indexBy(rows, key) {
  var m = {};
  rows.forEach(function (r) { if (r[key]) m[r[key]] = r; });
  return m;
}

// ---- mappers (serializan fechas a ISO, montos a number) ----
function mapPresup(r) {
  var estado = normalizarEstadoPresup(r.estado);
  return {
    _row: r._row, presupuestoId: r.presupuestoId || '', casoId: r.casoId || '',
    paciente: r.paciente || '', medico: r.medico || '', obraSocial: r.obraSocial || '',
    material: r.material || '', numeroPresupuesto: String(r.numeroPresupuesto || ''),
    precioCotizacion: parseMoney(r.precioCotizacion), precioMejora: parseMoney(r.precioMejora),
    monto: parseMoney(r.precioCotizacion) + parseMoney(r.precioMejora),
    fechaCotizacion: toISO(r.fechaCotizacion), estado: estado,
    fechaAutorizacion: toISO(r.fechaAutorizacion), condicionPago: r.condicionPago || '',
    realizada: parseBool(r.realizada), fechaCx: toISO(r.fechaCx),
    observaciones: r.observaciones || '',
    datosJson: r.datosJson || '',
    clasificacion: clasificacionPresup(estado, r.fechaCx)
  };
}
function mapCirugia(r) {
  return {
    _row: r._row, casoId: r.casoId || '', mes: mesLabel(r.fechaCx) || r.mes || '',
    pedidoPresupuestado: r.pedidoPresupuestado || '', consumo: r.consumo || '',
    valorImplantes: parseMoney(r.valorImplantes), valorDescartables: parseMoney(r.valorDescartables),
    valorLogistica: parseMoney(r.valorLogistica), correccionGastos: parseMoney(r.correccionGastos),
    valorTotalCostos: parseMoney(r.valorTotalCostos), montoPresupuesto: parseMoney(r.montoPresupuesto),
    retencionesOtros: parseMoney(r.retencionesOtros)
  };
}
function mapFactura(r) {
  return {
    _row: r._row, casoId: r.casoId || '', numeroFactura: String(r.numeroFactura || ''),
    montoFacturado: parseMoney(r.montoFacturado), fechaFactura: toISO(r.fechaFactura),
    condicionPago: r.condicionPago || '', fechaCobroEsperada: toISO(r.fechaCobroEsperada),
    fechaEntrega: toISO(r.fechaEntrega), notas: r.notas || ''
  };
}
function mapCobro(r) {
  return {
    _row: r._row, cobroId: r.cobroId || '', casoId: r.casoId || '',
    montoCobrado: parseMoney(r.montoCobrado), retGanancias: parseMoney(r.retGanancias),
    retIIBB: parseMoney(r.retIIBB), retSuss: parseMoney(r.retSuss), retSellados: parseMoney(r.retSellados),
    medioPago: r.medioPago || '', lugarPago: r.lugarPago || '', condicionPago: r.condicionPago || '',
    fechaCobroEsperada: toISO(r.fechaCobroEsperada), fechaCobroReal: toISO(r.fechaCobroReal),
    fechaCobroCheque: toISO(r.fechaCobroCheque), notas: r.notas || ''
  };
}
function mapPago(r) {
  return {
    _row: r._row, casoId: r.casoId || '', fechaEmision: toISO(r.fechaEmision),
    nroFactura: String(r.nroFactura || ''), monto: parseMoney(r.monto), emisor: r.emisor || '',
    categoria: r.categoria || '', descripcion: r.descripcion || '', fechaPago: toISO(r.fechaPago),
    pagado: parseBool(r.pagado), formaPago: r.formaPago || '', comprobanteEnviado: r.comprobanteEnviado || '',
    fechaPagoEcheq: toISO(r.fechaPagoEcheq), saldado: parseBool(r.saldado)
  };
}
function mapOrden(r) {
  return {
    _row: r._row, ocId: r.ocId || '', proveedor: r.proveedor || '', material: r.material || '',
    cantidad: Number(r.cantidad) || 0, precioUnitario: parseMoney(r.precioUnitario),
    mesObjetivo: r.mesObjetivo || '', estado: r.estado || 'pendiente',
    numeroFactura: String(r.numeroFactura || ''), casoId: r.casoId || ''
  };
}

// Endpoints individuales (por compatibilidad / carga parcial)
function getCasos()        { return getBootstrap().casos; }
function getPresupuestos() { return readSheet(SHEETS.presupuestos).rows.map(mapPresup); }
function getCirugias()     { return readSheet(SHEETS.cirugias).rows.map(mapCirugia); }
function getFacturas()     { return readSheet(SHEETS.facturas).rows.map(mapFactura); }
function getCobros()       { return readSheet(SHEETS.cobros).rows.map(mapCobro); }
function getPagos()        { return readSheet(SHEETS.pagos).rows.map(mapPago); }
function getOrdenes()      { return readSheet(SHEETS.ordenes).rows.map(mapOrden); }
function getConsolidado()  { return getBootstrap().consolidado; }

// ============================================================
// CONSOLIDADO — calculado (fuente única de métricas)
// ============================================================
function computeConsolidado(casos, facturas, cobros, pagos) {
  var meses = {}; // ym -> agregados
  function bucket(k) {
    if (!meses[k]) meses[k] = {
      mes: k, cantidadCirugias: 0, montoFacturado: 0, montoCobrado: 0,
      retenciones: 0, gastosProveedores: 0
    };
    return meses[k];
  }
  casos.forEach(function (c) {
    var k = ym(c.fechaCx); if (k) bucket(k).cantidadCirugias++;
  });
  facturas.forEach(function (f) {
    var k = ym(f.fechaFactura); if (k) bucket(k).montoFacturado += parseMoney(f.montoFacturado);
  });
  cobros.forEach(function (c) {
    var k = ym(c.fechaCobroReal); if (!k) return;
    var b = bucket(k);
    var ret = parseMoney(c.retGanancias) + parseMoney(c.retIIBB) + parseMoney(c.retSuss) + parseMoney(c.retSellados);
    b.montoCobrado += parseMoney(c.montoCobrado);
    b.retenciones += ret;
  });
  pagos.forEach(function (p) {
    var k = ym(p.fechaPago || p.fechaEmision); if (k) bucket(k).gastosProveedores += parseMoney(p.monto);
  });
  return Object.keys(meses).sort().reverse().map(function (k) {
    var b = meses[k];
    b.rentabilidad = b.montoFacturado > 0
      ? ((b.montoCobrado - b.gastosProveedores) / b.montoFacturado) * 100 : null;
    return b;
  });
}

// ============================================================
// WRITE — Presupuestos + cascada (crea caso al autorizar)
// ============================================================
function addPresupuesto(data) {
  var estado = normalizarEstadoPresup(data.estado);
  var presupuestoId = nextPresupId();
  var casoId = '';
  if (estado === 'Autorizada' && parseFechaFlexible(data.fechaCx)) {
    casoId = crearOReusarCaso(data, presupuestoId);
  }
  appendObject(SHEETS.presupuestos, {
    presupuestoId: presupuestoId, casoId: casoId,
    paciente: data.paciente || '', medico: data.medico || '', obraSocial: data.obraSocial || '',
    material: data.material || '', numeroPresupuesto: data.numeroPresupuesto || '',
    precioCotizacion: requireMoney('precio cotización', data.precioCotizacion),
    fechaCotizacion: data.fechaCotizacion || '', precioMejora: requireMoney('precio mejora', data.precioMejora),
    estado: estado, fechaAutorizacion: data.fechaAutorizacion || '',
    condicionPago: data.condicionPago || '', realizada: false,
    fechaCx: data.fechaCx || '', observaciones: data.observaciones || '',
    // Payload completo del presupuesto (renglones, cliente, alícuota, etc.)
    // para poder ver/regenerar/editar el PDF desde la app.
    datosJson: data.datosJson || ''
  });
  return { presupuestoId: presupuestoId, casoId: casoId };
}

function updatePresupuesto(rowIndex, fields) {
  if (fields.estado !== undefined) fields.estado = normalizarEstadoPresup(fields.estado);
  writeFields(SHEETS.presupuestos, rowIndex, fields);
  // Si quedó Autorizada + fechaCx y aún no tenía caso, crearlo y linkear.
  var row = readSheet(SHEETS.presupuestos).rows.filter(function (r) { return r._row === rowIndex; })[0];
  if (row && normalizarEstadoPresup(row.estado) === 'Autorizada' &&
      parseFechaFlexible(row.fechaCx) && !row.casoId) {
    var casoId = crearOReusarCaso(row, row.presupuestoId);
    writeFields(SHEETS.presupuestos, rowIndex, { casoId: casoId });
  }
  return { updated: rowIndex };
}

// Crea el caso (y su cirugía) si no existe uno equivalente; devuelve casoId.
// Identidad: paciente(normalizado) + fechaCx + material.
function crearOReusarCaso(data, presupuestoId) {
  var casos = readSheet(SHEETS.casos).rows;
  var pn = normalizeNombre(data.paciente);
  var fx = toISO(data.fechaCx);
  var mat = normalizeNombre(data.material);
  for (var i = 0; i < casos.length; i++) {
    if (normalizeNombre(casos[i].paciente) === pn &&
        toISO(casos[i].fechaCx) === fx &&
        normalizeNombre(casos[i].material) === mat) {
      return casos[i].casoId; // ya existe este caso
    }
  }
  var casoId = nextCasoId();
  appendObject(SHEETS.casos, {
    casoId: casoId, paciente: data.paciente || '', medico: data.medico || '',
    obraSocial: data.obraSocial || '', sanatorio: data.sanatorio || '', material: data.material || '',
    fechaCotizacion: data.fechaCotizacion || '', fechaAutorizacion: data.fechaAutorizacion || '',
    fechaCx: data.fechaCx || '', presupuestoId: presupuestoId || '',
    creadoEl: new Date(), actualizadoEl: new Date()
  });
  // Crear la cirugía asociada (costos vacíos, a completar).
  appendObject(SHEETS.cirugias, {
    casoId: casoId, montoPresupuesto: (parseMoney(data.precioCotizacion) + parseMoney(data.precioMejora))
  });
  return casoId;
}

// ============================================================
// WRITE — Cirugías (carga manual también genera caso)
// ============================================================
function addCirugia(data) {
  var casoId = data.casoId;
  if (!casoId) {
    // Carga manual sin presupuesto: generar caso nuevo.
    casoId = nextCasoId();
    appendObject(SHEETS.casos, {
      casoId: casoId, paciente: data.paciente || '', medico: data.medico || '',
      obraSocial: data.obraSocial || '', sanatorio: data.sanatorio || '', material: data.material || '',
      fechaCx: data.fechaCx || '', creadoEl: new Date(), actualizadoEl: new Date()
    });
  }
  appendObject(SHEETS.cirugias, {
    casoId: casoId, pedidoPresupuestado: data.pedidoPresupuestado || '',
    consumo: data.consumo || '', valorImplantes: data.valorImplantes || '',
    valorDescartables: data.valorDescartables || '', valorLogistica: data.valorLogistica || '',
    correccionGastos: data.correccionGastos || '', valorTotalCostos: data.valorTotalCostos || '',
    montoPresupuesto: data.montoPresupuesto || '', retencionesOtros: data.retencionesOtros || ''
  });
  return { casoId: casoId };
}
function updateCirugia(casoId, fields) {
  var cir = readSheet(SHEETS.cirugias).rows.filter(function (r) { return r.casoId === casoId; })[0];
  if (!cir) throw new Error('No se encontró cirugía para el caso ' + casoId);
  writeFields(SHEETS.cirugias, cir._row, fields);
  return { casoId: casoId };
}

// ============================================================
// WRITE — Facturas (varias por caso)
// ============================================================
function addFactura(data) {
  if (!data.casoId) throw new Error('addFactura requiere casoId');
  appendObject(SHEETS.facturas, {
    casoId: data.casoId, numeroFactura: data.numeroFactura || '',
    montoFacturado: requireMoney('monto facturado', data.montoFacturado),
    fechaFactura: data.fechaFactura || '', condicionPago: data.condicionPago || '',
    fechaCobroEsperada: data.fechaCobroEsperada || '', fechaEntrega: data.fechaEntrega || '',
    notas: data.notas || ''
  });
  return { appended: true };
}
function updateFactura(rowIndex, fields) { writeFields(SHEETS.facturas, rowIndex, fields); return { updated: rowIndex }; }

// ============================================================
// WRITE — Cobros (varios por caso)
// ============================================================
function addCobro(data) {
  if (!data.casoId) throw new Error('addCobro requiere casoId');
  var cobroId = nextCobroId();
  appendObject(SHEETS.cobros, {
    cobroId: cobroId, casoId: data.casoId,
    montoCobrado: requireMoney('monto cobrado', data.montoCobrado),
    retGanancias: requireMoney('ret. ganancias', data.retGanancias),
    retIIBB: requireMoney('ret. IIBB', data.retIIBB),
    retSuss: requireMoney('ret. SUSS', data.retSuss),
    retSellados: requireMoney('ret. sellados', data.retSellados),
    medioPago: data.medioPago || '', lugarPago: data.lugarPago || '',
    condicionPago: data.condicionPago || '', fechaCobroEsperada: data.fechaCobroEsperada || '',
    fechaCobroReal: data.fechaCobroReal || '', fechaCobroCheque: data.fechaCobroCheque || '',
    notas: data.notas || ''
  });
  return { cobroId: cobroId };
}
function updateCobro(rowIndex, fields) { writeFields(SHEETS.cobros, rowIndex, fields); return { updated: rowIndex }; }

// Registrar cobro "completo" desde un formulario plano (como el viejo registrarCobro):
// crea un caso provisional (sin fechaCx), su factura y su cobro, todo enlazado.
// Reusa el caso si ya existe una factura con ese Nº.
function registrarCobroCompleto(data) {
  var casoId = '';
  var nf = String(data.nroFactura || '').trim();
  if (nf) {
    var fac = readSheet(SHEETS.facturas).rows.filter(function (f) {
      return String(f.numeroFactura || '').trim() === nf; })[0];
    if (fac) casoId = fac.casoId;
  }
  if (!casoId) {
    casoId = nextCasoId();
    appendObject(SHEETS.casos, {
      casoId: casoId, paciente: data.paciente || '', obraSocial: data.obraSocial || '',
      creadoEl: new Date(), actualizadoEl: new Date()
    });
    if (nf || data.montoFacturado) {
      appendObject(SHEETS.facturas, {
        casoId: casoId, numeroFactura: data.nroFactura || '',
        montoFacturado: requireMoney('monto facturado', data.montoFacturado),
        fechaFactura: data.fechaFactura || '', condicionPago: data.condicionPago || '',
        fechaCobroEsperada: data.fechaCobroEsperada || '',
        fechaEntrega: data.fechaEntrega || '', notas: data.notas || ''
      });
    }
  }
  var res = addCobro({
    casoId: casoId, montoCobrado: data.montoCobrado, retGanancias: data.retGanancias,
    retIIBB: data.retIIBB, retSuss: data.retSuss, retSellados: data.retSellados,
    medioPago: data.medioPago, lugarPago: data.lugarPago, condicionPago: data.condicionPago,
    fechaCobroEsperada: data.fechaCobroEsperada, fechaCobroReal: data.fechaCobroReal,
    fechaCobroCheque: data.fechaCobroCheque, notas: data.notas
  });
  return { casoId: casoId, cobroId: res.cobroId };
}

// ============================================================
// WRITE — Pagos y Órdenes de compra
// ============================================================
function addPago(data) {
  appendObject(SHEETS.pagos, {
    casoId: data.casoId || '', fechaEmision: data.fechaEmision || '',
    nroFactura: data.nroFactura || '', monto: requireMoney('monto', data.monto),
    emisor: data.emisor || '', categoria: data.categoria || '', descripcion: data.descripcion || '',
    fechaPago: data.fechaPago || '', pagado: false, formaPago: data.formaPago || '',
    comprobanteEnviado: data.comprobanteEnviado || '', fechaPagoEcheq: data.fechaPagoEcheq || '',
    saldado: false
  });
  return { appended: true };
}
function updatePago(rowIndex, fields) { writeFields(SHEETS.pagos, rowIndex, fields); return { updated: rowIndex }; }

function addOrden(data) {
  var ocId = nextOcId();
  appendObject(SHEETS.ordenes, {
    ocId: ocId, proveedor: data.proveedor || '', material: data.material || '',
    cantidad: Number(data.cantidad) || 0, precioUnitario: requireMoney('precio unitario', data.precioUnitario),
    mesObjetivo: data.mesObjetivo || '', estado: data.estado || 'pendiente',
    numeroFactura: data.numeroFactura || '', casoId: data.casoId || ''
  });
  return { ocId: ocId };
}
function updateOrden(rowIndex, fields) { writeFields(SHEETS.ordenes, rowIndex, fields); return { updated: rowIndex }; }
