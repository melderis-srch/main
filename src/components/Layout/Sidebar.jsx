'use client';
import { LayoutDashboard, Stethoscope, CreditCard, Calendar, Receipt, BarChart2 } from 'lucide-react';

const ORANGE = '#C05621';

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',          Icon: LayoutDashboard },
  { id: 'cirugias',    label: 'Cirugías',            Icon: Stethoscope     },
  { id: 'cobranzas',   label: 'Cobranzas',           Icon: CreditCard      },
  { id: 'calendario',  label: 'Calendario',          Icon: Calendar        },
  { id: 'pagos',       label: 'Pagos',               Icon: Receipt         },
  { id: 'consolidado', label: 'Consolidado',         Icon: BarChart2       },
];

export function Sidebar({ active, onNavigate }) {
  return (
    <nav style={{
      width: 220, minHeight: '100vh',
      background: '#fff',
      borderRight: '1px solid #E5E7EB',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0,
      zIndex: 100
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SurcherieLogo size={34}/>
          <div>
            <div style={{ color: '#111827', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Surcherie</div>
            <div style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 400 }}>Gestión interna</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '10px 10px' }}>
        {NAV.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onNavigate(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', marginBottom: 2,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isActive ? '#FFF7F3' : 'transparent',
              color: isActive ? ORANGE : '#6B7280',
              fontFamily: 'inherit', fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              textAlign: 'left', transition: 'all 0.12s',
              borderLeft: isActive ? `3px solid ${ORANGE}` : '3px solid transparent',
            }}>
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8}/>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6' }}>
        <div style={{ color: '#D1D5DB', fontSize: 11 }}>Surcherie © 2026</div>
      </div>
    </nav>
  );
}

function SurcherieLogo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill={ORANGE}/>
      <rect x="16" y="5"  width="4" height="26" rx="2" fill="white"/>
      <rect x="10" y="9"  width="16" height="3" rx="1.5" fill="white"/>
      <rect x="10" y="15" width="16" height="3" rx="1.5" fill="white"/>
      <rect x="10" y="21" width="16" height="3" rx="1.5" fill="white"/>
    </svg>
  );
}

export function BottomNav({ active, onNavigate }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #E5E7EB',
      display: 'flex', zIndex: 100
    }}>
      {NAV.slice(0,5).map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button key={id} onClick={() => onNavigate(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '10px 4px 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: isActive ? ORANGE : '#9CA3AF',
            fontFamily: 'inherit', fontSize: 10,
            fontWeight: isActive ? 600 : 400
          }}>
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8}/>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
