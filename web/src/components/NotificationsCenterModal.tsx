import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  X, 
  ShieldAlert, 
  Car, 
  Sparkles, 
  Check, 
  Radio, 
  Volume2
} from 'lucide-react';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type?: 'system' | 'ride' | 'promo' | 'alert';
}

interface NotificationsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onEnablePush?: () => Promise<void>;
  pushPermission?: NotificationPermission | 'unsupported';
  theme?: 'light' | 'dark';
}

export function NotificationsCenterModal({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearAll,
  onMarkAsRead,
  onDeleteNotification,
  onEnablePush,
  pushPermission,
  theme = 'dark'
}: NotificationsCenterModalProps) {
  if (!isOpen) return null;

  // Checagem em tempo real direto da API do navegador
  const effectivePermission: NotificationPermission | 'unsupported' = 
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : (pushPermission || 'unsupported');

  const isLight = theme === 'light';
  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Agora';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'ride':
        return <Car size={16} color="#3b82f6" />;
      case 'alert':
        return <ShieldAlert size={16} color="#ef4444" />;
      case 'promo':
        return <Sparkles size={16} color="#f59e0b" />;
      default:
        return <Radio size={16} color="#10b981" />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '12px'
    }}>
      <div 
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          padding: '0',
          overflow: 'hidden',
          background: isLight ? '#ffffff' : '#0f172a',
          color: isLight ? '#0f172a' : '#f8fafc',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isLight ? '0 20px 45px rgba(0, 0, 0, 0.12)' : '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
        }}
      >
        {/* Cabeçalho Limpo */}
        <div style={{
          padding: '16px 20px',
          borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isLight ? '#f8fafc' : 'rgba(30, 41, 59, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0
            }}>
              <Bell size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Notificações</h3>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: '10px',
                    background: '#ef4444',
                    color: '#ffffff'
                  }}>
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
                {effectivePermission === 'granted' && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: '10px',
                    background: isLight ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    Ativo ✅
                  </span>
                )}
              </div>
              <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                Avisos do sistema e corridas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isLight ? '#334155' : '#ffffff'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Banner de Ativação de Notificações Mobile (ocultado automaticamente se já permitido) */}
        {effectivePermission !== 'granted' && onEnablePush && (
          <div style={{
            padding: '10px 16px',
            background: effectivePermission === 'denied'
              ? (isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.12)')
              : (isLight ? '#eff6ff' : 'rgba(59, 130, 246, 0.12)'),
            borderBottom: effectivePermission === 'denied'
              ? (isLight ? '1px solid #fef3c7' : '1px solid rgba(245, 158, 11, 0.25)')
              : (isLight ? '1px solid #dbeafe' : '1px solid rgba(59, 130, 246, 0.25)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Volume2 size={16} color={effectivePermission === 'denied' ? '#f59e0b' : '#3b82f6'} style={{ flexShrink: 0 }} />
              <span style={{ 
                fontSize: '0.75rem', 
                color: effectivePermission === 'denied' ? (isLight ? '#92400e' : '#fde68a') : (isLight ? '#1e3a8a' : '#bfdbfe'), 
                lineHeight: 1.3 
              }}>
                {effectivePermission === 'denied'
                  ? 'Notificações bloqueadas no Chrome. Toque ao lado para ver como liberar.'
                  : 'Ative as notificações push no celular para receber chamados em tempo real.'}
              </span>
            </div>
            <button
              type="button"
              onClick={onEnablePush}
              style={{
                background: effectivePermission === 'denied' ? '#f59e0b' : '#3b82f6',
                border: 'none',
                color: '#ffffff',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {effectivePermission === 'denied' ? 'Como Liberar' : 'Ativar'}
            </button>
          </div>
        )}

        {/* Barra de Ações - Layout Impecável sem Quebras de Texto */}
        {notifications.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            background: isLight ? '#ffffff' : 'transparent'
          }}>
            <span style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#94a3b8', whiteSpace: 'nowrap' }}>
              {notifications.length} {notifications.length > 1 ? 'notificações' : 'notificação'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  style={{
                    background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <CheckCheck size={13} />
                  <span>Ler todas</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClearAll}
                style={{
                  background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.1)',
                  border: isLight ? '1px solid #fee2e2' : '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <Trash2 size={13} />
                <span>Limpar</span>
              </button>
            </div>
          </div>
        )}

        {/* Lista de Notificações */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '220px',
          maxHeight: '52vh'
        }}>
          {notifications.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: '200px',
              color: isLight ? '#94a3b8' : '#64748b',
              gap: '8px',
              textAlign: 'center'
            }}>
              <Bell size={32} opacity={0.4} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Nenhuma notificação</p>
                <span style={{ fontSize: '0.75rem' }}>Você está em dia com todos os alertas!</span>
              </div>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: item.read 
                    ? (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)')
                    : (isLight ? '#eff6ff' : 'rgba(99, 102, 241, 0.12)'),
                  border: item.read
                    ? (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)')
                    : (isLight ? '1px solid #bfdbfe' : '1px solid rgba(99, 102, 241, 0.35)'),
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  position: 'relative'
                }}
              >
                <div style={{
                  padding: '7px',
                  borderRadius: '8px',
                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: isLight ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  flexShrink: 0
                }}>
                  {getIcon(item.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      fontWeight: item.read ? 600 : 800,
                      color: isLight ? '#0f172a' : '#f8fafc',
                      lineHeight: 1.3
                    }}>
                      {item.title}
                    </h4>
                    <span style={{ fontSize: '0.68rem', color: isLight ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>

                  <p style={{
                    margin: '3px 0 0',
                    fontSize: '0.78rem',
                    lineHeight: '1.4',
                    color: isLight ? '#334155' : '#cbd5e1',
                    wordBreak: 'break-word'
                  }}>
                    {item.body}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#3b82f6',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                          padding: 0
                        }}
                      >
                        <Check size={11} />
                        <span>Lida</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteNotification(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isLight ? '#94a3b8' : '#64748b',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap',
                        padding: 0
                      }}
                      title="Excluir"
                    >
                      <Trash2 size={11} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '10px 16px',
          borderTop: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: isLight ? '#f8fafc' : 'rgba(30, 41, 59, 0.3)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.15)',
              background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
              color: isLight ? '#0f172a' : '#ffffff',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
