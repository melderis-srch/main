export function KPICard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 10,
      padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{label}</span>
        {Icon && <Icon size={18} color={color || '#E8622A'} />}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700,
        color: color || '#111827',
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '-0.5px'
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#6B7280' }}>{sub}</div>}
    </div>
  );
}
