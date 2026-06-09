export function Badge({ type, children }) {
  const styles = {
    cobrado: { background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' },
    pendiente: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
    sinFactura: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' },
    vencido: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
    porVencer: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' },
  };
  const s = styles[type] || styles.sinFactura;
  return (
    <span style={{
      ...s,
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  );
}
