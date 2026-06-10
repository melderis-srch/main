'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseDate, formatMonthYear } from '../utils/formatters';
import { CirugiaModal } from './Cirugias';
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, format } from 'date-fns';

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function cirugiaChipColor(c) {
  if (c.cobrado) return { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' };
  if (c.numeroFactura || c.montoFactura) return { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' };
  return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' };
}

const COBRO_CHIP = { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' };

function abbrev(str) {
  if (!str) return '?';
  const parts = str.trim().split(' ');
  return parts.length >= 2 ? parts[parts.length - 1] : str.slice(0, 10);
}

export default function Calendario({ data, loading, addToast, refetch }) {
  const { cirugias, ventasCobros } = data;
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const byDate = useMemo(() => {
    const map = {};

    cirugias.forEach(c => {
      if (!c.fechaCx) return;
      const d = parseDate(c.fechaCx);
      if (!d) return;
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = { cirugias: [], cobros: [] };
      map[key].cirugias.push(c);
    });

    (ventasCobros || []).forEach(v => {
      if (v.fechaCobroReal) return; // already collected, skip
      if (!v.fechaCobroEsperada) return;
      const d = parseDate(v.fechaCobroEsperada);
      if (!d) return;
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = { cirugias: [], cobros: [] };
      map[key].cobros.push(v);
    });

    return map;
  }, [cirugias, ventasCobros]);

  const today = new Date();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={() => setCurrent(d => subMonths(d, 1))}
          style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} color="#374151" />
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827', minWidth: 200, textAlign: 'center', textTransform: 'capitalize' }}>
          {formatMonthYear(current)}
        </h2>
        <button onClick={() => setCurrent(d => addMonths(d, 1))}
          style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} color="#374151" />
        </button>
        <button onClick={() => setCurrent(new Date())}
          style={{ padding: '7px 14px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#374151' }}>
          Hoy
        </button>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
          {[
            { bg: '#F3F4F6', border: '#E5E7EB', color: '#374151', label: 'Cirugía' },
            { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', label: 'Facturada' },
            { bg: '#D1FAE5', border: '#6EE7B7', color: '#065F46', label: 'Cobrada' },
            { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', label: 'Cobro esperado' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}` }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E5E7EB' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#9CA3AF', background: '#F9FAFB' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd');
            const { cirugias: cxList = [], cobros: cobroList = [] } = byDate[key] || {};
            const inMonth = isSameMonth(day, current);
            const isToday = isSameDay(day, today);
            const isLastRow = idx >= days.length - 7;
            const totalEvents = cxList.length + cobroList.length;
            return (
              <div key={key} style={{
                minHeight: 100,
                borderRight: (idx + 1) % 7 !== 0 ? '1px solid #F3F4F6' : 'none',
                borderBottom: !isLastRow ? '1px solid #F3F4F6' : 'none',
                padding: '6px 8px',
                background: inMonth ? '#fff' : '#FAFAFA'
              }}>
                <div style={{
                  fontSize: 13, fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#fff' : inMonth ? '#374151' : '#D1D5DB',
                  width: 24, height: 24, borderRadius: '50%',
                  background: isToday ? '#E8622A' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 4
                }}>
                  {format(day, 'd')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {cxList.slice(0, 2).map((c, i) => {
                    const chip = cirugiaChipColor(c);
                    return (
                      <button key={'cx' + i} onClick={() => setSelected(c)}
                        style={{
                          display: 'block', width: '100%', padding: '2px 5px',
                          background: chip.bg, color: chip.color,
                          border: `1px solid ${chip.border}`,
                          borderRadius: 4, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                          textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}
                      >
                        {abbrev(c.paciente)}{c.obraSocial ? ' · ' + c.obraSocial.split(' ')[0] : ''}
                      </button>
                    );
                  })}
                  {cobroList.slice(0, 2).map((v, i) => (
                    <div key={'cobro' + i}
                      style={{
                        padding: '2px 5px',
                        background: COBRO_CHIP.bg, color: COBRO_CHIP.color,
                        border: `1px solid ${COBRO_CHIP.border}`,
                        borderRadius: 4, fontSize: 11, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}
                      title={`${v.obraSocial || v.paciente} — ${v.montoFacturado}`}
                    >
                      💰 {v.obraSocial ? v.obraSocial.split(' ')[0] : abbrev(v.paciente)}
                    </div>
                  ))}
                  {totalEvents > 4 && (
                    <span style={{ fontSize: 10, color: '#9CA3AF', paddingLeft: 4 }}>+{totalEvents - 4} más</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <CirugiaModal
          cirugia={selected}
          onClose={() => setSelected(null)}
          onCobrar={refetch}
          addToast={addToast}
        />
      )}
    </div>
  );
}
