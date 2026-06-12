'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, Edit2 } from 'lucide-react';
import { Badge } from '../components/UI/Badge';
import { Modal } from '../components/UI/Modal';
import { ProgressBar } from '../components/UI/ProgressBar';
import { SkeletonTable } from '../components/UI/Skeleton';
import { parseArgMoney, formatARS, formatPct, formatDate, parseDate, MONTHS_ES, toTitleCase } from '../utils/formatters';
import { gasClient } from '../utils/gasClient';

const EDIT_FIELDS = [
  { k: 'medico', label: 'Médico' },
  { k: 'obraSocial', label: 'Obra Social' },
  { k: 'fechaCx', label: 'Fecha cirugía', placeholder: 'dd/mm/yyyy' },
  { k: 'montoPresupuesto', label: 'Monto presupuesto' },
  { k: 'numeroFactura', label: 'N° Factura' },
  { k: 'montoFactura', label: 'Monto factura' },
  { k: 'fechaFactura', label: 'Fecha factura', placeholder: 'dd/mm/yyyy' },
  { k: 'fechaCobro', label: 'Fecha cobro', placeholder: 'dd/mm/yyyy' },
  { k: 'retencionesOtros', label: 'Retenciones / Otros' },
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
    <div style={{ background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function CostRow({ label, value, bold }) {
  const v = parseArgMoney(value);
  if (!v && v !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: bold ? '#111827' : '#374151', fontSize: 14 }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: bold ? '#111827' : '#6B7280' }}>{formatARS(v)}</span>
    </div>
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

  const handleCobrar = async () => {
    setSaving(true);
    try {
      await gasClient.updateCobrado(cirugia.rowIndex, fechaCobro);
      addToast('Cirugía marcada como cobrada', 'success');
      onCobrar(cirugia.rowIndex, fechaCobro);
      onClose();
    } catch (e) {
      addToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    const f = {};
    EDIT_FIELDS.forEach(({ k }) => { f[k] = cirugia[k] || ''; });
    setEditForm(f);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await gasClient.updateCirugia(cirugia.rowIndex, editForm);
      addToast('Cirugía actualizada', 'success');
      onCobrar();
      onClose();
    } catch (e) {
      addToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (editMode) {
    return (
      <Modal open onClose={onClose} width={620}
        title={<span style={{ fontSize: 17, fontWeight: 700 }}>Editar — {toTitleCase(cirugia.paciente)}</span>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {EDIT_FIELDS.map(({ k, label, placeholder }) => (
              <div key={k}>
                <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={editForm[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder || ''}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
            <button onClick={handleSaveEdit} disabled={saving}
              style={{ flex: 1, padding: '9px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditMode(false)} style={{ padding: '9px 18px', background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Volver</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} width={700}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{toTitleCase(cirugia.paciente)}</span>
          <Badge type={badgeType}>{getBadgeLabel(cirugia)}</Badge>
          <button onClick={startEdit}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#6B7280', fontSize: 12, fontFamily: 'inherit' }}>
            <Edit2 size={13} /> Editar
          </button>
        </div>
      }
    >
      {/* Info chips */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <InfoChip label="Médico" value={toTitleCase(cirugia.medico)} />
          <InfoChip label="Obra Social" value={toTitleCase(cirugia.obraSocial)} />
          <InfoChip label="Mes" value={cirugia.mes} />
          <InfoChip label="Fecha cirugía" value={cirugia.fechaCx} />
          <InfoChip label="Pedido / Presupuestado" value={cirugia.pedidoPresupuestado} />
        </div>
      </section>

      {/* Materiales */}
      {cirugia.consumo && (
        <section style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Materiales utilizados</h4>
          <div style={{ background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            {cirugia.consumo}
          </div>
        </section>
      )}

      {/* Costos */}
      <section style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Costos</h4>
        <div style={{ background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px' }}>
          <CostRow label="Implantes" value={cirugia.valorImplantes} />
          <CostRow label="Descartables" value={cirugia.valorDescartables} />
          <CostRow label="Logística / Esterilización" value={cirugia.valorLogistica} />
          <CostRow label="Corrección gastos" value={cirugia.correccionGastos} />
          <CostRow label="Valor total costos" value={cirugia.valorTotalCostos} bold />
        </div>
      </section>

      {/* Facturación */}
      <section style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturación</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <InfoChip label="Monto presupuesto" value={cirugia.montoPresupuesto ? formatARS(parseArgMoney(cirugia.montoPresupuesto)) : ''} />
          <InfoChip label="Monto factura" value={cirugia.montoFactura ? formatARS(parseArgMoney(cirugia.montoFactura)) : ''} />
          <InfoChip label="N° Factura" value={cirugia.numeroFactura} />
          <InfoChip label="Fecha factura" value={cirugia.fechaFactura} />
          <InfoChip label="Fecha cobro" value={cirugia.fechaCobro} />
          <InfoChip label="Retenciones / Otros" value={cirugia.retencionesOtros ? formatARS(parseArgMoney(cirugia.retencionesOtros)) : ''} />
        </div>
      </section>

      {/* Margen */}
      {(cirugia.facturaGastos || cirugia.pctMargen) && (
        <section style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margen</h4>
          <div style={{ background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: '#374151' }}>Factura - Gastos</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 700, color: parseArgMoney(cirugia.facturaGastos) >= 0 ? '#059669' : '#DC2626' }}>
                {formatARS(parseArgMoney(cirugia.facturaGastos))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#374151' }}>Margen %</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 700, color: '#C05621' }}>
                {formatPct(margen)}
              </span>
            </div>
            <ProgressBar value={Math.max(0, margen)} max={100} />
          </div>
        </section>
      )}

      {/* Footer actions */}
      {!cirugia.cobrado && (cirugia.numeroFactura || cirugia.montoFactura) && (
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
          {!showCobrarForm ? (
            <button
              onClick={() => setShowCobrarForm(true)}
              style={{
                width: '100%', padding: '11px',
                background: '#C05621', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600
              }}
            >
              Marcar como cobrado
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>Fecha de cobro real</label>
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={fechaCobro}
                  onChange={e => setFechaCobro(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={handleCobrar}
                disabled={saving}
                style={{ padding: '9px 20px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}
              >
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setShowCobrarForm(false)}
                style={{ padding: '9px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function NuevaCirugiaModal({ onClose, onSaved, addToast }) {
  const [form, setForm] = useState({ paciente: '', medico: '', fechaCx: '', mes: '', pedidoPresupuestado: '', obraSocial: '', consumo: '', valorImplantes: '', valorDescartables: '', valorLogistica: '', valorTotalCostos: '', montoPresupuesto: '', numeroFactura: '', montoFactura: '', fechaFactura: '', fechaCobro: '' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.paciente) { addToast('El paciente es requerido', 'error'); return; }
    setSaving(true);
    try {
      await gasClient.addCirugia(form);
      addToast('Cirugía agregada correctamente', 'success');
      onSaved();
      onClose();
    } catch (e) {
      addToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, k, placeholder }) => (
    <div>
      <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        value={form[k]} onChange={e => set(k, e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
      />
    </div>
  );

  return (
    <Modal open onClose={onClose} width={640} title={<span style={{ fontSize: 17, fontWeight: 700 }}>Nueva Cirugía</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Paciente *" k="paciente" />
          <Field label="Médico" k="medico" />
          <Field label="Fecha cirugía" k="fechaCx" placeholder="dd/mm/yyyy" />
          <Field label="Mes" k="mes" />
          <Field label="Obra Social" k="obraSocial" />
          <Field label="Pedido / Presupuestado" k="pedidoPresupuestado" />
        </div>
        <div>
          <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Consumo (materiales)</label>
          <textarea
            value={form.consumo} onChange={e => set('consumo', e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Valor implantes" k="valorImplantes" />
          <Field label="Valor descartables" k="valorDescartables" />
          <Field label="Valor logística/esterilización" k="valorLogistica" />
          <Field label="Valor total costos" k="valorTotalCostos" />
          <Field label="Monto presupuesto" k="montoPresupuesto" />
          <Field label="N° Factura" k="numeroFactura" />
          <Field label="Monto factura" k="montoFactura" />
          <Field label="Fecha factura" k="fechaFactura" placeholder="dd/mm/yyyy" />
          <Field label="Fecha cobro" k="fechaCobro" placeholder="dd/mm/yyyy" />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #E5E7EB' }}>
          <button
            onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '10px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}
          >
            {saving ? 'Guardando...' : 'Guardar cirugía'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Cirugias({ data, loading, refetch, addToast }) {
  const { cirugias } = data;
  const [search, setSearch] = useState('');
  const [filterMes, setFilterMes] = useState('');
  const [filterOS, setFilterOS] = useState('');
  const [filterMedico, setFilterMedico] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [selected, setSelected] = useState(null);
  const [showNueva, setShowNueva] = useState(false);

  const obrasSociales = useMemo(() => [...new Set(cirugias.map(c => c.obraSocial).filter(Boolean))].sort(), [cirugias]);
  const medicos = useMemo(() => [...new Set(cirugias.map(c => c.medico).filter(Boolean))].sort(), [cirugias]);

  const filtered = useMemo(() => {
    return cirugias.filter(c => {
      if (search && !c.paciente.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterMes && c.mes !== filterMes) return false;
      if (filterOS && c.obraSocial !== filterOS) return false;
      if (filterMedico && c.medico !== filterMedico) return false;
      if (filterEstado === 'cobrado' && !c.cobrado) return false;
      if (filterEstado === 'pendiente' && (c.cobrado || (!c.numeroFactura && !c.montoFactura))) return false;
      if (filterEstado === 'sinFactura' && (c.numeroFactura || c.montoFactura)) return false;
      return true;
    });
  }, [cirugias, search, filterMes, filterOS, filterMedico, filterEstado]);

  const handleCobrar = (rowIndex, fecha) => {
    refetch();
  };

  const selStyle = { padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, background: '#fff', color: '#374151', cursor: 'pointer' };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar paciente..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
        <select value={filterMes} onChange={e => setFilterMes(e.target.value)} style={selStyle}>
          <option value="">Todos los meses</option>
          {MONTHS_ES.map(m => <option key={m}>{m}</option>)}
        </select>
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
        <button
          onClick={() => setShowNueva(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#C05621', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          <Plus size={15} /> Nueva cirugía
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Paciente', 'Fecha cx', 'Médico', 'Obra Social', 'Materiales', 'Monto Factura', 'Costo Total', 'Margen $', 'Margen %', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={10}><SkeletonTable rows={8} cols={10} /></td></tr>
                : filtered.map((c, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelected(c)}
                      style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>{toTitleCase(c.paciente)}</td>
                      <td style={{ padding: '11px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{c.fechaCx}</td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{toTitleCase(c.medico)}</td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{toTitleCase(c.obraSocial)}</td>
                      <td style={{ padding: '11px 14px', color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.consumo}</td>
                      <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{c.montoFactura ? formatARS(parseArgMoney(c.montoFactura)) : '—'}</td>
                      <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#6B7280' }}>{c.valorTotalCostos ? formatARS(parseArgMoney(c.valorTotalCostos)) : '—'}</td>
                      <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: parseArgMoney(c.facturaGastos) >= 0 ? '#059669' : '#DC2626' }}>{c.facturaGastos ? formatARS(parseArgMoney(c.facturaGastos)) : '—'}</td>
                      <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#C05621' }}>{c.pctMargen ? formatPct(parseArgMoney(c.pctMargen)) : '—'}</td>
                      <td style={{ padding: '11px 14px' }}><Badge type={getBadgeType(c)}>{getBadgeLabel(c)}</Badge></td>
                    </tr>
                  ))
              }
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No se encontraron cirugías</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length > 0 && (
        <div style={{ padding: '10px 0', fontSize: 13, color: '#6B7280' }}>
          {filtered.length} cirugías
        </div>
      )}

      {selected && (
        <CirugiaModal
          cirugia={selected}
          onClose={() => setSelected(null)}
          onCobrar={handleCobrar}
          addToast={addToast}
        />
      )}
      {showNueva && (
        <NuevaCirugiaModal
          onClose={() => setShowNueva(false)}
          onSaved={refetch}
          addToast={addToast}
        />
      )}
    </div>
  );
}

export { CirugiaModal };
