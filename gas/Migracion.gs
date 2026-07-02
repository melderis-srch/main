// ============================================================
// Surcherie — Setup + Migración a la Planilla Maestra
// ============================================================
// Dos funciones que se corren MANUALMENTE una sola vez desde el
// editor de Apps Script, en orden:
//
//   1) setupMaestra()  → crea las hojas con encabezados, dropdowns
//                        y la hoja _config. Correr sobre la planilla
//                        maestra nueva (vacía).
//   2) migrar()        → lee las 3 planillas viejas y llena la
//                        maestra asignando casoId. Deja la hoja
//                        "_migracion_report" con los casos ambiguos
//                        para revisar a mano. NO borra nada viejo.
//
// Depende de los helpers de Code.v2.gs (mismo proyecto): parseMoney,
// parseBool, parseFechaFlexible, toISO, normalizeNombre,
// normalizarEstadoPresup, SHEETS, MASTER_SHEET_ID, OLD_*_ID.
// ============================================================

// Definición de hojas y sus encabezados (orden = orden de columnas).
var SCHEMA = {
  Casos: ['casoId','paciente','medico','obraSocial','sanatorio','estadoCaso','fechaCotizacion',
    'fechaAutorizacion','fechaCx','presupuestoId','material','creadoEl','actualizadoEl'],
  Presupuestos: ['presupuestoId','casoId','paciente','medico','obraSocial','material',
    'numeroPresupuesto','precioCotizacion','fechaCotizacion','precioMejora','estado',
    'fechaAutorizacion','condicionPago','realizada','fechaCx','observaciones','actualizadoEl'],
  Cirugias: ['casoId','mes','pedidoPresupuestado','consumo','valorImplantes','valorDescartables',
    'valorLogistica','correccionGastos','valorTotalCostos','montoPresupuesto','retencionesOtros','actualizadoEl'],
  Facturas: ['casoId','numeroFactura','montoFacturado','fechaFactura','fechaEntrega','notas','actualizadoEl'],
  Cobros: ['cobroId','casoId','montoCobrado','retGanancias','retIIBB','retSuss','retSellados',
    'medioPago','lugarPago','condicionPago','fechaCobroEsperada','fechaCobroReal','fechaCobroCheque','notas','actualizadoEl'],
  Pagos: ['casoId','fechaEmision','nroFactura','monto','emisor','categoria','descripcion',
    'fechaPago','pagado','formaPago','comprobanteEnviado','fechaPagoEcheq','saldado','actualizadoEl'],
  OrdenesCompra: ['ocId','proveedor','material','cantidad','precioUnitario','mesObjetivo',
    'estado','numeroFactura','casoId','actualizadoEl'],
  Usuarios: ['email','rol','modulos'],
  _config: ['clave','valor']
};

var ESTADOS_PRESUP_LIST = ['Cotizada','Autorizada','Perdida','Baja','Rechazada'];
var ESTADOS_OC_LIST = ['pendiente','recibida'];

// ------------------------------------------------------------
// 1) SETUP
// ------------------------------------------------------------
function setupMaestra() {
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clear();
    var headers = SCHEMA[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#F3F4F6');
    sh.setFrozenRows(1);
    if (name === 'Casos' || name === 'Presupuestos' || name === 'Cirugias' ||
        name === 'Facturas' || name === 'Cobros') {
      sh.setFrozenColumns(1); // casoId / presupuestoId / cobroId
    }
  });

  // Dropdowns de estado
  applyDropdown('Presupuestos', 'estado', ESTADOS_PRESUP_LIST);
  applyDropdown('OrdenesCompra', 'estado', ESTADOS_OC_LIST);

  // Seed _config con secuencias en 0 para el año actual
  var year = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy');
  var cfg = ss.getSheetByName('_config');
  cfg.getRange(2, 1, 4, 2).setValues([
    ['casoSeq_' + year, 0],
    ['presupSeq_' + year, 0],
    ['cobroSeq_' + year, 0],
    ['ocSeq_' + year, 0]
  ]);

  // Borrar la hoja default "Hoja 1" / "Sheet1" si quedó vacía
  ['Hoja 1','Hoja1','Sheet1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  return 'Setup completo: ' + Object.keys(SCHEMA).length + ' hojas creadas.';
}

function applyDropdown(sheetName, colName, options) {
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  var sh = ss.getSheetByName(sheetName);
  var col = SCHEMA[sheetName].indexOf(colName) + 1;
  if (col < 1) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(options, true).build();
  sh.getRange(2, col, sh.getMaxRows() - 1, 1).setDataValidation(rule);
}

// ------------------------------------------------------------
// 2) MIGRACIÓN
// ------------------------------------------------------------
function migrar() {
  var report = []; // filas de ambigüedad para revisar
  var yearSeq = { caso: 0, presup: 0, cobro: 0 };
  var tz = SpreadsheetApp.openById(MASTER_SHEET_ID).getSpreadsheetTimeZone();
  var year = Utilities.formatDate(new Date(), tz, 'yyyy');

  function mkId(prefix, kind) { yearSeq[kind]++; return prefix + '-' + year + '-' + ('0000' + yearSeq[kind]).slice(-4); }

  // ---- Leer viejas ----
  var oldCir  = valuesOf(OLD_CIRUGIAS_ID, 'Cirugías');
  var oldVC   = valuesOf(OLD_FINANCIERO_ID, 'VENTASCOBROS');
  var oldGP   = valuesOf(OLD_FINANCIERO_ID, 'GASTOSPAGOS');
  var oldPres = valuesOf(OLD_PRESUPUESTOS_ID, 'Presupuestos');

  var casos = {};          // clave nombre|fechaCx|material -> {casoId}
  var casoByFactura = {};  // nº de factura normalizado -> casoId (clave real entre hojas)
  var casoByNombre = {};   // nombre normalizado -> casoId (fallback para filas sin nº factura)
  var facturaSeen = {};    // nº de factura ya volcado a la hoja Facturas (evita duplicados)
  var casosRows = [], presupRows = [], cirugiaRows = [], facturaRows = [], cobroRows = [], pagoRows = [];

  function nfKey(nro) { return String(nro || '').trim().toLowerCase(); }

  // Crea una fila de caso y devuelve su casoId. Registra índices de matcheo.
  // orden = SCHEMA.Casos: casoId, paciente, medico, obraSocial, sanatorio, estadoCaso,
  //   fechaCotizacion, fechaAutorizacion, fechaCx, presupuestoId, material, creadoEl, actualizadoEl
  function pushCaso(paciente, medico, obraSocial, sanatorio, fechaCx, material, nro) {
    var casoId = mkId('CX', 'caso');
    casosRows.push([casoId, paciente || '', medico || '', obraSocial || '', sanatorio || '',
      '', '', '', parseFechaFlexible(fechaCx) || '', '', material || '', new Date(), new Date()]);
    var pn = normalizeNombre(paciente);
    if (pn && !casoByNombre[pn]) casoByNombre[pn] = casoId;
    if (nfKey(nro)) casoByFactura[nfKey(nro)] = casoId;
    return casoId;
  }

  // Caso de cirugía: identidad por nombre+fechaCx+material (requiere fechaCx).
  function ensureCasoCirugia(paciente, medico, obraSocial, fechaCx, material, nro, fuente) {
    if (!toISO(fechaCx)) {
      report.push([fuente, paciente, String(nro || ''), 'sin fechaCx — no se pudo asignar caso', '']);
      return null;
    }
    var key = normalizeNombre(paciente) + '|' + toISO(fechaCx) + '|' + normalizeNombre(material);
    if (casos[key]) {
      if (nfKey(nro)) casoByFactura[nfKey(nro)] = casos[key].casoId;
      return casos[key].casoId;
    }
    var casoId = pushCaso(paciente, medico, obraSocial, '', fechaCx, material, nro);
    casos[key] = { casoId: casoId };
    return casoId;
  }

  // ---- Cirugías (crean casos con fechaCx + costos) ----
  // cols viejas: 1=Pac 2=Med 3=FechaCx 4=Mes 6=OS 7=Pedido 8=Consumo 8..12 costos
  //   13=montoPresup 14=NºFactura 15=MontoFactura 16=FechaFactura ... 19=RetOtros
  for (var i = 1; i < oldCir.length; i++) {
    var r = oldCir[i];
    if (!r[0] && !r[1] && !r[2]) continue;
    var casoId = ensureCasoCirugia(r[0], r[1], r[5], r[2], '', r[13], 'Cirugías#' + (i + 1));
    if (!casoId) continue;
    cirugiaRows.push([casoId, r[3] || '', r[4] || '', r[6] || '',
      parseMoney(r[7]), parseMoney(r[8]), parseMoney(r[9]), parseMoney(r[10]),
      parseMoney(r[11]), parseMoney(r[12]), parseMoney(r[18]), new Date()]);
    // La factura embebida en la cirugía se registra para el match, pero la fila de
    // factura se crea desde VENTASCOBROS (hoja financiera autoritativa) para no duplicar.
  }

  // ---- Presupuestos ----
  // cols: 1=Pac 2=Med 3=OS 4=Mat 5=nro 6=cotiz 7=fCotiz 8=mejora 9=estado 10=fAut 11=cond 12=realiz 13=fCx 14=obs
  for (var p = 1; p < oldPres.length; p++) {
    var pr = oldPres[p];
    if (!pr[0] && !pr[1]) continue;
    if (String(pr[0]).toLowerCase() === 'paciente') continue;
    var estado = normalizarEstadoPresup(pr[8]);
    var presupId = mkId('PR', 'presup');
    var casoIdP = '';
    if (estado === 'Autorizada' && toISO(pr[12])) {
      casoIdP = ensureCasoCirugia(pr[0], pr[1], pr[2], pr[12], pr[3], '', 'Presup#' + (p + 1)) || '';
    }
    presupRows.push([presupId, casoIdP, pr[0] || '', pr[1] || '', pr[2] || '', pr[3] || '',
      String(pr[4] || ''), parseMoney(pr[5]), parseFechaFlexible(pr[6]) || '', parseMoney(pr[7]),
      estado, parseFechaFlexible(pr[9]) || '', pr[10] || '', parseBool(pr[11]),
      parseFechaFlexible(pr[12]) || '', pr[13] || '', new Date()]);
  }

  // ---- VENTASCOBROS → Facturas + Cobros ----
  // cols: 1=Pac 2=OS 3=nro 4=montoFact 5=fFact 6=retGan 7=retIIBB 8=retSell
  //       9=montoCobrado 10=medio 11=lugar 12=cond 13=fEsper 14=fReal 15=fCheque 16=retSuss 17=fEntrega 18=notas
  //
  // Estrategia de enlace (de más a menos confiable):
  //   1) por Nº de factura → reusa el caso de la cirugía o de otra fila con ese Nº
  //      (esto une "misma cirugía facturada en varias veces" = mismo caso).
  //   2) sin Nº y con nombre ya visto → reusa ese caso.
  //   3) si nada matchea → CREA un caso nuevo (provisional, sin fechaCx/material),
  //      porque una factura implica que hubo cirugía. Se reporta para completar.
  var creadosDesdeVC = 0;
  for (var v = 1; v < oldVC.length; v++) {
    var vc = oldVC[v];
    if (!vc[0] && !vc[2]) continue;
    var nf = nfKey(vc[2]);
    var casoIdV = '';
    if (nf && casoByFactura[nf]) {
      casoIdV = casoByFactura[nf];                       // (1) match por Nº factura
    } else if (!nf && casoByNombre[normalizeNombre(vc[0])]) {
      casoIdV = casoByNombre[normalizeNombre(vc[0])];    // (2) fallback por nombre
    } else {
      casoIdV = pushCaso(vc[0], '', vc[1], '', '', '', vc[2]); // (3) crear provisional
      creadosDesdeVC++;
      report.push(['VENTASCOBROS#' + (v + 1), vc[0], String(vc[2] || ''),
        'caso creado desde cobranza — falta cargar fechaCx / médico / material', casoIdV]);
    }

    // Factura (una sola fila por Nº de factura; si no hay Nº, se vuelca igual)
    if (vc[2] || vc[3]) {
      var yaVolcada = nf && facturaSeen[nf];
      if (!yaVolcada) {
        facturaRows.push([casoIdV, String(vc[2] || ''), parseMoney(vc[3]),
          parseFechaFlexible(vc[4]) || '', parseFechaFlexible(vc[16]) || '', vc[17] || '', new Date()]);
        if (nf) facturaSeen[nf] = true;
      }
    }
    // Cobro: una fila por movimiento (los pagos parciales de una factura suman varios)
    var hayCobro = vc[8] || vc[13] || vc[5] || vc[6] || vc[7] || vc[15];
    if (hayCobro) {
      cobroRows.push([mkId('CO', 'cobro'), casoIdV, parseMoney(vc[8]),
        parseMoney(vc[5]), parseMoney(vc[6]), parseMoney(vc[15]), parseMoney(vc[7]),
        vc[9] || '', vc[10] || '', vc[11] || '',
        parseFechaFlexible(vc[12]) || '', parseFechaFlexible(vc[13]) || '', parseFechaFlexible(vc[14]) || '',
        vc[17] || '', new Date()]);
    }
  }

  // ---- GASTOSPAGOS → Pagos ----
  // cols: A=fEmision B=nro C=monto D=emisor E=cat F=desc G=fPago H=pagado I=forma J=compEnv K=fEcheq L=saldado
  for (var g = 1; g < oldGP.length; g++) {
    var gp = oldGP[g];
    if (!gp[0] && !gp[1]) continue;
    if (String(gp[3]).toLowerCase() === 'emisor') continue;
    pagoRows.push(['', parseFechaFlexible(gp[0]) || '', String(gp[1] || ''), parseMoney(gp[2]),
      gp[3] || '', gp[4] || '', gp[5] || '', parseFechaFlexible(gp[6]) || '', parseBool(gp[7]),
      gp[8] || '', gp[9] || '', parseFechaFlexible(gp[10]) || '', parseBool(gp[11]), new Date()]);
  }

  // ---- Escribir a la maestra (limpiando datos previos para re-correr sin duplicar) ----
  ['Casos','Presupuestos','Cirugias','Facturas','Cobros','Pagos'].forEach(clearDataRows);
  bulkWrite('Casos', casosRows);
  bulkWrite('Presupuestos', presupRows);
  bulkWrite('Cirugias', cirugiaRows);
  bulkWrite('Facturas', facturaRows);
  bulkWrite('Cobros', cobroRows);
  bulkWrite('Pagos', pagoRows);

  // Actualizar secuencias en _config
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  var cfg = ss.getSheetByName('_config');
  setConfig(cfg, 'casoSeq_' + year, yearSeq.caso);
  setConfig(cfg, 'presupSeq_' + year, yearSeq.presup);
  setConfig(cfg, 'cobroSeq_' + year, yearSeq.cobro);

  // Reporte de ambigüedades
  writeReport(ss, report);

  return 'Migración completa. Casos: ' + casosRows.length + ' (de los cuales ' + creadosDesdeVC +
    ' se crearon desde cobranza y necesitan fechaCx/médico/material). Presup: ' + presupRows.length +
    ', Cirugías: ' + cirugiaRows.length + ', Facturas: ' + facturaRows.length +
    ', Cobros: ' + cobroRows.length + ', Pagos: ' + pagoRows.length +
    '. Filas en _migracion_report: ' + report.length + '.';
}

// Match por nombre: si hay UN solo caso con ese nombre normalizado, lo usa;
// si hay 0 o >1, devuelve null (ambiguo → al reporte).
function matchCasoPorNombre(casos, nombre) {
  var pn = normalizeNombre(nombre);
  var hits = [];
  for (var k in casos) { if (k.split('|')[0] === pn) hits.push(casos[k].casoId); }
  return hits.length === 1 ? hits[0] : null;
}

function valuesOf(spreadsheetId, sheetName) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    // tolerar tildes/nombres: buscar normalizado
    var target = normalizeNombre(sheetName);
    sh = ss.getSheets().filter(function (s) { return normalizeNombre(s.getName()) === target; })[0];
  }
  if (!sh) throw new Error('No se encontró la hoja vieja "' + sheetName + '" en ' + spreadsheetId);
  return sh.getDataRange().getValues();
}

// ------------------------------------------------------------
// 3) VERIFICACIÓN — busca duplicados e inconsistencias
// ------------------------------------------------------------
// Correr DESPUÉS de migrar(). Deja la hoja "_verificacion" con todo
// lo que encuentre y devuelve un resumen. No modifica datos.
function verificar() {
  var casos    = readSheet('Casos').rows;
  var facturas = readSheet('Facturas').rows;
  var cobros   = readSheet('Cobros').rows;
  var pagos    = readSheet('Pagos').rows;
  var hallazgos = []; // [tipo, referencia, detalle]

  // 1) casoId duplicado en Casos (no debería pasar nunca)
  contarDuplicados(casos, 'casoId', function (val, filas) {
    hallazgos.push(['casoId duplicado en Casos', val, 'filas ' + filas.join(', ')]);
  });

  // 2) Nº de factura repetido en Facturas (posible factura duplicada)
  contarDuplicados(facturas.filter(function (f) { return String(f.numeroFactura || '').trim(); }),
    'numeroFactura', function (val, filas) {
      hallazgos.push(['Nº de factura repetido', val, 'aparece en ' + filas.length + ' facturas (filas ' + filas.join(', ') + ')']);
    });

  // 3) Casos "gemelos": mismo paciente + fechaCx + material (posible caso duplicado)
  var byIdentidad = {};
  casos.forEach(function (c) {
    var fx = toISO(c.fechaCx);
    if (!fx) return; // los provisionales sin fechaCx no se comparan acá
    var k = normalizeNombre(c.paciente) + '|' + fx + '|' + normalizeNombre(c.material);
    (byIdentidad[k] = byIdentidad[k] || []).push(c.casoId);
  });
  Object.keys(byIdentidad).forEach(function (k) {
    if (byIdentidad[k].length > 1) {
      hallazgos.push(['Casos posiblemente duplicados', k.split('|')[0],
        'mismos paciente+fechaCx+material: ' + byIdentidad[k].join(', ')]);
    }
  });

  // 4) Facturas/cobros sin casoId (huérfanos — no debería quedar ninguno)
  facturas.forEach(function (f) {
    if (!f.casoId) hallazgos.push(['Factura sin casoId', String(f.numeroFactura || ''), 'fila ' + f._row]);
  });
  cobros.forEach(function (c) {
    if (!c.casoId) hallazgos.push(['Cobro sin casoId', c.cobroId || '', 'fila ' + c._row]);
  });

  // 5) Facturas/cobros que apuntan a un casoId inexistente
  var idsCaso = {}; casos.forEach(function (c) { idsCaso[c.casoId] = true; });
  facturas.forEach(function (f) {
    if (f.casoId && !idsCaso[f.casoId]) hallazgos.push(['Factura con casoId inexistente', f.casoId, 'fila ' + f._row]);
  });
  cobros.forEach(function (c) {
    if (c.casoId && !idsCaso[c.casoId]) hallazgos.push(['Cobro con casoId inexistente', c.casoId, 'fila ' + c._row]);
  });

  // 6) Pagos a proveedores con mismo Nº de factura (posible pago cargado dos veces)
  contarDuplicados(pagos.filter(function (p) { return String(p.nroFactura || '').trim(); }),
    'nroFactura', function (val, filas) {
      hallazgos.push(['Pago con Nº repetido', val, 'filas ' + filas.join(', ')]);
    });

  // Escribir hoja de resultados
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  var sh = ss.getSheetByName('_verificacion') || ss.insertSheet('_verificacion');
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['tipo', 'referencia', 'detalle']])
    .setFontWeight('bold').setBackground('#DBEAFE');
  if (hallazgos.length) sh.getRange(2, 1, hallazgos.length, 3).setValues(hallazgos);
  else sh.getRange(2, 1).setValue('✓ Sin duplicados ni inconsistencias.');

  return hallazgos.length === 0
    ? '✓ Todo limpio: no se encontraron duplicados ni inconsistencias.'
    : 'Se encontraron ' + hallazgos.length + ' cosas para revisar (ver hoja _verificacion).';
}

// Agrupa filas por un campo y llama al callback por cada valor con 2+ apariciones.
function contarDuplicados(rows, campo, cb) {
  var m = {};
  rows.forEach(function (r) {
    var val = String(r[campo] || '').trim().toLowerCase();
    if (!val) return;
    (m[val] = m[val] || []).push(r._row);
  });
  Object.keys(m).forEach(function (val) { if (m[val].length > 1) cb(val, m[val]); });
}

// Borra las filas de datos (deja el encabezado) para poder re-correr la migración.
function clearDataRows(sheetName) {
  var sh = SpreadsheetApp.openById(MASTER_SHEET_ID).getSheetByName(sheetName);
  if (!sh) return;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
}

function bulkWrite(sheetName, rows) {
  if (!rows.length) return;
  var sh = SpreadsheetApp.openById(MASTER_SHEET_ID).getSheetByName(sheetName);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function setConfig(cfg, key, value) {
  var data = cfg.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) { cfg.getRange(i + 1, 2).setValue(value); return; }
  }
  cfg.appendRow([key, value]);
}

function writeReport(ss, report) {
  var name = '_migracion_report';
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  sh.getRange(1, 1, 1, 5).setValues([['fuente','paciente','referencia','problema','sugerencia']])
    .setFontWeight('bold').setBackground('#FEF3C7');
  if (report.length) sh.getRange(2, 1, report.length, 5).setValues(report);
}
