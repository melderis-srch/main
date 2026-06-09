import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SkeletonTable, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, formatPct } from '../utils/formatters';

const ORANGE = '#E8622A';
const BLUE = '#2B4C8C';

function pct(val) {
  const n = parseArgMoney(val);
  if (!n) return '—';
  const formatted = (n * 100).toFixed(1).replace('.', ',') + '%';
  // If already looks like percentage (e.g. "45,2%")
  if (n > 1) return n.toFixed(1).replace('.', ',') + '%';
  return formatted;
}

export default function Consolidado({ data, loading }) {
  const { consolidado } = data;

  const chartData = useMemo(() =>
    consolidado.map(c => ({
      mes: String(c.mes).substring(0, 3),
      Facturado: parseArgMoney(c.montoFacturadoTotal),
      Costos: parseArgMoney(c.costosCirugias),
      Cobrado: parseArgMoney(c.montoRecolectado),
    })),
    [consolidado]
  );

  const totals = useMemo(() => {
    if (!consolidado.length) return null;
    return {
      cantidadCirugias: consolidado.reduce((s, c) => s + (Number(c.cantidadCirugias) || 0), 0),
      montoFacturadoTotal: consolidado.reduce((s, c) => s + parseArgMoney(c.montoFacturadoTotal), 0),
      montoRecolectado: consolidado.reduce((s, c) => s + parseArgMoney(c.montoRecolectado), 0),
      costosCirugias: consolidado.reduce((s, c) => s + parseArgMoney(c.costosCirugias), 0),
      totalGastos: consolidado.reduce((s, c) => s + parseArgMoney(c.totalGastos), 0),
    };
  }, [consolidado]);

  const formatTooltip = (v) => formatARS(v);

  if (loading) {
    return (
      <div>
        <Skeleton height={280} borderRadius={10} style={{ marginBottom: 20 }} />
        <SkeletonTable rows={12} cols={8} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stacked bar chart */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
          Facturado vs Costos por mes
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis tickFormatter={v => formatARS(v, true)} tick={{ fontSize: 11, fill: '#6B7280' }} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Bar dataKey="Facturado" stackId="a" fill={ORANGE} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Costos" stackId="b" fill={BLUE} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Mes', 'Cirugías', 'Facturado', 'Cobrado', 'Costos', 'Total Gastos', '% Recolección', '% Rentabilidad'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Mes' ? 'left' : 'right', fontWeight: 600, color: '#374151', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consolidado.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{c.mes}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6B7280' }}>{c.cantidadCirugias}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{formatARS(parseArgMoney(c.montoFacturadoTotal))}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#059669' }}>{formatARS(parseArgMoney(c.montoRecolectado))}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(parseArgMoney(c.costosCirugias))}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(parseArgMoney(c.totalGastos))}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#E8622A' }}>{pct(c.pctRecoleccion)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: parseArgMoney(c.pctRentabilidad) > 0 ? '#059669' : '#DC2626' }}>{pct(c.pctRentabilidad)}</td>
                </tr>
              ))}
              {consolidado.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Sin datos</td></tr>
              )}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ background: '#F9FAFB', borderTop: '2px solid #E5E7EB', fontWeight: 700 }}>
                  <td style={{ padding: '11px 14px', color: '#111827' }}>TOTAL</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#111827' }}>{totals.cantidadCirugias}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{formatARS(totals.montoFacturadoTotal)}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#059669' }}>{formatARS(totals.montoRecolectado)}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(totals.costosCirugias)}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(totals.totalGastos)}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
