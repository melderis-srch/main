// ============================================================
// Surcherie Implantes Quirúrgicos - Google Apps Script Backend
// ============================================================

var CIRUCIAS_SHEET_ID = '1ZMNbsQRzzJScaIP2JB7tJmy8cEafVqHuCDgZGOiFq-M';
var FINANCIERO_SHEET_ID = '1Qy7ylSFMy8-zOCMuGS7B6JUQ8K2BisuDX1WFB5bO-9E';

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// doGet
// ============================================================
function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;
    if (action === 'getCirugias')      result = getCirugias();
    else if (action === 'getConsolidado')   result = getConsolidado();
    else if (action === 'getVentasCobros')  result = getVentasCobros();
    else if (action === 'getGastosPagos')   result = getGastosPagos();
    else result = { error: 'Acción no reconocida: ' + action };
    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// doPost
// ============================================================
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var data = body.data;
    var result;
    if (action === 'updateCobrado')      result = updateCobrado(data.rowIndex, data.fechaCobro);
    else if (action === 'updatePagado')  result = updatePagado(data.rowIndex);
    else if (action === 'addCirugia')    result = addCirugia(data);
    else if (action === 'registrarCobro') result = registrarCobro(data);
    else result = { error: 'Acción no reconocida: ' + action };
    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// READ FUNCTIONS
// ============================================================

function formatFecha(val) {
  if (!val) return '';
  try {
    var d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch(e) { return String(val); }
}

// Hoja "Cirugías":
// Col: 1=Paciente, 2=Medico, 3=Fecha cx, 4=Mes, 5=Pedido/presupuestado,
//      6=Obra Social, 7=Consumo, 8=Valor implantes, 9=Valor descartables,
//      10=Valor logística, 11=Corrección gastos, 12=Valor total,
//      13=Monto presupuesto, 14=Número de Factura, 15=Monto Factura,
//      16=Fecha factura, 17=Fecha cobro, 18=Cobrado,
//      19=Retenciones/otros, 20=Diferencia consumo, 21=Factura-Gastos, 22=%
function getCirugias() {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Cirugías');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1] && !r[2]) continue;
    rows.push({
      rowIndex: i + 1,
      paciente:            r[0]  || '',
      medico:              r[1]  || '',
      fechaCx:             formatFecha(r[2]),
      mes:                 r[3]  || '',
      pedidoPresupuestado: r[4]  || '',
      obraSocial:          r[5]  || '',
      consumo:             r[6]  || '',
      valorImplantes:      r[7]  || '',
      valorDescartables:   r[8]  || '',
      valorLogistica:      r[9]  || '',
      correccionGastos:    r[10] || '',
      valorTotalCostos:    r[11] || '',
      montoPresupuesto:    r[12] || '',
      numeroFactura:       r[13] || '',
      montoFactura:        r[14] || '',
      fechaFactura:        formatFecha(r[15]),
      fechaCobro:          formatFecha(r[16]),  // Col 17: Fecha cobro (real)
      cobrado:             r[17] === true || r[17] === 'TRUE' || r[17] === 'true',
      retencionesOtros:    r[18] || '',
      diferenciaConsumo:   r[19] || '',
      facturaGastos:       r[20] || '',
      pctMargen:           r[21] || ''
    });
  }
  return rows;
}

// Hoja "Consolidado": estructura pivotada
// Fila 1: col A = "Cantidad de cirugías", cols B+ = meses (ej: "Enero/31")
// Filas siguientes: col A = nombre de métrica, cols B+ = valores por mes
function getConsolidado() {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Consolidado');
  var data = sheet.getDataRange().getValues();

  // Encontrar la fila de encabezado (contiene "cantidad" en col A)
  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).toLowerCase().indexOf('cantidad') !== -1) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return [];

  // Extraer columnas de meses desde la fila de encabezado
  var months = [];
  for (var j = 1; j < data[headerRow].length; j++) {
    var cell = String(data[headerRow][j] || '').trim();
    if (!cell) continue;
    // "Enero/31" → nombre = "Enero", cantidad en header
    var monthName = cell.split('/')[0].trim();
    months.push({ colIndex: j, name: monthName });
  }

  // Mapear filas por su etiqueta en col A (desde la fila de encabezado en adelante)
  var rowMap = {};
  for (var i = headerRow; i < data.length; i++) {
    var label = String(data[i][0] || '').trim().toLowerCase();
    if (label) rowMap[label] = i;
  }

  // Construir resultado como array de objetos por mes
  var result = [];
  for (var m = 0; m < months.length; m++) {
    var col = months[m].colIndex;
    var obj = {
      mes:                    months[m].name,
      cantidadCirugias:       '',
      facturasMesCorriente:   '',
      facturasMesAnterior:    '',
      montoFacturadoTotal:    '',
      costosCirugias:         '',
      montoRecolectado:       '',
      gastosProveedores:      '',
      otrosGastos:            '',
      totalGastos:            '',
      pctRecoleccion:         '',
      pctRentabilidad:        ''
    };

    for (var label in rowMap) {
      var ri = rowMap[label];
      var val = data[ri][col];
      if (val === '' || val === null || val === undefined) val = '';
      if      (label.indexOf('cantidad') !== -1)                        obj.cantidadCirugias = val;
      else if (label.indexOf('corriente') !== -1)                       obj.facturasMesCorriente = val;
      else if (label.indexOf('anterior') !== -1)                        obj.facturasMesAnterior = val;
      else if (label.indexOf('monto facturado') !== -1 || label.indexOf('total') !== -1) obj.montoFacturadoTotal = val;
      else if (label.indexOf('costos') !== -1)                          obj.costosCirugias = val;
      else if (label.indexOf('recolect') !== -1 || label.indexOf('cobrado') !== -1) obj.montoRecolectado = val;
      else if (label.indexOf('proveedores') !== -1)                     obj.gastosProveedores = val;
      else if (label.indexOf('otros gastos') !== -1)                    obj.otrosGastos = val;
      else if (label.indexOf('total gastos') !== -1)                    obj.totalGastos = val;
      else if (label.indexOf('recolec') !== -1 && label.indexOf('%') !== -1) obj.pctRecoleccion = val;
      else if (label.indexOf('rentab') !== -1)                          obj.pctRentabilidad = val;
    }

    result.push(obj);
  }
  return result;
}

// Hoja "VENTASCOBROS":
// Col: 1=Paciente, 2=Obra social, 3=N° Factura, 4=Monto facturado,
//      5=Fecha factura, 6=Ret. ganancias, 7=Ret. IIBB, 8=Ret. Sellados,
//      9=Monto Cobrado, 10=Medio de pago, 11=Lugar de pago,
//      12=Condición de pago, 13=Fecha de cobro (esperada),
//      14=Fecha de cobro REAL, 15=Fecha de cobro cheque
function getVentasCobros() {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('VENTASCOBROS');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[2]) continue;
    rows.push({
      rowIndex:             i + 1,
      paciente:             r[0]  || '',
      obraSocial:           r[1]  || '',
      nroFactura:           r[2]  || '',
      montoFacturado:       r[3]  || '',
      fechaFactura:         formatFecha(r[4]),
      retGanancias:         r[5]  || '',
      retIIBB:              r[6]  || '',
      retSellados:          r[7]  || '',
      montoCobrado:         r[8]  || '',
      medioPago:            r[9]  || '',
      lugarPago:            r[10] || '',
      condicionPago:        r[11] || '',
      fechaCobroEsperada:   formatFecha(r[12]),  // Col 13: Fecha de cobro (esperada)
      fechaCobroReal:       formatFecha(r[13]),  // Col 14: Fecha de cobro REAL
      fechaCobroCheque:     formatFecha(r[14])   // Col 15: Fecha de cobro cheque
    });
  }
  return rows;
}

// Hoja "GASTOSPAGOS":
// Col: 1=Fecha emisión, 2=N° Factura, 3=Monto, 4=Emisor, 5=Categorias,
//      6=Descripción, 7=Fecha de pago, 8=Pago (TRUE/FALSE),
//      9=Forma de pago, 10=Comprobante enviado, 11=Recibo, 12=Reclamos
function getGastosPagos() {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('GASTOSPAGOS');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1]) continue;
    rows.push({
      rowIndex:             i + 1,
      fechaEmision:         formatFecha(r[0]),
      nroFactura:           r[1]  || '',
      monto:                r[2]  || '',
      emisor:               r[3]  || '',
      categoria:            r[4]  || '',
      descripcion:          r[5]  || '',
      fechaPago:            formatFecha(r[6]),
      pagado:               r[7] === true || r[7] === 'TRUE' || r[7] === 'true',
      formaPago:            r[8]  || '',
      comprobanteEnviado:   r[9]  || '',
      recibo:               r[10] || '',
      reclamos:             r[11] || ''
    });
  }
  return rows;
}

// ============================================================
// WRITE FUNCTIONS
// ============================================================

// updateCobrado: marca cirugía como cobrada
// Col 18 (idx 17) = Cobrado, Col 17 (idx 16) = Fecha cobro
function updateCobrado(rowIndex, fechaCobro) {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Cirugías');
  sheet.getRange(rowIndex, 18).setValue(true);
  if (fechaCobro) {
    sheet.getRange(rowIndex, 17).setValue(fechaCobro);
  }
  return { updated: rowIndex };
}

// updatePagado: marca gasto como pagado
// Col 8 (idx 7) = Pago, Col 7 (idx 6) = Fecha de pago
function updatePagado(rowIndex) {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('GASTOSPAGOS');
  sheet.getRange(rowIndex, 8).setValue(true);
  sheet.getRange(rowIndex, 7).setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')
  );
  return { updated: rowIndex };
}

function addCirugia(data) {
  var ss = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = ss.getSheetByName('Cirugías');
  sheet.appendRow([
    data.paciente            || '',
    data.medico              || '',
    data.fechaCx             || '',
    data.mes                 || '',
    data.pedidoPresupuestado || '',
    data.obraSocial          || '',
    data.consumo             || '',
    data.valorImplantes      || '',
    data.valorDescartables   || '',
    data.valorLogistica      || '',
    data.correccionGastos    || '',
    data.valorTotalCostos    || '',
    data.montoPresupuesto    || '',
    data.numeroFactura       || '',
    data.montoFactura        || '',
    data.fechaFactura        || '',
    data.fechaCobro          || '',
    false,
    data.retencionesOtros    || '',
    '', '', ''  // columnas calculadas por fórmulas del sheet
  ]);
  return { appended: true };
}

function registrarCobro(data) {
  var ss = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = ss.getSheetByName('VENTASCOBROS');
  sheet.appendRow([
    data.paciente           || '',
    data.obraSocial         || '',
    data.nroFactura         || '',
    data.montoFacturado     || '',
    data.fechaFactura       || '',
    data.retGanancias       || '',
    data.retIIBB            || '',
    data.retSellados        || '',
    data.montoCobrado       || '',
    data.medioPago          || '',
    data.lugarPago          || '',
    data.condicionPago      || '',
    data.fechaCobroEsperada || '',
    data.fechaCobroReal     || '',
    data.fechaCobroCheque   || ''
  ]);
  return { appended: true };
}
