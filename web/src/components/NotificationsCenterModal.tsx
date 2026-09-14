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

  const isLight = theme === 'light';
  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `Há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Há ${days} d`;
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'ride':
        return <Car size={18} color="#3b82f6" />;
      case 'alert':
        return <ShieldAlert size={18} color="#ef4444" />;
      case 'promo':
        return <Sparkles size={18} color="#f59e0b" />;
      default:
        return <Radio size={18} color="#10b981" />;
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
      padding: '16px'
    }}>
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          padding: '0',
          overflow: 'hidden',
          background: isLight ? '#ffffff' : '#0f172a',
          color: isLight ? '#0f172a' : '#f8fafc',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isLight ? '0 20px 45px rgba(0, 0, 0, 0.15)' : '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
        }}
      >
        {/* Cabeçalho */}
        <div style={{
          padding: '20px 24px',
          borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isLight ? '#f8fafc' : 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              <Bell size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Central de Notificações</h3>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#ef4444',
                    color: '#ffffff'
                  }}>
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                Avisos do sistema, corridas e comunicados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isLight ? '#334155' : '#ffffff'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner para Ativar Notificações no Dispositivo (Muito útil em celulares onde Notification.requestPermission exige toque explícito) */}
        {pushPermission !== 'granted' && onEnablePush && (
          <div style={{
            padding: '12px 20px',
            background: isLight ? '#eff6ff' : 'rgba(59, 130, 246, 0.12)',
            borderBottom: isLight ? '1px solid #dbeafe' : '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Volume2 size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.78rem', lineHeight: 1.3, color: isLight ? '#1e3a8a' : '#bfdbfe' }}>
                <strong>Receber alertas no celular:</strong> Ative as notificações push para não perder avisos importantes mesmo com o app minimizado.
              </div>
            </div>
            <button
              type="button"
              onClick={onEnablePush}
              style={{
                background: '#3b82f6',
                border: 'none',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}
            >
              Ativar
            </button>
          </div>
        )}

        {/* Barra de Ações Rápidas (Marcar todas lidas / Excluir todas) */}
        {notifications.length > 0 && (
          <div style={{
            padding: '10px 20px',
            borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem'
          }}>
            <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
              Total: {notifications.length} notificaç{notifications.length > 1 ? 'ões' : 'ão'}
            </span>

            <div style={{ display: 'flex', gap: '10px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 600,
                    fontSize: '0.78rem'
                  }}
                >
                  <CheckCheck size={15} />
                  <span>Marcar todas lidas</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClearAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isLight ? '#ef4444' : '#f87171',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  fontSize: '0.78rem'
                }}
              >
                <Trash2 size={14} />
                <span>Excluir todas</span>
              </button>
            </div>
          </div>
        )}

        {/* Lista de Notificações */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '260px',
          maxHeight: '52vh'
        }}>
          {notifications.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: '220px',
              color: isLight ? '#94a3b8' : '#64748b',
              gap: '10px',
              textAlign: 'center'
            }}>
              <Bell size={36} opacity={0.4} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Nenhuma notificação por aqui</p>
                <span style={{ fontSize: '0.78rem' }}>Você está em dia com todos os alertas e comunicados!</span>
              </div>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: item.read 
                    ? (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)')
                    : (isLight ? '#f1f5f9' : 'rgba(99, 102, 241, 0.12)'),
                  border: item.read
                    ? (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)')
                    : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(99, 102, 241, 0.35)'),
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  position: 'relative',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  flexShrink: 0
                }}>
                  {getIcon(item.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '0.9rem',
                      fontWeight: item.read ? 600 : 800,
                      color: isLight ? '#0f172a' : '#f8fafc'
                    }}>
                      {item.title}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: isLight ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>

                  <p style={{
                    margin: 0,
                    fontSize: '0.82rem',
                    lineHeight: '1.45',
                    color: isLight ? '#334155' : '#cbd5e1',
                    wordBreak: 'break-word'
                  }}>
                    {item.body}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#3b82f6',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Check size={12} />
                        <span>Marcar como lida</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteNotification(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isLight ? '#94a3b8' : '#64748b',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                      title="Excluir notificação"
                    >
                      <Trash2 size={12} />
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
          padding: '12px 20px',
          borderTop: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: isLight ? '#f8fafc' : 'rgba(30, 41, 59, 0.3)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.15)',
              background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
              color: isLight ? '#0f172a' : '#ffffff',
              fontWeight: 600,
              fontSize: '0.82rem',
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
