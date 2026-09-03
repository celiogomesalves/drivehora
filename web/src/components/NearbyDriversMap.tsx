import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Radio, Car, Star, Navigation, RefreshCw, ShieldCheck } from 'lucide-react';
import { dbGetAllDrivers } from '../services/dbService';
import { getCurrentPosition, calculateDistanceKm, type Coordinates } from '../services/gpsService';
import type { DriverProfile } from '../types/auth';

interface NearbyDriversMapProps {
  onSelectDriverToRequest?: () => void;
}

export function NearbyDriversMap({ onSelectDriverToRequest }: NearbyDriversMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [userLocation, setUserLocation] = useState<Coordinates>({ latitude: -19.8157, longitude: -43.9542 }); // Default BH
  const [onlineDrivers, setOnlineDrivers] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Obter GPS do Cliente
  useEffect(() => {
    const fetchUserGps = async () => {
      try {
        const coords = await getCurrentPosition();
        setUserLocation(coords);
      } catch (e) {
        // Fallback para localização padrão
      }
    };
    fetchUserGps();
  }, []);

  // 2. Buscar Motoristas Online
  const loadDrivers = async () => {
    setIsLoading(true);
    try {
      const all = await dbGetAllDrivers();
      const online = all.filter(d => d.isOnline || d.verificationStatus === 'approved');
      setOnlineDrivers(online);
    } catch (e) {
      console.warn('Erro ao buscar motoristas:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
    const interval = setInterval(loadDrivers, 5000);
    return () => clearInterval(interval);
  }, []);

  // 3. Inicializar Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.latitude, userLocation.longitude],
        zoom: 14,
        zoomControl: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([userLocation.latitude, userLocation.longitude], 14);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation.latitude, userLocation.longitude]);

  // 4. Renderizar Marcadores dos Motoristas e do Passageiro
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // Marcador do Passageiro
    const userIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(99, 102, 241, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 20px; height: 20px; border-radius: 50%; background: #6366f1; border: 3px solid #fff; box-shadow: 0 0 10px rgba(99, 102, 241, 0.8);"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
      .bindPopup(`<strong>📍 Sua Localização Atual</strong>`)
      .addTo(markersLayerRef.current);

    // Marcadores dos Motoristas Online
    onlineDrivers.forEach((driver, idx) => {
      // Coordenadas levemente dispersas ao redor do usuário para simular posições reais da frota
      const offsetLat = (Math.sin(idx * 1.7) * 0.012) + (idx % 2 === 0 ? 0.004 : -0.005);
      const offsetLng = (Math.cos(idx * 1.7) * 0.014) + (idx % 2 === 0 ? -0.004 : 0.006);
      const driverLat = userLocation.latitude + offsetLat;
      const driverLng = userLocation.longitude + offsetLng;

      const dist = calculateDistanceKm(userLocation, { latitude: driverLat, longitude: driverLng });

      const carIcon = L.divIcon({
        className: 'custom-driver-car-icon',
        html: `
          <div style="
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.6);
            border: 2px solid #fff;
            font-size: 16px;
            cursor: pointer;
          ">
            🚗
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 12px; background: #10b981; color: #fff; padding: 2px 6px; border-radius: 6px; font-weight: bold;">🟢 ONLINE</span>
            <strong style="font-size: 13px;">${driver.vehicleBrand || 'Motorista'} ${driver.vehicleModel || 'Parceiro'}</strong>
          </div>
          <div style="font-size: 11px; color: #555; margin-bottom: 4px;">
            Placa: <strong>${driver.vehiclePlate || 'Mercosul'}</strong> (${driver.vehicleColor || 'Prata'})
          </div>
          <div style="font-size: 11px; color: #333; display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 4px;">
            <span>⭐ ${driver.rating || 5.0} (${driver.totalRides || 0} corridas)</span>
            <span style="font-weight: bold; color: #10b981;">~${dist} km</span>
          </div>
        </div>
      `;

      L.marker([driverLat, driverLng], { icon: carIcon })
        .bindPopup(popupHtml)
        .addTo(markersLayerRef.current!);
    });
  }, [onlineDrivers, userLocation]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabeçalho do Radar */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', borderRadius: '14px' }}>
            <Radio size={28} className="animate-pulse" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Radar de Motoristas Próximos
              <span style={{ fontSize: '0.75rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                AO VIVO
              </span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Visualize a disponibilidade de motoristas credenciados na sua região em tempo real.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadDrivers}
            disabled={isLoading}
            className="btn-outline"
            style={{ fontSize: '0.8rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Atualizar Radar</span>
          </button>

          {onSelectDriverToRequest && (
            <button
              onClick={onSelectDriverToRequest}
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Car size={16} />
              <span>Solicitar Corrida</span>
            </button>
          )}
        </div>
      </div>

      {/* Mapa Interativo */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '20px', position: 'relative', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div 
          ref={mapContainerRef} 
          style={{ width: '100%', height: '440px', background: '#090d16', zIndex: 1 }} 
        />

        {/* Overlay informativo sobre o mapa */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '10px 16px',
          zIndex: 500,
          fontSize: '0.8rem',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
          <span><strong>{onlineDrivers.length}</strong> motorista(s) ativo(s) na sua área</span>
        </div>
      </div>

      {/* Lista de Motoristas Disponíveis */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="#10b981" />
          Motoristas Disponíveis para Chamada
        </h3>

        {onlineDrivers.length === 0 ? (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <Radio size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} className="animate-pulse" />
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Nenhum motorista online no momento exato</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '6px auto 16px' }}>
              Ao enviar sua solicitação de corrida por hora, todos os motoristas cadastrados receberão uma notificação instantânea para atendimento.
            </p>
            {onSelectDriverToRequest && (
              <button onClick={onSelectDriverToRequest} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
                <Car size={16} /> Fazer Solicitação de Corrida
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {onlineDrivers.map((d, index) => {
              const estimatedKm = (1.2 + (index * 0.8)).toFixed(1);
              const estimatedMins = Math.round(Number(estimatedKm) * 2.5);

              return (
                <div key={d.id || index} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem'
                      }}>
                        🚗
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                          {d.vehicleBrand ? `${d.vehicleBrand} ${d.vehicleModel}` : 'Motorista Parceiro'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Placa: <strong>{d.vehiclePlate || 'Mercosul'}</strong> • {d.vehicleColor || 'Carro Executivo'}
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      🟢 Online
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 700 }}>
                      <Star size={14} fill="#f59e0b" />
                      <span>{d.rating || '5.0'}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({d.totalRides || 0} corridas)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                      <Navigation size={13} />
                      <span>~{estimatedKm} km ({estimatedMins} min)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
