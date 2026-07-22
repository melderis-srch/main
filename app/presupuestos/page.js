'use client';
// App individual del Generador de Presupuestos.
// Ruta standalone (/presupuestos), sin sidebar ni login: se puede usar sola y
// más adelante se embebe en la app principal (ya está también como pestaña en
// la vista Presupuestos).
import { useMasterData } from '../../src/hooks/useMasterData';
import { useToast } from '../../src/hooks/useToast';
import { ToastContainer } from '../../src/components/UI/Toast';
import GeneradorPresupuesto from '../../src/views/GeneradorPresupuesto';

export default function PresupuestosStandalonePage() {
  const { data } = useMasterData();
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>
      <header style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB',
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#D65E29', letterSpacing: '-0.5px' }}>
          Surch<span style={{ fontStyle: 'normal' }}>ĕ</span>rie
        </span>
        <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>· Generador de Presupuestos</span>
      </header>

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 20px 60px' }}>
        <GeneradorPresupuesto data={data} addToast={addToast} />
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
