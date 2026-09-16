import { useState } from 'react';
import { 
  X, Star, ShieldCheck, Heart, Car, 
  CheckCircle2, Sparkles, UserCheck 
} from 'lucide-react';
import type { DriverPublicProfile } from '../types/auth';

interface DriverProfileModalProps {
  driver: DriverPublicProfile | null;
  onClose: () => void;
  onToggleFavorite?: (driverId: string) => Promise<void>;
  onRequestDirectRide?: (driver: DriverPublicProfile) => void;
  theme?: 'light' | 'dark';
}

export function DriverProfileModal({ 
  driver, 
  onClose, 
  onToggleFavorite, 
  onRequestDirectRide,
  theme = 'dark'
}: DriverProfileModalProps) {
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isFav, setIsFav] = useState(driver?.isFavorite || false);
  const [showPhotoZoom, setShowPhotoZoom] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  if (!driver) return null;

  const isLight = theme === 'light';

  const handleFavoriteClick = async () => {
    if (isFavoriting) return;
    setIsFavoriting(true);
    setIsFav(!isFav);
    try {
      if (onToggleFavorite) {
        await onToggleFavorite(driver.userId || driver.id);
      }
    } finally {
      setIsFavoriting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div 
        className="glass-panel" 
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '0',
          background: isLight ? '#ffffff' : '#0f172a',
          color: isLight ? '#0f172a' : '#f8fafc',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isLight ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Banner Superior & Ações (Favoritar e Fechar) */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #4f46e5 0%, #059669 100%)',
          padding: '20px 24px 45px 24px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            background: 'rgba(0, 0, 0, 0.3)',
            color: '#ffffff',
            padding: '4px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <ShieldCheck size={14} color="#34d399" />
            <span>MOTORISTA CREDENCIADO</span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Botão Favoritar */}
            <button
              onClick={handleFavoriteClick}
              disabled={isFavoriting}
              title={isFav ? 'Remover dos favoritos' : 'Favoritar este motorista'}
              style={{
                background: isFav ? 'rgba(239, 68, 68, 0.85)' : 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            >
              <Heart size={18} fill={isFav ? '#ffffff' : 'none'} color="#ffffff" />
            </button>

            {/* Botão Fechar */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Informações Principais do Motorista */}
        <div style={{ padding: '16px 20px 20px 20px', position: 'relative' }}>
          {/* Card com Foto e Nome (sem colisão nem sobreposição com o banner) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '18px',
              background: '#0f172a',
              border: isLight ? '2px solid #e2e8f0' : '2px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              color: '#fff',
              flexShrink: 0
            }}>
              {driver.selfieUrl ? (
                <img 
                  src={driver.profilePhotoUrl || driver.selfieUrl} 
                  alt={driver.displayName} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => setShowPhotoZoom(true)}
                  title="Clique para ampliar"
                />
              ) : (
                '🚗'
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  margin: 0,
                  color: isLight ? '#0f172a' : '#ffffff',
                  whiteSpace: 'nowrap'
                }}>
                  {driver.displayName ? driver.displayName.trim().split(/\s+/).slice(0, 2).join(' ') : 'Motorista'}
                </h3>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
              </div>

              <p style={{
                fontSize: '0.78rem',
                color: isLight ? '#64748b' : '#94a3b8',
                margin: '2px 0 5px',
                fontWeight: 500
              }}>
                {driver.memberSince || 'Membro'} • Categoria Executiva
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f59e0b', fontWeight: 800 }}>
                  <Star size={14} fill="#f59e0b" />
                  <span>{driver.rating ? Number(driver.rating).toFixed(1) : '5.0'}</span>
                </div>
                <span style={{ color: isLight ? '#cbd5e1' : '#475569' }}>•</span>
                <span style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                  <strong>{driver.totalRides || 0}</strong> corridas
                </span>
              </div>
            </div>
          </div>

          {/* Bio do Motorista (Contraste adaptativo garantido) */}
          {driver.bio && (
            <div style={{
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '0.85rem',
              color: isLight ? '#334155' : '#e2e8f0',
              lineHeight: '1.5',
              marginBottom: '18px',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
              fontStyle: 'italic'
            }}>
              "{driver.bio}"
            </div>
          )}

          {/* Ficha do Veículo */}
          <div style={{
            background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)',
            borderRadius: '16px',
            padding: '16px',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                color: isLight ? '#475569' : '#94a3b8',
                letterSpacing: '0.05em',
                fontWeight: 800,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Car size={15} color="#6366f1" /> Detalhes do Veículo
              </h4>
              {driver.vehicleCategory && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '3px 10px',
                  borderRadius: '8px',
                  background: isLight ? '#e0e7ff' : 'rgba(99, 102, 241, 0.2)',
                  color: isLight ? '#3730a3' : '#a5b4fc',
                  fontWeight: 700,
                  textTransform: 'capitalize'
                }}>
                  Categoria: {driver.vehicleCategory}
                </span>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', display: 'block', marginBottom: '2px' }}>Modelo</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>
                  {driver.vehicleBrand} {driver.vehicleModel}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', display: 'block', marginBottom: '2px' }}>Ano / Cor</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isLight ? '#1e293b' : '#e2e8f0' }}>
                  {driver.vehicleYear} • {driver.vehicleColor}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', display: 'block', marginBottom: '2px' }}>Placa</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                  {driver.vehiclePlate}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', display: 'block', marginBottom: '2px' }}>Status GPS</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: driver.isOnline ? '#10b981' : (isLight ? '#64748b' : '#94a3b8') }}>
                  {driver.isOnline ? '🟢 Online no Radar' : '⚪ Offline no momento'}
                </div>
              </div>
            </div>
          </div>

          {/* Comodidades a Bordo */}
          {driver.amenities && driver.amenities.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                color: isLight ? '#475569' : '#94a3b8',
                letterSpacing: '0.05em',
                fontWeight: 800,
                margin: '0 0 10px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Sparkles size={14} color="#f59e0b" /> Comodidades e Diferenciais
              </h4>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {driver.amenities.map((item, idx) => (
                  <span 
                    key={idx}
                    style={{
                      background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isLight ? '#1e293b' : '#e2e8f0'
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Selos de Confiança e Vetting (Excelente contraste em fundo claro) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.08)',
            border: isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '20px'
          }}>
            <UserCheck size={24} color="#059669" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', color: isLight ? '#065f46' : '#a7f3d0', lineHeight: 1.4 }}>
              Documentação e antecedentes rigorosamente verificados pela equipe de segurança <strong>DriveHora</strong>.
            </div>
          </div>

          {/* Botão de Ação: Contratar ou Agendar Direto */}
          {onRequestDirectRide && (
            <button
              onClick={() => {
                onRequestDirectRide(driver);
                onClose();
              }}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '0.95rem',
                fontWeight: 800,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)'
              }}
            >
              <Car size={18} />
              <span>Solicitar ou Agendar com {driver.displayName.split(' ')[0]}</span>
            </button>
          )}
        </div>
      </div>

      {/* MODAL DE ZOOM NA FOTO */}
      {showPhotoZoom && (driver.profilePhotoUrl || driver.selfieUrl) && (
        <div
          onClick={() => { setShowPhotoZoom(false); setZoomScale(1); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
            padding: '20px'
          }}
        >
          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 2001 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setZoomScale(s => Math.min(s + 0.5, 4)); }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >+</button>
            <button
              onClick={(e) => { e.stopPropagation(); setZoomScale(s => Math.max(s - 0.5, 0.5)); }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >−</button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowPhotoZoom(false); setZoomScale(1); }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            ><X size={20} /></button>
          </div>
          <img
            src={driver.profilePhotoUrl || driver.selfieUrl}
            alt={driver.displayName}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              transform: `scale(${zoomScale})`,
              transition: 'transform 0.3s ease',
              cursor: zoomScale > 1 ? 'grab' : 'zoom-in'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '20px',
            padding: '6px 16px',
            fontSize: '0.8rem',
            color: '#fff',
            fontWeight: 600
          }}>
            {driver.displayName} • Toque fora para fechar
          </div>
        </div>
      )}
    </div>
  );
}
