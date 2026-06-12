'use client';
import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip,
  ResponsiveContainer
} from 'recharts';
import { SkeletonKPI, Skeleton } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, parseDate, daysDiff, toTitleCase } from '../utils/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const ORANGE  = '#C05621';
const BLUE    = '#2563EB';
const GREEN   = '#059669';
const RED     = '#DC2626';
const AMBER   = '#D97706';
const GREY    = '#6B7280';

const PIE_COLORS = ['#1E3A5F','#2563EB','#3B82F6','#93C5FD','#BFDBFE','#DBEAFE'];

/* ── helpers ─────────────────────────────────────────────── */
function Card({ children, style }) {
  return (
    <div style={{
      background:'#fff', border:'1px solid #E5E7EB', borderRadius:12,
      overflow:'hidden', ...style
    }}>{children}</div>
  );
}

function CardHeader({ left, right }) {
  return (
    <div style={{
      padding:'13px 20px', borderBottom:'1px solid #F3F4F6',
      display:'flex', justifyContent:'space-between', alignItems:'center',
      background:'#FAFAFA'
    }}>
      <span style={{ fontSize:12, fontWeight:700, color:'#374151',
        textTransform:'uppercase', letterSpacing:'0.06em' }}>{left}</span>
      {right && <span style={{ fontSize:13, fontVariantNumeric:'tabular-nums',
        fontWeight:700, color:'#374151' }}>{right}</span>}
    </div>
  );
}

function MonthSelect({ value, onChange, allMonths }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <label style={{ fontSize:13, color:'#6B7280', fontWeight:500 }}>Período:</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          padding:'6px 12px', border:'1px solid #E5E7EB', borderRadius:7,
          fontSize:13, fontFamily:'inherit', background:'#fff',
          color:'#111827', cursor:'pointer'
        }}>
        <option value="">Acumulado total</option>
        {allMonths.map(m => (
          <option key={m} value={m}>
            {format(parseISO(m+'-01'), 'MMMM yyyy', { locale:es })}
          </option>
        ))}
      </select>
    </div>
  );
}

function Delta({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3,
      fontSize:11, fontWeight:600, color: up ? GREEN : RED }}>
      {up ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
      {up?'+':''}{pct.toFixed(1)}%
    </span>
  );
}

/* Tooltip inline */
function Hint({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:'relative', display:'inline-flex', cursor:'help' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="#C4C9D1" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      {show && (
        <span style={{
          position:'absolute', bottom:'calc(100% + 6px)', left:'50%',
          transform:'translateX(-50%)', background:'#1F2937', color:'#F9FAFB',
          fontSize:11, lineHeight:1.4, padding:'7px 10px', borderRadius:7,
          width:210, zIndex:60, boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
          fontWeight:400, whiteSpace:'normal', textTransform:'none', letterSpacing:0
        }}>
          {text}
          <span style={{
            position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)',
            borderLeft:'5px solid transparent', borderRight:'5px solid transparent',
            borderTop:'5px solid #1F2937'
          }}/>
        </span>
      )}
    </span>
  );
}

/* Una fila del resumen financiero */
function SummaryRow({ label, value, delta, hint, accent, mono=true }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'10px 0', borderBottom:'1px solid #F3F4F6'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:13, color:'#4B5563', fontWeight: accent ? 600 : 400 }}>{label}</span>
        {hint && <Hint text={hint}/>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
        <span style={{
          fontSize: accent ? 15 : 14, fontWeight: accent ? 700 : 600,
          fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
          color: accent === 'green' ? GREEN : accent === 'red' ? RED
               : accent === 'orange' ? ORANGE : '#111827'
        }}>{value}</span>
        {delta !== undefined && <Delta pct={delta}/>}
      </div>
    </div>
  );
}

/* Mini KPI dentro del panel de gastos */
function MiniKPI({ label, value, color, hint }) {
  return (
    <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#9CA3AF',
          textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
        {hint && <Hint text={hint}/>}
      </div>
      <span style={{
        fontSize:16, fontWeight:700, fontVariantNumeric:'tabular-nums',
        color:'#111827', borderLeft:`2px solid ${color}`, paddingLeft:8
      }}>{value}</span>
    </div>
  );
}

/* Leyenda del pie chart */
function PieLegend({ data }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      {data.map((d,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{
              width:9, height:9, borderRadius:2, flexShrink:0, display:'inline-block',
              background: PIE_COLORS[i % PIE_COLORS.length]
            }}/>
            <span style={{ fontSize:12, color:'#374151' }}>{d.name}</span>
          </div>
          <span style={{ fontSize:12, fontVariantNumeric:'tabular-nums',
            fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>
            {formatARS(d.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── cálculo de métricas ─────────────────────────────────── */
function calcMetrics(ventasCobros, gastosPagos, monthFilter) {
  function inM(dateStr) {
    if (!monthFilter) return true;
    const d = parseDate(dateStr);
    return d ? format(d,'yyyy-MM') === monthFilter : false;
  }
  const vc = ventasCobros.filter(v => inM(v.fechaFactura));
  const gp = gastosPagos.filter(g => inM(g.fechaEmision));

  const facturado   = vc.reduce((s,v) => s + parseArgMoney(v.montoFacturado), 0);
  const ingresado   = vc.filter(v => v.fechaCobroReal)
                       .reduce((s,v) => s + parseArgMoney(v.montoCobrado || v.montoFacturado), 0);
  const retenciones = vc.reduce((s,v) =>
    s + parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados), 0);
  const pendienteCobro = vc.filter(v => !v.fechaCobroReal && !v.fechaCobroCheque)
                           .reduce((s,v) => s + parseArgMoney(v.montoFacturado), 0);
  const echeqCobros = vc.filter(v => !v.fechaCobroReal && v.fechaCobroCheque).reduce((s,v) => {
    const r = parseArgMoney(v.retGanancias) + parseArgMoney(v.retIIBB) + parseArgMoney(v.retSellados);
    return s + parseArgMoney(v.montoFacturado) - r;
  }, 0);

  const gasTotal      = gp.reduce((s,g) => s + parseArgMoney(g.monto), 0);
  const gasPagado     = gp.filter(g => g.pagado||g.saldado).reduce((s,g) => s + parseArgMoney(g.monto), 0);
  const gasProyectado = gp.filter(g => !g.pagado&&!g.saldado&&g.fechaPagoEcheq)
                          .reduce((s,g) => s + parseArgMoney(g.monto), 0);
  const gasPendiente  = gp.filter(g => !g.pagado&&!g.saldado&&!g.fechaPagoEcheq)
                          .reduce((s,g) => s + parseArgMoney(g.monto), 0);

  const ganancia      = ingresado - gasTotal;
  const rentabilidad  = facturado > 0 ? (ganancia / facturado) * 100 : 0;

  return { facturado, ingresado, retenciones, pendienteCobro, echeqCobros,
           gasTotal, gasPagado, gasProyectado, gasPendiente, ganancia, rentabilidad };
}

function pctDelta(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/* ── componente principal ────────────────────────────────── */
export default function Dashboard({ data, loading }) {
  const { ventasCobros, gastosPagos } = data;
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(),'yyyy-MM'));

  const allMonths = useMemo(() => {
    const s = new Set();
    ventasCobros.forEach(v => { const d=parseDate(v.fechaFactura); if(d) s.add(format(d,'yyyy-MM')); });
    gastosPagos.forEach(g  => { const d=parseDate(g.fechaEmision);  if(d) s.add(format(d,'yyyy-MM')); });
    return Array.from(s).sort().reverse();
  }, [ventasCobros, gastosPagos]);

  const metrics = useMemo(() =>
    calcMetrics(ventasCobros, gastosPagos, selectedMonth),
    [ventasCobros, gastosPagos, selectedMonth]
  );

  const prevMonthKey = useMemo(() => {
    if (!selectedMonth) return null;
    return format(subMonths(parseISO(selectedMonth+'-01'),1),'yyyy-MM');
  }, [selectedMonth]);

  const prevMetrics = useMemo(() =>
    prevMonthKey ? calcMetrics(ventasCobros, gastosPagos, prevMonthKey) : null,
    [ventasCobros, gastosPagos, prevMonthKey]
  );

  const gastosPorCategoria = useMemo(() => {
    const rows = selectedMonth
      ? gastosPagos.filter(g => { const d=parseDate(g.fechaEmision); return d && format(d,'yyyy-MM')===selectedMonth; })
      : gastosPagos;
    const map = {};
    rows.forEach(g => {
      const cat = toTitleCase(g.categoria) || 'Otros';
      map[cat] = (map[cat]||0) + parseArgMoney(g.monto);
    });
    return Object.entries(map).map(([name,value])=>({name,value}))
      .sort((a,b)=>b.value-a.value).slice(0,6);
  }, [gastosPagos, selectedMonth]);

  const deudaOS = useMemo(() => {
    const rows = selectedMonth
      ? ventasCobros.filter(v => { const d=parseDate(v.fechaFactura); return d && format(d,'yyyy-MM')===selectedMonth; })
      : ventasCobros;
    const map = {};
    rows.forEach(v => {
      if (v.fechaCobroReal) return;
      const os = toTitleCase(v.obraSocial)||'Sin OS';
      if (!map[os]) map[os] = { name:os, monto:0, facturas:0, echeq:0 };
      map[os].monto += parseArgMoney(v.montoFacturado);
      map[os].facturas++;
      if (v.fechaCobroCheque) {
        const r = parseArgMoney(v.retGanancias)+parseArgMoney(v.retIIBB)+parseArgMoney(v.retSellados);
        map[os].echeq += parseArgMoney(v.montoFacturado)-r;
      }
    });
    return Object.values(map).sort((a,b)=>b.monto-a.monto);
  }, [ventasCobros, selectedMonth]);

  const deudaProveedores = useMemo(() => {
    const rows = selectedMonth
      ? gastosPagos.filter(g => { const d=parseDate(g.fechaEmision); return d && format(d,'yyyy-MM')===selectedMonth; })
      : gastosPagos;
    const map = {};
    rows.forEach(g => {
      if (g.pagado||g.saldado) return;
      const prov = toTitleCase(g.emisor)||'Sin proveedor';
      if (!map[prov]) map[prov] = { name:prov, monto:0, vencidas:0, echeq:0 };
      map[prov].monto += parseArgMoney(g.monto);
      if (daysDiff(parseDate(g.fechaEmision))>30) map[prov].vencidas++;
      if (g.fechaPagoEcheq && !g.saldado) map[prov].echeq += parseArgMoney(g.monto);
    });
    return Object.values(map).sort((a,b)=>b.monto-a.monto);
  }, [gastosPagos, selectedMonth]);

  const pm = prevMetrics;

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Skeleton height={400} borderRadius={12}/><Skeleton height={400} borderRadius={12}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Skeleton height={200} borderRadius={12}/><Skeleton height={200} borderRadius={12}/>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:'#111827' }}>Consolidado financiero</h2>
          <p style={{ margin:'2px 0 0', fontSize:12, color:'#9CA3AF' }}>
            {selectedMonth
              ? format(parseISO(selectedMonth+'-01'), 'MMMM yyyy', { locale:es })
              : 'Todos los períodos'}
          </p>
        </div>
        <MonthSelect value={selectedMonth} onChange={setSelectedMonth} allMonths={allMonths}/>
      </div>

      {/* Main row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Resumen financiero */}
        <Card>
          <CardHeader left="Resumen financiero"/>
          <div style={{ padding:'2px 20px 16px' }}>
            <SummaryRow label="Facturado" value={formatARS(metrics.facturado)}
              delta={pm ? pctDelta(metrics.facturado, pm.facturado) : undefined}
              hint="Total emitido en facturas del período. Lo que se debería cobrar."
              accent="orange"/>
            <SummaryRow label="Total ingresado" value={formatARS(metrics.ingresado)}
              delta={pm ? pctDelta(metrics.ingresado, pm.ingresado) : undefined}
              hint="Dinero realmente recibido: facturas con Fecha de cobro REAL cargada."
              accent="green"/>
            <SummaryRow label="Retenciones (IIBB + Ganancias + Sellados)"
              value={`- ${formatARS(metrics.retenciones)}`}
              hint="Total descontado por las obras sociales en retenciones impositivas."/>
            <SummaryRow label="Pendiente sin echeq" value={formatARS(metrics.pendienteCobro)}
              delta={pm ? pctDelta(metrics.pendienteCobro, pm.pendienteCobro) : undefined}
              hint="Facturas sin cobrar y sin cheque emitido todavía. Sin fecha de ingreso."/>
            <SummaryRow label="Echeqs que acreditan" value={formatARS(metrics.echeqCobros)}
              delta={pm ? pctDelta(metrics.echeqCobros, pm.echeqCobros) : undefined}
              hint="Cheques/echeq en circulación, netos de retenciones. Tienen fecha pero aún no ingresaron."/>
            <SummaryRow label="Total gastos" value={`- ${formatARS(metrics.gasTotal)}`}
              delta={pm ? pctDelta(metrics.gasTotal, pm.gasTotal) : undefined}
              hint="Suma de todos los gastos del período (pagados + pendientes)."/>
            <SummaryRow label="Ganancia neta" value={formatARS(metrics.ganancia)}
              delta={pm ? pctDelta(metrics.ganancia, pm.ganancia) : undefined}
              hint="Ingresado real menos total de gastos."
              accent={metrics.ganancia >= 0 ? 'green' : 'red'}/>
            <SummaryRow label="Rentabilidad" value={`${metrics.rentabilidad.toFixed(1)}%`}
              delta={pm ? pctDelta(metrics.rentabilidad, pm.rentabilidad) : undefined}
              hint="(Ganancia / Facturado) × 100. Margen neto del período."
              accent={metrics.rentabilidad >= 0 ? 'green' : 'red'}
              mono={false}/>
          </div>
        </Card>

        {/* Gastos por categoría */}
        <Card>
          <CardHeader left="Gastos por categoría" right={formatARS(metrics.gasTotal)}/>
          <div style={{ padding:'18px 20px', display:'flex', gap:16, alignItems:'center' }}>
            {gastosPorCategoria.length === 0
              ? <div style={{ flex:1, textAlign:'center', color:'#9CA3AF', fontSize:13, padding:40 }}>Sin datos</div>
              : (
                <>
                  <div style={{ width:150, height:150, flexShrink:0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={gastosPorCategoria} cx="50%" cy="50%"
                          innerRadius={38} outerRadius={68}
                          dataKey="value" stroke="none" paddingAngle={2}>
                          {gastosPorCategoria.map((_,i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>
                          ))}
                        </Pie>
                        <PieTooltip formatter={v => formatARS(v)}
                          contentStyle={{ fontSize:12, borderRadius:7, border:'1px solid #E5E7EB' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex:1 }}>
                    <PieLegend data={gastosPorCategoria}/>
                  </div>
                </>
              )
            }
          </div>

          {/* Mini KPIs gastos — componentes separados para evitar hooks en map */}
          <div style={{ borderTop:'1px solid #F3F4F6', display:'grid', gridTemplateColumns:'1fr 1fr' }}>
            <div style={{ borderRight:'1px solid #F3F4F6' }}>
              <MiniKPI label="Total gastos" value={formatARS(metrics.gasTotal)} color={GREY}
                hint="Suma de todas las facturas del período, pagas o no."/>
            </div>
            <div>
              <MiniKPI label="Pagado" value={formatARS(metrics.gasPagado)} color={GREEN}
                hint="Gastos ya cancelados o echeq saldado/debitado."/>
            </div>
            <div style={{ borderRight:'1px solid #F3F4F6', borderTop:'1px solid #F3F4F6' }}>
              <MiniKPI label="Proyectado (echeq)" value={formatARS(metrics.gasProyectado)} color={BLUE}
                hint="Echeq emitido pendiente de débito. Saldrá de la cuenta en la fecha programada."/>
            </div>
            <div style={{ borderTop:'1px solid #F3F4F6' }}>
              <MiniKPI label="Pendiente de pago" value={formatARS(metrics.gasPendiente)} color={AMBER}
                hint="Gastos sin pagar ni echeq programado. Falta definir el pago."/>
            </div>
          </div>
        </Card>
      </div>

      {/* Tablas deuda */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        <Card>
          <CardHeader
            left="Cobros pendientes por obra social"
            right={formatARS(deudaOS.reduce((s,o)=>s+o.monto,0))}
          />
          {deudaOS.length === 0
            ? <div style={{ padding:32, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>Sin cobros pendientes</div>
            : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#FAFAFA' }}>
                    {['Obra Social','Facturas','Monto','Echeq'].map(h => (
                      <th key={h} style={{
                        padding:'8px 16px', textAlign: h==='Obra Social' ? 'left' : 'right',
                        fontWeight:600, color:'#9CA3AF', fontSize:10,
                        borderBottom:'1px solid #F3F4F6', textTransform:'uppercase', letterSpacing:'0.05em'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deudaOS.map((os,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #F9FAFB' }}>
                      <td style={{ padding:'9px 16px', fontWeight:500, color:'#111827' }}>{os.name}</td>
                      <td style={{ padding:'9px 16px', textAlign:'right', color:'#9CA3AF', fontSize:12 }}>{os.facturas}</td>
                      <td style={{ padding:'9px 16px', textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:600, color:RED }}>{formatARS(os.monto)}</td>
                      <td style={{ padding:'9px 16px', textAlign:'right', fontVariantNumeric:'tabular-nums', fontSize:12, color:BLUE }}>{os.echeq > 0 ? formatARS(os.echeq) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Card>

        <Card>
          <CardHeader
            left="Deuda a proveedores"
            right={formatARS(deudaProveedores.reduce((s,p)=>s+p.monto,0))}
          />
          {deudaProveedores.length === 0
            ? <div style={{ padding:32, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>Sin deuda pendiente</div>
            : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#FAFAFA' }}>
                    {['Proveedor','Vencidas','Monto','Echeq'].map(h => (
                      <th key={h} style={{
                        padding:'8px 16px', textAlign: h==='Proveedor' ? 'left' : 'right',
                        fontWeight:600, color:'#9CA3AF', fontSize:10,
                        borderBottom:'1px solid #F3F4F6', textTransform:'uppercase', letterSpacing:'0.05em'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deudaProveedores.map((p,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #F9FAFB' }}>
                      <td style={{ padding:'9px 16px', fontWeight:500, color:'#111827' }}>{p.name}</td>
                      <td style={{ padding:'9px 16px', textAlign:'right', color: p.vencidas>0 ? RED : '#9CA3AF', fontSize:12 }}>{p.vencidas > 0 ? p.vencidas : '—'}</td>
                      <td style={{ padding:'9px 16px', textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:600, color:AMBER }}>{formatARS(p.monto)}</td>
                      <td style={{ padding:'9px 16px', textAlign:'right', fontVariantNumeric:'tabular-nums', fontSize:12, color:BLUE }}>{p.echeq > 0 ? formatARS(p.echeq) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Card>
      </div>
    </div>
  );
}
