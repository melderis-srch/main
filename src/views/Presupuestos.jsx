'use client';
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonTable, SkeletonKPI } from '../components/UI/Skeleton';
import { formatARS, parseDate, toTitleCase } from '../utils/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ORANGE = '#C05621';
const GREEN  = '#059669';
const RED    = '#DC2626';
const AMBER  = '#D97706';

function ymLabel(ym) {
  if (!ym || ym === 'sin-fecha') return 'Sin fecha';
  const [y, m] = ym.split('-');
  const s = format(new Date(Number(y), Number(m) - 1, 1), 'MMMM yyyy', { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ClasificacionBadge({ c }) {
  if (c === 'convertido') return <Badge type="cobrado">Convertido</Badge>;
  if (c === 'rechazado') return <Badge type="vencido">Rechazado</Badge>;
  return <Badge type="porVencer">Pendiente</Badge>;
}

function PresupuestoRow({ p }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? 'none' : '1px solid #F3F4F6', cursor: 'pointer' }}>
        <td style={{ padding: '10px 12px', width: 28 }}>
          {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{toTitleCase(p.paciente)}</td>
        <td style={{ padding: '10px 12px', color: '#374151' }}>{toTitleCase(p.medico)}</td>
        <td style={{ padding: '10px 12px', color: '#374151' }}>{toTitleCase(p.obraSocial)}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{p.fechaCotizacion || '—'}</td>
        <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: '#111827' }}>{formatARS(p.monto)}</td>
        <td style={{ padding: '10px 12px' }}><ClasificacionBadge c={p.clasificacion} /></td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F8FAFC' }}>
          <td />
          <td colSpan={6} style={{ padding: '0 12px 14px' }}>
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
              {['Paciente', 'Médico', 'Obra Social', 'F. Cotización', 'Monto', 'Estado'].map(h => (
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

export default function Presupuestos({ data, loading }) {
  const { presupuestos } = data;
  const [search, setSearch] = useState('');
  const [filterMedico, setFilterMedico] = useState('');
  const [filterClasificacion, setFilterClasificacion] = useState('');

  const medicos = useMemo(() => [...new Set(presupuestos.map(p => p.medico).filter(Boolean))].sort(), [presupuestos]);

  const filtered = useMemo(() => presupuestos.filter(p => {
    if (search && !`${p.paciente} ${p.obraSocial}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMedico && p.medico !== filterMedico) return false;
    if (filterClasificacion && p.clasificacion !== filterClasificacion) return false;
    return true;
  }), [presupuestos, search, filterMedico, filterClasificacion]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      const d = parseDate(p.fechaCotizacion);
      const ym = d ? format(d, 'yyyy-MM') : 'sin-fecha';
      if (!map[ym]) map[ym] = [];
      map[ym].push(p);
    });
    return Object.keys(map).sort().reverse().map(k => ({ ym: k, rows: map[k] }));
  }, [filtered]);

  const kpis = useMemo(() => {
    const convertidos = presupuestos.filter(p => p.clasificacion === 'convertido');
    const rechazados = presupuestos.filter(p => p.clasificacion === 'rechazado');
    const pendientes = presupuestos.filter(p => p.clasificacion === 'pendiente');
    const totalPresupuestado = presupuestos.reduce((s, p) => s + p.monto, 0);
    const totalConvertido = convertidos.reduce((s, p) => s + p.monto, 0);
    const decididos = convertidos.length + rechazados.length;
    const tasaConversion = decididos > 0 ? (convertidos.length / decididos) * 100 : 0;
    return { convertidos, rechazados, pendientes, totalPresupuestado, totalConvertido, tasaConversion };
  }, [presupuestos]);

  const currentYM = format(new Date(), 'yyyy-MM');

  return (
    <div>
      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>{Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Tasa de conversión" value={`${kpis.tasaConversion.toFixed(0)}%`} icon={TrendingUp} color={GREEN}
              hint="Convertidos / (convertidos + rechazados), sin contar los pendientes." />
            <KPICard label="Monto presupuestado" value={formatARS(kpis.totalPresupuestado)} icon={FileText} color={ORANGE}
              hint="Suma de todos los presupuestos cotizados (precio cotización + mejora)." />
            <KPICard label="Convertidos" value={String(kpis.convertidos.length)} sub={formatARS(kpis.totalConvertido)} icon={CheckCircle2} color={GREEN}
              hint="Autorizados y con fecha de cirugía confirmada." />
            <KPICard label="Pendientes" value={String(kpis.pendientes.length)} icon={Clock} color={AMBER}
              hint="Cotizados, por salir, o autorizados sin fecha de cirugía todavía." />
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
        <select value={filterClasificacion} onChange={e => setFilterClasificacion(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Todos los estados</option>
          <option value="convertido">Convertido</option>
          <option value="pendiente">Pendiente</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          Sin presupuestos que coincidan con el filtro
        </div>
      ) : (
        grouped.map(({ ym, rows }) => (
          <MesGroup key={ym} ym={ym} rows={rows} defaultOpen={ym === currentYM} />
        ))
      )}
    </div>
  );
}
