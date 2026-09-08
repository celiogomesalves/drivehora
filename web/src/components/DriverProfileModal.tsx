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
}

export function DriverProfileModal({ 
  driver, 
  onClose, 
  onToggleFavorite, 
  onRequestDirectRide 
}: DriverProfileModalProps) {
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isFav, setIsFav] = useState(driver?.isFavorite || false);

  if (!driver) return null;

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
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '0',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Cabeçalho com Banner & Botão Fechar */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(16, 185, 129, 0.2) 100%)',
          padding: '24px 24px 16px 24px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={13} /> MOTORISTA CREDENCIADO
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Botão Favoritar */}
            <button
              onClick={handleFavoriteClick}
              disabled={isFavoriting}
              title={isFav ? 'Remover dos favoritos' : 'Favoritar este motorista'}
              style={{
                background: isFav ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: isFav ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: isFav ? '#ef4444' : '#fff',
                width: '38px',
                height: '38px',
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
              <Heart size={18} fill={isFav ? '#ef4444' : 'none'} />
            </button>

            {/* Botão Fechar */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                width: '38px',
                height: '38px',
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
        <div style={{ padding: '0 24px 24px 24px' }}>
          <div style={{ display: 'flex', gap: '18px', marginTop: '-30px', alignItems: 'flex-end', marginBottom: '18px' }}>
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: '3px solid #090d16',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              color: '#fff',
              flexShrink: 0
            }}>
              {driver.selfieUrl ? (
                <img 
                  src={driver.selfieUrl} 
                  alt={driver.displayName} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                '🚗'
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {driver.displayName}
                </h3>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 6px' }}>
                {driver.memberSince} • Categoria Executiva
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 700 }}>
                  <Star size={14} fill="#f59e0b" />
                  <span>{driver.rating ? Number(driver.rating).toFixed(1) : '5.0'}</span>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <strong>{driver.totalRides || 0}</strong> corridas realizadas
                </span>
              </div>
            </div>
          </div>

          {/* Bio do Motorista */}
          {driver.bio && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '0.85rem',
              color: '#cbd5e1',
              lineHeight: '1.45',
              marginBottom: '18px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              "{driver.bio}"
            </div>
          )}

          {/* Ficha do Veículo */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '18px'
          }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Car size={15} color="#818cf8" /> Detalhes do Veículo Executivo
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Modelo</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                  {driver.vehicleBrand} {driver.vehicleModel}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ano / Cor</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {driver.vehicleYear} • {driver.vehicleColor}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Placa</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                  {driver.vehiclePlate}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status GPS</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: driver.isOnline ? '#10b981' : 'var(--text-muted)' }}>
                  {driver.isOnline ? '🟢 Online no Radar' : '⚪ Offline no momento'}
                </div>
              </div>
            </div>
          </div>

          {/* Comodidades a Bordo */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 700, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#f59e0b" /> Comodidades e Diferenciais
            </h4>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {driver.amenities.map((item, idx) => (
                <span 
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#e2e8f0'
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Selos de Confiança e Vetting */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '20px'
          }}>
            <UserCheck size={24} color="#10b981" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
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
    </div>
  );
}
