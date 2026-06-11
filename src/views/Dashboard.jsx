'use client';
import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonKPI, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff, toTitleCase } from '../utils/formatters';
import { Receipt, CreditCard, CalendarClock, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const PIE_COLORS = ['#1E3A5F', '#2D6A9F', '#5B9BD5', '#A8C9E8', '#C8D8E8', '#E0EAF4'];

function Card({ children, style }) {
  return <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', ...style }}>{children}</div>;
}

function MonthSelect({ value, onChange, allMonths }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Período:</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#111827', cursor: 'pointer' }}>
        <option value="">Acumulado total</option>
        {allMonths.map(m => (
          <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}</option>
        ))}
      </select>
    </div>
  );
}

function Delta({ pct }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: up ? '#059669' : '#DC2626' }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct.toFixed(1)}% vs mes ant.
    </span>
  );
}

function SummaryRow({ label, value, delta, hint, highlight, mono }) {
  const [showHint, setShowHint] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 0', borderBottom: '1px solid #F3F4F6',
      background: highlight ? '#FAFFFE' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <span style={{ fontSize: 13, color: '#374151', fontWeight: highlight ? 600 : 400 }}>{label}</span>
        {hint && (
          <span onMouseEnter={() => setShowHint(true)} onMouseLeave={() => setShowHint(false)}
            style={{ cursor: 'help', color: '#D1D5DB', lineHeight: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            {showHint && (
              <span style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50,
                background: '#1F2937', color: '#F9FAFB', fontSize: 11, lineHeight: 1.4,
                padding: '7px 10px', borderRadius: 6, width: 210, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                fontWeight: 400, whiteSpace: 'normal'
              }}>{hint}</span>
            )}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{
          fontSize: highlight ? 16 : 14, fontWeight: highlight ? 700 : 600,
          fontFamily: mono !== false ? 'JetBrains Mono, monospace' : 'inherit',
          color: highlight === 'red' ? '#DC2626' : highlight === 'green' ? '#059669' : '#111827'
        }}>{value}</span>
        {delta !== undefined && <Delta pct={delta} />}
      </div>
    </div>
  );
}

function PieLegend({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{d.name}</span>
          </div>
          <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
            {formatARS(d.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

function calcMetrics(ventasCobros, gastosPagos, monthFilter) {
  function inM(dateStr, m) {
    if (!m) return true;
    const d = parseDate(dateStr);
    return d ? format(d, 'yyyy-MM') === m : false;
  }
  const vc = monthFilter ? ventasCobros.filter(v => inM(v.fechaFactura, monthFilter)) : ventasCobros;
  const gp = monthFilter ? gastosPagos.filter(g => inM(g.fechaEmision, monthFilter)) : gastosPagos;

  const facturado = vc.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
  const ingresado = vc.filter(v => v.fechaCobroReal).reduce((s, v) => s + parseArgMoney(v.montoCobrado || v.montoFacturado), 0);
  const retenciones = vc.reduce((s, v) => s + parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados), 0);
  const proyCobranzas = vc.filter(v => !v.fechaCobroReal && !v.fechaCobroCheque).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
  const echeqCobros = vc.filter(v => !v.fechaCobroReal && v.fechaCobroCheque).reduce((s, v) => {
    const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
    return s + parseArgMoney(v.montoFacturado) - r;
  }, 0);

  const gasTotal = gp.reduce((s, g) => s + parseArgMoney(g.monto), 0);
  const gasPagado = gp.filter(g => g.pagado || g.saldado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
  const gasProyectado = gp.filter(g => !g.pagado && !g.saldado && g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
  const gasPendiente = gp.filter(g => !g.pagado && !g.saldado && !g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);

  const ganancia = ingresado - gasTotal;
  const rentabilidad = facturado > 0 ? (ganancia / facturado) * 100 : 0;

  return { facturado, ingresado, retenciones, proyCobranzas, echeqCobros, gasTotal, gasPagado, gasProyectado, gasPendiente, ganancia, rentabilidad };
}

export default function Dashboard({ data, loading }) {
  const { ventasCobros, gastosPagos } = data;
  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const allMonths = useMemo(() => {
    const set = new Set();
    ventasCobros.forEach(v => { const d = parseDate(v.fechaFactura); if (d) set.add(format(d, 'yyyy-MM')); });
    gastosPagos.forEach(g => { const d = parseDate(g.fechaEmision); if (d) set.add(format(d, 'yyyy-MM')); });
    return Array.from(set).sort().reverse();
  }, [ventasCobros, gastosPagos]);

  const metrics = useMemo(() => calcMetrics(ventasCobros, gastosPagos, selectedMonth), [ventasCobros, gastosPagos, selectedMonth]);

  const prevMonth = useMemo(() => {
    if (!selectedMonth) return null;
    return format(subMonths(parseISO(selectedMonth + '-01'), 1), 'yyyy-MM');
  }, [selectedMonth]);

  const prevMetrics = useMemo(() => prevMonth ? calcMetrics(ventasCobros, gastosPagos, prevMonth) : null, [ventasCobros, gastosPagos, prevMonth]);

  function delta(curr, prev) {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  const gastosPorCategoria = useMemo(() => {
    const rows = selectedMonth
      ? gastosPagos.filter(g => { const d = parseDate(g.fechaEmision); return d && format(d, 'yyyy-MM') === selectedMonth; })
      : gastosPagos;
    const map = {};
    rows.forEach(g => {
      const cat = toTitleCase(g.categoria) || 'Otros';
      map[cat] = (map[cat] || 0) + parseArgMoney(g.monto);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [gastosPagos, selectedMonth]);

  const deudaOS = useMemo(() => {
    const rows = selectedMonth
      ? ventasCobros.filter(v => { const d = parseDate(v.fechaFactura); return d && format(d, 'yyyy-MM') === selectedMonth; })
      : ventasCobros;
    const map = {};
    rows.forEach(v => {
      if (v.fechaCobroReal) return;
      const os = toTitleCase(v.obraSocial) || 'Sin OS';
      if (!map[os]) map[os] = { name: os, monto: 0, facturas: 0, echeq: 0 };
      map[os].monto += parseArgMoney(v.montoFacturado);
      map[os].facturas++;
      if (v.fechaCobroCheque) {
        const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
        map[os].echeq += parseArgMoney(v.montoFacturado) - r;
      }
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [ventasCobros, selectedMonth]);

  const deudaProveedores = useMemo(() => {
    const rows = selectedMonth
      ? gastosPagos.filter(g => { const d = parseDate(g.fechaEmision); return d && format(d, 'yyyy-MM') === selectedMonth; })
      : gastosPagos;
    const map = {};
    rows.forEach(g => {
      if (g.pagado || g.saldado) return;
      const prov = toTitleCase(g.emisor) || 'Sin proveedor';
      if (!map[prov]) map[prov] = { name: prov, monto: 0, vencidas: 0, echeq: 0 };
      map[prov].monto += parseArgMoney(g.monto);
      if (daysDiff(parseDate(g.fechaEmision)) > 30) map[prov].vencidas++;
      if (g.fechaPagoEcheq && !g.saldado) map[prov].echeq += parseArgMoney(g.monto);
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [gastosPagos, selectedMonth]);

  const pm = prevMetrics;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Skeleton height={380} borderRadius={10} />
        <Skeleton height={380} borderRadius={10} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {Array(4).fill(0).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <Skeleton height={200} borderRadius={10} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Consolidado financiero</h2>
        <MonthSelect value={selectedMonth} onChange={setSelectedMonth} allMonths={allMonths} />
      </div>

      {/* Main row: Financial Summary + Gastos pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Financial Summary */}
        <Card>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFC' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen financiero</span>
          </div>
          <div style={{ padding: '4px 20px 12px' }}>
            <SummaryRow
              label="Facturado"
              value={formatARS(metrics.facturado)}
              delta={pm ? delta(metrics.facturado, pm.facturado) : null}
              hint="Total emitido en facturas del período. Lo que debería entrar."
            />
            <SummaryRow
              label="Total ingresado"
              value={formatARS(metrics.ingresado)}
              delta={pm ? delta(metrics.ingresado, pm.ingresado) : null}
              hint="Dinero realmente recibido: solo facturas con Fecha de cobro REAL cargada."
              highlight="green"
            />
            <SummaryRow
              label="Retenciones (IIBB, Ganancias, Sellados)"
              value={`- ${formatARS(metrics.retenciones)}`}
              hint="Total de retenciones descontadas por las obras sociales: IIBB + Ganancias + Sellados."
            />
            <SummaryRow
              label="Cobros pendientes s/ echeq"
              value={formatARS(metrics.proyCobranzas)}
              delta={pm ? delta(metrics.proyCobranzas, pm.proyCobranzas) : null}
              hint="Facturas sin cobrar y sin cheque emitido. Aún no hay fecha de ingreso."
            />
            <SummaryRow
              label="Echeqs que ingresan"
              value={formatARS(metrics.echeqCobros)}
              delta={pm ? delta(metrics.echeqCobros, pm.echeqCobros) : null}
              hint="Cheques/echeq en circulación, netos de retenciones. Tienen fecha de acreditación pero todavía no ingresaron."
            />
            <SummaryRow
              label="Total gastos"
              value={`- ${formatARS(metrics.gasTotal)}`}
              delta={pm ? delta(metrics.gasTotal, pm.gasTotal) : null}
              hint="Suma de todos los gastos del período (pagados + pendientes)."
            />
            <SummaryRow
              label="Ganancia"
              value={formatARS(metrics.ganancia)}
              delta={pm ? delta(metrics.ganancia, pm.ganancia) : null}
              hint="Ingresado real menos total de gastos del período."
              highlight={metrics.ganancia >= 0 ? 'green' : 'red'}
            />
            <SummaryRow
              label="Rentabilidad"
              value={`${metrics.rentabilidad.toFixed(1)}%`}
              delta={pm ? delta(metrics.rentabilidad, pm.rentabilidad) : null}
              hint="(Ganancia / Facturado) × 100. Margen neto del período."
              highlight={metrics.rentabilidad >= 0 ? 'green' : 'red'}
              mono={false}
            />
          </div>
        </Card>

        {/* Gastos por categoría */}
        <Card>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gastos por categoría</span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#374151' }}>{formatARS(metrics.gasTotal)}</span>
          </div>
          <div style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
            {gastosPorCategoria.length === 0 ? (
              <div style={{ flex: 1, textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 40 }}>Sin datos</div>
            ) : (
              <>
                <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gastosPorCategoria} cx="50%" cy="50%" innerRadius={42} outerRadius={72}
                        dataKey="value" stroke="none">
                        {gastosPorCategoria.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <PieTooltip formatter={v => formatARS(v)} contentStyle={{ fontSize: 12, borderRadius: 7, border: '1px solid #E5E7EB' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1 }}>
                  <PieLegend data={gastosPorCategoria} />
                </div>
              </>
            )}
          </div>

          {/* Gastos KPIs mini-grid */}
          <div style={{ borderTop: '1px solid #E5E7EB', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { label: 'Total gastos', value: formatARS(metrics.gasTotal), color: '#6B7280', hint: 'Suma de todas las facturas del período, pagas o no.' },
              { label: 'Pagado', value: formatARS(metrics.gasPagado), color: '#059669', hint: 'Gastos ya cancelados o echeq saldado.' },
              { label: 'Proyectado (echeq)', value: formatARS(metrics.gasProyectado), color: '#1D4ED8', hint: 'Echeq emitido, pendiente de débito. Saldrá de la cuenta en la fecha programada.' },
              { label: 'Pendiente de pago', value: formatARS(metrics.gasPendiente), color: '#D97706', hint: 'Gastos sin pagar ni echeq programado.' },
            ].map((k, i) => {
              const [showH, setShowH] = useState(false);
              return (
                <div key={i} style={{
                  padding: '12px 16px', borderRight: i % 2 === 0 ? '1px solid #E5E7EB' : 'none',
                  borderTop: i >= 2 ? '1px solid #E5E7EB' : 'none', position: 'relative'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
                    <span onMouseEnter={() => setShowH(true)} onMouseLeave={() => setShowH(false)} style={{ cursor: 'help', color: '#D1D5DB', lineHeight: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    </span>
                    {showH && (
                      <span style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 50, background: '#1F2937', color: '#F9FAFB', fontSize: 11, lineHeight: 1.4, padding: '6px 9px', borderRadius: 6, width: 190, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', whiteSpace: 'normal' }}>{k.hint}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#111827', borderLeft: `2px solid ${k.color}`, paddingLeft: 8 }}>{k.value}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Bottom tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        <Card>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Cobros pendientes por obra social</span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#DC2626' }}>{formatARS(deudaOS.reduce((s, o) => s + o.monto, 0))}</span>
          </div>
          {deudaOS.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin cobros pendientes</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Obra Social', 'Facturas', 'Monto', 'Echeq'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Obra Social' ? 'left' : 'right', fontWeight: 600, color: '#9CA3AF', fontSize: 10, borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deudaOS.map((os, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 500 }}>{os.name}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: '#9CA3AF', fontSize: 12 }}>{os.facturas}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#DC2626' }}>{formatARS(os.monto)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#1D4ED8', fontSize: 12 }}>{os.echeq > 0 ? formatARS(os.echeq) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Deuda a proveedores</span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#D97706' }}>{formatARS(deudaProveedores.reduce((s, p) => s + p.monto, 0))}</span>
          </div>
          {deudaProveedores.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin deuda pendiente</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Proveedor', 'Vencidas', 'Monto', 'Echeq'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Proveedor' ? 'left' : 'right', fontWeight: 600, color: '#9CA3AF', fontSize: 10, borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deudaProveedores.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: p.vencidas > 0 ? '#DC2626' : '#9CA3AF', fontSize: 12 }}>{p.vencidas > 0 ? p.vencidas : '—'}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#D97706' }}>{formatARS(p.monto)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#1D4ED8', fontSize: 12 }}>{p.echeq > 0 ? formatARS(p.echeq) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

      </div>
    </div>
  );
}
