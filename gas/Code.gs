// ============================================================
// Surcherie Implantes Quirúrgicos - Google Apps Script Backend
// ============================================================

var CIRUCIAS_SHEET_ID  = '1ZMNbsQRzzJScaIP2JB7tJmy8cEafVqHuCDgZGOiFq-M';
var FINANCIERO_SHEET_ID = '1Qy7ylSFMy8-zOCMuGS7B6JUQ8K2BisuDX1WFB5bO-9E';

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

// Busca una hoja por nombre ignorando tildes y mayúsculas
function findSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  function normalize(s) {
    return s.toLowerCase()
      .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e')
      .replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o')
      .replace(/[úùûü]/g,'u')
      .replace(/[^a-z0-9]/g,''); // quita espacios, barras, guiones, etc.
  }
  var target = normalize(name);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normalize(sheets[i].getName()) === target) return sheets[i];
  }
  return null;
}

// ============================================================
// doGet
// ============================================================
function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;
    if      (action === 'getCirugias')     result = getCirugias();
    else if (action === 'getConsolidado')  result = getConsolidado();
    else if (action === 'getVentasCobros') result = getVentasCobros();
    else if (action === 'getGastosPagos')  result = getGastosPagos();
    else if (action === 'getSheetNames')   result = getSheetNames();
    else result = { error: 'Accion no reconocida: ' + action };
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
    var data   = body.data;
    var result;
    if      (action === 'updateCobrado')   result = updateCobrado(data.rowIndex, data.fechaCobro);
    else if (action === 'updatePagado')    result = updatePagado(data.rowIndex);
    else if (action === 'addCirugia')      result = addCirugia(data);
    else if (action === 'registrarCobro')  result = registrarCobro(data);
    else result = { error: 'Accion no reconocida: ' + action };
    return makeResponse({ success: true, data: result });
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// HELPERS
// ============================================================
function formatFecha(val) {
  if (!val) return '';
  try {
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch(e) { return String(val); }
}

// Debug: lista nombres exactos de todas las hojas
function getSheetNames() {
  var result = {};
  var ss1 = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  result.cirugiasSheets = ss1.getSheets().map(function(s){ return s.getName(); });
  var ss2 = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  result.financieroSheets = ss2.getSheets().map(function(s){ return s.getName(); });
  return result;
}

// ============================================================
// READ — Cirugías
// Col: 1=Paciente 2=Medico 3=FechaCx 4=Mes 5=Pedido 6=ObraSocial
//      7=Consumo 8=Implantes 9=Descartables 10=Logistica
//      11=CorreccionGastos 12=ValorTotal 13=MontoPresupuesto
//      14=NroFactura 15=MontoFactura 16=FechaFactura
//      17=FechaCobro 18=Cobrado 19=Retenciones
//      20=DifConsumo 21=FacturaGastos 22=%Margen
// ============================================================
function getCirugias() {
  var ss    = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = findSheet(ss, 'Cirugías');
  if (!sheet) throw new Error('No se encontró la hoja "Cirugías". Hojas disponibles: ' +
    ss.getSheets().map(function(s){return s.getName();}).join(', '));
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1] && !r[2]) continue;
    rows.push({
      rowIndex:            i + 1,
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
      numeroFactura:       String(r[13] || ''),
      montoFactura:        r[14] || '',
      fechaFactura:        formatFecha(r[15]),
      fechaCobro:          formatFecha(r[16]),
      cobrado:             r[17] === true || String(r[17]).toUpperCase() === 'TRUE',
      retencionesOtros:    r[18] || '',
      diferenciaConsumo:   r[19] || '',
      facturaGastos:       r[20] || '',
      pctMargen:           r[21] || ''
    });
  }
  return rows;
}

// ============================================================
// READ — Consolidado (tabla pivotada: filas=métricas, columnas=meses)
// Filas conocidas:
//   "Cantidad de cirugías"
//   "$Factura Mes Cx Mes corriente"
//   "$Factura Mes Cx Mes Anterior"
//   "Monto Facturado TOTAL"
//   "Costos Cirugias"
//   "Monto Recolectado"
//   "Gastos Proveedores"
//   "Otros gastos"
//   "Total Gastos"
//   "%recolección"
//   "%rentabilidad x mes"
// ============================================================
function getConsolidado() {
  var ss    = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = findSheet(ss, 'Consolidado');
  if (!sheet) throw new Error('No se encontró la hoja "Consolidado". Hojas disponibles: ' +
    ss.getSheets().map(function(s){return s.getName();}).join(', '));

  var data = sheet.getDataRange().getValues();

  // Encontrar fila encabezado (tiene "cantidad" en col A)
  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().indexOf('cantidad') !== -1) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) return [];

  // Extraer meses desde la fila de encabezado (col B en adelante)
  var months = [];
  for (var j = 1; j < data[headerRow].length; j++) {
    var cell = String(data[headerRow][j] || '').trim();
    if (!cell) continue;
    months.push({ col: j, name: cell.split('/')[0].trim() });
  }

  // Mapear filas por etiqueta normalizada
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g,' ').trim(); }
  var rowMap = {};
  for (var i = headerRow; i < data.length; i++) {
    var lbl = norm(data[i][0]);
    if (lbl) rowMap[lbl] = i;
  }

  function findRow(keywords) {
    for (var lbl in rowMap) {
      var match = true;
      for (var k = 0; k < keywords.length; k++) {
        if (lbl.indexOf(keywords[k]) === -1) { match = false; break; }
      }
      if (match) return rowMap[lbl];
    }
    return -1;
  }

  var riCantidad    = findRow(['cantidad']);
  var riCorriente   = findRow(['corriente']);
  var riAnterior    = findRow(['anterior']);
  var riTotalFact   = findRow(['monto facturado']);
  var riCostos      = findRow(['costos']);
  var riRecolectado = findRow(['recolectado']);
  var riProveed     = findRow(['proveedores']);
  var riOtros       = findRow(['otros gastos']);
  var riTotalGastos = findRow(['total gastos']);
  var riPctRec      = findRow(['recolec']);
  var riPctRent     = findRow(['rentab']);

  function val(ri, col) {
    if (ri === -1) return '';
    return data[ri][col] !== undefined ? data[ri][col] : '';
  }

  var result = [];
  for (var m = 0; m < months.length; m++) {
    var col = months[m].col;
    result.push({
      mes:                  months[m].name,
      cantidadCirugias:     val(riCantidad,    col),
      facturasMesCorriente: val(riCorriente,   col),
      facturasMesAnterior:  val(riAnterior,    col),
      montoFacturadoTotal:  val(riTotalFact,   col),
      costosCirugias:       val(riCostos,      col),
      montoRecolectado:     val(riRecolectado, col),
      gastosProveedores:    val(riProveed,     col),
      otrosGastos:          val(riOtros,       col),
      totalGastos:          val(riTotalGastos, col),
      pctRecoleccion:       val(riPctRec,      col),
      pctRentabilidad:      val(riPctRent,     col)
    });
  }
  return result;
}

// ============================================================
// READ — VENTASCOBROS
// Col: 1=Paciente 2=ObraSocial 3=NroFactura 4=MontoFacturado
//      5=FechaFactura 6=RetGanancias 7=RetIIBB 8=RetSellados
//      9=MontoCobrado 10=MedioPago 11=LugarPago 12=CondicionPago
//      13=FechaCobroEsperada 14=FechaCobroReal 15=FechaCobroCheque
// ============================================================
function getVentasCobros() {
  var ss    = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = findSheet(ss, 'VENTASCOBROS');
  if (!sheet) throw new Error('No se encontró la hoja "VENTASCOBROS". Hojas disponibles: ' +
    ss.getSheets().map(function(s){return s.getName();}).join(', '));
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[2]) continue;
    rows.push({
      rowIndex:           i + 1,
      paciente:           r[0]  || '',
      obraSocial:         r[1]  || '',
      nroFactura:         String(r[2] || ''),
      montoFacturado:     r[3]  || '',
      fechaFactura:       formatFecha(r[4]),
      retGanancias:       r[5]  || '',
      retIIBB:            r[6]  || '',
      retSellados:        r[7]  || '',
      montoCobrado:       r[8]  || '',
      medioPago:          r[9]  || '',
      lugarPago:          r[10] || '',
      condicionPago:      r[11] || '',
      fechaCobroEsperada: formatFecha(r[12]),
      fechaCobroReal:     formatFecha(r[13]),
      fechaCobroCheque:   formatFecha(r[14])
    });
  }
  return rows;
}

// ============================================================
// READ — GASTOSPAGOS
// Col: 1=FechaEmision 2=NroFactura 3=Monto 4=Emisor 5=Categoria
//      6=Descripcion 7=FechaPago 8=Pago(bool) 9=FormaPago
//      10=ComprobanteEnviado 11=Recibo 12=Reclamos
// ============================================================
function getGastosPagos() {
  var ss    = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = findSheet(ss, 'GASTOSPAGOS');
  if (!sheet) throw new Error('No se encontró la hoja "GASTOSPAGOS". Hojas disponibles: ' +
    ss.getSheets().map(function(s){return s.getName();}).join(', '));
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1]) continue;
    rows.push({
      rowIndex:           i + 1,
      fechaEmision:       formatFecha(r[0]),
      nroFactura:         String(r[1] || ''),
      monto:              r[2]  || '',
      emisor:             r[3]  || '',
      categoria:          r[4]  || '',
      descripcion:        r[5]  || '',
      fechaPago:          formatFecha(r[6]),
      pagado:             r[7] === true || String(r[7]).toUpperCase() === 'TRUE',
      formaPago:          r[8]  || '',
      comprobanteEnviado: r[9]  || '',
      recibo:             r[10] || '',
      reclamos:           r[11] || ''
    });
  }
  return rows;
}

// ============================================================
// WRITE
// ============================================================
function updateCobrado(rowIndex, fechaCobro) {
  var ss    = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = findSheet(ss, 'Cirugías');
  if (!sheet) throw new Error('Hoja Cirugías no encontrada');
  sheet.getRange(rowIndex, 18).setValue(true);
  if (fechaCobro) sheet.getRange(rowIndex, 17).setValue(fechaCobro);
  return { updated: rowIndex };
}

function updatePagado(rowIndex) {
  var ss    = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = findSheet(ss, 'GASTOSPAGOS');
  if (!sheet) throw new Error('Hoja GASTOSPAGOS no encontrada');
  sheet.getRange(rowIndex, 8).setValue(true);
  sheet.getRange(rowIndex, 7).setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')
  );
  return { updated: rowIndex };
}

function addCirugia(data) {
  var ss    = SpreadsheetApp.openById(CIRUCIAS_SHEET_ID);
  var sheet = findSheet(ss, 'Cirugías');
  if (!sheet) throw new Error('Hoja Cirugías no encontrada');
  sheet.appendRow([
    data.paciente||'', data.medico||'', data.fechaCx||'', data.mes||'',
    data.pedidoPresupuestado||'', data.obraSocial||'', data.consumo||'',
    data.valorImplantes||'', data.valorDescartables||'', data.valorLogistica||'',
    data.correccionGastos||'', data.valorTotalCostos||'', data.montoPresupuesto||'',
    data.numeroFactura||'', data.montoFactura||'', data.fechaFactura||'',
    data.fechaCobro||'', false, data.retencionesOtros||'', '', '', ''
  ]);
  return { appended: true };
}

function registrarCobro(data) {
  var ss    = SpreadsheetApp.openById(FINANCIERO_SHEET_ID);
  var sheet = findSheet(ss, 'VENTASCOBROS');
  if (!sheet) throw new Error('Hoja VENTASCOBROS no encontrada');
  sheet.appendRow([
    data.paciente||'', data.obraSocial||'', data.nroFactura||'',
    data.montoFacturado||'', data.fechaFactura||'',
    data.retGanancias||'', data.retIIBB||'', data.retSellados||'',
    data.montoCobrado||'', data.medioPago||'', data.lugarPago||'',
    data.condicionPago||'', data.fechaCobroEsperada||'',
    data.fechaCobroReal||'', data.fechaCobroCheque||''
  ]);
  return { appended: true };
}
