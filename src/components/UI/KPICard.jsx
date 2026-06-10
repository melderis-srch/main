'use client';
import { useState } from 'react';
import { Info } from 'lucide-react';

function Hint({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={13} color="#C4C9D1" strokeWidth={2} />
      {show && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1F2937', color: '#F9FAFB', fontSize: 11, fontWeight: 400, lineHeight: 1.4,
          padding: '7px 10px', borderRadius: 6, width: 200, zIndex: 50, textTransform: 'none',
          letterSpacing: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', textAlign: 'left'
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1F2937'
          }} />
        </span>
      )}
    </span>
  );
}

export function KPICard({ label, value, sub, color, icon: Icon, hint }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 10,
      padding: '18px 20px',
      borderLeft: `3px solid ${color || '#E8622A'}`,
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {label}
          {hint && <Hint text={hint} />}
        </span>
        {Icon && <Icon size={16} color={color || '#E8622A'} strokeWidth={2} />}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  );
}
