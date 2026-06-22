'use client';
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, CheckCircle2, Clock, TrendingUp, AlertTriangle, PhoneCall } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { formatARS, parseDate, toTitleCase, daysDiff } from '../utils/formatters';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

const ORANGE = '#C05621';
const GREEN  = '#059669';
const RED    = '#DC2626';
const AMBER  = '#D97706';
const BLUE   = '#1D4ED8';

function ymLabel(ym) {
  if (!ym || ym === 'sin-fecha') return 'Sin fecha';
  const [y, m] = ym.split('-');
  const s = format(new Date(Number(y), Number(m) - 1, 1), 'MMMM yyyy', { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function weekKey(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return format(start, 'yyyy-MM-dd');
}

function weekLabel(key) {
  const start = parseDate2(key);
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`;
}

// parseDate de formatters espera dd/MM/yyyy o ISO; acá la key ya es ISO yyyy-MM-dd
function parseDate2(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function ClasificacionBadge({ c }) {
  if (c === 'convertido') return <Badge type="cobrado">Convertido</Badge>;
  if (c === 'rechazado') return <Badge type="vencido">Rechazado</Badge>;
  return <Badge type="porVencer">Pendiente</Badge>;
}

// Apellido = primera palabra del nombre (los nombres se cargan apellido primero)
function apellido(str) {
  if (!str) return '';
  const first = String(str).trim().split(/\s+/)[0];
  return toTitleCase(first);
}

function nombrePar(p) {
  return `${apellido(p.paciente) || '—'} - ${apellido(p.medico) || '—'}`;
}

/* ── Tab: Pendientes a gestionar ─────────────────────────── */
function PendientesGroup({ title, hint, color, rows, icon: Icon }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
        {Icon && <Icon size={15} color={color} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</span>
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, background: '#F3F4F6', borderRadius: 10, padding: '1px 8px' }}>{rows.length}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{hint}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            {['', 'Paciente - Médico', 'Obra Social', 'F. Cotización', 'Días esperando', 'Monto', 'Estado'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const dias = daysDiff(parseDate(p.fechaCotizacion));
            const urgente = dias !== null && dias >= 14;
            return (
              <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: urgente ? '#FFFBEB' : '#fff' }}>
                <td style={{ padding: '10px 12px', width: 28 }}>
                  {urgente && <AlertTriangle size={14} color={AMBER} />}
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{nombrePar(p)}</td>
                <td style={{ padding: '10px 12px', color: '#374151' }}>{toTitleCase(p.obraSocial)}</td>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{p.fechaCotizacion || '—'}</td>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: urgente ? AMBER : '#6B7280' }}>
                  {dias !== null ? `${dias}d` : '—'}
                </td>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: '#111827' }}>{formatARS(p.monto)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{p.estado || '(sin estado)'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendientesTab({ rows }) {
  const { autorizadosSinFecha, cotizadosSinRespuesta } = useMemo(() => {
    const byUrgency = (a, b) => {
      const da = parseDate(a.fechaCotizacion);
      const db = parseDate(b.fechaCotizacion);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db; // más antiguos primero = más urgentes
    };
    const autorizadosSinFecha = rows
      .filter(p => String(p.estado || '').trim().toUpperCase() === 'AUTORIZADA')
      .sort(byUrgency);
    const cotizadosSinRespuesta = rows
      .filter(p => String(p.estado || '').trim().toUpperCase() !== 'AUTORIZADA')
      .sort(byUrgency);
    return { autorizadosSinFecha, cotizadosSinRespuesta };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
        No hay presupuestos pendientes de autorización 🎉
      </div>
    );
  }

  return (
    <div>
      <PendientesGroup
        title="Autorizado, sin fecha de cirugía"
        hint="Ya aprobaron el presupuesto — falta coordinar la fecha"
        color={GREEN}
        icon={CheckCircle2}
        rows={autorizadosSinFecha}
      />
      <PendientesGroup
        title="Cotizado, sin respuesta de autorización"
        hint="Todavía no contestaron si lo autorizan o no"
        color={AMBER}
        icon={Clock}
        rows={cotizadosSinRespuesta}
      />
    </div>
  );
}

/* ── Tab: Resumen semanal (agrupado por mes) ─────────────── */
function SemanalTab({ presupuestos }) {
  const meses = useMemo(() => {
    const map = {};
    const touch = (key) => { if (!map[key]) map[key] = { presupuestado: 0, autorizado: 0 }; return map[key]; };
    presupuestos.forEach(p => {
      const dCot = parseDate(p.fechaCotizacion);
      if (dCot) touch(weekKey(dCot)).presupuestado += p.monto;
      const dAut = parseDate(p.fechaAutorizacion);
      if (dAut && p.estado === 'Autorizada') touch(weekKey(dAut)).autorizado += p.monto;
    });
    const weeks = Object.keys(map).sort().reverse().map(k => ({ key: k, ...map[k] }));

    const byMonth = {};
    weeks.forEach(w => {
      const ym = format(parseDate2(w.key), 'yyyy-MM');
      if (!byMonth[ym]) byMonth[ym] = { ym, weeks: [], presupuestado: 0, autorizado: 0 };
      byMonth[ym].weeks.push(w);
      byMonth[ym].presupuestado += w.presupuestado;
      byMonth[ym].autorizado += w.autorizado;
    });
    return Object.keys(byMonth).sort().reverse().map(k => byMonth[k]);
  }, [presupuestos]);

  if (meses.length === 0) {
    return <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin datos</div>;
  }

  const currentYM = format(new Date(), 'yyyy-MM');

  return meses.map(m => (
    <SemanalMesGroup key={m.ym} mes={m} defaultOpen={m.ym === currentYM} />
  ));
}

function SemanalMesGroup({ mes, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer', borderBottom: open ? '1px solid #F3F4F6' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 150 }}>{ymLabel(mes.ym)}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Presupuestado:</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: ORANGE, fontVariantNumeric: 'tabular-nums', marginRight: 16 }}>{formatARS(mes.presupuestado)}</span>
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Autorizado:</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{formatARS(mes.autorizado)}</span>
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Semana', 'Presupuestado', 'Autorizado'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Semana' ? 'left' : 'right', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mes.weeks.map(({ key, presupuestado, autorizado }) => (
              <tr key={key} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{weekLabel(key)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: ORANGE, fontWeight: 600 }}>{presupuestado ? formatARS(presupuestado) : '—'}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: GREEN, fontWeight: 600 }}>{autorizado ? formatARS(autorizado) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Tab: Resumen mensual (pivot tipo Sheet) ────────────────
   Filas:
   - Presupuesto: monto cotizado, por mes de Fecha de cotización
   - Autorizado: monto autorizado, por mes de Fecha de autorización
   - Cirugías realizadas: monto realizado, por mes de Fecha de cx
   - Autorizado con fecha sin realizarse: autorizado + fecha de cx, sin realizar, por mes de Fecha de cx
   - Autorizaciones del mes sin fecha: autorizado sin fecha de cx, por mes de Fecha de autorización
============================================================ */
function MensualTab({ presupuestos }) {
  const { months, rows } = useMemo(() => {
    const monthSet = new Set();
    const presupuestoPorMes = {};
    const autorizadoPorMes = {};
    const realizadoPorMes = {};
    const autorizadoSinRealizarPorMes = {};
    const autorizacionesSinFechaPorMes = {};

    const add = (map, ym, monto) => { map[ym] = (map[ym] || 0) + monto; monthSet.add(ym); };

    presupuestos.forEach(p => {
      const dCot = parseDate(p.fechaCotizacion);
      if (dCot) add(presupuestoPorMes, format(dCot, 'yyyy-MM'), p.monto);

      const dAut = parseDate(p.fechaAutorizacion);
      const esAutorizada = p.estado === 'Autorizada';
      if (dAut && esAutorizada) add(autorizadoPorMes, format(dAut, 'yyyy-MM'), p.monto);

      const dCx = parseDate(p.fechaCx);
      if (dCx && p.realizada) add(realizadoPorMes, format(dCx, 'yyyy-MM'), p.monto);
      if (dCx && esAutorizada && !p.realizada) add(autorizadoSinRealizarPorMes, format(dCx, 'yyyy-MM'), p.monto);
      if (!dCx && esAutorizada && dAut) add(autorizacionesSinFechaPorMes, format(dAut, 'yyyy-MM'), p.monto);
    });

    const monthsSorted = Array.from(monthSet).sort().reverse();
    const rows = [
      { label: 'Presupuesto',                          color: ORANGE, map: presupuestoPorMes },
      { label: 'Autorizado',                            color: GREEN,  map: autorizadoPorMes },
      { label: 'Cirugías realizadas',                   color: BLUE,   map: realizadoPorMes },
      { label: 'Autorizado con fecha sin realizarse',   color: AMBER,  map: autorizadoSinRealizarPorMes },
      { label: 'Autorizaciones del mes sin fecha',      color: RED,    map: autorizacionesSinFechaPorMes },
    ];
    return { months: monthsSorted, rows };
  }, [presupuestos]);

  if (months.length === 0) {
    return <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin datos</div>;
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', left: 0, background: '#F9FAFB' }}>Métrica</th>
            {months.map(m => (
              <th key={m} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>{ymLabel(m)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, color, map }) => (
            <tr key={label} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '8px 12px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>{label}</td>
              {months.map(m => (
                <td key={m} style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: map[m] ? color : '#D1D5DB' }}>
                  {map[m] ? formatARS(map[m]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Tab: Detalle (todas las filas, agrupadas por mes) ──────── */
function PresupuestoRow({ p }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? 'none' : '1px solid #F3F4F6', cursor: 'pointer' }}>
        <td style={{ padding: '10px 12px', width: 28 }}>
          {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{nombrePar(p)}</td>
        <td style={{ padding: '10px 12px', color: '#374151' }}>{toTitleCase(p.obraSocial)}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{p.fechaCotizacion || '—'}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: '#111827' }}>{formatARS(p.monto)}</td>
        <td style={{ padding: '10px 12px' }}><ClasificacionBadge c={p.clasificacion} /></td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F8FAFC' }}>
          <td />
          <td colSpan={5} style={{ padding: '0 12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 24px', paddingTop: 10 }}>
              {[
                { label: 'Material', value: p.material || '—' },
                { label: 'N° Presupuesto', value: p.numeroPresupuesto || '—' },
                { label: 'Precio cotización', value: formatARS(p.precioCotizacion) },
                { label: 'Precio de mejora', value: p.precioMejora ? formatARS(p.precioMejora) : '—' },
                { label: 'Estado', value: p.estado || '—' },
                { label: 'F. autorización', value: p.fechaAutorizacion || '—' },
                { label: 'Condición de pago', value: toTitleCase(p.condicionPago) || '—' },
                { label: 'Realizada', value: p.realizada ? 'Sí' : 'No' },
                { label: 'F. de cirugía', value: p.fechaCx || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>
            {p.observaciones && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Observaciones</div>
                <div style={{ fontSize: 13, color: '#374151' }}>{p.observaciones}</div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function MesGroup({ ym, rows, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const total = rows.reduce((s, p) => s + p.monto, 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer', borderBottom: open ? '1px solid #F3F4F6' : 'none', background: open ? '#FAFAFA' : '#fff' }}>
        {open ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 150 }}>{ymLabel(ym)}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{rows.length} {rows.length === 1 ? 'presupuesto' : 'presupuestos'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280', marginRight: 6 }}>Total:</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{formatARS(total)}</span>
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              <th style={{ width: 28 }} />
              {['Paciente - Médico', 'Obra Social', 'F. Cotización', 'Monto', 'Estado'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => <PresupuestoRow key={i} p={p} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DetalleTab({ rows }) {
  const grouped = useMemo(() => {
    const map = {};
    rows.forEach(p => {
      const d = parseDate(p.fechaCotizacion);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(p);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [rows]);

  const currentYM = format(new Date(), 'yyyy-MM');

  if (grouped.length === 0) {
    return <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin presupuestos que coincidan con el filtro</div>;
  }

  return grouped.map(({ ym, rows }) => (
    <MesGroup key={ym} ym={ym} rows={rows} defaultOpen={ym === currentYM} />
  ));
}

/* ── Componente principal ───────────────────────────────── */
const TABS = [
  { id: 'pendientes', label: 'Pendientes a gestionar', icon: PhoneCall },
  { id: 'semanal',    label: 'Resumen semanal' },
  { id: 'mensual',    label: 'Resumen mensual' },
  { id: 'detalle',    label: 'Detalle' },
];

export default function Presupuestos({ data, loading }) {
  const { presupuestos } = data;
  const [search, setSearch] = useState('');
  const [filterMedico, setFilterMedico] = useState('');
  const [filterClasificacion, setFilterClasificacion] = useState('');
  const [tab, setTab] = useState('pendientes');

  const medicos = useMemo(() => [...new Set(presupuestos.map(p => p.medico).filter(Boolean))].sort(), [presupuestos]);

  const filtered = useMemo(() => presupuestos.filter(p => {
    if (search && !`${p.paciente} ${p.obraSocial}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMedico && p.medico !== filterMedico) return false;
    if (filterClasificacion && p.clasificacion !== filterClasificacion) return false;
    return true;
  }), [presupuestos, search, filterMedico, filterClasificacion]);

  const pendientesFiltrados = useMemo(() => filtered.filter(p => p.clasificacion === 'pendiente'), [filtered]);

  const kpis = useMemo(() => {
    const convertidos = presupuestos.filter(p => p.clasificacion === 'convertido');
    const rechazados = presupuestos.filter(p => p.clasificacion === 'rechazado');
    const pendientes = presupuestos.filter(p => p.clasificacion === 'pendiente');
    const totalPresupuestado = presupuestos.reduce((s, p) => s + p.monto, 0);
    const totalConvertido = convertidos.reduce((s, p) => s + p.monto, 0);
    const totalPendiente = pendientes.reduce((s, p) => s + p.monto, 0);
    const decididos = convertidos.length + rechazados.length;
    const tasaConversion = decididos > 0 ? (convertidos.length / decididos) * 100 : 0;
    return { convertidos, rechazados, pendientes, totalPresupuestado, totalConvertido, totalPendiente, tasaConversion };
  }, [presupuestos]);

  return (
    <div>
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Pendientes a gestionar" value={String(kpis.pendientes.length)} sub={formatARS(kpis.totalPendiente)} icon={PhoneCall} color={AMBER}
              hint="Cotizados, por salir, o autorizados sin fecha de cirugía todavía. Para hacer seguimiento." />
            <KPICard label="Tasa de conversión" value={`${kpis.tasaConversion.toFixed(0)}%`} icon={TrendingUp} color={GREEN}
              hint="Convertidos / (convertidos + rechazados), sin contar los pendientes." />
            <KPICard label="Monto presupuestado" value={formatARS(kpis.totalPresupuestado)} icon={FileText} color={ORANGE}
              hint="Suma de todos los presupuestos cotizados (precio cotización + mejora)." />
            <KPICard label="Convertidos" value={String(kpis.convertidos.length)} sub={formatARS(kpis.totalConvertido)} icon={CheckCircle2} color={GREEN}
              hint="Autorizados y con fecha de cirugía confirmada." />
          </div>
        )
      }

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente u obra social..."
          style={{ flex: 1, minWidth: 220, padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit' }} />
        <select value={filterMedico} onChange={e => setFilterMedico(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Todos los médicos</option>
          {medicos.map(m => <option key={m} value={m}>{toTitleCase(m)}</option>)}
        </select>
        {tab === 'detalle' && (
          <select value={filterClasificacion} onChange={e => setFilterClasificacion(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Todos los estados</option>
            <option value="convertido">Convertido</option>
            <option value="pendiente">Pendiente</option>
            <option value="rechazado">Rechazado</option>
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 2, background: '#F3F4F6', borderRadius: 9, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 500, fontFamily: 'inherit',
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#111827' : '#6B7280',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t.icon && <t.icon size={13} />}
            {t.label}
            {t.id === 'pendientes' && kpis.pendientes.length > 0 && (
              <span style={{ background: AMBER, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{kpis.pendientes.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : (
        <>
          {tab === 'pendientes' && <PendientesTab rows={pendientesFiltrados} />}
          {tab === 'semanal' && <SemanalTab presupuestos={filtered} />}
          {tab === 'mensual' && <MensualTab presupuestos={filtered} />}
          {tab === 'detalle' && <DetalleTab rows={filtered} />}
        </>
      )}
    </div>
  );
}
