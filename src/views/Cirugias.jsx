'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { ProgressBar } from '../components/UI/ProgressBar';
import { SkeletonTable } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, formatPct, formatDate, parseDate, MONTHS_ES, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MONTH_ORDER = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Lista canónica de médicos (apellido, nombre) — hoja "médicos" del sheet de Surcherie
const MEDICOS_LIST = [
  'Abitante, Fernando', 'Abraham, Juan Carlos', 'Amato, Daniel', 'Arneodo, Martin',
  'Baigorria, José', 'Bocchiardo, Jorge', 'Buccari, Marcelo', 'Cozzi, Leonardo',
  'Del Sastre, José', 'Escalada, Guillermo', 'Esquivel, Gabriel', 'Esquivel, Luciano',
  'Fernandez, José', 'Jacob, Diego', 'Jacob, Matias', 'Jmelnizky, Sergio',
  'Kopech, Flavio', 'Lopez Otero, Sergio', 'Martinez, Augusto', 'Mazzuferi, Fernando',
  'Morere, Jorge', 'Morra, Brian', 'Morra, Daniel', 'Romeo, Sabrina', 'Rocca, Mario',
  'Rossa, Guillermo', 'Salem, Alejandro', 'Santa María, José', 'Simoncini, Raul',
  'Taleb, Cristian', 'Tolomei, Federico', 'Uranga, Martiniano', 'Valla, Luis',
  'Vanrrel, Hernán', 'Yobe, Germán',
];
const MEDICOS_SET = new Set(MEDICOS_LIST.map(m => m.trim().toLowerCase()));
const isMedicoEstandar = (raw) => !raw || MEDICOS_SET.has(raw.trim().toLowerCase());
const normName = (s) => (s || '').trim().toLowerCase();

function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Busca el médico canónico más cercano a un texto cargado a mano (typos, nombre incompleto, etc.)
function bestCanonicalMedico(raw) {
  if (!raw) return null;
  const r = normName(raw);
  for (const m of MEDICOS_LIST) if (normName(m) === r) return { name: m, dist: 0 };
  const lastNameMatches = MEDICOS_LIST.filter(m => normName(m.split(',')[0]) === r);
  if (lastNameMatches.length === 1) return { name: lastNameMatches[0], dist: 0 };
  let best = null;
  MEDICOS_LIST.forEach(m => {
    const last = normName(m.split(',')[0]);
    const d = Math.min(levenshtein(r, last), levenshtein(r, normName(m)));
    if (!best || d < best.dist) best = { name: m, dist: d };
  });
  return best;
}

// Decide el nombre de médico para un grupo de filas que son la misma cirugía:
// si hay varias grafías distintas (typo), se queda con la que mejor matchea la lista canónica.
function resolveMedicoGrupo(rows) {
  const candidatos = [...new Set(rows.map(r => (r.medico || '').trim()).filter(Boolean))];
  if (candidatos.length === 0) return '';
  let best = null;
  candidatos.forEach(c => {
    const m = bestCanonicalMedico(c);
    if (m && (!best || m.dist < best.dist)) best = m;
  });
  if (best && best.dist <= 2) return best.name;
  const freq = {};
  rows.forEach(r => { const v = (r.medico || '').trim(); if (v) freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

// Suma valores monetarios distintos dentro del grupo (si dos filas tienen el mismo
// monto, es la misma carga repetida y no se duplica; si difieren, son dos presupuestos reales).
function sumMontosUnicos(rows, field) {
  const seen = new Set();
  let total = 0;
  rows.forEach(r => {
    const v = parseArgMoney(r[field]);
    if (!v) return;
    const key = v.toFixed(2);
    if (!seen.has(key)) { seen.add(key); total += v; }
  });
  return total;
}

// Resuelve el médico de una fila a su forma canónica para poder agrupar de forma
// estable (si no hay buen match, devuelve el texto tal cual normalizado).
function medicoKeyKanonico(raw) {
  if (!raw || !raw.trim()) return '';
  const m = bestCanonicalMedico(raw);
  return (m && m.dist <= 2) ? normName(m.name) : normName(raw);
}

const MONEY_FIELDS = ['montoPresupuesto', 'montoFactura', 'valorImplantes', 'valorDescartables', 'valorLogistica', 'valorTotalCostos', 'retencionesOtros', 'facturaGastos'];
const TEXT_MERGE_FIELDS = ['obraSocial', 'numeroFactura', 'fechaFactura', 'fechaCobro', 'consumo', 'mes'];

// Une en una sola cirugía todas las filas con el mismo paciente + médico + fecha de
// cirugía. El médico se resuelve primero contra la lista canónica para que un typo
// ("Jacov" vs "Jacob") no impida fusionar la misma cirugía; mismo paciente/médico/fecha
// con dos presupuestos cargados por separado también se suma en una sola cirugía.
function mergeCirugias(rows) {
  const groups = new Map();
  rows.forEach(c => {
    const key = normName(c.paciente) + '|' + medicoKeyKanonico(c.medico) + '|' + (c.fechaCx || '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });

  const out = [];
  groups.forEach(grupo => {
    if (grupo.length === 1) { out.push(grupo[0]); return; }
    const merged = { ...grupo[0] };
    merged.medico = resolveMedicoGrupo(grupo);
    MONEY_FIELDS.forEach(f => { merged[f] = sumMontosUnicos(grupo, f); });
    TEXT_MERGE_FIELDS.forEach(f => {
      const vals = [...new Set(grupo.map(g => (g[f] || '').toString().trim()).filter(Boolean))];
      merged[f] = vals.join(' / ');
    });
    merged.pctMargen = merged.montoFactura > 0 ? (merged.facturaGastos / merged.montoFactura) * 100 : '';
    merged.cobrado = grupo.some(g => g.cobrado);
    merged._mergedCount = grupo.length;
    // Desglose original de presupuesto y factura, fila por fila, para mostrar el detalle
    merged._desglose = grupo.map(g => ({
      medico: g.medico || '',
      numeroFactura: g.numeroFactura || '',
      montoPresupuesto: parseArgMoney(g.montoPresupuesto),
      montoFactura: parseArgMoney(g.montoFactura),
    }));
    // Filas originales completas (con su propio rowIndex) para poder editarlas por separado
    merged._rows = grupo;
    out.push(merged);
  });
  return out;
}

const EDIT_FIELDS = [
  { k:'medico', label:'Médico', list:'medicos-datalist' },
  { k:'obraSocial', label:'Obra Social' },
  { k:'fechaCx', label:'Fecha cirugía', placeholder:'dd/mm/yyyy' },
  { k:'montoPresupuesto', label:'Monto presupuesto' },
  { k:'numeroFactura', label:'N° Factura' },
  { k:'montoFactura', label:'Monto factura' },
  { k:'fechaFactura', label:'Fecha factura', placeholder:'dd/mm/yyyy' },
  { k:'fechaCobro', label:'Fecha cobro', placeholder:'dd/mm/yyyy' },
  { k:'retencionesOtros', label:'Retenciones / Otros' },
];

function getBadgeType(c) {
  if (c.cobrado) return 'cobrado';
  if (c.numeroFactura || c.montoFactura) return 'pendiente';
  return 'sinFactura';
}
function getBadgeLabel(c) {
  if (c.cobrado) return 'Cobrado';
  if (c.numeroFactura || c.montoFactura) return 'Pendiente';
  return 'Sin factura';
}

function InfoChip({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ background:'#F7F8FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px' }}>
      <div style={{ fontSize:11, color:'#6B7280', marginBottom:3, fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:14, color:'#111827', fontWeight:600 }}>{value}</div>
    </div>
  );
}

function CostRow({ label, value, bold }) {
  const v = parseArgMoney(value);
  if (!v && v !== 0) return null;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F3F4F6', fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: bold ? '#111827' : '#374151', fontSize:14 }}>{label}</span>
      <span style={{ fontVariantNumeric:'tabular-nums', fontSize:13, color: bold ? '#111827' : '#6B7280' }}>{formatARS(v)}</span>
    </div>
  );
}

// Editor de una cirugía fusionada: muestra cada fila original del grupo por
// separado, para no escribir montos sumados sobre una sola fila del sheet.
function MultiEditCirugia({ rows, paciente, onClose, onSaved, addToast }) {
  const [forms, setForms] = useState(() => rows.map(r => {
    const f = {};
    EDIT_FIELDS.forEach(({ k }) => { f[k] = r[k] || ''; });
    return f;
  }));
  const [savingIdx, setSavingIdx] = useState(null);

  const setField = (i, k, v) => setForms(fs => fs.map((f, idx) => idx === i ? { ...f, [k]: v } : f));

  const handleSaveRow = async (i) => {
    setSavingIdx(i);
    try {
      await gasClient.updateCirugia(rows[i].rowIndex, forms[i]);
      addToast(`Fila ${i + 1} actualizada`, 'success');
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
    finally { setSavingIdx(null); }
  };

  const handleSaveAll = async () => {
    setSavingIdx('all');
    try {
      for (let i = 0; i < rows.length; i++) {
        await gasClient.updateCirugia(rows[i].rowIndex, forms[i]);
      }
      addToast('Todas las filas actualizadas', 'success');
      onSaved(); onClose();
    } catch (e) { addToast('Error: ' + e.message, 'error'); }
    finally { setSavingIdx(null); }
  };

  return (
    <Modal open onClose={onClose} width={680}
      title={<span style={{ fontSize:17, fontWeight:700 }}>Editar — {toTitleCase(paciente)} ({rows.length} cargas)</span>}>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ fontSize:12, color:'#6B7280', background:'#FFF7F3', border:'1px solid #FBD9C2', borderRadius:7, padding:'8px 12px' }}>
          Esta cirugía tiene varias filas cargadas (mismo paciente y fecha). Editá y guardá cada una por separado para no perder el detalle.
        </div>
        {rows.map((r, i) => (
          <div key={r.rowIndex} style={{ border:'1px solid #E5E7EB', borderRadius:8, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:8 }}>Fila {i + 1}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {EDIT_FIELDS.map(({ k, label, placeholder, list }) => (
                <div key={k}>
                  <label style={{ fontSize:11, color:'#9CA3AF', fontWeight:500, display:'block', marginBottom:3 }}>{label}</label>
                  <input value={forms[i][k] || ''} onChange={e => setField(i, k, e.target.value)} placeholder={placeholder || ''} list={list}
                    style={{ width:'100%', padding:'6px 9px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:12, fontFamily:'inherit', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <button onClick={() => handleSaveRow(i)} disabled={savingIdx !== null}
              style={{ marginTop:8, padding:'5px 12px', background:'none', border:'1px solid #E5E7EB', borderRadius:6, cursor: savingIdx !== null ? 'not-allowed' : 'pointer', color:'#374151', fontSize:12, fontFamily:'inherit' }}>
              {savingIdx === i ? 'Guardando...' : 'Guardar esta fila'}
            </button>
          </div>
        ))}
        <datalist id="medicos-datalist">
          {MEDICOS_LIST.map(m => <option key={m} value={m} />)}
        </datalist>
        <div style={{ display:'flex', gap:8, paddingTop:8, borderTop:'1px solid #E5E7EB' }}>
          <button onClick={handleSaveAll} disabled={savingIdx !== null}
            style={{ flex:1, padding:'9px', background:'#C05621', color:'#fff', border:'none', borderRadius:7, cursor: savingIdx !== null ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
            {savingIdx === 'all' ? 'Guardando...' : 'Guardar todas y cerrar'}
          </button>
          <button onClick={onClose} style={{ padding:'9px 18px', background:'#F9FAFB', color:'#374151', border:'1px solid #E5E7EB', borderRadius:7, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

function CirugiaModal({ cirugia, onClose, onCobrar, addToast }) {
  const [showCobrarForm, setShowCobrarForm] = useState(false);
  const [fechaCobro, setFechaCobro] = useState(formatDate(new Date()));
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);

  if (!cirugia) return null;
  const badgeType = getBadgeType(cirugia);
  const margen = parseArgMoney(cirugia.pctMargen);
  const isFusionada = cirugia._mergedCount > 1 && cirugia._rows;

  const handleCobrar = async () => {
    setSaving(true);
    try {
      await gasClient.updateCobrado(cirugia.rowIndex, fechaCobro);
      addToast('Cirugía marcada como cobrada', 'success');
      onCobrar();
      onClose();
    } catch(e) { addToast('Error: '+e.message,'error'); } finally { setSaving(false); }
  };

  const startEdit = () => {
    const f = {};
    EDIT_FIELDS.forEach(({k}) => { f[k] = cirugia[k] || ''; });
    setEditForm(f); setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await gasClient.updateCirugia(cirugia.rowIndex, editForm);
      addToast('Cirugía actualizada','success');
      onCobrar(); onClose();
    } catch(e) { addToast('Error: '+e.message,'error'); } finally { setSaving(false); }
  };

  if (editMode && isFusionada) return (
    <MultiEditCirugia rows={cirugia._rows} paciente={cirugia.paciente} onClose={onClose} onSaved={onCobrar} addToast={addToast} />
  );

  if (editMode) return (
    <Modal open onClose={onClose} width={620}
      title={<span style={{ fontSize:17, fontWeight:700 }}>Editar — {toTitleCase(cirugia.paciente)}</span>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {EDIT_FIELDS.map(({k,label,placeholder,list}) => (
            <div key={k}>
              <label style={{ fontSize:12, color:'#6B7280', fontWeight:500, display:'block', marginBottom:4 }}>{label}</label>
              <input value={editForm[k]||''} onChange={e => setEditForm(f=>({...f,[k]:e.target.value}))} placeholder={placeholder||''} list={list}
                style={{ width:'100%', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
          ))}
        </div>
        <datalist id="medicos-datalist">
          {MEDICOS_LIST.map(m => <option key={m} value={m} />)}
        </datalist>
        <div style={{ display:'flex', gap:8, paddingTop:8, borderTop:'1px solid #E5E7EB' }}>
          <button onClick={handleSaveEdit} disabled={saving}
            style={{ flex:1, padding:'9px', background:'#C05621', color:'#fff', border:'none', borderRadius:7, cursor: saving?'not-allowed':'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button onClick={() => setEditMode(false)} style={{ padding:'9px 18px', background:'#F9FAFB', color:'#374151', border:'1px solid #E5E7EB', borderRadius:7, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Volver</button>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal open onClose={onClose} width={700}
      title={
        <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
          <span style={{ fontSize:18, fontWeight:700, color:'#111827' }}>{toTitleCase(cirugia.paciente)}</span>
          <Badge type={badgeType}>{getBadgeLabel(cirugia)}</Badge>
          <button onClick={startEdit} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'5px 12px', background:'none', border:'1px solid #E5E7EB', borderRadius:6, cursor:'pointer', color:'#6B7280', fontSize:12, fontFamily:'inherit' }}>
            <Edit2 size={13}/> Editar
          </button>
        </div>
      }>
      <section style={{ marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          <InfoChip label="Médico" value={toTitleCase(cirugia.medico)}/>
          <InfoChip label="Obra Social" value={toTitleCase(cirugia.obraSocial)}/>
          <InfoChip label="Mes" value={cirugia.mes}/>
          <InfoChip label="Fecha cirugía" value={cirugia.fechaCx}/>
          <InfoChip label="Pedido / Presupuestado" value={cirugia.pedidoPresupuestado}/>
        </div>
      </section>
      {cirugia.consumo && (
        <section style={{ marginBottom:20 }}>
          <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#6B7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Materiales utilizados</h4>
          <div style={{ background:'#F7F8FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'12px 16px', fontSize:14, color:'#374151', lineHeight:1.6 }}>{cirugia.consumo}</div>
        </section>
      )}
      <section style={{ marginBottom:20 }}>
        <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#6B7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Costos</h4>
        <div style={{ background:'#F7F8FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'12px 16px' }}>
          <CostRow label="Implantes" value={cirugia.valorImplantes}/>
          <CostRow label="Descartables" value={cirugia.valorDescartables}/>
          <CostRow label="Logística / Esterilización" value={cirugia.valorLogistica}/>
          <CostRow label="Corrección gastos" value={cirugia.correccionGastos}/>
          <CostRow label="Valor total costos" value={cirugia.valorTotalCostos} bold/>
        </div>
      </section>
      <section style={{ marginBottom:20 }}>
        <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#6B7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Facturación</h4>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <InfoChip label="Monto presupuesto" value={cirugia.montoPresupuesto ? formatARS(parseArgMoney(cirugia.montoPresupuesto)) : ''}/>
          <InfoChip label="Monto factura" value={cirugia.montoFactura ? formatARS(parseArgMoney(cirugia.montoFactura)) : ''}/>
          <InfoChip label="N° Factura" value={cirugia.numeroFactura}/>
          <InfoChip label="Fecha factura" value={cirugia.fechaFactura}/>
          <InfoChip label="Fecha cobro" value={cirugia.fechaCobro}/>
          <InfoChip label="Retenciones / Otros" value={cirugia.retencionesOtros ? formatARS(parseArgMoney(cirugia.retencionesOtros)) : ''}/>
        </div>
        {cirugia._mergedCount > 1 && cirugia._desglose && (
          <div style={{ marginTop:10, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 14px' }}>
            <div style={{ fontSize:11, color:'#1D4ED8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>
              Detalle ({cirugia._mergedCount} cargas unificadas)
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['Médico cargado','N° Factura','Presupuesto','Factura'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'3px 8px 5px 0', color:'#6B7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cirugia._desglose.map((d,i) => (
                  <tr key={i} style={{ borderTop:'1px solid #DBEAFE' }}>
                    <td style={{ padding:'5px 8px 5px 0', color:'#374151' }}>{toTitleCase(d.medico) || '—'}</td>
                    <td style={{ padding:'5px 8px 5px 0', color:'#374151' }}>{d.numeroFactura || '—'}</td>
                    <td style={{ padding:'5px 8px 5px 0', fontVariantNumeric:'tabular-nums', color:'#111827' }}>{d.montoPresupuesto ? formatARS(d.montoPresupuesto) : '—'}</td>
                    <td style={{ padding:'5px 8px 5px 0', fontVariantNumeric:'tabular-nums', color:'#111827' }}>{d.montoFactura ? formatARS(d.montoFactura) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {(cirugia.facturaGastos || cirugia.pctMargen) && (
        <section style={{ marginBottom:20 }}>
          <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#6B7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Margen</h4>
          <div style={{ background:'#F7F8FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:14, color:'#374151' }}>Factura - Gastos</span>
              <span style={{ fontVariantNumeric:'tabular-nums', fontSize:14, fontWeight:700, color: parseArgMoney(cirugia.facturaGastos)>=0?'#059669':'#DC2626' }}>{formatARS(parseArgMoney(cirugia.facturaGastos))}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:14, color:'#374151' }}>Margen %</span>
              <span style={{ fontVariantNumeric:'tabular-nums', fontSize:14, fontWeight:700, color:'#C05621' }}>{formatPct(margen)}</span>
            </div>
            <ProgressBar value={Math.max(0,margen)} max={100}/>
          </div>
        </section>
      )}
      {!cirugia.cobrado && (cirugia.numeroFactura || cirugia.montoFactura) && (
        <div style={{ borderTop:'1px solid #E5E7EB', paddingTop:16 }}>
          {!showCobrarForm
            ? <button onClick={() => setShowCobrarForm(true)} style={{ width:'100%', padding:'11px', background:'#C05621', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600 }}>Marcar como cobrado</button>
            : (
              <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, color:'#374151', fontWeight:500, display:'block', marginBottom:6 }}>Fecha de cobro real</label>
                  <input type="text" placeholder="dd/mm/yyyy" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontFamily:'inherit', fontSize:14, boxSizing:'border-box' }}/>
                </div>
                <button onClick={handleCobrar} disabled={saving} style={{ padding:'9px 20px', background:'#C05621', color:'#fff', border:'none', borderRadius:8, cursor: saving?'not-allowed':'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600 }}>{saving?'Guardando...':'Confirmar'}</button>
                <button onClick={() => setShowCobrarForm(false)} style={{ padding:'9px 16px', background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>Cancelar</button>
              </div>
            )
          }
        </div>
      )}
    </Modal>
  );
}

function NuevaCirugiaModal({ onClose, onSaved, addToast }) {
  const [form, setForm] = useState({ paciente:'', medico:'', fechaCx:'', mes:'', pedidoPresupuestado:'', obraSocial:'', consumo:'', valorImplantes:'', valorDescartables:'', valorLogistica:'', valorTotalCostos:'', montoPresupuesto:'', numeroFactura:'', montoFactura:'', fechaFactura:'', fechaCobro:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.paciente) { addToast('El paciente es requerido','error'); return; }
    setSaving(true);
    try { await gasClient.addCirugia(form); addToast('Cirugía agregada','success'); onSaved(); onClose(); }
    catch(e) { addToast('Error: '+e.message,'error'); } finally { setSaving(false); }
  };

  const Field = ({label,k,placeholder,list}) => (
    <div>
      <label style={{ fontSize:13, color:'#374151', fontWeight:500, display:'block', marginBottom:4 }}>{label}</label>
      <input value={form[k]} onChange={e => set(k,e.target.value)} placeholder={placeholder} list={list}
        style={{ width:'100%', padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontFamily:'inherit', fontSize:14, boxSizing:'border-box' }}/>
    </div>
  );

  return (
    <Modal open onClose={onClose} width={640} title={<span style={{ fontSize:17, fontWeight:700 }}>Nueva Cirugía</span>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <datalist id="medicos-datalist">
          {MEDICOS_LIST.map(m => <option key={m} value={m} />)}
        </datalist>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Paciente *" k="paciente"/>
          <Field label="Médico" k="medico" list="medicos-datalist"/>
          <Field label="Fecha cirugía" k="fechaCx" placeholder="dd/mm/yyyy"/>
          <Field label="Mes" k="mes"/>
          <Field label="Obra Social" k="obraSocial"/>
          <Field label="Pedido / Presupuestado" k="pedidoPresupuestado"/>
        </div>
        <div>
          <label style={{ fontSize:13, color:'#374151', fontWeight:500, display:'block', marginBottom:4 }}>Consumo (materiales)</label>
          <textarea value={form.consumo} onChange={e => set('consumo',e.target.value)} rows={3}
            style={{ width:'100%', padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontFamily:'inherit', fontSize:14, boxSizing:'border-box', resize:'vertical' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Valor implantes" k="valorImplantes"/>
          <Field label="Valor descartables" k="valorDescartables"/>
          <Field label="Valor logística/esterilización" k="valorLogistica"/>
          <Field label="Valor total costos" k="valorTotalCostos"/>
          <Field label="Monto presupuesto" k="montoPresupuesto"/>
          <Field label="N° Factura" k="numeroFactura"/>
          <Field label="Monto factura" k="montoFactura"/>
          <Field label="Fecha factura" k="fechaFactura" placeholder="dd/mm/yyyy"/>
          <Field label="Fecha cobro" k="fechaCobro" placeholder="dd/mm/yyyy"/>
        </div>
        <div style={{ display:'flex', gap:10, paddingTop:8, borderTop:'1px solid #E5E7EB' }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'10px', background:'#C05621', color:'#fff', border:'none', borderRadius:8, cursor: saving?'not-allowed':'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600 }}>{saving?'Guardando...':'Guardar cirugía'}</button>
          <button onClick={onClose} style={{ padding:'10px 20px', background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── MonthGroup ───────────────────────────────────────────── */
function MonthGroup({ mes, rows, defaultOpen, onSelect }) {
  const [open, setOpen] = useState(defaultOpen);
  const totalFact = rows.reduce((s,c) => s + parseArgMoney(c.montoFactura), 0);
  const cobradas  = rows.filter(c => c.cobrado).length;

  return (
    <div style={{ marginBottom:8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'11px 16px', background:'#F8FAFC', border:'1px solid #E5E7EB',
        borderRadius: open ? '8px 8px 0 0' : 8, cursor:'pointer', fontFamily:'inherit'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {open ? <ChevronDown size={15} color="#6B7280"/> : <ChevronRight size={15} color="#6B7280"/>}
          <span style={{ fontWeight:600, fontSize:14, color:'#111827' }}>{mes}</span>
          <span style={{ fontSize:12, color:'#9CA3AF' }}>{rows.length} cirugía{rows.length!==1?'s':''}</span>
          {cobradas > 0 && <span style={{ fontSize:11, background:'#ECFDF5', color:'#065F46', border:'1px solid #A7F3D0', borderRadius:5, padding:'1px 7px', fontWeight:600 }}>{cobradas} cobrada{cobradas!==1?'s':''}</span>}
        </div>
        <span style={{ fontVariantNumeric:'tabular-nums', fontSize:13, fontWeight:700, color:'#374151' }}>{formatARS(totalFact)}</span>
      </button>

      {open && (
        <div style={{ border:'1px solid #E5E7EB', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden', background:'#fff' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#FAFAFA' }}>
                {['Paciente','Fecha Cx','Médico','Obra Social','Estado'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#9CA3AF', fontSize:11, borderBottom:'1px solid #F3F4F6', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c,i) => (
                <tr key={i} onClick={() => onSelect(c)}
                  style={{ borderBottom:'1px solid #F9FAFB', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{ padding:'13px 14px', fontWeight:600, color:'#111827' }}>
                    {toTitleCase(c.paciente)}
                    {c._mergedCount > 1 && (
                      <span title={`Se unificaron ${c._mergedCount} filas cargadas para esta misma cirugía`}
                        style={{ marginLeft:6, fontSize:10, fontWeight:600, color:'#1D4ED8', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:5, padding:'1px 5px' }}>
                        ×{c._mergedCount}
                      </span>
                    )}
                  </td>
                  <td style={{ padding:'13px 14px', color:'#6B7280', whiteSpace:'nowrap', fontSize:12, fontVariantNumeric:'tabular-nums' }}>{c.fechaCx || '—'}</td>
                  <td style={{ padding:'13px 14px', color:'#374151' }}>
                    {toTitleCase(c.medico) || '—'}
                    {c.medico && !isMedicoEstandar(c.medico) && (
                      <span title="Nombre de médico no estandarizado — corregir desde Editar"
                        style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#D97706', marginLeft:6, verticalAlign:'middle' }} />
                    )}
                  </td>
                  <td style={{ padding:'13px 14px', color:'#374151' }}>{toTitleCase(c.obraSocial) || '—'}</td>
                  <td style={{ padding:'13px 14px' }}><Badge type={getBadgeType(c)}>{getBadgeLabel(c)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Cirugias({ data, loading, refetch, addToast }) {
  const cirugias = useMemo(() => mergeCirugias(data.cirugias), [data.cirugias]);
  const [search, setSearch]           = useState('');
  const [filterOS, setFilterOS]       = useState('');
  const [filterMedico, setFilterMedico] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [selected, setSelected]       = useState(null);
  const [showNueva, setShowNueva]     = useState(false);

  const obrasSociales = useMemo(() => [...new Set(cirugias.map(c => c.obraSocial).filter(Boolean))].sort(), [cirugias]);
  const medicos       = useMemo(() => [...new Set(cirugias.map(c => c.medico).filter(Boolean))].sort(), [cirugias]);

  const filtered = useMemo(() => cirugias.filter(c => {
    if (search && !c.paciente.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterOS && c.obraSocial !== filterOS) return false;
    if (filterMedico && c.medico !== filterMedico) return false;
    if (filterEstado === 'cobrado' && !c.cobrado) return false;
    if (filterEstado === 'pendiente' && (c.cobrado || (!c.numeroFactura && !c.montoFactura))) return false;
    if (filterEstado === 'sinFactura' && (c.numeroFactura || c.montoFactura)) return false;
    return true;
  }), [cirugias, search, filterOS, filterMedico, filterEstado]);

  // Agrupar por mes
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      const key = c.mes || 'Sin mes';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).sort((a, b) => {
      const ai = MONTH_ORDER.findIndex(m => a[0].toLowerCase().includes(m.toLowerCase()));
      const bi = MONTH_ORDER.findIndex(m => b[0].toLowerCase().includes(m.toLowerCase()));
      return bi - ai;
    });
  }, [filtered]);

  // Mes actual para expandir por defecto
  const currentMes = format(new Date(), 'MMMM', { locale: es });
  const currentMesCapitalized = currentMes.charAt(0).toUpperCase() + currentMes.slice(1);

  const selStyle = { padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:7, fontFamily:'inherit', fontSize:13, background:'#fff', color:'#374151', cursor:'pointer' };

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:180 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente..."
            style={{ width:'100%', paddingLeft:30, paddingRight:10, paddingTop:7, paddingBottom:7, border:'1px solid #E5E7EB', borderRadius:7, fontFamily:'inherit', fontSize:13, boxSizing:'border-box' }}/>
        </div>
        <select value={filterOS} onChange={e => setFilterOS(e.target.value)} style={selStyle}>
          <option value="">Todas las OS</option>
          {obrasSociales.map(os => <option key={os}>{os}</option>)}
        </select>
        <select value={filterMedico} onChange={e => setFilterMedico(e.target.value)} style={selStyle}>
          <option value="">Todos los médicos</option>
          {medicos.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={selStyle}>
          <option value="">Todos los estados</option>
          <option value="cobrado">Cobrado</option>
          <option value="pendiente">Pendiente</option>
          <option value="sinFactura">Sin factura</option>
        </select>
        <button onClick={() => setShowNueva(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#C05621', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, whiteSpace:'nowrap' }}>
          <Plus size={14}/> Nueva cirugía
        </button>
      </div>

      {loading
        ? <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}><SkeletonTable rows={8} cols={10}/></div>
        : grouped.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No se encontraron cirugías</div>
          : grouped.map(([mes, rows]) => (
              <MonthGroup
                key={mes} mes={mes} rows={rows}
                defaultOpen={rows.some(c => {
                  const d = parseDate(c.fechaCx);
                  return d && format(d,'yyyy-MM') === format(new Date(),'yyyy-MM');
                }) || mes.toLowerCase().includes(currentMes.toLowerCase())}
                onSelect={setSelected}
              />
            ))
      }

      {filtered.length > 0 && !loading && (
        <div style={{ padding:'10px 0', fontSize:12, color:'#9CA3AF' }}>{filtered.length} cirugías</div>
      )}

      {selected && <CirugiaModal cirugia={selected} onClose={() => setSelected(null)} onCobrar={refetch} addToast={addToast}/>}
      {showNueva && <NuevaCirugiaModal onClose={() => setShowNueva(false)} onSaved={refetch} addToast={addToast}/>}
    </div>
  );
}

export { CirugiaModal, mergeCirugias, MEDICOS_LIST, isMedicoEstandar };
