// ============================================================
// Surcherie Implantes Quirúrgicos - Google Apps Script Backend
// ============================================================

var CIRUCIAS_SHEET_ID = '1ZMNbsQRzzJScaIP2JB7tJmy8cEafVqHuCDgZGOiFq-M';
var FINANCIERO_SHEET_ID = '1Qy7ylSFMy8-zOCMuGS7B6JUQ8K2BisuDX1WFB5bO-9E';

// CORS headers helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function makeResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// OPTIONS preflight
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// doGet - handles all read actions
// ============================================================
function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;

    if (action === 'getCirugias') {
      result = getCirugias();
    } else if (action === 'getConsolidado') {
      result = getConsolidado();
    } else if (action === 'getVentasCobros') {
      result = getVentasCobros();
    } else if (action === 'getGastosPagos') {
      result = getGastosPagos();
    } else {
      result = { error: 'Acción no reconocida: ' + action };
    }

    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// doPost - handles all write actions
// ============================================================
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var data = body.data;
    var result;

    if (action === 'updateCobrado') {
      result = updateCobrado(data.rowIndex, data.fechaCobroReal);
    } else if (action === 'updatePagado') {
      result = updatePagado(data.rowIndex);
    } else if (action === 'addCirugia') {
      result = addCirugia(data);
    } else if (action === 'registrarCobro') {
      result = registrarCobro(data);
    } else {
      result = { error: 'Acción no reconocida: ' + action };
    }

    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// READ FUNCTIONS
// ============================================================

function getCirugias() {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Cirugías');
  var data = sheet.getDataRange().getValues();
  // skip header row (index 0)
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    // skip completely empty rows
    if (!r[0] && !r[1] && !r[2]) continue;
    rows.push({
      rowIndex: i + 1, // 1-based sheet row
      paciente: r[0] || '',
      medico: r[1] || '',
      fechaCx: r[2] ? Utilities.formatDate(new Date(r[2]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      mes: r[3] || '',
      pedidoPresupuestado: r[4] || '',
      obraSocial: r[5] || '',
      consumo: r[6] || '',
      valorImplantes: r[7] || '',
      valorDescartables: r[8] || '',
      valorLogistica: r[9] || '',
      correccionGastos: r[10] || '',
      valorTotalCostos: r[11] || '',
      montoPresupuesto: r[12] || '',
      numeroFactura: r[13] || '',
      montoFactura: r[14] || '',
      fechaFactura: r[15] ? Utilities.formatDate(new Date(r[15]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      fechaCobroEsperada: r[16] ? Utilities.formatDate(new Date(r[16]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      cobrado: r[17] === true || r[17] === 'TRUE' || r[17] === 'true',
      retencionesOtros: r[18] || '',
      diferenciaConsumo: r[19] || '',
      facturaGastos: r[20] || '',
      pctMargen: r[21] || ''
    });
  }
  return rows;
}

function getConsolidado() {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Consolidado');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    rows.push({
      mes: r[0] || '',
      cantidadCirugias: r[1] || 0,
      facturasMesCxCorriente: r[2] || '',
      facturasMesCxAnterior: r[3] || '',
      montoFacturadoTotal: r[4] || '',
      costosCirugias: r[5] || '',
      montoRecolectado: r[6] || '',
      gastosProveedores: r[7] || '',
      otrosGastos: r[8] || '',
      totalGastos: r[9] || '',
      pctRecoleccion: r[10] || '',
      pctRentabilidad: r[11] || ''
    });
  }
  return rows;
}

function getVentasCobros() {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('VENTASCOBROS');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[2]) continue;
    rows.push({
      rowIndex: i + 1,
      paciente: r[0] || '',
      obraSocial: r[1] || '',
      nroFactura: r[2] || '',
      montoFacturado: r[3] || '',
      fechaFactura: r[4] ? Utilities.formatDate(new Date(r[4]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      retGanancias: r[5] || '',
      retIIBB: r[6] || '',
      retSellados: r[7] || '',
      montoCobrado: r[8] || '',
      medioPago: r[9] || '',
      lugarPago: r[10] || '',
      condicionPago: r[11] || '',
      fechaCobroEsperada: r[12] ? Utilities.formatDate(new Date(r[12]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      fechaCobroReal: r[13] ? Utilities.formatDate(new Date(r[13]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''
    });
  }
  return rows;
}

function getGastosPagos() {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('GASTOSPAGOS');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1]) continue;
    rows.push({
      rowIndex: i + 1,
      fechaEmision: r[0] ? Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      nroFactura: r[1] || '',
      monto: r[2] || '',
      emisor: r[3] || '',
      categoria: r[4] || '',
      descripcion: r[5] || '',
      fechaPago: r[6] ? Utilities.formatDate(new Date(r[6]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      pagado: r[7] === true || r[7] === 'TRUE' || r[7] === 'true',
      formaPago: r[8] || '',
      comprobanteEnviado: r[9] || '',
      recibo: r[10] || ''
    });
  }
  return rows;
}

// ============================================================
// WRITE FUNCTIONS
// ============================================================

function updateCobrado(rowIndex, fechaCobroReal) {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Cirugías');
  sheet.getRange(rowIndex, 18).setValue(true);   // col 18 = Cobrado
  if (fechaCobroReal) {
    sheet.getRange(rowIndex, 17).setValue(fechaCobroReal); // col 17 = Fecha cobro esperada (usamos como cobro real también)
  }
  return { updated: rowIndex };
}

function updatePagado(rowIndex) {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('GASTOSPAGOS');
  sheet.getRange(rowIndex, 8).setValue(true); // col 8 = Pagado
  sheet.getRange(rowIndex, 7).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')); // fecha pago
  return { updated: rowIndex };
}

function addCirugia(data) {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Cirugías');
  var newRow = [
    data.paciente || '',
    data.medico || '',
    data.fechaCx || '',
    data.mes || '',
    data.pedidoPresupuestado || '',
    data.obraSocial || '',
    data.consumo || '',
    data.valorImplantes || '',
    data.valorDescartables || '',
    data.valorLogistica || '',
    data.correccionGastos || '',
    data.valorTotalCostos || '',
    data.montoPresupuesto || '',
    data.numeroFactura || '',
    data.montoFactura || '',
    data.fechaFactura || '',
    data.fechaCobroEsperada || '',
    false, // Cobrado
    data.retencionesOtros || '',
    '', // Diferencia consumo (calculado)
    '', // Factura - Gastos (calculado)
    ''  // % margen (calculado)
  ];
  sheet.appendRow(newRow);
  return { appended: true };
}

function registrarCobro(data) {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('VENTASCOBROS');
  var newRow = [
    data.paciente || '',
    data.obraSocial || '',
    data.nroFactura || '',
    data.montoFacturado || '',
    data.fechaFactura || '',
    data.retGanancias || '',
    data.retIIBB || '',
    data.retSellados || '',
    data.montoCobrado || '',
    data.medioPago || '',
    data.lugarPago || '',
    data.condicionPago || '',
    data.fechaCobroEsperada || '',
    data.fechaCobroReal || ''
  ];
  sheet.appendRow(newRow);
  return { appended: true };
}
