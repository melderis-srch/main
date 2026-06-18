'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { mergeCirugias } from './Cirugias';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ORANGE = '#C05621';
const GREEN  = '#059669';
const BLUE   = '#1D4ED8';
const RED    = '#DC2626';

function ymLabel(ym) {
  if (!ym || ym === 'sin-fecha') return 'Sin fecha';
  const s = format(parseISO(ym + '-01'), 'MMMM yyyy', { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normName(s) {
  return (s || '').trim().toLowerCase();
}

const FIELDS_FACTURA = [
  { k: 'paciente', label: 'Paciente' },
  { k: 'obraSocial', label: 'Obra Social' },
  { k: 'nroFactura', label: 'N° Factura' },
  { k: 'montoFacturado', label: 'Monto Facturado' },
  { k: 'fechaFactura', label: 'Fecha Emisión', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaEntrega', label: 'Fecha Entrega', placeholder: 'dd/mm/yyyy' },
];

/* ── Formulario (edición) ───────────────────────────────── */
function FacturaForm({ initial, title, onSubmit, onClose }) {
  const [form, setForm] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} width={560} title={<span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {FIELDS_FACTURA.map(({ k, label, placeholder }) => (
            <div key={k}>
              <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
              <input value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder || ''}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Notas</label>
          <textarea value={form.notas || ''} onChange={e => set('notas', e.target.value)} rows={3}
            placeholder="Ej: se facturó de más por error en consumo, ajustar próxima factura..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '9px', background: ORANGE, color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Fila expandible ────────────────────────────────────── */
function FacturaRow({ v, cirugiaMatch, sortBy, onEdit }) {
  const [open, setOpen] = useState(false);
  const cobrado = !!v.fechaCobroReal;

  const presupuesto = cirugiaMatch ? parseArgMoney(cirugiaMatch.montoPresupuesto) : null;
  const facturado = parseArgMoney(v.montoFacturado);
  const diff = presupuesto !== null ? facturado - presupuesto : null;

  return (
    <>
      <tr onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? 'none' : '1px solid #F3F4F6', cursor: 'pointer', background: cobrado ? '#FAFFFE' : '#fff' }}>
        <td style={{ padding: '10px 12px', width: 28 }}>
          {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{toTitleCase(v.paciente)}</td>
        <td style={{ padding: '10px 12px', color: '#374151' }}>{toTitleCase(v.obraSocial)}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#6B7280' }}>{v.nroFactura || '—'}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: sortBy === 'emision' ? '#111827' : '#9CA3AF', fontWeight: sortBy === 'emision' ? 600 : 400, whiteSpace: 'nowrap' }}>{v.fechaFactura || '—'}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: sortBy === 'entrega' ? '#111827' : '#9CA3AF', fontWeight: sortBy === 'entrega' ? 600 : 400, whiteSpace: 'nowrap' }}>{v.fechaEntrega || '—'}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: '#111827' }}>{formatARS(facturado)}</td>
        <td style={{ padding: '10px 12px' }}>{cobrado ? <Badge type="cobrado">Cobrado</Badge> : <Badge type="pendiente">Pendiente</Badge>}</td>
        <td style={{ padding: '10px 12px' }}>{v.notas ? <FileText size={13} color={ORANGE} /> : null}</td>
      </tr>

      {open && (
        <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F8FAFC' }}>
          <td />
          <td colSpan={8} style={{ padding: '0 12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 24px', paddingTop: 10 }}>
              {[
                { label: 'Monto Facturado', value: formatARS(facturado) },
                { label: 'Monto Presupuestado', value: presupuesto !== null ? formatARS(presupuesto) : 'Sin dato en cirugía' },
                { label: 'Diferencia (factura - presup.)', value: diff !== null ? formatARS(diff) : '—', color: diff === null ? '#9CA3AF' : diff > 0 ? RED : diff < 0 ? BLUE : GREEN },
                { label: 'F. Cobro Real', value: v.fechaCobroReal || '—' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: color || '#111827', fontVariantNumeric: 'tabular-nums', fontWeight: color ? 700 : 400 }}>{value}</div>
                </div>
              ))}
            </div>
            {v.notas && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFF7F3', border: '1px solid #FBD9C2', borderRadius: 7 }}>
                <div style={{ fontSize: 11, color: ORANGE, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Notas</div>
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{v.notas}</div>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button onClick={e => { e.stopPropagation(); onEdit(v); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#6B7280', fontSize: 12, fontFamily: 'inherit' }}>
                <Pencil size={12} /> Editar factura
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Grupo por mes ──────────────────────────────────────── */
function FacturasDelMes({ ym, rows, defaultOpen, cirugiasByName, sortBy, onEdit }) {
  const [open, setOpen] = useState(defaultOpen);
  const total = rows.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
  const cobradas = rows.filter(v => v.fechaCobroReal).length;

  const sorted = useMemo(() => {
    const key = sortBy === 'entrega' ? 'fechaEntrega' : 'fechaFactura';
    return [...rows].sort((a, b) => {
      const da = parseDate(a[key]); const db = parseDate(b[key]);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }, [rows, sortBy]);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer', borderBottom: open ? '1px solid #F3F4F6' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 150 }}>{ymLabel(ym)}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{rows.length} {rows.length === 1 ? 'factura' : 'facturas'} · {cobradas} cobradas</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Facturado:</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</span>
      </div>

      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              <th style={{ width: 28 }} />
              {['Paciente', 'Obra Social', 'N° Factura', 'F. Emisión', 'F. Entrega', 'Facturado', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, i) => (
              <FacturaRow key={i} v={v} cirugiaMatch={cirugiasByName.get(normName(v.paciente))} sortBy={sortBy} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Componente principal ───────────────────────────────── */
export default function Facturacion({ data, loading, refetch, addToast }) {
  const { ventasCobros } = data;
  const cirugias = useMemo(() => mergeCirugias(data.cirugias), [data.cirugias]);
  const [editing, setEditing] = useState(null);
  const [sortBy, setSortBy] = useState('emision'); // 'emision' | 'entrega'
  const [selectedMonth, setSelectedMonth] = useState('');

  const currentYM = format(new Date(), 'yyyy-MM');

  const cirugiasByName = useMemo(() => {
    const map = new Map();
    cirugias.forEach(c => { if (c.paciente) map.set(normName(c.paciente), c); });
    return map;
  }, [cirugias]);

  // Todos los meses con facturas emitidas (para el selector de período)
  const allMonths = useMemo(() => {
    const set = new Set();
    ventasCobros.forEach(v => {
      const d = parseDate(v.fechaFactura);
      if (d) set.add(format(d, 'yyyy-MM'));
    });
    return Array.from(set).sort().reverse();
  }, [ventasCobros]);

  // Facturas del período seleccionado (o todas si es "Acumulado total")
  const ventasDelPeriodo = useMemo(() => {
    if (!selectedMonth) return ventasCobros;
    return ventasCobros.filter(v => {
      const d = parseDate(v.fechaFactura);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    });
  }, [ventasCobros, selectedMonth]);

  // Agrupado por mes de fecha de emisión (fechaFactura)
  const porMes = useMemo(() => {
    const map = {};
    ventasDelPeriodo.forEach(v => {
      const d = parseDate(v.fechaFactura);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(v);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [ventasDelPeriodo]);

  const kpis = useMemo(() => {
    const totalCirugias = cirugias.length;
    const cirugiasFacturadas = cirugias.filter(c => (c.numeroFactura || '').toString().trim() !== '').length;
    const ratioFacturadas = totalCirugias > 0 ? cirugiasFacturadas / totalCirugias : null;

    const totalFacturas = ventasDelPeriodo.length;
    const facturasCobradas = ventasDelPeriodo.filter(v => v.fechaCobroReal).length;
    const ratioCobradas = totalFacturas > 0 ? facturasCobradas / totalFacturas : null;

    const pendientesEntrega = ventasDelPeriodo.filter(v => !v.fechaEntrega).length;
    const totalFacturadoPeriodo = ventasDelPeriodo.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);

    return { totalCirugias, cirugiasFacturadas, ratioFacturadas, totalFacturas, facturasCobradas, ratioCobradas, pendientesEntrega, totalFacturadoPeriodo };
  }, [cirugias, ventasDelPeriodo]);

  const handleEdit = async (form) => {
    try {
      await gasClient.updateCobro(editing.rowIndex, form);
      addToast('Factura actualizada', 'success');
      refetch();
      setEditing(null);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  return (
    <div>
      {/* Selector de período + toggle orden */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Período:</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#111827', cursor: 'pointer' }}>
            <option value="">Acumulado total</option>
            {allMonths.map(m => (
              <option key={m} value={m}>{ymLabel(m)}</option>
            ))}
          </select>
          {selectedMonth && (
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              Facturado del mes: <strong style={{ color: '#111827' }}>{formatARS(kpis.totalFacturadoPeriodo)}</strong>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Resaltar orden por:</span>
          <div style={{ display: 'flex', gap: 2, background: '#F3F4F6', borderRadius: 9, padding: 3 }}>
            {[{ id: 'emision', label: 'Fecha de emisión' }, { id: 'entrega', label: 'Fecha de entrega' }].map(o => (
              <button key={o.id} onClick={() => setSortBy(o.id)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: sortBy === o.id ? 600 : 500, fontFamily: 'inherit',
                  background: sortBy === o.id ? '#fff' : 'transparent', color: sortBy === o.id ? '#111827' : '#6B7280',
                  boxShadow: sortBy === o.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>{Array(3).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Facturadas / Cirugías" icon={FileText} color={ORANGE}
              value={kpis.ratioFacturadas !== null ? `${kpis.cirugiasFacturadas} / ${kpis.totalCirugias} (${Math.round(kpis.ratioFacturadas * 100)}%)` : '—'}
              hint="Cirugías con N° de factura cargado, sobre el total de cirugías registradas." />
            <KPICard label="Cobradas / Facturadas" icon={FileText} color={GREEN}
              value={kpis.ratioCobradas !== null ? `${kpis.facturasCobradas} / ${kpis.totalFacturas} (${Math.round(kpis.ratioCobradas * 100)}%)` : '—'}
              hint="Facturas con cobro real registrado, sobre el total de facturas del período seleccionado." />
            <KPICard label="Pendientes de entrega" icon={FileText} color={kpis.pendientesEntrega > 0 ? RED : GREEN}
              value={String(kpis.pendientesEntrega)}
              hint="Facturas sin fecha de entrega cargada todavía, dentro del período seleccionado." />
          </div>
        )
      }

      {loading ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>
          <SkeletonTable rows={6} cols={7} />
        </div>
      ) : (
        porMes.length === 0
          ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin facturas registradas</div>
          : porMes.map(({ ym, rows }) => (
              <FacturasDelMes key={ym} ym={ym} rows={rows} defaultOpen={ym === currentYM || !!selectedMonth} cirugiasByName={cirugiasByName} sortBy={sortBy} onEdit={setEditing} />
            ))
      )}

      {editing && (
        <FacturaForm
          initial={editing}
          title={`Editar factura — ${toTitleCase(editing.paciente || editing.obraSocial)}`}
          onSubmit={handleEdit} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
