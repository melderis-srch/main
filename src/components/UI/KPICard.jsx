export function KPICard({ label, value, sub, color, icon: Icon }) {
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
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {Icon && <Icon size={16} color={color || '#E8622A'} strokeWidth={2} />}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  );
}
