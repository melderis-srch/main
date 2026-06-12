'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, formatDate, daysDiff, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { Receipt, CreditCard, AlertCircle, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function getEstadoGasto(g) {
  if (g.pagado || g.saldado) return 'pagado';
  if (g.fechaPagoEcheq) return 'proyectado';
  if (daysDiff(parseDate(g.fechaEmision)) > 30) return 'vencido';
  return 'pendiente';
}

function rowBg(estado) {
  if (estado === 'pagado') return '#FAFFFE';
  if (estado === 'vencido') return '#FFFAFA';
  if (estado === 'proyectado') return '#F8FBFF';
  return '#fff';
}

const FIELDS_GASTO = [
  { k: 'fechaEmision', label: 'Fecha Emisión', placeholder: 'dd/mm/yyyy' },
  { k: 'nroFactura', label: 'N° Factura' },
  { k: 'emisor', label: 'Emisor / Proveedor' },
  { k: 'monto', label: 'Monto' },
  { k: 'categoria', label: 'Categoría' },
  { k: 'formaPago', label: 'Forma de Pago' },
  { k: 'fechaPago', label: 'F. Pago', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaPagoEcheq', label: 'F. Débito Echeq', placeholder: 'dd/mm/yyyy' },
  { k: 'comprobanteEnviado', label: 'Comprobante Enviado' },
  { k: 'recibo', label: 'Recibo' },
];

function GastoForm({ initial, title, saveLabel, onSubmit, onClose, showPagado }) {
  const [form, setForm] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} width={620} title={<span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {FIELDS_GASTO.map(({ k, label, placeholder }) => (
            <div key={k}>
              <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
              <input value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder || ''}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Descripción</label>
          <textarea value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} rows={2}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Reclamos / Notas</label>
          <textarea value={form.reclamos || ''} onChange={e => set('reclamos', e.target.value)} rows={2}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        {showPagado && (
          <div style={{ padding: '8px 0', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 24 }}>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
              <input type="checkbox" checked={!!form.pagado} onChange={e => set('pagado', e.target.checked)}
                style={{ marginRight: 6, width: 14, height: 14, cursor: 'pointer' }} />
              Marcar como pagado
            </label>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
              <input type="checkbox" checked={!!form.saldado} onChange={e => set('saldado', e.target.checked)}
                style={{ marginRight: 6, width: 14, height: 14, cursor: 'pointer' }} />
              Echeq saldado / debitado
            </label>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid #E5E7EB' }}>
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

export default function Pagos({ data, loading, refetch, addToast }) {
  const { gastosPagos } = data;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  const allMonths = useMemo(() => {
    const set = new Set();
    gastosPagos.forEach(g => { const d = parseDate(g.fechaEmision); if (d) set.add(format(d, 'yyyy-MM')); });
    return Array.from(set).sort().reverse();
  }, [gastosPagos]);

  const filtered = useMemo(() => {
    if (!selectedMonth) return gastosPagos;
    return gastosPagos.filter(g => {
      const d = parseDate(g.fechaEmision);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    });
  }, [gastosPagos, selectedMonth]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const pagado = filtered.filter(g => g.pagado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const proyectado = filtered.filter(g => !g.pagado && !g.saldado && g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const pendiente = filtered.filter(g => !g.pagado && !g.saldado && !g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    return { total, pagado, proyectado, pendiente };
  }, [filtered]);

  const handleEdit = async (form) => {
    try {
      await gasClient.updateGasto(editing.rowIndex, form);
      addToast('Gasto actualizado', 'success');
      refetch();
      setEditing(null);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  const handleRegister = async (form) => {
    if (!form.emisor) { addToast('El emisor es requerido', 'error'); return; }
    try {
      await gasClient.registrarGasto(form);
      addToast('Gasto registrado', 'success');
      refetch();
      setShowModal(false);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  const HEADERS = ['F. Emisión', 'N° Factura', 'Proveedor', 'Categoría', 'Descripción', 'Monto', 'Forma Pago', 'F. Pago', 'F. Débito Echeq', 'Compr.', 'Recibo', 'Notas', 'Estado', ''];

  return (
    <div>
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Total gastos" value={formatARS(kpis.total)} icon={Receipt} color="#6B7280"
              hint="Suma de todas las facturas de gastos del período, pagadas o no." />
            <KPICard label="Pagado" value={formatARS(kpis.pagado)} icon={CreditCard} color="#059669"
              hint="Gastos ya cancelados (marcados como pagados o con echeq saldado/debitado)." />
            <KPICard label="Proyectado (echeq)" value={formatARS(kpis.proyectado)} icon={CalendarClock} color="#1D4ED8"
              hint="Echeq emitido con fecha de débito futura, todavía no saldado. Saldrá de la cuenta ese día." />
            <KPICard label="Pendiente de pago" value={formatARS(kpis.pendiente)} icon={AlertCircle} color="#D97706"
              hint="Gastos sin pagar y sin echeq programado. Falta definir el pago." />
          </div>
        )
      }

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
          <Plus size={14} /> Registrar gasto
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {HEADERS.map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={HEADERS.length}><SkeletonTable rows={6} cols={HEADERS.length} /></td></tr>
                : filtered.map((g, i) => {
                    const estado = getEstadoGasto(g);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: rowBg(estado) }}>
                        <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>{g.fechaEmision}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{g.nroFactura}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>{toTitleCase(g.emisor)}</td>
                        <td style={{ padding: '9px 12px', color: '#6B7280' }}>{toTitleCase(g.categoria)}</td>
                        <td style={{ padding: '9px 12px', color: '#374151', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.descripcion}>{toTitleCase(g.descripcion)}</td>
                        <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600 }}>{formatARS(parseArgMoney(g.monto))}</td>
                        <td style={{ padding: '9px 12px', color: '#6B7280' }}>{toTitleCase(g.formaPago)}</td>
                        <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>{g.fechaPago || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, whiteSpace: 'nowrap', fontWeight: g.fechaPagoEcheq ? 600 : 400, color: g.fechaPagoEcheq ? (g.saldado ? '#059669' : '#1D4ED8') : '#9CA3AF' }}>
                          {g.fechaPagoEcheq ? (g.saldado ? `✓ ${g.fechaPagoEcheq}` : g.fechaPagoEcheq) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: 12 }}>{g.comprobanteEnviado || '—'}</td>
                        <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: 12 }}>{g.recibo || '—'}</td>
                        <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.reclamos}>{g.reclamos || '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {estado === 'pagado' && <Badge type="cobrado">Pagado</Badge>}
                          {estado === 'proyectado' && <Badge type="proyectado">Echeq</Badge>}
                          {estado === 'vencido' && <Badge type="vencido">Vencido</Badge>}
                          {estado === 'pendiente' && <Badge type="pendiente">Pendiente</Badge>}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button onClick={() => setEditing(g)}
                            style={{ padding: '4px 8px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 5, cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Pencil size={12} /> <span style={{ fontSize: 11 }}>Editar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={HEADERS.length} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <GastoForm
          initial={{ fechaEmision: formatDate(new Date()), nroFactura: '', monto: '', emisor: '', categoria: '', descripcion: '', fechaPago: '', fechaPagoEcheq: '', formaPago: '', comprobanteEnviado: '', recibo: '', reclamos: '' }}
          title="Registrar gasto" saveLabel="Registrar gasto" showPagado={false}
          onSubmit={handleRegister} onClose={() => setShowModal(false)}
        />
      )}
      {editing && (
        <GastoForm
          initial={editing}
          title={`Editar gasto — ${toTitleCase(editing.emisor)}`} saveLabel="Guardar cambios" showPagado={true}
          onSubmit={handleEdit} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
