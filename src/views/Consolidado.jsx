'use client';
import { useMemo } from 'react';
import { SkeletonTable, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS } from '../utils/formatters';

function pct(val) {
  const n = parseArgMoney(val);
  if (!n && n !== 0) return '—';
  if (n > 1) return n.toFixed(1).replace('.', ',') + '%';
  return (n * 100).toFixed(1).replace('.', ',') + '%';
}

function pctColor(val) {
  const n = parseArgMoney(val);
  if (!n) return '#6B7280';
  const v = n > 1 ? n : n * 100;
  return v >= 60 ? '#059669' : v >= 30 ? '#D97706' : '#DC2626';
}

export default function Consolidado({ data, loading }) {
  const { consolidado } = data;

  const totals = useMemo(() => {
    if (!consolidado.length) return null;
    return {
      cantidadCirugias: consolidado.reduce((s, c) => s + (Number(c.cantidadCirugias) || 0), 0),
      montoFacturadoTotal: consolidado.reduce((s, c) => s + parseArgMoney(c.montoFacturadoTotal), 0),
      montoRecolectado: consolidado.reduce((s, c) => s + parseArgMoney(c.montoRecolectado), 0),
      costosCirugias: consolidado.reduce((s, c) => s + parseArgMoney(c.costosCirugias), 0),
      gastosProveedores: consolidado.reduce((s, c) => s + parseArgMoney(c.gastosProveedores), 0),
      otrosGastos: consolidado.reduce((s, c) => s + parseArgMoney(c.otrosGastos), 0),
      totalGastos: consolidado.reduce((s, c) => s + parseArgMoney(c.totalGastos), 0),
    };
  }, [consolidado]);

  if (loading) {
    return (
      <div>
        <Skeleton height={48} borderRadius={8} style={{ marginBottom: 16 }} />
        <SkeletonTable rows={12} cols={9} />
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Consolidado mensual</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Datos del resumen financiero de la hoja Consolidado</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Mes', 'Cirugías', 'Fact. mes cx corr.', 'Fact. mes cx ant.', 'Total Facturado', 'Costos Cx', 'Recolectado', 'Gastos Prov.', 'Otros Gastos', 'Total Gastos', '% Recolección', '% Rentabilidad'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mes' ? 'left' : 'right', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {consolidado.map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{c.mes}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#374151' }}>{c.cantidadCirugias || '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{c.factMesCxCorriente ? formatARS(parseArgMoney(c.factMesCxCorriente)) : '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{c.factMesCxAnterior ? formatARS(parseArgMoney(c.factMesCxAnterior)) : '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600 }}>{formatARS(parseArgMoney(c.montoFacturadoTotal))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(parseArgMoney(c.costosCirugias))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#059669' }}>{formatARS(parseArgMoney(c.montoRecolectado))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(parseArgMoney(c.gastosProveedores))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(parseArgMoney(c.otrosGastos))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{formatARS(parseArgMoney(c.totalGastos))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: pctColor(c.pctRecoleccion) }}>{pct(c.pctRecoleccion)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: pctColor(c.pctRentabilidad) }}>{pct(c.pctRentabilidad)}</td>
              </tr>
            ))}
            {consolidado.length === 0 && (
              <tr><td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Sin datos</td></tr>
            )}
          </tbody>
          {totals && (
            <tfoot>
              <tr style={{ background: '#F9FAFB', borderTop: '2px solid #E5E7EB', fontWeight: 700 }}>
                <td style={{ padding: '11px 14px', color: '#111827' }}>TOTAL</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>{totals.cantidadCirugias}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>—</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>—</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{formatARS(totals.montoFacturadoTotal)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(totals.costosCirugias)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#059669' }}>{formatARS(totals.montoRecolectado)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(totals.gastosProveedores)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#6B7280' }}>{formatARS(totals.otrosGastos)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{formatARS(totals.totalGastos)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>—</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
