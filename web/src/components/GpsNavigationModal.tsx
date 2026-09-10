import React, { useState } from 'react';
import { Navigation, X, Check, ExternalLink, MapPin } from 'lucide-react';
import { 
  getDriverPreferredGps, 
  setDriverPreferredGps, 
  launchNavigationApp 
} from '../services/gpsNavigationService';

interface GpsNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationAddress: string;
  destinationLabel?: string;
  coords?: { lat: number; lng: number };
  onNavigateStarted?: () => void;
}

export const GpsNavigationModal: React.FC<GpsNavigationModalProps> = ({
  isOpen,
  onClose,
  destinationAddress,
  destinationLabel = 'Destino',
  coords,
  onNavigateStarted
}) => {
  const currentSaved = getDriverPreferredGps();
  const [selectedApp, setSelectedApp] = useState<'waze' | 'google_maps' | 'apple_maps'>(
    currentSaved === 'ask' ? 'waze' : (currentSaved as any)
  );
  const [rememberPreference, setRememberPreference] = useState(currentSaved !== 'ask');

  if (!isOpen) return null;

  const handleStartNavigation = () => {
    if (rememberPreference) {
      setDriverPreferredGps(selectedApp);
    } else {
      setDriverPreferredGps('ask');
    }

    launchNavigationApp(destinationAddress, selectedApp, coords);
    if (onNavigateStarted) onNavigateStarted();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 22, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '28px',
        borderRadius: '24px',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
            }}>
              <Navigation size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Navegação GPS em Tempo Real
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#a5b4fc' }}>
                Selecione o aplicativo para iniciar a rota
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#cbd5e1',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Local de Destino */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <MapPin size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {destinationLabel}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, marginTop: '2px', lineHeight: 1.4 }}>
              {destinationAddress}
            </div>
          </div>
        </div>

        {/* Opções de GPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* Opção 1: Waze */}
          <div
            onClick={() => setSelectedApp('waze')}
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              cursor: 'pointer',
              border: selectedApp === 'waze' ? '2px solid #33ccff' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedApp === 'waze' ? 'rgba(51, 204, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#33ccff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 4px 12px rgba(51, 204, 255, 0.4)'
              }}>
                🚙
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '1rem', color: '#fff' }}>Waze</strong>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: 'rgba(51, 204, 255, 0.25)',
                    color: '#33ccff',
                    padding: '2px 8px',
                    borderRadius: '8px'
                  }}>
                    Recomendado
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Alertas de trânsito em tempo real, radares e rota rápida.
                </div>
              </div>
            </div>

            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              border: selectedApp === 'waze' ? '2px solid #33ccff' : '2px solid rgba(255, 255, 255, 0.3)',
              background: selectedApp === 'waze' ? '#33ccff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000'
            }}>
              {selectedApp === 'waze' && <Check size={14} strokeWidth={3} />}
            </div>
          </div>

          {/* Opção 2: Google Maps */}
          <div
            onClick={() => setSelectedApp('google_maps')}
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              cursor: 'pointer',
              border: selectedApp === 'google_maps' ? '2px solid #4285f4' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedApp === 'google_maps' ? 'rgba(66, 133, 244, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4285f4, #34a853)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 4px 12px rgba(66, 133, 244, 0.4)'
              }}>
                🗺️
              </div>
              <div>
                <strong style={{ fontSize: '1rem', color: '#fff' }}>Google Maps</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Navegação oficial passo a passo com fotos e satélite.
                </div>
              </div>
            </div>

            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              border: selectedApp === 'google_maps' ? '2px solid #4285f4' : '2px solid rgba(255, 255, 255, 0.3)',
              background: selectedApp === 'google_maps' ? '#4285f4' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              {selectedApp === 'google_maps' && <Check size={14} strokeWidth={3} />}
            </div>
          </div>

          {/* Opção 3: Apple Maps */}
          <div
            onClick={() => setSelectedApp('apple_maps')}
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              cursor: 'pointer',
              border: selectedApp === 'apple_maps' ? '2px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedApp === 'apple_maps' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                🍎
              </div>
              <div>
                <strong style={{ fontSize: '1rem', color: '#fff' }}>Apple Maps</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Navegação nativa integrada para aparelhos iPhone/iOS.
                </div>
              </div>
            </div>

            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              border: selectedApp === 'apple_maps' ? '2px solid #a855f7' : '2px solid rgba(255, 255, 255, 0.3)',
              background: selectedApp === 'apple_maps' ? '#a855f7' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              {selectedApp === 'apple_maps' && <Check size={14} strokeWidth={3} />}
            </div>
          </div>
        </div>

        {/* Lembrar Preferência */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          padding: '8px 4px',
          marginBottom: '20px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)'
        }}>
          <input
            type="checkbox"
            checked={rememberPreference}
            onChange={(e) => setRememberPreference(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
          />
          <span>Lembrar minha escolha para as próximas corridas</span>
        </label>

        {/* Botão de Ação Principal */}
        <button
          type="button"
          onClick={handleStartNavigation}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            borderRadius: '16px'
          }}
        >
          <ExternalLink size={18} />
          <span>Iniciar Navegação no {selectedApp === 'waze' ? 'Waze' : selectedApp === 'google_maps' ? 'Google Maps' : 'Apple Maps'}</span>
        </button>
      </div>
    </div>
  );
};
