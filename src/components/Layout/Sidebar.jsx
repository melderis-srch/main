import { LayoutDashboard, Stethoscope, CreditCard, Calendar, Receipt, BarChart2 } from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'cirugias', label: 'Cirugías', Icon: Stethoscope },
  { id: 'cobranzas', label: 'Cobranzas', Icon: CreditCard },
  { id: 'calendario', label: 'Calendario', Icon: Calendar },
  { id: 'pagos', label: 'Pagos', Icon: Receipt },
  { id: 'consolidado', label: 'Consolidado', Icon: BarChart2 },
];

export function Sidebar({ active, onNavigate }) {
  return (
    <nav style={{
      width: 220, minHeight: '100vh',
      background: '#2B4C8C',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0,
      zIndex: 100
    }}>
      {/* Logo area */}
      <div style={{
        padding: '28px 20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SurcherieLogo size={36} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Surcherie</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 400 }}>Gestión interna</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '12px 12px' }}>
        {NAV.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 2,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActive ? '#E8622A' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                fontFamily: 'inherit', fontSize: 14, fontWeight: isActive ? 600 : 400,
                textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          Surcherie © 2026
        </div>
      </div>
    </nav>
  );
}

function SurcherieLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="#E8622A" />
      {/* Spine icon simplified */}
      <rect x="16" y="5" width="4" height="26" rx="2" fill="white" />
      <rect x="10" y="9" width="16" height="3" rx="1.5" fill="white" />
      <rect x="10" y="15" width="16" height="3" rx="1.5" fill="white" />
      <rect x="10" y="21" width="16" height="3" rx="1.5" fill="white" />
    </svg>
  );
}

// Mobile bottom nav
export function BottomNav({ active, onNavigate }) {
  const MOBILE_NAV = NAV.slice(0, 5);
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#2B4C8C',
      display: 'flex', zIndex: 100,
      borderTop: '1px solid rgba(255,255,255,0.1)'
    }}>
      {MOBILE_NAV.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 4px 8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? '#E8622A' : 'rgba(255,255,255,0.6)',
              fontFamily: 'inherit', fontSize: 10, fontWeight: isActive ? 600 : 400
            }}
          >
            <Icon size={20} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
