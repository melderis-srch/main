'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, formatDate, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { Receipt, CreditCard, AlertCircle, CalendarClock } from 'lucide-react';

function getEstadoGasto(g) {
  if (g.pagado || g.saldado) return 'pagado';
  if (g.fechaPagoEcheq) return 'proyectado';
  return 'pendiente';
}

function rowBg(estado) {
  if (estado === 'pagado') return '#FAFFFE';
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

function EstadoBadge({ estado }) {
  if (estado === 'pagado') return <Badge type="cobrado">Pagado</Badge>;
  if (estado === 'proyectado') return <Badge type="proyectado">Echeq</Badge>;
  return <Badge type="pendiente">Pendiente</Badge>;
}

function GastoRow({ g, onEdit }) {
  const [open, setOpen] = useState(false);
  const estado = getEstadoGasto(g);

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? 'none' : '1px solid #F3F4F6', background: rowBg(estado), cursor: 'pointer' }}
      >
        <td style={{ padding: '10px 12px', width: 28 }}>
          {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{toTitleCase(g.emisor)}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#6B7280' }}>{g.nroFactura || '—'}</td>
        <td style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>{g.fechaEmision || '—'}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: '#111827' }}>{formatARS(parseArgMoney(g.monto))}</td>
        <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.descripcion}>
          {toTitleCase(g.descripcion) || '—'}
        </td>
        <td style={{ padding: '10px 12px' }}><EstadoBadge estado={estado} /></td>
      </tr>

      {open && (
        <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F8FAFC' }}>
          <td />
          <td colSpan={6} style={{ padding: '0 12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 24px', paddingTop: 10 }}>
              {[
                { label: 'Forma de Pago', value: toTitleCase(g.formaPago) || '—' },
                { label: 'F. Pago', value: g.fechaPago || '—' },
                { label: 'F. Débito Echeq', value: g.fechaPagoEcheq ? (g.saldado ? `✓ ${g.fechaPagoEcheq}` : g.fechaPagoEcheq) : '—' },
                { label: 'Echeq saldado', value: g.saldado ? 'Sí' : 'No' },
                { label: 'Comprobante enviado', value: g.comprobanteEnviado || '—' },
                { label: 'Descripción completa', value: g.descripcion || '—', wide: true },
              ].map(({ label, value, wide }) => (
                <div key={label} style={wide ? { gridColumn: 'span 2' } : {}}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={e => { e.stopPropagation(); onEdit(g); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#6B7280', fontSize: 12, fontFamily: 'inherit' }}>
                <Pencil size={12} /> Editar gasto
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CatGroup({ categoria, rows, onEdit }) {
  const [open, setOpen] = useState(true);

  const total = rows.reduce((s, g) => s + parseArgMoney(g.monto), 0);
  const pagado = rows.filter(g => g.pagado || g.saldado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
  const pendiente = rows.filter(g => !g.pagado && !g.saldado && !g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: open ? '1px solid #F3F4F6' : 'none', background: open ? '#FAFAFA' : '#fff' }}
      >
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 160 }}>{toTitleCase(categoria) || 'Sin categoría'}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{rows.length} {rows.length === 1 ? 'gasto' : 'gastos'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Total:</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginRight: 20 }}>{formatARS(total)}</span>
        {pagado > 0 && <>
          <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Pagado:</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums', marginRight: 20 }}>{formatARS(pagado)}</span>
        </>}
        {pendiente > 0 && <>
          <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Pendiente:</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706', fontVariantNumeric: 'tabular-nums' }}>{formatARS(pendiente)}</span>
        </>}
      </div>

      {open && (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              <th style={{ width: 28, position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1 }} />
              {['Proveedor', 'N° Factura', 'Fecha', 'Monto', 'Descripción', 'Estado'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => <GastoRow key={i} g={g} onEdit={onEdit} />)}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

export default function Pagos({ data, loading, refetch, addToast }) {
  const { gastosPagos } = data;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    gastosPagos.forEach(g => {
      const cat = (g.categoria || '').trim() || 'Sin categoría';
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    });
    return Object.keys(map).sort().map(k => ({ categoria: k, rows: map[k] }));
  }, [gastosPagos]);

  const kpis = useMemo(() => {
    const total = gastosPagos.reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const pagado = gastosPagos.filter(g => g.pagado || g.saldado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const proyectado = gastosPagos.filter(g => !g.pagado && !g.saldado && g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const pendiente = gastosPagos.filter(g => !g.pagado && !g.saldado && !g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    return { total, pagado, proyectado, pendiente };
  }, [gastosPagos]);

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
              hint="Echeq emitido con fecha de débito futura, todavía no saldado." />
            <KPICard label="Pendiente de pago" value={formatARS(kpis.pendiente)} icon={AlertCircle} color="#D97706"
              hint="Gastos sin pagar y sin echeq programado. Falta definir el pago." />
          </div>
        )
      }

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
          <Plus size={14} /> Registrar gasto
        </button>
      </div>

      {loading
        ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}><SkeletonTable rows={6} cols={7} /></div>
        : grouped.length === 0
          ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Sin datos</div>
          : grouped.map(({ categoria, rows }) => (
              <CatGroup key={categoria} categoria={categoria} rows={rows} onEdit={setEditing} />
            ))
      }

      {showModal && (
        <GastoForm
          initial={{ fechaEmision: formatDate(new Date()), nroFactura: '', monto: '', emisor: '', categoria: '', descripcion: '', fechaPago: '', fechaPagoEcheq: '', formaPago: '', comprobanteEnviado: '' }}
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
