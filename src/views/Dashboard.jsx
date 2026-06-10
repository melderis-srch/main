'use client';
import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonKPI, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, formatPct, MONTHS_ES } from '../utils/formatters';
import { DollarSign, TrendingUp, Clock, Activity, Receipt, BarChart2 } from 'lucide-react';

const ORANGE = '#E8622A';
const BLUE = '#2B4C8C';
const PIE_COLORS = ['#E8622A', '#2B4C8C', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

export default function Dashboard({ data, loading }) {
  const { cirugias, consolidado, ventasCobros, gastosPagos } = data;

  const kpis = useMemo(() => {
    const totalFacturado = cirugias.reduce((s, c) => s + parseArgMoney(c.montoFactura), 0);
    const totalCobrado = ventasCobros.reduce((s, v) => s + parseArgMoney(v.montoCobrado), 0);
    const pendienteCobro = totalFacturado - totalCobrado;
    const cantCirugias = cirugias.length;
    const totalGastos = gastosPagos.reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const margens = cirugias.filter(c => c.pctMargen).map(c => parseArgMoney(c.pctMargen));
    const avgMargen = margens.length ? margens.reduce((a, b) => a + b, 0) / margens.length : 0;
    return { totalFacturado, totalCobrado, pendienteCobro, cantCirugias, totalGastos, avgMargen };
  }, [cirugias, ventasCobros, gastosPagos]);

  // Monthly chart data from consolidado or fallback from cirugias
  const monthlyData = useMemo(() => {
    if (consolidado.length) {
      return consolidado.map(c => ({
        mes: String(c.mes).substring(0, 3),
        facturado: parseArgMoney(c.montoFacturadoTotal),
        cobrado: parseArgMoney(c.montoRecolectado),
      }));
    }
    // fallback: group cirugias by mes
    const byMes = {};
    cirugias.forEach(c => {
      const m = c.mes || 'Sin mes';
      if (!byMes[m]) byMes[m] = { facturado: 0, cobrado: 0 };
      byMes[m].facturado += parseArgMoney(c.montoFactura);
      if (c.cobrado) byMes[m].cobrado += parseArgMoney(c.montoFactura);
    });
    return Object.entries(byMes).map(([mes, v]) => ({ mes: mes.substring(0, 3), ...v }));
  }, [consolidado, cirugias]);

  // Top obras sociales
  const obrasSociales = useMemo(() => {
    const map = {};
    cirugias.forEach(c => {
      const os = c.obraSocial || 'Sin OS';
      if (!map[os]) map[os] = { name: os, cantidad: 0, facturado: 0, cobrado: 0 };
      map[os].cantidad++;
      map[os].facturado += parseArgMoney(c.montoFactura);
      if (c.cobrado) map[os].cobrado += parseArgMoney(c.montoFactura);
    });
    return Object.values(map)
      .sort((a, b) => b.facturado - a.facturado)
      .slice(0, 8);
  }, [cirugias]);

  const formatTooltipMoney = (value) => formatARS(value);

  if (loading) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {Array(6).fill(0).map((_, i) => <SkeletonKPI key={i} />)}
        </div>
        <Skeleton height={280} borderRadius={10} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <KPICard label="Total facturado YTD" value={formatARS(kpis.totalFacturado)} icon={DollarSign} color={ORANGE} />
        <KPICard label="Total cobrado YTD" value={formatARS(kpis.totalCobrado)} icon={TrendingUp} color="#059669" />
        <KPICard label="Pendiente de cobro" value={formatARS(kpis.pendienteCobro)} icon={Clock} color="#DC2626" />
        <KPICard label="Cirugías YTD" value={kpis.cantCirugias} icon={Activity} color={BLUE} />
        <KPICard label="Total gastos YTD" value={formatARS(kpis.totalGastos)} icon={Receipt} color="#6B7280" />
        <KPICard label="% Rentabilidad promedio" value={formatPct(kpis.avgMargen)} icon={BarChart2} color={ORANGE} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Bar + Line chart */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
            Facturado vs Cobrado por mes
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tickFormatter={v => formatARS(v, true)} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip formatter={formatTooltipMoney} />
              <Bar dataKey="facturado" fill={ORANGE} name="Facturado" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="cobrado" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} name="Cobrado" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart top OS */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
            Top obras sociales
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={obrasSociales} cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                dataKey="facturado" nameKey="name"
              >
                {obrasSociales.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipMoney} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* OS summary table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
            Resumen por obra social
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Obra Social', 'Cirugías', 'Facturado', 'Cobrado', 'Pendiente', '% Cobranza'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Obra Social' ? 'left' : 'right', fontWeight: 600, color: '#374151', fontSize: 13, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obrasSociales.map((os, i) => {
                const pendiente = os.facturado - os.cobrado;
                const pctCob = os.facturado ? (os.cobrado / os.facturado) * 100 : 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{os.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#6B7280' }}>{os.cantidad}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{formatARS(os.facturado)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#059669' }}>{formatARS(os.cobrado)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: pendiente > 0 ? '#DC2626' : '#6B7280' }}>{formatARS(pendiente)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: pctCob >= 80 ? '#059669' : pctCob >= 50 ? '#D97706' : '#DC2626' }}>{pctCob.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
