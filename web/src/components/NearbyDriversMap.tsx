import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Radio, Car, Star, Navigation, RefreshCw, ShieldCheck, Zap, Maximize2, Heart, User } from 'lucide-react';
import { dbGetAllDrivers, dbSubscribeToDrivers, dbGetDriverPublicProfile } from '../services/dbService';
import { getCurrentPosition, calculateDistanceKm, type Coordinates } from '../services/gpsService';
import type { DriverProfile, DriverPublicProfile } from '../types/auth';

interface NearbyDriversMapProps {
  clientId?: string;
  onSelectDriverToRequest?: () => void;
  onOpenDriverProfile?: (driver: DriverPublicProfile) => void;
  onToggleFavorite?: (driverId: string) => Promise<void>;
  favoriteDriverIds?: string[];
}

export function NearbyDriversMap({ 
  clientId,
  onSelectDriverToRequest,
  onOpenDriverProfile,
  onToggleFavorite,
  favoriteDriverIds = []
}: NearbyDriversMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hasAutoFittedRef = useRef<boolean>(false);

  const [userLocation, setUserLocation] = useState<Coordinates>({ latitude: -19.8157, longitude: -43.9542 }); // Default BH
  const [onlineDrivers, setOnlineDrivers] = useState<DriverProfile[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Função de Auto-Zoom Inteligente: calcula enquadramento ótimo para todos os motoristas + cliente
  const fitMapToAllDrivers = useCallback((isSmooth = true) => {
    if (!mapInstanceRef.current) return;

    const points: [number, number][] = [
      [userLocation.latitude, userLocation.longitude]
    ];

    onlineDrivers.forEach((driver, idx) => {
      const offsetLat = (Math.sin(idx * 1.7) * 0.008) + (idx % 2 === 0 ? 0.003 : -0.004);
      const offsetLng = (Math.cos(idx * 1.7) * 0.009) + (idx % 2 === 0 ? -0.003 : 0.004);
      const driverLat = (driver.currentLat && !isNaN(driver.currentLat)) ? driver.currentLat : (userLocation.latitude + offsetLat);
      const driverLng = (driver.currentLng && !isNaN(driver.currentLng)) ? driver.currentLng : (userLocation.longitude + offsetLng);
      points.push([driverLat, driverLng]);
    });

    if (points.length === 1) {
      mapInstanceRef.current.setView(points[0], 14, { animate: isSmooth });
    } else {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 15,
        animate: isSmooth,
        duration: 0.8
      });
    }
  }, [userLocation, onlineDrivers]);

  // Focar em um motorista específico e abrir o popup
  const focusOnDriver = (driverId: string, lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.0 });
    const marker = driverMarkersRef.current.get(driverId);
    if (marker) {
      setTimeout(() => marker.openPopup(), 600);
    }
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // 1. Obter e monitorar GPS real do Cliente (Sem forçar remontagem do mapa)
  useEffect(() => {
    let watchId: number | null = null;
    getCurrentPosition()
      .then(coords => setUserLocation(coords))
      .catch(() => {});

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 2. Buscar Motoristas com Posições GPS
  const loadDrivers = useCallback(async (isManual = false) => {
    if (isManual) setIsSyncing(true);
    try {
      const all = await dbGetAllDrivers();
      // Filtrar motoristas que estão com modo ONLINE ativo ou credenciados
      const online = all.filter(d => d.isOnline || d.verificationStatus === 'approved');
      const finalDrivers = online.length > 0 ? online : all;
      setOnlineDrivers(finalDrivers);
      setLastSyncTime(new Date());

      // Auto-enquadramento inteligente na primeira carga ou sincronização manual
      if ((!hasAutoFittedRef.current || isManual) && finalDrivers.length > 0) {
        hasAutoFittedRef.current = true;
        setTimeout(() => fitMapToAllDrivers(true), 300);
      }
    } catch (e) {
      console.warn('Erro ao sincronizar motoristas:', e);
    } finally {
      if (isManual) setIsSyncing(false);
    }
  }, [fitMapToAllDrivers]);

  // 3. Inscrição em Tempo Real (Supabase Realtime) + Polling Suave
  useEffect(() => {
    loadDrivers();

    const unsubscribe = dbSubscribeToDrivers(() => {
      loadDrivers();
    });

    const interval = setInterval(() => {
      loadDrivers();
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadDrivers]);

  // 4. Inicializar Mapa Leaflet UMA ÚNICA VEZ (Flicker-Free / Sem piscar)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Já inicializado

    const map = L.map(mapContainerRef.current, {
      center: [userLocation.latitude, userLocation.longitude],
      zoom: 14,
      zoomControl: true,
      fadeAnimation: true,
      markerZoomAnimation: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Criar Marcador Inicial do Passageiro
    const userIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(99, 102, 241, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 18px; height: 18px; border-radius: 50%; background: #6366f1; border: 3px solid #fff; box-shadow: 0 0 12px rgba(99, 102, 241, 0.9);"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const userMarker = L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
      .bindPopup(`<strong>📍 Sua Localização Atual</strong>`)
      .addTo(layerGroup);

    userMarkerRef.current = userMarker;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        driverMarkersRef.current.clear();
      }
    };
  }, []); // Run once on mount

  // 5. Atualizar posição do passageiro de forma suave (Sem recriar o mapa)
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.latitude, userLocation.longitude]);
    }
  }, [userLocation.latitude, userLocation.longitude]);

  // 6. Atualizar Marcadores dos Motoristas Suavemente (Move existentes / Adiciona novos)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const currentDriverIds = new Set<string>();

    onlineDrivers.forEach((driver, idx) => {
      const driverId = driver.id || `driver_${driver.userId || idx}`;
      currentDriverIds.add(driverId);

      const hasExactGps = Boolean(driver.currentLat && driver.currentLng);
      const offsetLat = (Math.sin(idx * 1.7) * 0.008) + (idx % 2 === 0 ? 0.003 : -0.004);
      const offsetLng = (Math.cos(idx * 1.7) * 0.009) + (idx % 2 === 0 ? -0.003 : 0.004);

      const driverLat = (driver.currentLat && !isNaN(driver.currentLat)) ? driver.currentLat : (userLocation.latitude + offsetLat);
      const driverLng = (driver.currentLng && !isNaN(driver.currentLng)) ? driver.currentLng : (userLocation.longitude + offsetLng);

      const dist = calculateDistanceKm(userLocation, { latitude: driverLat, longitude: driverLng });
      const etaMin = Math.max(1, Math.round(Number(dist) * 2.2));
      const driverFullName = driver.fullName || driver.driverName || 'Motorista Parceiro';

      const popupHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 6px; min-width: 210px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; background: #10b981; color: #fff; padding: 2px 7px; border-radius: 6px; font-weight: bold;">
              🟢 ONLINE ${hasExactGps ? '• GPS REAL' : ''}
            </span>
            <span style="font-size: 11px; font-weight: bold; color: #10b981;">~${dist} km</span>
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
            👤 ${driverFullName}
          </div>
          <div style="font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 2px;">
            🚗 ${driver.vehicleBrand || 'Veículo'} ${driver.vehicleModel || 'Particular'}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            Placa: <strong>${driver.vehiclePlate || 'Mercosul'}</strong> (${driver.vehicleColor || 'Prata'})
          </div>
          <div style="font-size: 11px; color: #333; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <span>⭐ ${driver.rating || 5.0} (${driver.totalRides || 0} corridas)</span>
            <span style="color: #6366f1; font-weight: bold;">Chegada: ~${etaMin} min</span>
          </div>
        </div>
      `;

      // Se o marcador já existe, apenas move a posição (setLatLng) suavemente!
      if (driverMarkersRef.current.has(driverId)) {
        const existingMarker = driverMarkersRef.current.get(driverId)!;
        existingMarker.setLatLng([driverLat, driverLng]);
        existingMarker.setPopupContent(popupHtml);
      } else {
        // Criar novo marcador
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
              font-size: 18px;
              cursor: pointer;
            ">
              🚗
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const newMarker = L.marker([driverLat, driverLng], { icon: carIcon })
          .bindPopup(popupHtml)
          .addTo(markersLayerRef.current!);

        driverMarkersRef.current.set(driverId, newMarker);
      }
    });

    // Remover marcadores de motoristas que ficaram offline
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentDriverIds.has(id)) {
        markersLayerRef.current?.removeLayer(marker);
        driverMarkersRef.current.delete(id);
      }
    });
  }, [onlineDrivers, userLocation]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabeçalho do Radar em Tempo Real */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', borderRadius: '14px' }}>
            <Radio size={28} className="animate-pulse" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                Radar de Motoristas em Tempo Real
              </h2>
              <span style={{ fontSize: '0.7rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={11} /> GPS AO VIVO
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Posicionamento geográfico contínuo dos motoristas conectados com auto-enquadramento inteligente.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Botão de Auto-Zoom / Enquadrar Todos */}
          <button
            onClick={() => fitMapToAllDrivers(true)}
            title="Ajustar zoom para enquadrar a maior quantidade possível de motoristas"
            className="btn-outline"
            style={{ fontSize: '0.8rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }}
          >
            <Maximize2 size={14} />
            <span>Auto-Zoom ({onlineDrivers.length})</span>
          </button>

          <button
            onClick={() => loadDrivers(true)}
            disabled={isSyncing}
            className="btn-outline"
            style={{ fontSize: '0.8rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>Sincronizar ({lastSyncTime.toLocaleTimeString()})</span>
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

      {/* Mapa Interativo Estável com Controles de Auto-Zoom */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '20px', position: 'relative', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div 
          ref={mapContainerRef} 
          style={{ width: '100%', height: '480px', background: '#090d16', zIndex: 1 }} 
        />

        {/* Overlay informativo e Botão Flutuante de Auto-Enquadramento */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          zIndex: 500
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '0.8rem',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
            <span><strong>{onlineDrivers.length}</strong> motorista(s) visíveis</span>
          </div>

          <button
            onClick={() => fitMapToAllDrivers(true)}
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '10px',
              padding: '7px 12px',
              fontSize: '0.75rem',
              color: '#818cf8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.92)';
              e.currentTarget.style.color = '#818cf8';
            }}
          >
            <Maximize2 size={13} />
            <span>Enquadrar Visão Geral</span>
          </button>
        </div>
      </div>

      {/* Lista de Motoristas Disponíveis */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#10b981" />
            Motoristas Online no Seu Raio de Atendimento
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Clique no card para focar a câmera no mapa
          </span>
        </div>

        {onlineDrivers.length === 0 ? (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <Radio size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Nenhum motorista online no momento</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '6px auto 16px' }}>
              Ao solicitar uma corrida por hora, todos os motoristas cadastrados receberão uma notificação instantânea.
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
              const driverId = d.id || `driver_${d.userId || index}`;
              const driverLat = (d.currentLat && !isNaN(d.currentLat)) ? d.currentLat : userLocation.latitude;
              const driverLng = (d.currentLng && !isNaN(d.currentLng)) ? d.currentLng : userLocation.longitude;
              const calculatedKm = calculateDistanceKm(userLocation, { latitude: driverLat, longitude: driverLng });
              const estimatedMins = Math.max(1, Math.round(Number(calculatedKm) * 2.2));
              const hasExactGps = Boolean(d.currentLat && d.currentLng);

              const driverDisplayName = d.fullName || d.driverName || 'Motorista Parceiro';
              const isDriverFav = favoriteDriverIds.includes(driverId) || (d.userId ? favoriteDriverIds.includes(d.userId) : false);

              const handleCardOpenProfile = async (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onOpenDriverProfile) {
                  const fullProfile = await dbGetDriverPublicProfile(driverId, clientId);
                  if (fullProfile) {
                    onOpenDriverProfile(fullProfile);
                  }
                }
              };

              const handleCardFavorite = async (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onToggleFavorite) {
                  await onToggleFavorite(d.userId || driverId);
                }
              };

              return (
                <div 
                  key={driverId} 
                  className="glass-panel" 
                  style={{ 
                    padding: '18px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, border-color 0.2s',
                    borderColor: 'rgba(255, 255, 255, 0.08)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
                  onClick={() => focusOnDriver(driverId, driverLat, driverLng)}
                  title="Clique para localizar no mapa"
                >
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
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>👤</span> {driverDisplayName}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                          🚗 {d.vehicleBrand ? `${d.vehicleBrand} ${d.vehicleModel}` : 'Veículo Particular'}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Placa: <strong>{d.vehiclePlate || 'Mercosul'}</strong> • {d.vehicleColor || 'Carro Executivo'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Botão Favoritar no Card */}
                      {onToggleFavorite && (
                        <button
                          onClick={handleCardFavorite}
                          title={isDriverFav ? 'Remover dos favoritos' : 'Favoritar este motorista'}
                          style={{
                            background: isDriverFav ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                            border: isDriverFav ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: isDriverFav ? '#ef4444' : '#fff',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Heart size={14} fill={isDriverFav ? '#ef4444' : 'none'} />
                        </button>
                      )}

                      <span style={{
                        fontSize: '0.7rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontWeight: 700
                      }}>
                        {hasExactGps ? '🟢 GPS Real' : '🟢 Online'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 700 }}>
                      <Star size={14} fill="#f59e0b" />
                      <span>{d.rating || '5.0'}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({d.totalRides || 0} corridas)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                      <Navigation size={13} />
                      <span>~{calculatedKm} km ({estimatedMins} min)</span>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  {onOpenDriverProfile && (
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '2px' }}>
                      <button
                        onClick={handleCardOpenProfile}
                        className="btn-outline"
                        style={{ width: '100%', padding: '7px', fontSize: '0.75rem', justifyContent: 'center' }}
                      >
                        <User size={13} />
                        <span>Ver Ficha Executiva</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
