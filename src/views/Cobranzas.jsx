'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, FileText, Percent } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff, toTitleCase } from '../utils/formatters';
import { gasV2 } from '../utils/gasClientV2';
import { useMasterData } from '../hooks/useMasterData';
import { buildCobranzaRows } from '../utils/casoSelectors';
import { TrendingUp, Clock, CalendarClock, ArrowDownUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ORANGE = '#C05621';
const GREEN  = '#059669';
const BLUE   = '#1D4ED8';
const RED    = '#DC2626';
const AMBER  = '#D97706';

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

function ymLabel(ym) {
  if (!ym || ym === 'sin-fecha') return 'Sin fecha';
  const s = format(parseISO(ym + '-01'), 'MMMM yyyy', { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FIELDS_COBRO = [
  { k: 'paciente', label: 'Paciente' },
  { k: 'obraSocial', label: 'Obra Social' },
  { k: 'nroFactura', label: 'N° Factura' },
  { k: 'montoFacturado', label: 'Monto Facturado' },
  { k: 'fechaFactura', label: 'Fecha Factura', placeholder: 'dd/mm/yyyy' },
  { k: 'retGanancias', label: 'Ret. Ganancias' },
  { k: 'retIIBB', label: 'Ret. IIBB' },
  { k: 'retSuss', label: 'Ret. SUSS' },
  { k: 'retSellados', label: 'Ret. Sellados' },
  { k: 'montoCobrado', label: 'Monto Cobrado' },
  { k: 'medioPago', label: 'Medio de Pago' },
  { k: 'lugarPago', label: 'Lugar de Pago' },
  { k: 'condicionPago', label: 'Condición de Pago' },
  { k: 'fechaCobroEsperada', label: 'F. Cobro Esperada', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaCobroReal', label: 'F. Cobro Real', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaCobroCheque', label: 'F. Acreditación Cheque/Echeq', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaEntrega', label: 'Fecha Entrega', placeholder: 'dd/mm/yyyy' },
];

/* ── Formulario ─────────────────────────────────────────── */
function CobroForm({ initial, title, saveLabel, onSubmit, onClose }) {
  const [form, setForm] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const retes = parseArgMoney(form.retGanancias) + parseArgMoney(form.retIIBB) + parseArgMoney(form.retSuss) + parseArgMoney(form.retSellados);
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
          <span style={{ fontSize: 13, color: '#6B7280' }}>Neto: <strong style={{ color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(neto)}</strong></span>
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
        <div>
          <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Notas</label>
          <textarea value={form.notas || ''} onChange={e => set('notas', e.target.value)} rows={2}
            placeholder="Ej: se facturó de más por error en consumo, ajustar próxima factura..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '9px', background: ORANGE, color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            {saving ? 'Guardando...' : saveLabel}
          </button>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Fila expandible ────────────────────────────────────── */
function EstadoBadge({ estado }) {
  if (estado === 'cobrado') return <Badge type="cobrado">Cobrado</Badge>;
  if (estado === 'proyectado') return <Badge type="proyectado">Echeq</Badge>;
  if (estado === 'vencido') return <Badge type="vencido">Vencido</Badge>;
  if (estado === 'porVencer') return <Badge type="porVencer">Por vencer</Badge>;
  return <Badge type="pendiente">Pendiente</Badge>;
}

function CobroRow({ v, onEdit, cols }) {
  const [open, setOpen] = useState(false);
  const estado = getEstado(v);
  const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSuss) + parseArgMoney(v.retSellados);
  const neto = parseArgMoney(v.montoFacturado) - retes;
  const mora = v.fechaCobroReal ? null : daysDiff(parseDate(v.fechaCobroEsperada));
  const fechaDisplay = v.fechaCobroReal ? v.fechaCobroReal : v.fechaCobroCheque ? `echeq ${v.fechaCobroCheque}` : '—';

  return (
    <>
      <tr onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? 'none' : '1px solid #F3F4F6', background: getRowBg(estado), cursor: 'pointer' }}>
        <td style={{ padding: '10px 12px', width: 28 }}>
          {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{toTitleCase(v.paciente)}</td>
        <td style={{ padding: '10px 12px', color: '#374151' }}>{toTitleCase(v.obraSocial)}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#6B7280' }}>{v.nroFactura || '—'}</td>
        {cols === 'cobros' ? (
          <>
            <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaCobroReal || '—'}</td>
            <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: GREEN }}>{formatARS(neto)}</td>
          </>
        ) : (
          <>
            <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaFactura || '—'}</td>
            <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: estado === 'cobrado' ? GREEN : estado === 'proyectado' ? BLUE : '#111827' }}>
              {formatARS(neto)}
            </td>
            <td style={{ padding: '10px 12px', color: estado === 'cobrado' ? GREEN : BLUE, whiteSpace: 'nowrap', fontSize: 12 }}>{fechaDisplay}</td>
            <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: mora > 0 ? RED : '#9CA3AF' }}>
              {mora !== null ? (mora > 0 ? `+${mora}d` : mora < 0 ? `${Math.abs(mora)}d` : 'Hoy') : '—'}
            </td>
            <td style={{ padding: '10px 12px' }}><EstadoBadge estado={estado} /></td>
          </>
        )}
      </tr>

      {open && (
        <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F8FAFC' }}>
          <td />
          <td colSpan={cols === 'cobros' ? 5 : 8} style={{ padding: '0 12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 24px', paddingTop: 10 }}>
              {[
                { label: 'Monto Facturado', value: formatARS(parseArgMoney(v.montoFacturado)) },
                { label: 'Ret. Ganancias', value: formatARS(parseArgMoney(v.retGanancias)) },
                { label: 'Ret. IIBB', value: formatARS(parseArgMoney(v.retIIBB)) },
                { label: 'Ret. SUSS', value: formatARS(parseArgMoney(v.retSuss)) },
                { label: 'Ret. Sellados', value: formatARS(parseArgMoney(v.retSellados)) },
                { label: 'Monto Cobrado', value: v.montoCobrado ? formatARS(parseArgMoney(v.montoCobrado)) : '—' },
                { label: 'Medio de Pago', value: toTitleCase(v.medioPago) || '—' },
                { label: 'Lugar de Pago', value: toTitleCase(v.lugarPago) || '—' },
                { label: 'Condición de Pago', value: toTitleCase(v.condicionPago) || '—' },
                { label: 'F. Factura', value: v.fechaFactura || '—' },
                { label: 'F. Cobro Esperada', value: v.fechaCobroEsperada || '—' },
                { label: 'F. Cobro Real', value: v.fechaCobroReal || '—' },
                { label: 'F. Acred. Cheque/Echeq', value: v.fechaCobroCheque || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={e => { e.stopPropagation(); onEdit(v); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#6B7280', fontSize: 12, fontFamily: 'inherit' }}>
                <Pencil size={12} /> Editar cobro
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Grupo por mes de cobro ─────────────────────────────── */
function CobrosDelMes({ ym, rows, defaultOpen, onEdit }) {
  const [open, setOpen] = useState(defaultOpen);
  const totNeto = rows.reduce((s, v) => {
    const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSuss) + parseArgMoney(v.retSellados);
    return s + parseArgMoney(v.montoFacturado) - r;
  }, 0);
  const totRetes = rows.reduce((s, v) =>
    s + parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSuss) + parseArgMoney(v.retSellados), 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer', borderBottom: open ? '1px solid #F3F4F6' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 150 }}>{ymLabel(ym)}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{rows.length} {rows.length === 1 ? 'cobro' : 'cobros'}</span>
        <div style={{ flex: 1 }} />
        {totRetes > 0 && <>
          <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Ret.:</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: RED, fontVariantNumeric: 'tabular-nums', marginRight: 20 }}>-{formatARS(totRetes)}</span>
        </>}
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Neto cobrado:</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(totNeto)}</span>
      </div>

      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              <th style={{ width: 28 }} />
              {['Paciente', 'Obra Social', 'N° Factura', 'F. Cobro', 'Neto cobrado'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => <CobroRow key={i} v={v} onEdit={onEdit} cols="cobros" />)}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Grupo por mes de factura (facturación) ─────────────── */
/* ── Retenciones: mes → categorías ─────────────────────── */
const RET_TYPES = [
  { key: 'retIIBB',      label: 'Ret. IIBB',     color: AMBER,     dot: '#F59E0B' },
  { key: 'retGanancias', label: 'Ret. Ganancias', color: '#7C3AED', dot: '#7C3AED' },
  { key: 'retSuss',      label: 'Ret. SUSS',      color: '#0891B2', dot: '#0891B2' },
  { key: 'retSellados',  label: 'Ret. Sellados',  color: '#BE185D', dot: '#BE185D' },
];

// Tabla de una categoría dentro de un mes
function RetCatTable({ rows, retKey, label, color }) {
  const [open, setOpen] = useState(false);
  const total = rows.reduce((s, v) => s + parseArgMoney(v[retKey]), 0);
  if (total === 0) return null;

  return (
    <div style={{ borderRadius: 7, overflow: 'hidden', border: '1px solid #F3F4F6', marginBottom: 6 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', background: open ? '#F9FAFB' : '#fff', borderBottom: open ? '1px solid #F3F4F6' : 'none' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {open ? <ChevronDown size={12} color="#9CA3AF" /> : <ChevronRight size={12} color="#9CA3AF" />}
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1 }}>{label}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF', marginRight: 12 }}>{rows.length} {rows.length === 1 ? 'factura' : 'facturas'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</span>
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Paciente', 'Obra Social', 'N° Factura', 'F. Factura', 'F. Cobro Real', 'Facturado', label].map(h => (
                <th key={h} style={{ padding: '6px 12px', textAlign: h === label || h === 'Facturado' ? 'right' : 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                <td style={{ padding: '7px 12px', fontWeight: 500, color: '#111827' }}>{toTitleCase(v.paciente)}</td>
                <td style={{ padding: '7px 12px', color: '#374151' }}>{toTitleCase(v.obraSocial)}</td>
                <td style={{ padding: '7px 12px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{v.nroFactura || '—'}</td>
                <td style={{ padding: '7px 12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaFactura || '—'}</td>
                <td style={{ padding: '7px 12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaCobroReal || '—'}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{formatARS(parseArgMoney(v.montoFacturado))}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color }}>{formatARS(parseArgMoney(v[retKey]))}</td>
              </tr>
            ))}
            <tr style={{ background: '#F9FAFB' }}>
              <td colSpan={5} style={{ padding: '6px 12px', fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</td>
              <td />
              <td style={{ padding: '6px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color }}>{formatARS(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// Un mes con sus 4 categorías de retención
function RetMesCard({ ym, rows, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const totalMes = RET_TYPES.reduce((s, rt) =>
    s + rows.reduce((ss, v) => ss + parseArgMoney(v[rt.key]), 0), 0);

  // Mini totales por tipo para mostrar en el header
  const mini = RET_TYPES.map(rt => ({
    ...rt,
    total: rows.reduce((s, v) => s + parseArgMoney(v[rt.key]), 0)
  })).filter(rt => rt.total > 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer', background: open ? '#FAFAFA' : '#fff', borderBottom: open ? '1px solid #F3F4F6' : 'none' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 150 }}>{ymLabel(ym)}</span>
        {/* Dots de tipos presentes */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {mini.map(rt => (
            <span key={rt.key} title={rt.label}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: rt.color, fontWeight: 600,
                background: '#F9FAFB', border: `1px solid ${rt.color}22`, borderRadius: 20, padding: '1px 7px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: rt.color, display: 'inline-block' }} />
              {rt.label.replace('Ret. ', '')}
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Total retenciones:</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: AMBER, fontVariantNumeric: 'tabular-nums' }}>{formatARS(totalMes)}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>
          {RET_TYPES.map(rt => (
            <RetCatTable key={rt.key} rows={rows} retKey={rt.key} label={rt.label} color={rt.color} />
          ))}
        </div>
      )}
    </div>
  );
}

function RetencionesSectionWrapper({ rows }) {
  // Agrupa por mes de fechaCobroReal (o fechaFactura como fallback)
  const byMonth = useMemo(() => {
    const map = {};
    rows.forEach(v => {
      const hasAnyRet = RET_TYPES.some(rt => parseArgMoney(v[rt.key]) > 0);
      if (!hasAnyRet) return;
      const d = parseDate(v.fechaCobroReal || v.fechaFactura);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(v);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [rows]);

  // Totales globales por tipo para el resumen top
  const totales = useMemo(() =>
    RET_TYPES.map(rt => ({
      ...rt,
      total: rows.reduce((s, v) => s + parseArgMoney(v[rt.key]), 0)
    })),
    [rows]
  );
  const totalGlobal = totales.reduce((s, t) => s + t.total, 0);
  const currentYM = format(new Date(), 'yyyy-MM');

  return (
    <div>
      {/* Resumen 4 tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {totales.map(({ key, label, color, total }) => (
          <div key={key} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 9, padding: '13px 16px', borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>acumulado total</div>
          </div>
        ))}
      </div>

      {/* Total global */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8 }}>
        <Percent size={14} color={AMBER} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle por mes</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>— para el contador</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>Total: {formatARS(totalGlobal)}</span>
      </div>

      {byMonth.length === 0
        ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin retenciones registradas</div>
        : byMonth.map(({ ym, rows: mrows }) => (
            <RetMesCard key={ym} ym={ym} rows={mrows} defaultOpen={ym === currentYM} />
          ))
      }
    </div>
  );
}

/* ── Sección collapsible genérica ───────────────────────── */
function SectionBlock({ title, subtitle, icon: Icon, accentColor, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 20 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 10 : 0, cursor: 'pointer', userSelect: 'none' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        {Icon && <Icon size={15} color={accentColor || '#6B7280'} strokeWidth={2} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{subtitle}</span>}
      </div>
      {open && children}
    </div>
  );
}

const TABS = [
  { id: 'cobros',      label: 'Cobros realizados' },
  { id: 'retenciones', label: 'Retenciones' },
];

/* ── Componente principal ───────────────────────────────── */
export default function Cobranzas({ addToast }) {
  // Vista migrada al modelo v2 (planilla maestra). Se auto-abastece de datos
  // vía useMasterData y arma las filas uniendo casos + facturas + cobros.
  const master = useMasterData();
  const { loading, refetch } = master;
  const ventasCobros = useMemo(() => buildCobranzaRows(master.data), [master.data]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('cobros');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const currentYM = format(new Date(), 'yyyy-MM');

  // Todos los meses con actividad (cobro real O cobro esperado)
  const allMonths = useMemo(() => {
    const set = new Set();
    ventasCobros.forEach(v => {
      const d1 = parseDate(v.fechaCobroReal);
      if (d1) set.add(format(d1, 'yyyy-MM'));
      const d2 = parseDate(v.fechaCobroEsperada);
      if (d2) set.add(format(d2, 'yyyy-MM'));
    });
    return Array.from(set).sort().reverse();
  }, [ventasCobros]);

  // Cobros que ingresaron en el mes seleccionado (por fechaCobroReal)
  const cobrosDelMes = useMemo(() => {
    if (!selectedMonth) return ventasCobros.filter(v => v.fechaCobroReal);
    return ventasCobros.filter(v => {
      if (!v.fechaCobroReal) return false;
      const d = parseDate(v.fechaCobroReal);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    });
  }, [ventasCobros, selectedMonth]);

  // Cobros esperados en el mes seleccionado pero que todavía no ingresaron
  // (fecha cobro esperada en ese mes, sin fechaCobroReal)
  const pendientesDelMes = useMemo(() => {
    if (!selectedMonth) return [];
    return ventasCobros.filter(v => {
      if (v.fechaCobroReal) return false;
      const d = parseDate(v.fechaCobroEsperada);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    });
  }, [ventasCobros, selectedMonth]);

  // Cobros realizados agrupados por mes de fechaCobroReal
  const cobrosRealizados = useMemo(() => {
    const src = cobrosDelMes;
    const map = {};
    src.forEach(v => {
      const d = parseDate(v.fechaCobroReal);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(v);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [cobrosDelMes]);

  const kpis = useMemo(() => {
    const neto = (v) => {
      const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSuss) + parseArgMoney(v.retSellados);
      return parseArgMoney(v.montoFacturado) - r;
    };

    if (selectedMonth) {
      // Vista mensual: eje = "qué se esperaba cobrar este mes"
      const cobradoNeto = cobrosDelMes.reduce((s, v) => s + neto(v), 0);
      // Echeq con fecha de acreditación en este mes, no cobrado aún
      const echeqMes = ventasCobros.filter(v => {
        if (v.fechaCobroReal) return false;
        const d = parseDate(v.fechaCobroCheque);
        return d && format(d, 'yyyy-MM') === selectedMonth;
      }).reduce((s, v) => s + neto(v), 0);
      // Esperados este mes sin cobrar ni echeq
      const pendienteMes = pendientesDelMes
        .filter(v => !v.fechaCobroCheque)
        .reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
      const totalEsperado = cobradoNeto + echeqMes + pendienteMes;
      const faltaCobrar = totalEsperado - cobradoNeto;
      return { mode: 'mes', cobradoNeto, echeqMes, pendienteMes, totalEsperado, faltaCobrar };
    } else {
      // Vista acumulada: eje = facturado total vs cobrado total
      const facturado = ventasCobros.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
      const cobradoNeto = ventasCobros.filter(v => v.fechaCobroReal).reduce((s, v) => s + neto(v), 0);
      const echeq = ventasCobros.filter(v => !v.fechaCobroReal && v.fechaCobroCheque).reduce((s, v) => s + neto(v), 0);
      const pendiente = ventasCobros.filter(v => !v.fechaCobroReal && !v.fechaCobroCheque).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
      const porCobrar = facturado - cobradoNeto;
      return { mode: 'total', facturado, cobradoNeto, echeq, pendiente, porCobrar };
    }
  }, [cobrosDelMes, pendientesDelMes, selectedMonth, ventasCobros]);

  const handleEdit = async (form) => {
    try {
      // Los campos de la factura y del cobro viven en hojas distintas: se rutea
      // cada grupo a su endpoint. (Los montos/retenciones son agregados del caso;
      // para el caso común 1 factura + 1 cobro coincide con el registro real.)
      const facturaFields = {
        numeroFactura: form.nroFactura, montoFacturado: form.montoFacturado,
        fechaFactura: form.fechaFactura, condicionPago: form.condicionPago,
        fechaCobroEsperada: form.fechaCobroEsperada, fechaEntrega: form.fechaEntrega, notas: form.notas,
      };
      const cobroFields = {
        retGanancias: form.retGanancias, retIIBB: form.retIIBB, retSuss: form.retSuss,
        retSellados: form.retSellados, montoCobrado: form.montoCobrado, medioPago: form.medioPago,
        lugarPago: form.lugarPago, fechaCobroReal: form.fechaCobroReal,
        fechaCobroCheque: form.fechaCobroCheque, notas: form.notas,
      };
      if (editing._facturaRow) await gasV2.updateFactura(editing._facturaRow, facturaFields);
      if (editing._cobroRow) await gasV2.updateCobro(editing._cobroRow, cobroFields);
      else if (editing._casoId) await gasV2.addCobro({ casoId: editing._casoId, ...cobroFields });
      addToast('Cobro actualizado', 'success');
      refetch();
      setEditing(null);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  const handleRegister = async (form) => {
    if (!form.nroFactura) { addToast('N° de factura requerido', 'error'); return; }
    try {
      await gasV2.registrarCobroCompleto(form);
      addToast('Cobro registrado', 'success');
      refetch();
      setShowModal(false);
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
  };

  return (
    <div>
      {/* Banner de error de carga (backend v2 / planilla maestra) */}
      {master.error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          <strong>No se pudo cargar la planilla maestra.</strong> {master.error}
          <div style={{ marginTop: 4, color: '#B91C1C', fontSize: 12 }}>
            Revisá que el backend v2 esté desplegado como Web App con acceso "Cualquier persona" y que la URL sea la correcta.
          </div>
        </div>
      )}

      {/* Selector de mes + botón */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Período:</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#111827', cursor: 'pointer' }}>
            <option value="">Acumulado total</option>
            {allMonths.map(m => (
              <option key={m} value={m}>{ymLabel(m)}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: ORANGE, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
          <Plus size={14} /> Registrar cobro
        </button>
      </div>

      {/* KPIs */}
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : kpis.mode === 'mes' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            <KPICard label="Cobrado neto" value={formatARS(kpis.cobradoNeto)} icon={TrendingUp} color={GREEN}
              hint="Dinero que efectivamente ingresó este mes (fecha cobro real), neto de retenciones." />
            <KPICard label="Echeq a acreditar" value={formatARS(kpis.echeqMes)} icon={CalendarClock} color={BLUE}
              hint="Echeq con fecha de acreditación en este mes, todavía no debitado." />
            <KPICard label="Pendiente del mes" value={formatARS(kpis.pendienteMes)} icon={Clock} color={RED}
              hint="Cobros con fecha esperada en este mes que todavía no ingresaron ni tienen echeq." />
            <KPICard label="Total esperado" value={formatARS(kpis.totalEsperado)} icon={TrendingUp} color="#6B7280"
              hint="Todo lo que se esperaba cobrar este mes: ya cobrado + echeq + pendiente." />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            <KPICard label="Cobrado neto (total)" value={formatARS(kpis.cobradoNeto)} icon={TrendingUp} color={GREEN}
              hint="Total cobrado históricamente, neto de todas las retenciones." />
            <KPICard label="Proyectado (echeq)" value={formatARS(kpis.echeq)} icon={CalendarClock} color={BLUE}
              hint="Echeq en circulación sin acreditar, netos de retenciones." />
            <KPICard label="Pendiente" value={formatARS(kpis.pendiente)} icon={Clock} color={RED}
              hint="Facturas sin cobro real ni echeq en circulación." />
            <KPICard label="Facturado total" value={formatARS(kpis.facturado)} icon={TrendingUp} color="#6B7280"
              hint="Suma de todas las facturas emitidas históricamente." />
          </div>
        )
      }

      {/* Banner contextual */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 22px', marginBottom: 20 }}>
          {kpis.mode === 'mes' ? (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total esperado del mes</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.totalEsperado)}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>cobrado + echeq + pendiente</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: '#D1D5DB', padding: '0 18px' }}><ArrowDownUp size={18} /></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado neto</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.cobradoNeto)}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>ya ingresó a la cuenta</span>
              </div>
              <div style={{ width: 1, background: '#E5E7EB', margin: '0 18px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Falta cobrar del mes</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: kpis.faltaCobrar > 0 ? RED : GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.faltaCobrar)}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {kpis.totalEsperado > 0 ? `${Math.round((kpis.cobradoNeto / kpis.totalEsperado) * 100)}% cobrado del mes` : '—'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturado total</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.facturado)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: '#D1D5DB', padding: '0 18px' }}><ArrowDownUp size={18} /></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado neto</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.cobradoNeto)}</span>
              </div>
              <div style={{ width: 1, background: '#E5E7EB', margin: '0 18px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por cobrar (histórico)</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: kpis.porCobrar > 0 ? RED : GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.porCobrar)}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {kpis.facturado > 0 ? `${Math.round((kpis.cobradoNeto / kpis.facturado) * 100)}% cobrado históricamente` : '—'}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#F3F4F6', borderRadius: 9, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 500, fontFamily: 'inherit',
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#111827' : '#6B7280',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : (
        <>
          {tab === 'cobros' && (
            cobrosRealizados.length === 0
              ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  {selectedMonth ? `Sin cobros en ${ymLabel(selectedMonth)}` : 'Sin cobros registrados'}
                </div>
              : cobrosRealizados.map(({ ym, rows }) => (
                  <CobrosDelMes key={ym} ym={ym} rows={rows} defaultOpen={ym === currentYM || !!selectedMonth} onEdit={setEditing} />
                ))
          )}

          {tab === 'retenciones' && (
            <RetencionesSectionWrapper rows={ventasCobros} />
          )}
        </>
      )}

      {showModal && (
        <CobroForm
          initial={{ paciente: '', obraSocial: '', nroFactura: '', montoFacturado: '', fechaFactura: '', retGanancias: '', retIIBB: '', retSuss: '', retSellados: '', montoCobrado: '', medioPago: '', lugarPago: '', condicionPago: '', fechaCobroEsperada: '', fechaCobroReal: '', fechaCobroCheque: '', fechaEntrega: '', notas: '' }}
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
