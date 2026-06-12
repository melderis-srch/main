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
  const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
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
    const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
    return s + parseArgMoney(v.montoFacturado) - r;
  }, 0);
  const totRetes = rows.reduce((s, v) =>
    s + parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados), 0);

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

/* ── Sección Retenciones IIBB ───────────────────────────── */
function RetIIBBSection({ rows }) {
  const [open, setOpen] = useState(false);

  const withIIBB = useMemo(() =>
    rows.filter(v => parseArgMoney(v.retIIBB) > 0)
        .sort((a, b) => {
          const da = parseDate(a.fechaCobroReal || a.fechaFactura);
          const db = parseDate(b.fechaCobroReal || b.fechaFactura);
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        }),
    [rows]
  );

  const byMonth = useMemo(() => {
    const map = {};
    withIIBB.forEach(v => {
      const d = parseDate(v.fechaCobroReal || v.fechaFactura);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = { ym, rows: [], total: 0 };
      map[ym].rows.push(v);
      map[ym].total += parseArgMoney(v.retIIBB);
    });
    return Object.values(map).sort((a, b) => b.ym.localeCompare(a.ym));
  }, [withIIBB]);

  const totalIIBB = withIIBB.reduce((s, v) => s + parseArgMoney(v.retIIBB), 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header principal */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', cursor: 'pointer', borderBottom: open ? '1px solid #E5E7EB' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        <Percent size={16} color={AMBER} strokeWidth={2} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Retenciones IIBB</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
            {withIIBB.length} {withIIBB.length === 1 ? 'factura con retención' : 'facturas con retención'} · para enviar al contador
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total acumulado</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: AMBER, fontVariantNumeric: 'tabular-nums' }}>{formatARS(totalIIBB)}</div>
        </div>
        {open ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
      </div>

      {open && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {byMonth.length === 0
            ? <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', margin: 0 }}>Sin retenciones registradas</p>
            : byMonth.map(({ ym, rows: mrows, total }) => (
                <IIBBMesGroup key={ym} ym={ym} rows={mrows} total={total} />
              ))
          }
        </div>
      )}
    </div>
  );
}

function IIBBMesGroup({ ym, rows, total }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: '1px solid #FEF3C7', borderRadius: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: open ? '#FFFBEB' : '#FFFDF5', borderBottom: open ? '1px solid #FEF3C7' : 'none' }}>
        {open ? <ChevronDown size={13} color="#92400E" /> : <ChevronRight size={13} color="#92400E" />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E', minWidth: 150 }}>{ymLabel(ym)}</span>
        <span style={{ fontSize: 12, color: '#A16207' }}>{rows.length} {rows.length === 1 ? 'factura' : 'facturas'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: AMBER, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</span>
      </div>

      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FFFBEB' }}>
              {['Paciente', 'Obra Social', 'N° Factura', 'F. Factura', 'F. Cobro Real', 'Facturado', 'Ret. IIBB'].map(h => (
                <th key={h} style={{ padding: '7px 14px', textAlign: h === 'Ret. IIBB' || h === 'Facturado' ? 'right' : 'left', fontWeight: 600, color: '#92400E', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #FEF3C7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #FEF9EB' }}>
                <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827' }}>{toTitleCase(v.paciente)}</td>
                <td style={{ padding: '8px 14px', color: '#374151' }}>{toTitleCase(v.obraSocial)}</td>
                <td style={{ padding: '8px 14px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{v.nroFactura || '—'}</td>
                <td style={{ padding: '8px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaFactura || '—'}</td>
                <td style={{ padding: '8px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{v.fechaCobroReal || '—'}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{formatARS(parseArgMoney(v.montoFacturado))}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: AMBER }}>{formatARS(parseArgMoney(v.retIIBB))}</td>
              </tr>
            ))}
            <tr style={{ background: '#FFFBEB' }}>
              <td colSpan={5} style={{ padding: '7px 14px', fontSize: 11, color: '#92400E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total mes</td>
              <td />
              <td style={{ padding: '7px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: AMBER }}>{formatARS(total)}</td>
            </tr>
          </tbody>
        </table>
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

/* ── Componente principal ───────────────────────────────── */
export default function Cobranzas({ data, loading, refetch, addToast }) {
  const { ventasCobros } = data;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const currentYM = format(new Date(), 'yyyy-MM');

  // Cobros realizados: agrupar por mes de fechaCobroReal
  const cobrosRealizados = useMemo(() => {
    const map = {};
    ventasCobros.filter(v => v.fechaCobroReal).forEach(v => {
      const d = parseDate(v.fechaCobroReal);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(v);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [ventasCobros]);

  // Facturación: agrupar por mes de fechaFactura
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

  const kpis = useMemo(() => {
    const facturado = ventasCobros.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const ingresado = ventasCobros.filter(v => v.fechaCobroReal).reduce((s, v) => {
      const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
      return s + parseArgMoney(v.montoFacturado) - r;
    }, 0);
    const proyectado = ventasCobros.filter(v => !v.fechaCobroReal && v.fechaCobroCheque).reduce((s, v) => {
      const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
      return s + parseArgMoney(v.montoFacturado) - r;
    }, 0);
    const pendiente = ventasCobros.filter(v => !v.fechaCobroReal && !v.fechaCobroCheque).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const porIngresar = facturado - ingresado;
    return { facturado, ingresado, proyectado, pendiente, porIngresar };
  }, [ventasCobros]);

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
      {/* KPIs */}
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Facturado" value={formatARS(kpis.facturado)} icon={TrendingUp} color="#6B7280"
              hint="Total emitido en facturas. Lo que se debería cobrar." />
            <KPICard label="Ingresado" value={formatARS(kpis.ingresado)} icon={TrendingUp} color={GREEN}
              hint="Dinero efectivamente recibido (con Fecha de cobro REAL cargada), neto de retenciones." />
            <KPICard label="Proyectado (echeq)" value={formatARS(kpis.proyectado)} icon={CalendarClock} color={BLUE}
              hint="Cheques/echeq sin acreditar todavía, netos de retenciones." />
            <KPICard label="Pendiente" value={formatARS(kpis.pendiente)} icon={Clock} color={RED}
              hint="Facturado sin cobro real ni cheque en circulación." />
          </div>
        )
      }

      {/* Banner facturado vs ingresado */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 22px', marginBottom: 24 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturado</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.facturado)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#D1D5DB', padding: '0 18px' }}><ArrowDownUp size={20} /></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingresado (real)</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.ingresado)}</span>
          </div>
          <div style={{ width: 1, background: '#E5E7EB', margin: '0 18px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diferencia (por ingresar)</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: kpis.porIngresar > 0 ? RED : GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(kpis.porIngresar)}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{kpis.facturado > 0 ? `${Math.round((kpis.ingresado / kpis.facturado) * 100)}% cobrado` : '—'}</span>
          </div>
        </div>
      )}

      {/* Botón registrar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: ORANGE, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
          <Plus size={14} /> Registrar cobro
        </button>
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : (
        <>
          {/* SECCIÓN 1: Cobros realizados por mes */}
          <SectionBlock title="Cobros realizados" subtitle="— por fecha de ingreso real" icon={TrendingUp} accentColor={GREEN} defaultOpen>
            {cobrosRealizados.length === 0
              ? <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin cobros registrados</div>
              : cobrosRealizados.map(({ ym, rows }) => (
                  <CobrosDelMes key={ym} ym={ym} rows={rows} defaultOpen={ym === currentYM} onEdit={setEditing} />
                ))
            }
          </SectionBlock>

          {/* SECCIÓN 2: Facturación por mes */}
          <SectionBlock title="Facturación" subtitle="— por fecha de emisión de factura" icon={FileText} accentColor="#6B7280">
            {facturacion.map(({ ym, rows }) => (
              <FacturacionMes key={ym} ym={ym} rows={rows} onEdit={setEditing} />
            ))}
          </SectionBlock>

          {/* SECCIÓN 3: Retenciones IIBB */}
          <RetIIBBSection rows={ventasCobros} />
        </>
      )}

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
