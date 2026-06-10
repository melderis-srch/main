'use client';
import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { KPICard } from '../components/UI/KPICard';
import { SkeletonKPI, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff, toTitleCase } from '../utils/formatters';
import { DollarSign, TrendingUp, Clock, AlertCircle, Receipt, CreditCard, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ORANGE = '#E8622A';

function SectionTitle({ children }) {
  return <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</h3>;
}

function Card({ children, style }) {
  return <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, ...style }}>{children}</div>;
}

function MonthSelect({ value, onChange, allMonths }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Período:</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#111827', cursor: 'pointer' }}>
        <option value="">Acumulado total</option>
        {allMonths.map(m => (
          <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}</option>
        ))}
      </select>
    </div>
  );
}

export default function Dashboard({ data, loading }) {
  const { consolidado, ventasCobros, gastosPagos } = data;
  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const allMonths = useMemo(() => {
    const set = new Set();
    ventasCobros.forEach(v => { const d = parseDate(v.fechaFactura); if (d) set.add(format(d, 'yyyy-MM')); });
    gastosPagos.forEach(g => { const d = parseDate(g.fechaEmision); if (d) set.add(format(d, 'yyyy-MM')); });
    return Array.from(set).sort().reverse();
  }, [ventasCobros, gastosPagos]);

  function inMonth(dateStr) {
    if (!selectedMonth) return true;
    const d = parseDate(dateStr);
    if (!d) return false;
    return format(d, 'yyyy-MM') === selectedMonth;
  }

  const cobros = useMemo(() => {
    const rows = selectedMonth ? ventasCobros.filter(v => inMonth(v.fechaFactura)) : ventasCobros;
    const facturado = rows.reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    const ingresado = rows.filter(v => v.fechaCobroReal).reduce((s, v) => s + parseArgMoney(v.montoCobrado || v.montoFacturado), 0);
    const proyectado = rows.filter(v => !v.fechaCobroReal && v.fechaCobroCheque).reduce((s, v) => {
      const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
      return s + parseArgMoney(v.montoFacturado) - retes;
    }, 0);
    const pendiente = rows.filter(v => !v.fechaCobroReal && !v.fechaCobroCheque).reduce((s, v) => s + parseArgMoney(v.montoFacturado), 0);
    return { facturado, ingresado, proyectado, pendiente };
  }, [ventasCobros, selectedMonth]);

  const gastos = useMemo(() => {
    const rows = selectedMonth ? gastosPagos.filter(g => inMonth(g.fechaEmision)) : gastosPagos;
    const total = rows.reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const pagado = rows.filter(g => g.pagado || g.saldado).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const proyectado = rows.filter(g => !g.pagado && !g.saldado && g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    const pendiente = rows.filter(g => !g.pagado && !g.saldado && !g.fechaPagoEcheq).reduce((s, g) => s + parseArgMoney(g.monto), 0);
    return { total, pagado, proyectado, pendiente };
  }, [gastosPagos, selectedMonth]);

  const monthlyData = useMemo(() => consolidado.map(c => ({
    mes: String(c.mes).substring(0, 3),
    facturado: parseArgMoney(c.montoFacturadoTotal),
    cobrado: parseArgMoney(c.montoRecolectado),
    gastos: parseArgMoney(c.totalGastos),
  })), [consolidado]);

  const deudaOS = useMemo(() => {
    const rows = selectedMonth ? ventasCobros.filter(v => inMonth(v.fechaFactura)) : ventasCobros;
    const map = {};
    rows.forEach(v => {
      if (v.fechaCobroReal) return;
      const os = toTitleCase(v.obraSocial) || 'Sin OS';
      if (!map[os]) map[os] = { name: os, monto: 0, facturas: 0, proyectado: 0 };
      const retes = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
      map[os].monto += parseArgMoney(v.montoFacturado);
      map[os].facturas++;
      if (v.fechaCobroCheque) map[os].proyectado += parseArgMoney(v.montoFacturado) - retes;
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [ventasCobros, selectedMonth]);

  const deudaProveedores = useMemo(() => {
    const rows = selectedMonth ? gastosPagos.filter(g => inMonth(g.fechaEmision)) : gastosPagos;
    const map = {};
    rows.forEach(g => {
      if (g.pagado) return;
      const prov = toTitleCase(g.emisor) || 'Sin proveedor';
      if (!map[prov]) map[prov] = { name: prov, monto: 0, vencidas: 0, proyectado: 0 };
      map[prov].monto += parseArgMoney(g.monto);
      if (daysDiff(parseDate(g.fechaEmision)) > 30) map[prov].vencidas++;
      if (!g.pagado && !g.saldado && g.fechaPagoEcheq) map[prov].proyectado += parseArgMoney(g.monto);
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [gastosPagos, selectedMonth]);

  if (loading) return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {Array(8).fill(0).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <Skeleton height={280} borderRadius={10} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MonthSelect value={selectedMonth} onChange={setSelectedMonth} allMonths={allMonths} />
      </div>

      <div>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cobros</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KPICard label="Facturado" value={formatARS(cobros.facturado)} icon={DollarSign} color="#6B7280" />
          <KPICard label="Ingresado" value={formatARS(cobros.ingresado)} icon={TrendingUp} color="#059669" />
          <KPICard label="Proyectado (echeq)" value={formatARS(cobros.proyectado)} icon={CalendarClock} color="#1D4ED8" />
          <KPICard label="Pendiente s/ cobrar" value={formatARS(cobros.pendiente)} icon={Clock} color="#DC2626" />
        </div>
      </div>

      <div>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gastos</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KPICard label="Total gastos" value={formatARS(gastos.total)} icon={Receipt} color="#6B7280" />
          <KPICard label="Pagado" value={formatARS(gastos.pagado)} icon={CreditCard} color="#059669" />
          <KPICard label="Proyectado (echeq)" value={formatARS(gastos.proyectado)} icon={CalendarClock} color="#1D4ED8" />
          <KPICard label="Pendiente de pago" value={formatARS(gastos.pendiente)} icon={AlertCircle} color="#D97706" />
        </div>
      </div>

      {monthlyData.length > 0 && (
        <Card>
          <SectionTitle>Evolución mensual</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => formatARS(v, true)} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={v => formatARS(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
              <Bar dataKey="facturado" fill={ORANGE} name="Facturado" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Line type="monotone" dataKey="cobrado" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669' }} name="Cobrado" />
              <Line type="monotone" dataKey="gastos" stroke="#1D4ED8" strokeWidth={2} dot={{ r: 3, fill: '#1D4ED8' }} strokeDasharray="4 2" name="Gastos" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        <Card style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Cobros pendientes por obra social</span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#DC2626' }}>{formatARS(deudaOS.reduce((s, o) => s + o.monto, 0))}</span>
          </div>
          {deudaOS.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin cobros pendientes</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#F9FAFB' }}>
                {['Obra Social', 'Facturas', 'Monto', 'Echeq'].map(h => <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Obra Social' ? 'left' : 'right', fontWeight: 600, color: '#9CA3AF', fontSize: 11, borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {deudaOS.map((os, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 500 }}>{os.name}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: '#9CA3AF' }}>{os.facturas}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#DC2626' }}>{formatARS(os.monto)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#1D4ED8' }}>{os.proyectado > 0 ? formatARS(os.proyectado) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Deuda a proveedores</span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#D97706' }}>{formatARS(deudaProveedores.reduce((s, p) => s + p.monto, 0))}</span>
          </div>
          {deudaProveedores.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin deuda pendiente</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#F9FAFB' }}>
                {['Proveedor', 'Vencidas', 'Monto', 'Echeq'].map(h => <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Proveedor' ? 'left' : 'right', fontWeight: 600, color: '#9CA3AF', fontSize: 11, borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {deudaProveedores.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: p.vencidas > 0 ? '#DC2626' : '#9CA3AF', fontSize: 12 }}>{p.vencidas > 0 ? `${p.vencidas}` : '—'}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#D97706' }}>{formatARS(p.monto)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#1D4ED8' }}>{p.proyectado > 0 ? formatARS(p.proyectado) : '—'}</td>
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
