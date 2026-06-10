export function Badge({ type, children }) {
  const styles = {
    cobrado:    { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
    pendiente:  { background: '#F9FAFB', color: '#374151', border: '1px solid #D1D5DB' },
    sinFactura: { background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #E5E7EB' },
    vencido:    { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
    porVencer:  { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' },
    proyectado: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
  };
  const s = styles[type] || styles.sinFactura;
  return (
    <span style={{
      ...s, display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  );
}
