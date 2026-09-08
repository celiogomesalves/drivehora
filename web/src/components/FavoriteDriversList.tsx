import { useState, useEffect } from 'react';
import { 
  Heart, Star, Calendar, Zap, ArrowRight 
} from 'lucide-react';
import type { DriverPublicProfile } from '../types/auth';
import { dbGetFavoriteDrivers, dbToggleFavoriteDriver } from '../services/dbService';

interface FavoriteDriversListProps {
  clientId: string;
  onOpenDriverProfile: (driver: DriverPublicProfile) => void;
  onSelectDriverForBooking: (driver: DriverPublicProfile) => void;
  onExploreRadar: () => void;
}

export function FavoriteDriversList({
  clientId,
  onOpenDriverProfile,
  onSelectDriverForBooking,
  onExploreRadar
}: FavoriteDriversListProps) {
  const [favorites, setFavorites] = useState<DriverPublicProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const list = await dbGetFavoriteDrivers(clientId);
      setFavorites(list);
    } catch (e) {
      console.warn('Erro ao carregar favoritos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [clientId]);

  const handleToggleFavorite = async (driverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await dbToggleFavoriteDriver(clientId, driverId);
    setFavorites(prev => prev.filter(d => d.id !== driverId && d.userId !== driverId));
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#818cf8', fontWeight: 600 }}>Carregando seus motoristas favoritos...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Superior da Lista VIP */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', borderRadius: '14px' }}>
            <Heart size={28} fill="#ef4444" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                Meus Motoristas Favoritos (VIP)
              </h2>
              <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                {favorites.length} FAVORITO(S)
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Sua rede particular de confiança para viagens imediatas ou agendamentos exclusivos.
            </p>
          </div>
        </div>

        <button
          onClick={onExploreRadar}
          className="btn-outline"
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Zap size={15} color="#10b981" />
          <span>Explorar no Radar</span>
        </button>
      </div>

      {/* Lista de Cards de Favoritos */}
      {favorites.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Heart size={32} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>
            Você ainda não favoritou nenhum motorista
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 20px' }}>
            Ao visualizar os motoristas no <strong>Radar</strong> ou ao término de suas corridas, clique no ícone de coração para adicioná-los à sua lista VIP e agendar diretamente com eles.
          </p>
          <button 
            onClick={onExploreRadar}
            className="btn-primary"
            style={{ padding: '10px 22px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Ver Motoristas no Radar</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {favorites.map((driver) => (
            <div
              key={driver.id || driver.userId}
              className="glass-panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => onOpenDriverProfile(driver)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Topo do Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    minWidth: '50px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    color: '#fff',
                    flexShrink: 0
                  }}>
                    {driver.selfieUrl ? (
                      <img src={driver.selfieUrl} alt={driver.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '🚗'
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <h4 
                      style={{ 
                        fontSize: '1rem', 
                        fontWeight: 800, 
                        margin: 0, 
                        color: '#fff', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}
                      title={driver.displayName}
                    >
                      {driver.displayName}
                    </h4>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        color: '#94a3b8', 
                        display: 'block', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}
                    >
                      {driver.vehicleBrand} {driver.vehicleModel}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.75rem' }}>
                      <span style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Star size={12} fill="#f59e0b" /> {driver.rating ? Number(driver.rating).toFixed(1) : '5.0'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>{driver.totalRides || 0} corridas</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleToggleFavorite(driver.userId || driver.id, e)}
                  title="Remover dos favoritos"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <Heart size={15} fill="#ef4444" />
                </button>
              </div>

              {/* Status Online & Comodidades */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: driver.isOnline ? '#10b981' : 'var(--text-muted)', fontWeight: 700 }}>
                  {driver.isOnline ? '🟢 Online no Radar' : '⚪ Offline no momento'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Placa: <strong>{driver.vehiclePlate}</strong>
                </span>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDriverProfile(driver);
                  }}
                  className="btn-outline"
                  style={{ flex: 1, padding: '8px', fontSize: '0.8rem', justifyContent: 'center' }}
                >
                  Ficha Completa
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDriverForBooking(driver);
                  }}
                  className="btn-primary"
                  style={{ flex: 1.3, padding: '8px', fontSize: '0.8rem', justifyContent: 'center' }}
                >
                  <Calendar size={14} />
                  <span>Agendar com Ele</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
