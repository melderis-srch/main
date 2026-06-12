'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, FileText, Percent } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
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
function FacturacionMes({ ym, rows, onEdit }) {
  const [open, setOpen] = useState(false);
  const totFact = rows.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
  const cobradas = rows.filter(v => v.fechaCobroReal).length;

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', borderBottom: open ? '1px solid #F3F4F6' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', minWidth: 150 }}>{ymLabel(ym)}</span>
        <span style={{ fontSize: 11, background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>
          {cobradas}/{rows.length} cobradas
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Facturado:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(totFact)}</span>
      </div>

      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              <th style={{ width: 28 }} />
              {['Paciente', 'Obra Social', 'N° Factura', 'F. Factura', 'Neto', 'F. Cobro / Echeq', 'Mora', 'Estado'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => <CobroRow key={i} v={v} onEdit={onEdit} cols="facturas" />)}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Sección Retenciones (4 tipos) ──────────────────────── */
const RET_TYPES = [
  { key: 'retIIBB',      label: 'Ret. IIBB',      color: AMBER,    bg: '#FEF3C7', bgLight: '#FFFDF5', border: '#FEF3C7', textColor: '#92400E' },
  { key: 'retGanancias', label: 'Ret. Ganancias',  color: '#7C3AED', bg: '#EDE9FE', bgLight: '#FAF5FF', border: '#DDD6FE', textColor: '#5B21B6' },
  { key: 'retSuss',      label: 'Ret. SUSS',       color: '#0891B2', bg: '#CFFAFE', bgLight: '#F0FDFE', border: '#A5F3FC', textColor: '#155E75' },
  { key: 'retSellados',  label: 'Ret. Sellados',   color: '#BE185D', bg: '#FCE7F3', bgLight: '#FFF1F8', border: '#FBCFE8', textColor: '#9D174D' },
];

function RetMesGroup({ ym, rows, total, retKey, colors }) {
  const [open, setOpen] = useState(false);
  const { bg, bgLight, border, textColor, label: retLabel, color } = colors;

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: open ? bg : bgLight, borderBottom: open ? `1px solid ${border}` : 'none' }}>
        {open ? <ChevronDown size={13} color={textColor} /> : <ChevronRight size={13} color={textColor} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: textColor, minWidth: 150 }}>{ymLabel(ym)}</span>
        <span style={{ fontSize: 12, color: textColor, opacity: 0.7 }}>{rows.length} {rows.length === 1 ? 'factura' : 'facturas'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</span>
      </div>

      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: bg }}>
              {['Paciente', 'Obra Social', 'N° Factura', 'F. Factura', 'F. Cobro Real', 'Facturado', retLabel].map(h => (
                <th key={h} style={{ padding: '7px 14px', textAlign: h === retLabel || h === 'Facturado' ? 'right' : 'left', fontWeight: 600, color: textColor, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${bgLight}` }}>
                <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827' }}>{toTitleCase(v.paciente)}</td>
                <td style={{ padding: '8px 14px', color: '#374151' }}>{toTitleCase(v.obraSocial)}</td>
                <td style={{ padding: '8px 14px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{v.nroFactura || '—'}</td>
                <td style={{ padding: '8px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaFactura || '—'}</td>
                <td style={{ padding: '8px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaCobroReal || '—'}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{formatARS(parseArgMoney(v.montoFacturado))}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color }}>{formatARS(parseArgMoney(v[retKey]))}</td>
              </tr>
            ))}
            <tr style={{ background: bg }}>
              <td colSpan={5} style={{ padding: '7px 14px', fontSize: 11, color: textColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total mes</td>
              <td />
              <td style={{ padding: '7px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color }}>{formatARS(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function RetTipoSection({ rows, retType }) {
  const [open, setOpen] = useState(false);
  const { key, label, color, bg, bgLight, border, textColor } = retType;

  const withRet = useMemo(() =>
    rows.filter(v => parseArgMoney(v[key]) > 0)
        .sort((a, b) => {
          const da = parseDate(a.fechaCobroReal || a.fechaFactura);
          const db = parseDate(b.fechaCobroReal || b.fechaFactura);
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        }),
    [rows, key]
  );

  const byMonth = useMemo(() => {
    const map = {};
    withRet.forEach(v => {
      const d = parseDate(v.fechaCobroReal || v.fechaFactura);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = { ym, rows: [], total: 0 };
      map[ym].rows.push(v);
      map[ym].total += parseArgMoney(v[key]);
    });
    return Object.values(map).sort((a, b) => b.ym.localeCompare(a.ym));
  }, [withRet, key]);

  const total = withRet.reduce((s, v) => s + parseArgMoney(v[key]), 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: open ? '1px solid #E5E7EB' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        <div style={{ width: 4, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
            {withRet.length} {withRet.length === 1 ? 'factura con retención' : 'facturas con retención'}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total acumulado</div>
          <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</div>
        </div>
        {open ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
      </div>

      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {byMonth.length === 0
            ? <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', margin: 0 }}>Sin retenciones registradas</p>
            : byMonth.map(({ ym, rows: mrows, total: mtotal }) => (
                <RetMesGroup key={ym} ym={ym} rows={mrows} total={mtotal} retKey={key} colors={retType} />
              ))
          }
        </div>
      )}
    </div>
  );
}

function RetencionesSectionWrapper({ rows }) {
  const [open, setOpen] = useState(false);
  const totales = useMemo(() => {
    return RET_TYPES.map(rt => ({
      ...rt,
      total: rows.reduce((s, v) => s + parseArgMoney(v[rt.key]), 0)
    }));
  }, [rows]);
  const totalGlobal = totales.reduce((s, t) => s + t.total, 0);

  return (
    <div>
      {/* Header colapsable de la sección completa */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 12 : 0, cursor: 'pointer', userSelect: 'none' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <Percent size={15} color={AMBER} strokeWidth={2} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retenciones</span>
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— desglose por tipo · para el contador</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{formatARS(totalGlobal)}</span>
      </div>

      {open && (
        <>
          {/* Mini resumen de los 4 tipos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            {totales.map(({ key, label, color, total }) => (
              <div key={key} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</div>
              </div>
            ))}
          </div>
          {/* Sección por tipo */}
          {totales.map(rt => (
            <RetTipoSection key={rt.key} rows={rows} retType={rt} />
          ))}
        </>
      )}
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
  { id: 'facturacion', label: 'Facturación' },
  { id: 'retenciones', label: 'Retenciones' },
];

/* ── Componente principal ───────────────────────────────── */
export default function Cobranzas({ data, loading, refetch, addToast }) {
  const { ventasCobros } = data;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('cobros');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const currentYM = format(new Date(), 'yyyy-MM');

  const allMonths = useMemo(() => {
    const set = new Set();
    ventasCobros.forEach(v => {
      const d = parseDate(v.fechaCobroReal);
      if (d) set.add(format(d, 'yyyy-MM'));
    });
    return Array.from(set).sort().reverse();
  }, [ventasCobros]);

  // Filtra por mes de cobro si hay selección, sino todos
  const filteredCobros = useMemo(() => {
    if (!selectedMonth) return ventasCobros.filter(v => v.fechaCobroReal);
    return ventasCobros.filter(v => {
      if (!v.fechaCobroReal) return false;
      const d = parseDate(v.fechaCobroReal);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    });
  }, [ventasCobros, selectedMonth]);

  // Cobros realizados agrupados por mes de fechaCobroReal
  const cobrosRealizados = useMemo(() => {
    const src = selectedMonth ? filteredCobros : ventasCobros.filter(v => v.fechaCobroReal);
    const map = {};
    src.forEach(v => {
      const d = parseDate(v.fechaCobroReal);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(v);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [filteredCobros, selectedMonth, ventasCobros]);

  // Facturación agrupada por mes de fechaFactura (sin filtro de mes)
  const facturacion = useMemo(() => {
    const map = {};
    ventasCobros.forEach(v => {
      const d = parseDate(v.fechaFactura);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(v);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [ventasCobros]);

  // KPIs filtrados por mes seleccionado
  const kpis = useMemo(() => {
    const base = selectedMonth ? filteredCobros : ventasCobros.filter(v => v.fechaCobroReal);
    const ingresado = base.reduce((s, v) => {
      const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSuss) + parseArgMoney(v.retSellados);
      return s + parseArgMoney(v.montoFacturado) - r;
    }, 0);
    const proyectado = ventasCobros.filter(v => {
      if (v.fechaCobroReal || !v.fechaCobroCheque) return false;
      if (!selectedMonth) return true;
      const d = parseDate(v.fechaCobroCheque);
      return d && format(d, 'yyyy-MM') === selectedMonth;
    }).reduce((s, v) => {
      const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSuss) + parseArgMoney(v.retSellados);
      return s + parseArgMoney(v.montoFacturado) - r;
    }, 0);
    const pendiente = ventasCobros
      .filter(v => !v.fechaCobroReal && !v.fechaCobroCheque)
      .reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const facturado = base.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const porIngresar = facturado - ingresado;
    return { facturado, ingresado, proyectado, pendiente, porIngresar };
  }, [filteredCobros, selectedMonth, ventasCobros]);

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
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            <KPICard label="Cobrado (neto)" value={formatARS(kpis.ingresado)} icon={TrendingUp} color={GREEN}
              hint="Dinero efectivamente recibido en el período, neto de todas las retenciones." />
            <KPICard label="Proyectado (echeq)" value={formatARS(kpis.proyectado)} icon={CalendarClock} color={BLUE}
              hint="Cheques/echeq sin acreditar todavía, netos de retenciones." />
            <KPICard label="Pendiente" value={formatARS(kpis.pendiente)} icon={Clock} color={RED}
              hint="Facturado sin cobro real ni cheque en circulación." />
            <KPICard label="Facturado base" value={formatARS(kpis.facturado)} icon={TrendingUp} color="#6B7280"
              hint="Total bruto cobrado en el período, antes de retenciones." />
          </div>
        )
      }

      {/* Banner facturado vs ingresado */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 22px', marginBottom: 20 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturado</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.facturado)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#D1D5DB', padding: '0 18px' }}><ArrowDownUp size={18} /></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado neto</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.ingresado)}</span>
          </div>
          <div style={{ width: 1, background: '#E5E7EB', margin: '0 18px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diferencia (por cobrar)</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: kpis.porIngresar > 0 ? RED : GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.porIngresar)}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{kpis.facturado > 0 ? `${Math.round((kpis.ingresado / kpis.facturado) * 100)}% cobrado` : '—'}</span>
          </div>
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

          {tab === 'facturacion' && (
            facturacion.length === 0
              ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin facturación registrada</div>
              : facturacion.map(({ ym, rows }) => (
                  <FacturacionMes key={ym} ym={ym} rows={rows} onEdit={setEditing} />
                ))
          )}

          {tab === 'retenciones' && (
            <RetencionesSectionWrapper rows={ventasCobros} />
          )}
        </>
      )}

      {showModal && (
        <CobroForm
          initial={{ paciente: '', obraSocial: '', nroFactura: '', montoFacturado: '', fechaFactura: '', retGanancias: '', retIIBB: '', retSuss: '', retSellados: '', montoCobrado: '', medioPago: '', lugarPago: '', condicionPago: '', fechaCobroEsperada: '', fechaCobroReal: '', fechaCobroCheque: '' }}
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
