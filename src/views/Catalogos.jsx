'use client';
// Módulo de catálogos: Productos y Clientes, contra las hojas de la planilla
// maestra (Clientes / Productos). Permite ver, buscar, editar (cargar precios)
// y agregar, además de la importación inicial desde los datos extraídos.
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Save, Search, Download, RefreshCw } from 'lucide-react';
import { gasV2 } from '../utils/gasClientV2';
import { CLIENTES as SEED_CLIENTES, PRODUCTOS as SEED_PRODUCTOS } from '../data/catalogos';
import { fmtMoney } from '../utils/presupuestoPDF';

const BLUE = '#2F55B0';

const COLS = {
  productos: [
    { key: 'codigo', label: 'Cód.', w: 70 },
    { key: 'denominacion', label: 'Denominación', w: 320 },
    { key: 'marca', label: 'Marca', w: 130 },
    { key: 'origen', label: 'Origen', w: 100 },
    { key: 'alternativa', label: 'Alternativa', w: 160 },
    { key: 'precio', label: 'Precio (neto)', w: 130, money: true },
    { key: 'gravado', label: 'IVA', w: 70 },
  ],
  clientes: [
    { key: 'codigo', label: 'Cód.', w: 70 },
    { key: 'denominacion', label: 'Denominación', w: 300 },
    { key: 'condicionIva', label: 'Condición IVA', w: 170 },
    { key: 'cuit', label: 'CUIT', w: 130 },
    { key: 'direccion', label: 'Dirección', w: 180 },
    { key: 'localidad', label: 'Localidad', w: 150 },
  ],
};

const inp = { width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', background: '#fff' };

export default function Catalogos({ tipo = 'productos', addToast }) {
  const [cat, setCat] = useState({ clientes: [], productos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState({});     // _row -> true
  const [savingRow, setSavingRow] = useState(null);
  const [importing, setImporting] = useState(false);

  const cols = COLS[tipo];
  const rows = cat[tipo] || [];

  const fetchCat = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCat(await gasV2.getCatalogos()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchCat(); }, [fetchCat]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));
  }, [rows, search, cols]);

  function setField(row, key, value) {
    setCat((prev) => ({
      ...prev,
      [tipo]: prev[tipo].map((r) => (r._row === row._row ? { ...r, [key]: value } : r)),
    }));
    setDirty((d) => ({ ...d, [row._row]: true }));
  }

  async function saveRow(row) {
    setSavingRow(row._row);
    try {
      const fields = {};
      cols.forEach((c) => { fields[c.key] = row[c.key] ?? ''; });
      if (tipo === 'productos') await gasV2.updateProducto(row._row, fields);
      else await gasV2.updateCliente(row._row, fields);
      setDirty((d) => { const n = { ...d }; delete n[row._row]; return n; });
      addToast?.('Guardado.', 'success');
    } catch (e) { addToast?.('No se pudo guardar: ' + e.message, 'error'); }
    finally { setSavingRow(null); }
  }

  async function addRow() {
    const blank = {};
    cols.forEach((c) => { blank[c.key] = ''; });
    try {
      if (tipo === 'productos') await gasV2.addProducto(blank);
      else await gasV2.addCliente(blank);
      addToast?.('Fila agregada — completala y guardá.', 'success');
      fetchCat();
    } catch (e) { addToast?.('No se pudo agregar: ' + e.message, 'error'); }
  }

  async function importarInicial() {
    setImporting(true);
    try {
      const res = await gasV2.importCatalogo({ clientes: SEED_CLIENTES, productos: SEED_PRODUCTOS });
      addToast?.(`Importados ${res.productos} productos y ${res.clientes} clientes.`, 'success');
      fetchCat();
    } catch (e) { addToast?.('No se pudo importar: ' + e.message, 'error'); }
    finally { setImporting(false); }
  }

  const vacio = !loading && rows.length === 0;
  const btn = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #E5E7EB', background: '#fff', color: '#374151' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${tipo}…`}
            style={{ ...inp, padding: '8px 10px 8px 32px', fontSize: 13 }} />
        </div>
        <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>{filtered.length} de {rows.length}</span>
        <button style={btn} onClick={fetchCat} title="Recargar"><RefreshCw size={14} /> Recargar</button>
        <button style={{ ...btn, borderColor: BLUE, color: BLUE }} onClick={addRow}><Plus size={15} /> Agregar</button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#991B1B' }}>
          Error al cargar: {error}
        </div>
      )}

      {vacio && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 24, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: '#92400E', marginBottom: 12 }}>
            La hoja <b>{tipo === 'productos' ? 'Productos' : 'Clientes'}</b> está vacía en la maestra.
          </div>
          <button style={{ ...btn, borderColor: BLUE, background: BLUE, color: '#fff', margin: '0 auto' }} onClick={importarInicial} disabled={importing}>
            <Download size={15} /> {importing ? 'Importando…' : `Importar catálogo inicial (${SEED_PRODUCTOS.length} productos / ${SEED_CLIENTES.length} clientes)`}
          </button>
        </div>
      )}

      {!vacio && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {cols.map((c) => (
                    <th key={c.key} style={{ padding: '9px 10px', textAlign: c.money ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>{c.label}</th>
                  ))}
                  <th style={{ width: 90, borderBottom: '1px solid #E5E7EB' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={cols.length + 1} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Cargando…</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r._row} style={{ borderBottom: '1px solid #F3F4F6', background: dirty[r._row] ? '#FFFDF5' : '#fff' }}>
                    {cols.map((c) => (
                      <td key={c.key} style={{ padding: '5px 8px', width: c.w }}>
                        <input value={r[c.key] ?? ''} onChange={(e) => setField(r, c.key, e.target.value)}
                          type={c.money ? 'number' : 'text'} step={c.money ? '0.01' : undefined}
                          style={{ ...inp, textAlign: c.money ? 'right' : 'left', maxWidth: c.w }} />
                      </td>
                    ))}
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                      <button onClick={() => saveRow(r)} disabled={!dirty[r._row] || savingRow === r._row}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
                          border: 'none', cursor: dirty[r._row] ? 'pointer' : 'default',
                          background: dirty[r._row] ? BLUE : '#F3F4F6', color: dirty[r._row] ? '#fff' : '#9CA3AF' }}>
                        <Save size={13} /> {savingRow === r._row ? '…' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
