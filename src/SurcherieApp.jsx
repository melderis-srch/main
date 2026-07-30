'use client';

import { useState, useEffect } from 'react';
import { Sidebar, BottomNav } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { ToastContainer } from './components/UI/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useGASData } from './hooks/useGASData';
import { useToast } from './hooks/useToast';
import Dashboard from './views/Dashboard';
import Cirugias from './views/Cirugias';
import Cobranzas from './views/Cobranzas';
import Facturacion from './views/Facturacion';
import Calendario from './views/Calendario';
import Pagos from './views/Pagos';
import Consolidado from './views/Consolidado';
import Presupuestos from './views/Presupuestos';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  cirugias: 'Cirugías',
  presupuestos: 'Presupuestos',
  cobranzas: 'Cobranzas',
  facturacion: 'Facturación',
  calendario: 'Calendario',
  pagos: 'Pagos / Proveedores',
  consolidado: 'Consolidado anual',
};

export default function SurcherieApp() {
  const [page, setPage] = useState('dashboard');
  const [isMobile, setIsMobile] = useState(false);
  const { data, loading, error, refetch } = useGASData();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const pageProps = { data, loading, refetch, addToast };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard {...pageProps} />;
      case 'cirugias':    return <Cirugias {...pageProps} />;
      case 'presupuestos': return <Presupuestos {...pageProps} />;
      case 'cobranzas':   return <Cobranzas {...pageProps} />;
      case 'facturacion': return <Facturacion {...pageProps} />;
      case 'calendario':  return <Calendario {...pageProps} />;
      case 'pagos':       return <Pagos {...pageProps} />;
      case 'consolidado': return <Consolidado {...pageProps} />;
      default:            return <Dashboard {...pageProps} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>
      {!isMobile && <Sidebar active={page} onNavigate={setPage} />}

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : 220, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header title={PAGE_TITLES[page]} onRefresh={refetch} loading={loading} />

        <main style={{ flex: 1, padding: isMobile ? '20px 16px 80px' : '28px 28px' }}>
          {error && (
            <div style={{
              marginBottom: 16, padding: '12px 16px',
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              borderRadius: 8, color: '#991B1B', fontSize: 14
            }}>
              <strong>Error al cargar datos:</strong> {error}
              {!process.env.NEXT_PUBLIC_GAS_URL && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  Configurá <code>NEXT_PUBLIC_GAS_URL</code> en el archivo <code>.env.local</code> con la URL de tu Google Apps Script.
                </div>
              )}
            </div>
          )}
          <ErrorBoundary key={page}>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>

      {isMobile && <BottomNav active={page} onNavigate={setPage} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
