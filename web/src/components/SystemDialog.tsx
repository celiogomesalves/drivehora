import { createContext, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface SystemDialogContextType {
  showAlert: (message: string, type?: DialogType, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, onCancel?: () => void, options?: { title?: string; confirmLabel?: string; cancelLabel?: string; type?: DialogType }) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const SystemDialogContext = createContext<SystemDialogContextType | undefined>(undefined);

export function SystemDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showAlert = (message: string, type: DialogType = 'info', title?: string) => {
    setDialog({
      message,
      type,
      title: title || (type === 'error' ? 'Atenção' : type === 'success' ? 'Sucesso' : type === 'warning' ? 'Aviso' : 'Informação'),
      confirmLabel: 'Entendido'
    });
  };

  const showConfirm = (
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    options?: { title?: string; confirmLabel?: string; cancelLabel?: string; type?: DialogType }
  ) => {
    setDialog({
      message,
      type: options?.type || 'confirm',
      title: options?.title || 'Confirmação Necessária',
      confirmLabel: options?.confirmLabel || 'Sim, Confirmar',
      cancelLabel: options?.cancelLabel || 'Cancelar',
      onConfirm: () => {
        setDialog(null);
        onConfirm();
      },
      onCancel: () => {
        setDialog(null);
        if (onCancel) onCancel();
      }
    });
  };

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const closeDialog = () => setDialog(null);

  return (
    <SystemDialogContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}

      {/* MODAL DE DIÁLOGO / CONFIRMAÇÃO DO SISTEMA (Substituto nativo para window.alert e window.confirm) */}
      {dialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            background: 'linear-gradient(145deg, #0f172a, #1e1b4b)',
            border: `1.5px solid ${
              dialog.type === 'error' || dialog.type === 'confirm' 
                ? 'rgba(239, 68, 68, 0.6)' 
                : dialog.type === 'success' 
                ? 'rgba(16, 185, 129, 0.6)' 
                : dialog.type === 'warning'
                ? 'rgba(245, 158, 11, 0.6)'
                : 'rgba(99, 102, 241, 0.6)'
            }`,
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.3)',
            position: 'relative',
            animation: 'fadeInScale 0.2s ease-out'
          }}>
            {/* Ícone e Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: dialog.type === 'error' || dialog.type === 'confirm'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : dialog.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : dialog.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
                color: dialog.type === 'error' || dialog.type === 'confirm'
                  ? '#ef4444'
                  : dialog.type === 'success'
                  ? '#10b981'
                  : dialog.type === 'warning'
                  ? '#f59e0b'
                  : '#818cf8'
              }}>
                {dialog.type === 'error' ? (
                  <AlertOctagon size={24} />
                ) : dialog.type === 'confirm' ? (
                  <AlertTriangle size={24} />
                ) : dialog.type === 'success' ? (
                  <CheckCircle2 size={24} />
                ) : dialog.type === 'warning' ? (
                  <AlertTriangle size={24} />
                ) : (
                  <Info size={24} />
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {dialog.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                  DriveHora Sistema
                </span>
              </div>
            </div>

            {/* Mensagem */}
            <p style={{
              fontSize: '0.92rem',
              color: '#e2e8f0',
              lineHeight: 1.5,
              margin: '0 0 24px 0',
              whiteSpace: 'pre-line'
            }}>
              {dialog.message}
            </p>

            {/* Ações */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {dialog.onCancel && (
                <button
                  type="button"
                  onClick={dialog.onCancel}
                  className="btn-outline"
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    borderRadius: '10px'
                  }}
                >
                  {dialog.cancelLabel || 'Cancelar'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (dialog.onConfirm) {
                    dialog.onConfirm();
                  } else {
                    closeDialog();
                  }
                }}
                className={dialog.type === 'error' || dialog.type === 'confirm' ? 'btn-primary' : 'btn-success'}
                style={{
                  padding: '10px 20px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  background: dialog.type === 'error' || dialog.type === 'confirm'
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : undefined
                }}
              >
                {dialog.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS FLUTUANTES NO CANTO INFERIOR DIREITO */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 99999,
          maxWidth: '380px'
        }}>
          {toasts.map(t => (
            <div
              key={t.id}
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: `1px solid ${
                  t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : t.type === 'warning' ? '#f59e0b' : '#6366f1'
                }`,
                borderRadius: '12px',
                padding: '12px 16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                color: '#fff',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'slideIn 0.3s ease-out'
              }}
            >
              {t.type === 'success' ? <CheckCircle2 size={18} color="#10b981" /> :
               t.type === 'error' ? <AlertOctagon size={18} color="#ef4444" /> :
               t.type === 'warning' ? <AlertTriangle size={18} color="#f59e0b" /> :
               <Info size={18} color="#818cf8" />}
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SystemDialogContext.Provider>
  );
}

export function useSystemDialog() {
  const context = useContext(SystemDialogContext);
  if (!context) {
    // Fallback seguro caso usado fora do provider
    return {
      showAlert: (msg: string) => alert(msg),
      showConfirm: (msg: string, onConfirm: () => void) => {
        if (confirm(msg)) onConfirm();
      },
      showToast: (msg: string) => console.log(msg)
    };
  }
  return context;
}
