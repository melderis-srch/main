// Selectores: transforman la data maestra (casos/facturas/cobros unidos por
// casoId) en las estructuras que cada vista ya sabe renderizar. Así migramos
// vista por vista sin reescribir toda la UI.

// ISO (yyyy-MM-dd) → dd/MM/yyyy para mostrar igual que antes. '' si vacío.
function isoToDMY(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

function indexByCaso(rows) {
  const m = {};
  rows.forEach(r => { const k = r.casoId; if (!k) return; (m[k] = m[k] || []).push(r); });
  return m;
}

// Construye filas estilo "ventasCobros" (una por factura) para la vista Cobranzas
// y Facturación. Une la factura con su caso (paciente/OS) y con los cobros del caso.
export function buildCobranzaRows(master) {
  const casosById = {};
  (master.casos || []).forEach(c => { casosById[c.casoId] = c; });
  const cobrosByCaso = indexByCaso(master.cobros || []);

  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(x[f]) || 0), 0);
  const rows = [];
  const casosConFactura = new Set();

  (master.facturas || []).forEach(f => {
    const caso = casosById[f.casoId] || {};
    const cobros = cobrosByCaso[f.casoId] || [];
    casosConFactura.add(f.casoId);
    const primary = cobros[0] || {};
    // último cobro con fecha real, para mostrar la fecha de cobro
    const conReal = cobros.filter(c => c.fechaCobroReal);
    const ultimoReal = conReal.length ? conReal[conReal.length - 1] : null;

    rows.push({
      // identidad / edición
      _casoId: f.casoId,
      _facturaRow: f._row,
      _cobroRow: primary._row || null,
      _cobros: cobros,
      estadoCaso: caso.estadoCaso || '',
      rowIndex: primary._row || null, // compat: editar cobro apunta acá

      // datos que la UI ya lee
      paciente:   caso.paciente || '',
      obraSocial: caso.obraSocial || '',
      nroFactura: f.numeroFactura || '',
      montoFacturado: Number(f.montoFacturado) || 0,
      fechaFactura:   isoToDMY(f.fechaFactura),
      fechaEntrega:   isoToDMY(f.fechaEntrega),

      // condición y fecha ESPERADA son de la factura (propiedad de la factura)
      condicionPago:      f.condicionPago || '',
      fechaCobroEsperada: isoToDMY(f.fechaCobroEsperada),
      // retenciones y cobro real: agregados de los cobros del caso
      retGanancias: sum(cobros, 'retGanancias'),
      retIIBB:      sum(cobros, 'retIIBB'),
      retSuss:      sum(cobros, 'retSuss'),
      retSellados:  sum(cobros, 'retSellados'),
      montoCobrado: sum(cobros, 'montoCobrado'),
      medioPago:     primary.medioPago || '',
      lugarPago:     primary.lugarPago || '',
      fechaCobroReal:     isoToDMY(ultimoReal ? ultimoReal.fechaCobroReal : ''),
      fechaCobroCheque:   isoToDMY(primary.fechaCobroCheque),
      notas: f.notas || primary.notas || '',
    });
  });

  // Cobros de casos sin factura (raros): que no se pierdan de la vista.
  (master.cobros || []).forEach(c => {
    if (casosConFactura.has(c.casoId)) return;
    const caso = casosById[c.casoId] || {};
    rows.push({
      _casoId: c.casoId, _facturaRow: null, _cobroRow: c._row, _cobros: [c],
      estadoCaso: caso.estadoCaso || '', rowIndex: c._row,
      paciente: caso.paciente || '', obraSocial: caso.obraSocial || '',
      nroFactura: '', montoFacturado: 0, fechaFactura: '', fechaEntrega: '',
      retGanancias: Number(c.retGanancias) || 0, retIIBB: Number(c.retIIBB) || 0,
      retSuss: Number(c.retSuss) || 0, retSellados: Number(c.retSellados) || 0,
      montoCobrado: Number(c.montoCobrado) || 0,
      medioPago: c.medioPago || '', lugarPago: c.lugarPago || '', condicionPago: c.condicionPago || '',
      fechaCobroEsperada: isoToDMY(c.fechaCobroEsperada),
      fechaCobroReal: isoToDMY(c.fechaCobroReal),
      fechaCobroCheque: isoToDMY(c.fechaCobroCheque),
      notas: c.notas || '',
    });
  });

  return rows;
}
