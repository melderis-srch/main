'use client';
import { useState, useMemo } from 'react';
import { Plus, Trash2, Printer, Save, FileText } from 'lucide-react';
import { CLIENTES, PRODUCTOS } from '../data/catalogos';
import { ALICUOTAS, alicuotaById, calcularTotales, fmtMoney, imprimirPresupuesto } from '../utils/presupuestoPDF';
import { gasV2 } from '../utils/gasClientV2';
import { LOGO_URL } from '../data/logo';

const BLUE = '#2F55B0';
const ORANGE = '#C05621';
const GREEN = '#059669';

function hoyDDMMYYYY() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function nextNumero(presupuestos) {
  // Sugerir el próximo N° visible a partir del máximo numeroPresupuesto existente.
  let max = 0;
  (presupuestos || []).forEach((p) => {
    const n = parseInt(String(p.numeroPresupuesto || '').replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  const next = max + 1;
  return String(next).padStart(8, '0');
}

const lbl = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' };
const inp = { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };

function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

const DEF_SERVICIO = 'Instrumental y descartables en quirófano · Asistencia técnica de instrumentador quirúrgico en cirugía.';
const DEF_COND = { entrega: 'A coordinar con el cirujano interviniente.', validez: '15 días corridos desde la fecha.', pago: '30 días fecha factura.' };

export default function GeneradorPresupuesto({ data, addToast, onSaved, initial }) {
  const editing = !!(initial && initial._row);
  const [numero, setNumero] = useState(() => initial?.numero || nextNumero(data?.presupuestos));
  const [fecha, setFecha] = useState(initial?.fecha || hoyDDMMYYYY());
  const [alicuotaId, setAlicuotaId] = useState(initial?.alicuotaId || 'ri21');

  const [cliente, setCliente] = useState(initial?.cliente || { denominacion: '', cuit: '', condicionIva: '', direccion: '', localidad: '' });
  const [cirugia, setCirugia] = useState(initial?.cirugia || { paciente: '', medico: '' });

  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map((x) => ({ codigo: '', marca: '', origen: '', alternativa: '', cantidad: 1, precioUnitario: '', ...x }))
      : [{ codigo: '', denominacion: '', marca: '', origen: '', alternativa: '', cantidad: 1, precioUnitario: '' }]
  );

  const [servicioOn, setServicioOn] = useState(initial ? !!initial.servicioIncluido : true);
  const [servicioTxt, setServicioTxt] = useState(initial?.servicioIncluido || DEF_SERVICIO);
  const [cond, setCond] = useState(initial?.condiciones || DEF_COND);
  const [notas, setNotas] = useState(initial?.notas || '');
  const [precioMejora, setPrecioMejora] = useState(initial?.precioMejora || '');
  const [guardando, setGuardando] = useState(false);

  const totales = useMemo(() => calcularTotales(items, alicuotaId), [items, alicuotaId]);
  const alic = alicuotaById(alicuotaId);

  // ── Cliente: autocompletar al elegir del catálogo ──
  function onClienteName(v) {
    const found = CLIENTES.find((c) => c.denominacion === v);
    if (found) {
      setCliente({
        denominacion: found.denominacion, cuit: found.cuit || '',
        condicionIva: found.condicionIva || '', direccion: found.direccion || '', localidad: found.localidad || '',
      });
    } else {
      setCliente((c) => ({ ...c, denominacion: v }));
    }
  }

  // ── Productos ──
  function updateItem(i, patch) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function onProductoName(i, v) {
    const found = PRODUCTOS.find((p) => p.denominacion === v);
    if (found) {
      updateItem(i, {
        codigo: found.codigo || '', denominacion: found.denominacion, marca: found.marca || '',
        origen: found.origen || '', alternativa: found.alternativa || '',
        precioUnitario: found.precio || '',
      });
    } else {
      updateItem(i, { denominacion: v });
    }
  }
  function addRow() {
    setItems((arr) => [...arr, { codigo: '', denominacion: '', marca: '', origen: '', alternativa: '', cantidad: 1, precioUnitario: '' }]);
  }
  function removeRow(i) {
    setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  // Datos completos del presupuesto (se guardan en la planilla como datosJson
  // para poder ver/regenerar/editar después).
  function fullData() {
    return {
      numero, fecha, alicuotaId,
      cliente, cirugia,
      items: items.filter((it) => it.denominacion),
      servicioIncluido: servicioOn ? servicioTxt : '',
      condiciones: cond, notas, precioMejora,
    };
  }
  function payloadPDF() {
    return { ...fullData(), logoDataUri: LOGO_URL };
  }

  function validar() {
    if (!cliente.denominacion) { addToast?.('Elegí o cargá un cliente primero.', 'error'); return false; }
    if (!items.some((it) => it.denominacion)) { addToast?.('Agregá al menos un producto.', 'error'); return false; }
    return true;
  }

  // Vista previa: genera el PDF sin guardar.
  function onVistaPrevia() {
    if (!validar()) return;
    imprimirPresupuesto(payloadPDF());
  }

  // Guarda (nuevo o edición) el registro en la planilla y genera el PDF.
  async function onGuardarYGenerar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      const fd = fullData();
      const material = fd.items.map((it) => it.denominacion).join(' + ');
      const record = {
        paciente: cirugia.paciente, medico: cirugia.medico, obraSocial: cliente.denominacion,
        material, numeroPresupuesto: numero, precioCotizacion: totales.total,
        precioMejora: precioMejora || '', fechaCotizacion: fecha,
        estado: initial?.estado || 'Cotizada', condicionPago: cond.pago,
        observaciones: notas, datosJson: JSON.stringify(fd),
      };
      if (editing) await gasV2.updatePresupuesto(initial._row, record);
      else await gasV2.addPresupuesto(record);
      addToast?.(`Presupuesto N° ${numero} ${editing ? 'actualizado' : 'guardado'} en la planilla.`, 'success');
      imprimirPresupuesto(payloadPDF());
      onSaved?.();
    } catch (err) {
      addToast?.('No se pudo guardar: ' + err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  const catalogoVacio = CLIENTES.length === 0 && PRODUCTOS.length === 0;

  return (
    <div style={{ maxWidth: 1000 }}>
      {catalogoVacio && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#92400E' }}>
          Los catálogos de clientes y productos todavía no están cargados — podés escribir a mano igual.
          Cuando se reimporten (305 clientes / 372 productos), los buscadores se autocompletan solos.
        </div>
      )}

      {/* Datalists para autocompletado */}
      <datalist id="dl-clientes">{CLIENTES.map((c) => <option key={c.codigo} value={c.denominacion} />)}</datalist>
      <datalist id="dl-productos">{PRODUCTOS.map((p) => <option key={p.codigo} value={p.denominacion} />)}</datalist>

      {/* Encabezado */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14 }}>
          <Field label="N° de presupuesto">
            <input style={inp} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Field>
          <Field label="Fecha">
            <input style={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} placeholder="dd/mm/aaaa" />
          </Field>
          <Field label="Condición de IVA (desglose)">
            <select style={inp} value={alicuotaId} onChange={(e) => setAlicuotaId(e.target.value)}>
              {ALICUOTAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Cliente + Cirugía */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 12 }}>Cliente / Obra Social</div>
          <Field label="Denominación">
            <input style={inp} list="dl-clientes" value={cliente.denominacion} onChange={(e) => onClienteName(e.target.value)} placeholder="Buscar o escribir…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="CUIT"><input style={inp} value={cliente.cuit} onChange={(e) => setCliente({ ...cliente, cuit: e.target.value })} /></Field>
            <Field label="Condición IVA (texto)"><input style={inp} value={cliente.condicionIva} onChange={(e) => setCliente({ ...cliente, condicionIva: e.target.value })} placeholder="Ej: Exento" /></Field>
            <Field label="Dirección"><input style={inp} value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} /></Field>
            <Field label="Localidad"><input style={inp} value={cliente.localidad} onChange={(e) => setCliente({ ...cliente, localidad: e.target.value })} /></Field>
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 12 }}>Cirugía</div>
          <Field label="Paciente"><input style={inp} value={cirugia.paciente} onChange={(e) => setCirugia({ ...cirugia, paciente: e.target.value })} /></Field>
          <div style={{ marginTop: 12 }}>
            <Field label="Médico"><input style={inp} value={cirugia.medico} onChange={(e) => setCirugia({ ...cirugia, medico: e.target.value })} /></Field>
          </div>
        </div>
      </div>

      {/* Renglones */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>Productos</div>
          <div style={{ flex: 1 }} />
          <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: `1px solid ${BLUE}`, background: '#fff', color: BLUE, borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={14} /> Agregar renglón
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
            <thead>
              <tr>
                {['Cant.', 'Cód.', 'Producto', 'Marca', 'Origen', 'Alternativa', 'P. Unit. Neto', 'Neto', ''].map((h) => (
                  <th key={h} style={{ textAlign: h === 'P. Unit. Neto' || h === 'Neto' ? 'right' : 'left', padding: '6px 8px', fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const sub = (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '6px 8px' }}><input style={{ ...inp, width: 60, padding: '6px 8px' }} type="number" min="0" step="1" value={it.cantidad} onChange={(e) => updateItem(i, { cantidad: e.target.value })} /></td>
                    <td style={{ padding: '6px 8px' }}><input style={{ ...inp, width: 64, padding: '6px 8px' }} value={it.codigo} onChange={(e) => updateItem(i, { codigo: e.target.value })} /></td>
                    <td style={{ padding: '6px 8px', minWidth: 220 }}><input style={{ ...inp, padding: '6px 8px' }} list="dl-productos" value={it.denominacion} onChange={(e) => onProductoName(i, e.target.value)} placeholder="Buscar o escribir…" /></td>
                    <td style={{ padding: '6px 8px' }}><input style={{ ...inp, width: 100, padding: '6px 8px' }} value={it.marca} onChange={(e) => updateItem(i, { marca: e.target.value })} /></td>
                    <td style={{ padding: '6px 8px' }}><input style={{ ...inp, width: 90, padding: '6px 8px' }} value={it.origen} onChange={(e) => updateItem(i, { origen: e.target.value })} /></td>
                    <td style={{ padding: '6px 8px' }}><input style={{ ...inp, width: 130, padding: '6px 8px' }} value={it.alternativa} onChange={(e) => updateItem(i, { alternativa: e.target.value })} /></td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}><input style={{ ...inp, width: 120, padding: '6px 8px', textAlign: 'right' }} type="number" min="0" step="0.01" value={it.precioUnitario} onChange={(e) => updateItem(i, { precioUnitario: e.target.value })} placeholder="0,00" /></td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: sub === 0 ? GREEN : '#111827' }}>{sub === 0 ? 'Sin cargo' : fmtMoney(sub)}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button onClick={() => removeRow(i)} title="Quitar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#D1D5DB', padding: 4 }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Servicio incluido */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={servicioOn} onChange={(e) => setServicioOn(e.target.checked)} style={{ marginTop: 3 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Servicio incluido (sin cargo, en todas las cirugías)</div>
            <input style={{ ...inp, fontSize: 12 }} value={servicioTxt} onChange={(e) => setServicioTxt(e.target.value)} disabled={!servicioOn} />
          </div>
        </div>
      </div>

      {/* Totales + Condiciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 12 }}>Condiciones</div>
          <Field label="Plazo de entrega"><input style={inp} value={cond.entrega} onChange={(e) => setCond({ ...cond, entrega: e.target.value })} /></Field>
          <div style={{ marginTop: 10 }}><Field label="Mantenimiento de la oferta"><input style={inp} value={cond.validez} onChange={(e) => setCond({ ...cond, validez: e.target.value })} /></Field></div>
          <div style={{ marginTop: 10 }}><Field label="Condiciones de pago"><input style={inp} value={cond.pago} onChange={(e) => setCond({ ...cond, pago: e.target.value })} /></Field></div>
        </div>

        <div style={{ ...card, background: '#F9FAFB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#4B5563' }}>
            <span>Subtotal</span><span style={{ fontWeight: 600 }}>{fmtMoney(totales.total)}</span>
          </div>
          {alic.rate > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#4B5563' }}>
                <span>Neto gravado</span><span style={{ fontWeight: 600 }}>{fmtMoney(totales.neto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#4B5563' }}>
                <span>IVA {(alic.rate * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span><span style={{ fontWeight: 600 }}>{fmtMoney(totales.iva)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '12px 14px', background: '#E9EEFA', border: '1px solid #C3D2F0', borderRadius: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: BLUE }}>TOTAL</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#22448F' }}>$ {fmtMoney(totales.total)}</span>
          </div>
        </div>
      </div>

      {/* Observaciones + Precio de mejora */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 12 }}>Observaciones</div>
        <Field label="Notas / observaciones">
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas internas o aclaraciones para este presupuesto…" />
        </Field>
        <div style={{ marginTop: 12, maxWidth: 260 }}>
          <Field label="Precio de mejora (opcional)">
            <input style={inp} type="number" min="0" step="0.01" value={precioMejora}
              onChange={(e) => setPrecioMejora(e.target.value)} placeholder="Si piden mejora de precio" />
          </Field>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={onVistaPrevia} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: '1px solid #E5E7EB', background: '#fff', color: '#374151', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Printer size={16} /> Vista previa
        </button>
        <button onClick={onGuardarYGenerar} disabled={guardando} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', border: 'none', background: guardando ? '#9CA3AF' : ORANGE, color: '#fff', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          <Save size={16} /> {guardando ? 'Guardando…' : (editing ? 'Guardar cambios y PDF' : 'Guardar y generar PDF')}
        </button>
      </div>
    </div>
  );
}
