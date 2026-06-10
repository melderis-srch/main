'use client';
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, formatDate, daysDiff } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { Clock, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

function getEstado(v) {
  if (v.fechaCobroReal) return 'cobrado';
  const d = daysDiff(parseDate(v.fechaCobroEsperada));
  if (d !== null && d > 0) return 'vencido';
  if (d !== null && d > -7) return 'porVencer';
  return null;
}

function getRowBg(estado) {
  if (estado === 'cobrado') return '#F0FDF4';
  if (estado === 'vencido') return '#FFF5F5';
  if (estado === 'porVencer') return '#FFFBEB';
  return '#fff';
}

function RegistrarCobroModal({ onClose, onSaved, addToast }) {
  const [form, setForm] = useState({ paciente: '', obraSocial: '', nroFactura: '', montoFacturado: '', fechaFactura: '', retGanancias: '', retIIBB: '', retSellados: '', montoCobrado: '', medioPago: '', lugarPago: '', condicionPago: '', fechaCobroEsperada: '', fechaCobroReal: formatDate(new Date()) });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nroFactura) { addToast('N° de factura requerido', 'error'); return; }
    setSaving(true);
    try {
      await gasClient.registrarCobro(form);
      addToast('Cobro registrado correctamente', 'success');
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
    <Modal open onClose={onClose} width={620} title={<span style={{ fontSize: 17, fontWeight: 700 }}>Registrar cobro</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Paciente" k="paciente" />
          <Field label="Obra Social" k="obraSocial" />
          <Field label="N° Factura *" k="nroFactura" />
          <Field label="Monto Facturado" k="montoFacturado" />
          <Field label="Fecha Factura" k="fechaFactura" placeholder="dd/mm/yyyy" />
          <Field label="Ret. Ganancias" k="retGanancias" />
          <Field label="Ret. IIBB" k="retIIBB" />
          <Field label="Ret. Sellados" k="retSellados" />
          <Field label="Monto Cobrado" k="montoCobrado" />
          <Field label="Medio de Pago" k="medioPago" />
          <Field label="Fecha Cobro Esperada" k="fechaCobroEsperada" placeholder="dd/mm/yyyy" />
          <Field label="Fecha Cobro Real" k="fechaCobroReal" placeholder="dd/mm/yyyy" />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '10px', background: '#E8622A', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
            {saving ? 'Guardando...' : 'Registrar cobro'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Cobranzas({ data, loading, refetch, addToast }) {
  const { ventasCobros } = data;
  const [showModal, setShowModal] = useState(false);
  const now = new Date();

  const kpis = useMemo(() => {
    const pendiente = ventasCobros.filter(v => !v.fechaCobroReal).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const vencido = ventasCobros.filter(v => !v.fechaCobroReal && daysDiff(parseDate(v.fechaCobroEsperada)) > 0).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const porVencer = ventasCobros.filter(v => {
      if (v.fechaCobroReal) return false;
      const d = daysDiff(parseDate(v.fechaCobroEsperada));
      return d !== null && d <= 0 && d > -30;
    }).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const cobradoMes = ventasCobros.filter(v => {
      if (!v.fechaCobroReal) return false;
      const d = parseDate(v.fechaCobroReal);
      return d && isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
    }).reduce((s, v) => s + parseArgMoney(v.montoCobrado || v.montoFacturado), 0);
    return { pendiente, vencido, porVencer, cobradoMes };
  }, [ventasCobros, now]);

  return (
    <div>
      {/* KPIs */}
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <KPICard label="Pendiente total" value={formatARS(kpis.pendiente)} icon={Clock} color="#6B7280" />
            <KPICard label="Vencido" value={formatARS(kpis.vencido)} icon={AlertCircle} color="#DC2626" />
            <KPICard label="Por vencer (30 días)" value={formatARS(kpis.porVencer)} icon={Calendar} color="#D97706" />
            <KPICard label="Cobrado este mes" value={formatARS(kpis.cobradoMes)} icon={CheckCircle} color="#059669" />
          </div>
        )
      }

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#E8622A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
          <Plus size={15} /> Registrar cobro
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Paciente', 'Obra Social', 'N° Factura', 'Monto Fact.', 'Retenciones', 'Monto Neto', 'Medio Pago', 'F. Esperada', 'F. Real', 'F. Cheque', 'Días mora', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={11}><SkeletonTable rows={6} cols={11} /></td></tr>
                : ventasCobros.map((v, i) => {
                    const estado = getEstado(v);
                    const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
                    const neto = parseArgMoney(v.montoFacturado) - retes;
                    const mora = v.fechaCobroReal ? null : daysDiff(parseDate(v.fechaCobroEsperada));
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: getRowBg(estado) }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{v.paciente}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{v.obraSocial}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{v.nroFactura}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{formatARS(parseArgMoney(v.montoFacturado))}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#6B7280' }}>{retes ? formatARS(retes) : '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{formatARS(neto)}</td>
                        <td style={{ padding: '10px 14px', color: '#6B7280' }}>{v.medioPago}</td>
                        <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{v.fechaCobroEsperada}</td>
                        <td style={{ padding: '10px 14px', color: '#059669', whiteSpace: 'nowrap' }}>{v.fechaCobroReal}</td>
                        <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{v.fechaCobroCheque}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: mora > 0 ? '#DC2626' : '#6B7280' }}>
                          {mora !== null ? (mora > 0 ? `+${mora}d` : mora < 0 ? `${mora}d` : 'Hoy') : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {estado === 'cobrado' && <Badge type="cobrado">Cobrado</Badge>}
                          {estado === 'vencido' && <Badge type="vencido">Vencido</Badge>}
                          {estado === 'porVencer' && <Badge type="porVencer">Por vencer</Badge>}
                          {!estado && <span style={{ color: '#9CA3AF', fontSize: 13 }}>Vigente</span>}
                        </td>
                      </tr>
                    );
                  })
              }
              {!loading && ventasCobros.length === 0 && (
                <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <RegistrarCobroModal onClose={() => setShowModal(false)} onSaved={refetch} addToast={addToast} />
      )}
    </div>
  );
}
