import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseDate, formatMonthYear } from '../utils/formatters';
import { CirugiaModal } from './Cirugias';
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, format } from 'date-fns';
import { es } from 'date-fns/locale';

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function getChipColor(c) {
  if (c.cobrado) return { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' };
  if (c.numeroFactura || c.montoFactura) return { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' };
  return { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' };
}

function abbrev(str) {
  if (!str) return '?';
  const parts = str.trim().split(' ');
  return parts.length >= 2 ? parts[parts.length - 1] : str.slice(0, 10);
}

export default function Calendario({ data, loading, addToast, refetch }) {
  const { cirugias } = data;
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Map cirugías by date string
  const byDate = useMemo(() => {
    const map = {};
    cirugias.forEach(c => {
      if (!c.fechaCx) return;
      const d = parseDate(c.fechaCx);
      if (!d) return;
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [cirugias]);

  const today = new Date();

  return (
    <div>
      {/* Header */}
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
      </div>

      {/* Calendar grid */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E5E7EB' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#9CA3AF', background: '#F9FAFB' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd');
            const events = byDate[key] || [];
            const inMonth = isSameMonth(day, current);
            const isToday = isSameDay(day, today);
            const isLastRow = idx >= days.length - 7;
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
                  {events.slice(0, 3).map((c, i) => {
                    const chip = getChipColor(c);
                    return (
                      <button key={i} onClick={() => setSelected(c)}
                        style={{
                          display: 'block', width: '100%', padding: '2px 5px',
                          background: chip.bg, color: chip.color,
                          border: `1px solid ${chip.border}`,
                          borderRadius: 4, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                          textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}
                      >
                        {abbrev(c.paciente)} {c.obraSocial ? '· ' + c.obraSocial.split(' ')[0] : ''}
                      </button>
                    );
                  })}
                  {events.length > 3 && (
                    <span style={{ fontSize: 10, color: '#9CA3AF', paddingLeft: 4 }}>+{events.length - 3} más</span>
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
