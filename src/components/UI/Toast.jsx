import { CheckCircle, XCircle, X } from 'lucide-react';

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: t.type === 'success' ? '#D1FAE5' : '#FEE2E2',
          border: `1px solid ${t.type === 'success' ? '#6EE7B7' : '#FCA5A5'}`,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: 280, maxWidth: 380,
          animation: 'slideIn 0.2s ease'
        }}>
          {t.type === 'success'
            ? <CheckCircle size={18} color="#059669" />
            : <XCircle size={18} color="#DC2626" />
          }
          <span style={{
            flex: 1, fontSize: 14,
            color: t.type === 'success' ? '#065F46' : '#991B1B'
          }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7280', padding: 0, lineHeight: 1
          }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
