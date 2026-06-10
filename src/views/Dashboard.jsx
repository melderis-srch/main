'use client';
import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonKPI, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff } from '../utils/formatters';
import { DollarSign, TrendingUp, Clock, AlertCircle, Receipt, CreditCard } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const ORANGE = '#E8622A';
const BLUE = '#2B4C8C';
const PIE_COLORS = ['#E8622A', '#2B4C8C', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

function SectionTitle({ children }) {
  return (
    <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111827' }}>{children}</h3>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, ...style }}>
      {children}
    </div>
  );
}

export default function Dashboard({ data, loading }) {
  const { cirugias, consolidado, ventasCobros, gastosPagos } = data;
  const now = new Date();

  // --- KPIs ---
  const kpis = useMemo(() => {
    const facturadoYTD = ventasCobros.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const cobradoYTD = ventasCobros.filter(v => v.fechaCobroReal).reduce((s, v) => s + parseArgMoney(v.montoCobrado || v.montoFacturado), 0);
    const pendienteCobro = ventasCobros.filter(v => !v.fechaCobroReal).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const totalGastos = gastosPagos.reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const gastosPageados = gastosPagos.filter(g => g.pagado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const gastosPendientes = gastosPagos.filter(g => !g.pagado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    return { facturadoYTD, cobradoYTD, pendienteCobro, totalGastos, gastosPageados, gastosPendientes };
  }, [ventasCobros, gastosPagos]);

  // --- Monthly chart from consolidado ---
  const monthlyData = useMemo(() => {
    if (consolidado.length) {
      return consolidado.map(c => ({
        mes: String(c.mes).substring(0, 3),
        facturado: parseArgMoney(c.montoFacturadoTotal),
        cobrado: parseArgMoney(c.montoRecolectado),
        gastos: parseArgMoney(c.totalGastos),
      }));
    }
    return [];
  }, [consolidado]);

  // --- Deuda por obra social (from ventasCobros, not cobrado yet) ---
  const deudaOS = useMemo(() => {
    const map = {};
    ventasCobros.forEach(v => {
      if (v.fechaCobroReal) return;
      const os = v.obraSocial || 'Sin OS';
      if (!map[os]) map[os] = { name: os, monto: 0, facturas: 0 };
      map[os].monto += parseArgMoney(v.montoFacturado);
      map[os].facturas++;
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [ventasCobros]);

  // --- Deuda a proveedores (from gastosPagos, not pagado) ---
  const deudaProveedores = useMemo(() => {
    const map = {};
    gastosPagos.forEach(g => {
      if (g.pagado) return;
      const prov = g.emisor || 'Sin proveedor';
      if (!map[prov]) map[prov] = { name: prov, monto: 0, facturas: 0, vencidas: 0 };
      map[prov].monto += parseArgMoney(g.monto);
      map[prov].facturas++;
      if (daysDiff(parseDate(g.fechaEmision)) > 30) map[prov].vencidas++;
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [gastosPagos]);

  // --- Gastos por categoría (pie) ---
  const gastosCat = useMemo(() => {
    const map = {};
    gastosPagos.forEach(g => {
      const cat = g.categoria || 'Sin categoría';
      if (!map[cat]) map[cat] = 0;
      map[cat] += parseArgMoney(g.monto);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [gastosPagos]);

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

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <KPICard label="Facturado YTD" value={formatARS(kpis.facturadoYTD)} icon={DollarSign} color={ORANGE} />
        <KPICard label="Cobrado YTD" value={formatARS(kpis.cobradoYTD)} icon={TrendingUp} color="#059669" />
        <KPICard label="Pendiente de cobro" value={formatARS(kpis.pendienteCobro)} icon={Clock} color="#DC2626" />
        <KPICard label="Total gastos YTD" value={formatARS(kpis.totalGastos)} icon={Receipt} color="#6B7280" />
        <KPICard label="Gastos pagados" value={formatARS(kpis.gastosPageados)} icon={CreditCard} color={BLUE} />
        <KPICard label="Gastos pendientes" value={formatARS(kpis.gastosPendientes)} icon={AlertCircle} color="#D97706" />
      </div>

      {/* Chart row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <Card>
          <SectionTitle>Facturado vs Cobrado vs Gastos por mes</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tickFormatter={v => formatARS(v, true)} tick={{ fontSize: 11, fill: '#6B7280' }} width={70} />
              <Tooltip formatter={v => formatARS(v)} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="facturado" fill={ORANGE} name="Facturado" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="cobrado" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Cobrado" />
              <Line type="monotone" dataKey="gastos" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="Gastos" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>Gastos por categoría</SectionTitle>
          {gastosCat.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', paddingTop: 60 }}>Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={gastosCat} cx="50%" cy="45%" innerRadius={50} outerRadius={85} dataKey="value" nameKey="name">
                  {gastosCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatARS(v)} />
                <Legend iconType="circle" iconSize={8} formatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Deuda tables row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Deuda de obras sociales */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionTitle>Cobros pendientes por obra social</SectionTitle>
            <span style={{ fontSize: 13, color: '#6B7280', background: '#F3F4F6', padding: '3px 10px', borderRadius: 12, fontFamily: 'JetBrains Mono, monospace' }}>
              {formatARS(deudaOS.reduce((s, o) => s + o.monto, 0))}
            </span>
          </div>
          {deudaOS.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin cobros pendientes</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>Obra Social</th>
                  <th style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>Facturas</th>
                  <th style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {deudaOS.map((os, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 500 }}>{os.name}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: '#6B7280' }}>{os.facturas}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{formatARS(os.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Deuda a proveedores */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionTitle>Deuda a proveedores</SectionTitle>
            <span style={{ fontSize: 13, color: '#6B7280', background: '#F3F4F6', padding: '3px 10px', borderRadius: 12, fontFamily: 'JetBrains Mono, monospace' }}>
              {formatARS(deudaProveedores.reduce((s, p) => s + p.monto, 0))}
            </span>
          </div>
          {deudaProveedores.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin deuda pendiente</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>Proveedor</th>
                  <th style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>Vencidas</th>
                  <th style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {deudaProveedores.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: p.vencidas > 0 ? '#DC2626' : '#6B7280', fontSize: 12 }}>
                      {p.vencidas > 0 ? `${p.vencidas} venc.` : '—'}
                    </td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: '#D97706' }}>{formatARS(p.monto)}</td>
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
