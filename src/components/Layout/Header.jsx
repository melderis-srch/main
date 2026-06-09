import { RefreshCw } from 'lucide-react';

export function Header({ title, onRefresh, loading }) {
  return (
    <header style={{
      height: 60, background: '#fff',
      borderBottom: '1px solid #E5E7EB',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky', top: 0, zIndex: 50
    }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>
        {title}
      </h1>
      <button
        onClick={onRefresh}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px',
          background: loading ? '#F3F4F6' : '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
          color: '#6B7280', fontSize: 13, fontFamily: 'inherit',
          transition: 'all 0.15s'
        }}
      >
        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        Actualizar datos
      </button>
    </header>
  );
}
