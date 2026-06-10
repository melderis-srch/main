'use client';
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, formatDate, daysDiff } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { DollarSign, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

function RegistrarPagoModal({ onClose, onSaved, addToast }) {
  const [form, setForm] = useState({ fechaEmision: formatDate(new Date()), nroFactura: '', monto: '', emisor: '', categoria: '', descripcion: '', fechaPago: '', pagado: false, formaPago: '', comprobanteEnviado: '', recibo: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.emisor) { addToast('El emisor es requerido', 'error'); return; }
    setSaving(true);
    try {
      await gasClient.registrarCobro({ ...form }); // reusing registrarCobro for generic append, ideally addGasto
      addToast('Gasto registrado correctamente', 'success');
      onSaved();
      onClose();
    } catch (e) {
      addToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, k, placeholder }) => (
    <div>
      <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <Modal open onClose={onClose} width={580} title={<span style={{ fontSize: 17, fontWeight: 700 }}>Registrar gasto</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Fecha Emisión" k="fechaEmision" placeholder="dd/mm/yyyy" />
          <Field label="N° Factura" k="nroFactura" />
          <Field label="Emisor *" k="emisor" />
          <Field label="Monto" k="monto" />
          <Field label="Categoría" k="categoria" />
          <Field label="Forma de Pago" k="formaPago" />
          <Field label="Fecha de Pago" k="fechaPago" placeholder="dd/mm/yyyy" />
        </div>
        <div>
          <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Descripción</label>
          <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '10px', background: '#E8622A', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
            {saving ? 'Guardando...' : 'Registrar gasto'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Pagos({ data, loading, refetch, addToast }) {
  const { gastosPagos } = data;
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState({});
  const now = new Date();

  const kpis = useMemo(() => {
    const totalPagado = gastosPagos.filter(g => g.pagado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const totalPendiente = gastosPagos.filter(g => !g.pagado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const vencidas = gastosPagos.filter(g => !g.pagado && daysDiff(parseDate(g.fechaEmision)) > 30).length;
    const pagosMes = gastosPagos.filter(g => {
      if (!g.pagado) return false;
      const d = parseDate(g.fechaPago);
      return d && isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
    }).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    return { totalPagado, totalPendiente, vencidas, pagosMes };
  }, [gastosPagos, now]);

  const handleMarcarPagado = async (g) => {
    setSaving(s => ({ ...s, [g.rowIndex]: true }));
    try {
      await gasClient.updatePagado(g.rowIndex);
      addToast('Pago registrado', 'success');
      refetch();
    } catch (e) {
      addToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(s => ({ ...s, [g.rowIndex]: false }));
    }
  };

  return (
    <div>
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <KPICard label="Total pagado" value={formatARS(kpis.totalPagado)} icon={CheckCircle} color="#059669" />
            <KPICard label="Pendiente de pago" value={formatARS(kpis.totalPendiente)} icon={Clock} color="#6B7280" />
            <KPICard label="Facturas vencidas (+30d)" value={kpis.vencidas} icon={AlertCircle} color="#DC2626" />
            <KPICard label="Pagos este mes" value={formatARS(kpis.pagosMes)} icon={DollarSign} color="#E8622A" />
          </div>
        )
      }

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#E8622A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
          <Plus size={15} /> Registrar gasto
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['F. Emisión', 'Emisor', 'N° Factura', 'Categoría', 'Descripción', 'Monto', 'F. Pago', 'Estado', 'Forma Pago', 'Reclamos', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={10}><SkeletonTable rows={6} cols={10} /></td></tr>
                : gastosPagos.map((g, i) => {
                    const diasDesde = daysDiff(parseDate(g.fechaEmision));
                    const vencida = !g.pagado && diasDesde > 30;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: vencida ? '#FFF5F5' : '#fff' }}>
                        <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{g.fechaEmision}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{g.emisor}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{g.nroFactura}</td>
                        <td style={{ padding: '10px 14px', color: '#6B7280' }}>{g.categoria}</td>
                        <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.descripcion}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>{formatARS(parseArgMoney(g.monto))}</td>
                        <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{g.fechaPago}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {g.pagado
                            ? <Badge type="cobrado">Pagado</Badge>
                            : vencida
                              ? <Badge type="vencido">Vencido</Badge>
                              : <Badge type="pendiente">Pendiente</Badge>
                          }
                        </td>
                        <td style={{ padding: '10px 14px', color: '#6B7280' }}>{g.formaPago}</td>
                        <td style={{ padding: '10px 14px', color: g.reclamos === 'pagado' ? '#059669' : '#6B7280', fontSize: 12 }}>{g.reclamos}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {!g.pagado && (
                            <button
                              onClick={() => handleMarcarPagado(g)}
                              disabled={saving[g.rowIndex]}
                              style={{ padding: '5px 12px', background: '#E8622A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              {saving[g.rowIndex] ? '...' : 'Marcar pagado'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
              }
              {!loading && gastosPagos.length === 0 && (
                <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <RegistrarPagoModal onClose={() => setShowModal(false)} onSaved={refetch} addToast={addToast} />
      )}
    </div>
  );
}
