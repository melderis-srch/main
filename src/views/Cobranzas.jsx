'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { TrendingUp, Clock, CalendarClock, ArrowDownUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function getEstado(v) {
  if (v.fechaCobroReal) return 'cobrado';
  if (v.fechaCobroCheque) return 'proyectado';
  const d = daysDiff(parseDate(v.fechaCobroEsperada));
  if (d !== null && d > 0) return 'vencido';
  if (d !== null && d > -7) return 'porVencer';
  return 'pendiente';
}

function getRowBg(estado) {
  if (estado === 'cobrado') return '#FAFFFE';
  if (estado === 'vencido') return '#FFFAFA';
  if (estado === 'proyectado') return '#F8FBFF';
  if (estado === 'porVencer') return '#FFFDF5';
  return '#fff';
}

const FIELDS_COBRO = [
  { k: 'paciente', label: 'Paciente' },
  { k: 'obraSocial', label: 'Obra Social' },
  { k: 'nroFactura', label: 'N° Factura' },
  { k: 'montoFacturado', label: 'Monto Facturado' },
  { k: 'fechaFactura', label: 'Fecha Factura', placeholder: 'dd/mm/yyyy' },
  { k: 'retGanancias', label: 'Ret. Ganancias' },
  { k: 'retIIBB', label: 'Ret. IIBB' },
  { k: 'retSellados', label: 'Ret. Sellados' },
  { k: 'montoCobrado', label: 'Monto Cobrado' },
  { k: 'medioPago', label: 'Medio de Pago' },
  { k: 'lugarPago', label: 'Lugar de Pago' },
  { k: 'condicionPago', label: 'Condición de Pago' },
  { k: 'fechaCobroEsperada', label: 'F. Cobro Esperada', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaCobroReal', label: 'F. Cobro Real', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaCobroCheque', label: 'F. Acreditación Cheque/Echeq', placeholder: 'dd/mm/yyyy' },
];

function CobroForm({ initial, title, saveLabel, onSubmit, onClose }) {
  const [form, setForm] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const retes = parseArgMoney(form.retGanancias) + parseArgMoney(form.retIIBB) + parseArgMoney(form.retSellados);
  const neto = parseArgMoney(form.montoFacturado) - retes;

  const handleSave = async () => {
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} width={640} title={<span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Facturado: <strong style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(parseArgMoney(form.montoFacturado))}</strong></span>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Retenciones: <strong style={{ color: '#B91C1C', fontVariantNumeric: 'tabular-nums' }}>- {formatARS(retes)}</strong></span>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Neto: <strong style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{formatARS(neto)}</strong></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {FIELDS_COBRO.map(({ k, label, placeholder }) => (
            <div key={k}>
              <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
              <input value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder || ''}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '9px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            {saving ? 'Guardando...' : saveLabel}
          </button>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Cobranzas({ data, loading, refetch, addToast }) {
  const { ventasCobros } = data;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  const allMonths = useMemo(() => {
    const set = new Set();
    ventasCobros.forEach(v => { const d = parseDate(v.fechaFactura); if (d) set.add(format(d, 'yyyy-MM')); });
    return Array.from(set).sort().reverse();
  }, [ventasCobros]);

  const filtered = useMemo(() => {
    if (!selectedMonth) return ventasCobros;
    return ventasCobros.filter(v => {
      const d = parseDate(v.fechaFactura);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    });
  }, [ventasCobros, selectedMonth]);

  const kpis = useMemo(() => {
    const facturado = filtered.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const ingresado = filtered.filter(v => v.fechaCobroReal).reduce((s, v) => s + parseArgMoney(v.montoCobrado || v.montoFacturado), 0);
    const proyectado = filtered.filter(v => !v.fechaCobroReal && v.fechaCobroCheque).reduce((s, v) => {
      const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
      return s + parseArgMoney(v.montoFacturado) - retes;
    }, 0);
    const pendiente = filtered.filter(v => !v.fechaCobroReal && !v.fechaCobroCheque).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const porIngresar = facturado - ingresado;
    return { facturado, ingresado, proyectado, pendiente, porIngresar };
  }, [filtered]);

  const handleEdit = async (form) => {
    try {
      await gasClient.updateCobro(editing.rowIndex, form);
      addToast('Cobro actualizado', 'success');
      refetch();
      setEditing(null);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  const handleRegister = async (form) => {
    if (!form.nroFactura) { addToast('N° de factura requerido', 'error'); return; }
    try {
      await gasClient.registrarCobro(form);
      addToast('Cobro registrado', 'success');
      refetch();
      setShowModal(false);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  return (
    <div>
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Facturado" value={formatARS(kpis.facturado)} icon={TrendingUp} color="#6B7280"
              hint="Total emitido en facturas del período. Lo que se debería cobrar." />
            <KPICard label="Ingresado" value={formatARS(kpis.ingresado)} icon={TrendingUp} color="#059669"
              hint="Dinero efectivamente recibido (con Fecha de cobro REAL cargada)." />
            <KPICard label="Proyectado (echeq)" value={formatARS(kpis.proyectado)} icon={CalendarClock} color="#1D4ED8"
              hint="Cheques/echeq sin acreditar todavía, netos de retenciones. Se cobran en la fecha de acreditación." />
            <KPICard label="Pendiente" value={formatARS(kpis.pendiente)} icon={Clock} color="#DC2626"
              hint="Facturado sin cobro real ni cheque en circulación. Aún no entró nada." />
          </div>
        )
      }

      {!loading && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 22px', marginBottom: 20 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturado</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.facturado)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#D1D5DB', padding: '0 18px' }}><ArrowDownUp size={20} /></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingresado (real)</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.ingresado)}</span>
          </div>
          <div style={{ width: 1, background: '#E5E7EB', margin: '0 18px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diferencia (por ingresar)</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: kpis.porIngresar > 0 ? '#DC2626' : '#059669', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.porIngresar)}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{kpis.facturado > 0 ? `${Math.round((kpis.ingresado / kpis.facturado) * 100)}% cobrado` : '—'}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Mes:</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Todos</option>
            {allMonths.map(m => <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMM yyyy', { locale: es })}</option>)}
          </select>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
          <Plus size={14} /> Registrar cobro
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Paciente', 'Obra Social', 'N° Factura', 'Facturado', 'Ret.', 'Neto cobrado', 'Medio Pago', 'F. Esperada', 'F. Real / Echeq', 'Mora', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={12}><SkeletonTable rows={6} cols={12} /></td></tr>
                : filtered.map((v, i) => {
                    const estado = getEstado(v);
                    const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
                    const neto = parseArgMoney(v.montoFacturado) - retes;
                    const mora = v.fechaCobroReal ? null : daysDiff(parseDate(v.fechaCobroEsperada));
                    const fechaDisplay = v.fechaCobroReal ? v.fechaCobroReal : v.fechaCobroCheque ? `echeq ${v.fechaCobroCheque}` : '—';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: getRowBg(estado) }}>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>{toTitleCase(v.paciente)}</td>
                        <td style={{ padding: '9px 12px', color: '#374151' }}>{toTitleCase(v.obraSocial)}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v.nroFactura}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatARS(parseArgMoney(v.montoFacturado))}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: retes > 0 ? '#B91C1C' : '#9CA3AF' }}>{retes > 0 ? `- ${formatARS(retes)}` : '—'}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: estado === 'cobrado' ? '#059669' : estado === 'proyectado' ? '#1D4ED8' : '#111827' }}>{formatARS(neto)}</td>
                        <td style={{ padding: '9px 12px', color: '#6B7280' }}>{toTitleCase(v.medioPago)}</td>
                        <td style={{ padding: '9px 12px', color: '#9CA3AF', whiteSpace: 'nowrap', fontSize: 12 }}>{v.fechaCobroEsperada || '—'}</td>
                        <td style={{ padding: '9px 12px', color: estado === 'cobrado' ? '#059669' : '#1D4ED8', whiteSpace: 'nowrap', fontSize: 12 }}>{fechaDisplay}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: mora > 0 ? '#DC2626' : '#9CA3AF' }}>
                          {mora !== null ? (mora > 0 ? `+${mora}d` : mora < 0 ? `${Math.abs(mora)}d` : 'Hoy') : '—'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {estado === 'cobrado' && <Badge type="cobrado">Cobrado</Badge>}
                          {estado === 'proyectado' && <Badge type="proyectado">Echeq</Badge>}
                          {estado === 'vencido' && <Badge type="vencido">Vencido</Badge>}
                          {estado === 'porVencer' && <Badge type="porVencer">Por vencer</Badge>}
                          {estado === 'pendiente' && <Badge type="pendiente">Pendiente</Badge>}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button onClick={() => setEditing(v)}
                            style={{ padding: '4px 8px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 5, cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Pencil size={12} /> <span style={{ fontSize: 11 }}>Editar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CobroForm
          initial={{ paciente: '', obraSocial: '', nroFactura: '', montoFacturado: '', fechaFactura: '', retGanancias: '', retIIBB: '', retSellados: '', montoCobrado: '', medioPago: '', lugarPago: '', condicionPago: '', fechaCobroEsperada: '', fechaCobroReal: '', fechaCobroCheque: '' }}
          title="Registrar cobro" saveLabel="Registrar cobro"
          onSubmit={handleRegister} onClose={() => setShowModal(false)}
        />
      )}
      {editing && (
        <CobroForm
          initial={editing}
          title={`Editar cobro — ${toTitleCase(editing.paciente || editing.obraSocial)}`} saveLabel="Guardar cambios"
          onSubmit={handleEdit} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
