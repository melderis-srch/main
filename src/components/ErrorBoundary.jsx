'use client';
import { Component } from 'react';

// Red de seguridad: si una vista lanza un error en render (por datos raros,
// una fecha inválida, etc.), en vez de romper toda la app mostramos un mensaje
// con botón de reintentar. Evita la pantalla "Application error".
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Log para poder diagnosticar desde la consola del navegador.
    console.error('ErrorBoundary capturó:', error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
          <div style={{ maxWidth: 480, margin: '40px auto', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>😕</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Hubo un problema al mostrar esta sección
            </div>
            <div style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 20, lineHeight: 1.5 }}>
              Puede ser que los datos hayan tardado demasiado o que alguno esté incompleto.
              Probá recargar; si sigue, avisanos con el detalle de abajo.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={this.reset} style={{ padding: '9px 18px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                Reintentar
              </button>
              <button onClick={() => window.location.reload()} style={{ padding: '9px 18px', border: 'none', background: '#2F55B0', color: '#fff', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Recargar página
              </button>
            </div>
            <details style={{ marginTop: 18, textAlign: 'left' }}>
              <summary style={{ fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}>Detalle técnico</summary>
              <pre style={{ fontSize: 11, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: 10, marginTop: 8, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
