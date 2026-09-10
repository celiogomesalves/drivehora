import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Car, Clock, Navigation, Crosshair } from 'lucide-react';
import type { DbRide } from '../services/dbService';
import { dbGetDriverProfile, dbSubscribeToDrivers } from '../services/dbService';
import { fetchRouteGeometry } from '../services/gpsService';
import { formatCurrency } from '../utils/formatters';

interface LiveRideTrackerMapProps {
  ride: DbRide;
}

export function LiveRideTrackerMap({ ride }: LiveRideTrackerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const lastRouteFetchCoordsRef = useRef<{ startLat: number; startLng: number; endLat: number; endLng: number } | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [realDriverCoords, setRealDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [lastGpsPingTime, setLastGpsPingTime] = useState<number>(0);
  const [secondsSincePing, setSecondsSincePing] = useState<number | null>(null);
  const [isAutoFollow, setIsAutoFollow] = useState(true);

  // Fases: 'to_pickup' = motorista a caminho do passageiro; 'in_progress' = corrida iniciada até o destino
  const isToPickup = ride.status === 'to_pickup' || ride.status === 'accepted';
  const isArrived = ride.status === 'arrived_at_pickup';
  const isInProgress = ride.status === 'in_progress';

  // Coordenadas reais da corrida
  const originLat = ride.originLat;
  const originLng = ride.originLng;
  const destLat = ride.destLat;
  const destLng = ride.destLng;

  // 1. Cronômetro da Viagem: A corrida de fato SÓ começa a ser contabilizada quando o motorista inicia a corrida até o destino!
  useEffect(() => {
    if (!isInProgress || !ride.startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - (ride.startedAt || Date.now())) / 1000);
      setElapsedSeconds(sec > 0 ? sec : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [ride.startedAt, isInProgress]);

  // 2. Contador de segundos desde o último ping do GPS
  useEffect(() => {
    if (!lastGpsPingTime) {
      setSecondsSincePing(null);
      return;
    }
    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - lastGpsPingTime) / 1000));
      setSecondsSincePing(diff);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [lastGpsPingTime]);

  // 3. Monitoramento em Tempo Real do GPS Real do Motorista (Eventos Locais + Supabase Realtime + Polling Rápido)
  useEffect(() => {
    const targetDriverId = ride.driverId;
    if (!targetDriverId) return;

    let isMounted = true;

    // A) Checagem inicial no cache local de GPS rápido
    try {
      const cached = localStorage.getItem(`drivehora_live_driver_gps_${targetDriverId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cLat = Number(parsed.latitude ?? parsed.lat);
        const cLng = Number(parsed.longitude ?? parsed.lng);
        if (!isNaN(cLat) && !isNaN(cLng) && cLat !== 0) {
          setRealDriverCoords({ lat: cLat, lng: cLng });
          setLastGpsPingTime(parsed.updatedAt || Date.now());
        }
      }
    } catch {}

    // Função de busca no banco Supabase
    const fetchDriverGps = async () => {
      try {
        const dp = await dbGetDriverProfile(targetDriverId);
        if (dp && dp.currentLat && dp.currentLng && isMounted) {
          const lat = Number(dp.currentLat);
          const lng = Number(dp.currentLng);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
            setRealDriverCoords({ lat, lng });
            setLastGpsPingTime(Date.now());
          }
        }
      } catch {}
    };

    fetchDriverGps();

    // B) Ouvir eventos de GPS do motorista disparados na mesma janela/navegador (Cross-component)
    const handleDriverGpsEvent = (e: any) => {
      if (!isMounted) return;
      const detail = e.detail;
      if (detail && (detail.userId === targetDriverId || detail.driverId === targetDriverId)) {
        const lat = Number(detail.coords?.latitude ?? detail.coords?.lat);
        const lng = Number(detail.coords?.longitude ?? detail.coords?.lng);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
          setRealDriverCoords({ lat, lng });
          setLastGpsPingTime(Date.now());
        }
      }
    };
    window.addEventListener('drivehora_driver_gps_updated', handleDriverGpsEvent);

    // C) Ouvir mudanças no localStorage de outras abas (Cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (!isMounted) return;
      if (e.key === `drivehora_live_driver_gps_${targetDriverId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const lat = Number(parsed.latitude ?? parsed.lat);
          const lng = Number(parsed.longitude ?? parsed.lng);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
            setRealDriverCoords({ lat, lng });
            setLastGpsPingTime(parsed.updatedAt || Date.now());
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // D) Supabase Realtime Channel na tabela 'drivers'
    const unsubscribeDb = dbSubscribeToDrivers(() => {
      if (isMounted) fetchDriverGps();
    });

    // E) Polling de alta frequência como garantia sólida (a cada 2.5s)
    const interval = setInterval(fetchDriverGps, 2500);

    return () => {
      isMounted = false;
      window.removeEventListener('drivehora_driver_gps_updated', handleDriverGpsEvent);
      window.removeEventListener('storage', handleStorageChange);
      unsubscribeDb();
      clearInterval(interval);
    };
  }, [ride.driverId]);

  // 4. Inicialização única do Leaflet Map (NÃO recriar em cada re-render)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = originLat || -19.9245;
    const initialLng = originLng || -43.9352;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: true,
      fadeAnimation: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Tratar renderização inicial e redimensionamento de container
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      driverMarkerRef.current = null;
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      routeLineRef.current = null;
    };
  }, []);

  // 5. Atualização Incremental e Fluida dos Marcadores (Embarque, Destino e Carro do Motorista)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // A) Marcador do Ponto de Embarque
    if (originLat && originLng) {
      if (!originMarkerRef.current) {
        const originIcon = L.divIcon({
          className: 'origin-marker',
          html: `
            <div style="background: #6366f1; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; border: 2.5px solid #fff; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.75);">
              📍
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        originMarkerRef.current = L.marker([originLat, originLng], { icon: originIcon })
          .bindPopup(`<strong>Ponto de Embarque:</strong><br/>${ride.origin}`)
          .addTo(map);
      } else {
        originMarkerRef.current.setLatLng([originLat, originLng]);
      }
    }

    // B) Marcador do Destino Final (Apenas quando a corrida estiver iniciada até o destino)
    if (destLat && destLng && isInProgress) {
      if (!destMarkerRef.current) {
        const destIcon = L.divIcon({
          className: 'dest-marker',
          html: `
            <div style="background: #10b981; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; border: 2.5px solid #fff; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.75);">
              🏁
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon })
          .bindPopup(`<strong>Destino Final:</strong><br/>${ride.destination}`)
          .addTo(map);
      } else {
        destMarkerRef.current.setLatLng([destLat, destLng]);
      }
    } else if (!isInProgress && destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // C) Marcador do Motorista (Carro com Brilho Dinâmico e Posicionamento Exato em Tempo Real)
    // Se o motorista chegou ao embarque, a posição física é exatamente no embarque
    const effectiveDriverCoords = isArrived && originLat && originLng
      ? { lat: originLat, lng: originLng }
      : realDriverCoords
      ? realDriverCoords
      : originLat && originLng
      ? { lat: originLat, lng: originLng }
      : null;

    if (effectiveDriverCoords) {
      const carBg = isToPickup ? 'linear-gradient(135deg, #f59e0b, #d97706)' : isArrived ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #10b981, #059669)';
      const carGlow = isToPickup ? 'rgba(245, 158, 11, 0.95)' : isArrived ? 'rgba(99, 102, 241, 0.95)' : 'rgba(16, 185, 129, 0.95)';

      const carIcon = L.divIcon({
        className: 'live-driver-car',
        html: `
          <div style="
            background: ${carBg};
            color: #fff;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 0 22px ${carGlow};
            border: 2.5px solid #fff;
            transition: transform 0.4s ease;
          ">
            🚗
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const popupText = `<strong>${ride.driverName || 'Motorista Parceiro'}</strong><br/>` +
        (isArrived ? 'Aguardando embarque no ponto de partida' : isToPickup ? 'Em deslocamento até o passageiro' : 'Corrida em andamento com passageiro');

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([effectiveDriverCoords.lat, effectiveDriverCoords.lng], { icon: carIcon })
          .bindPopup(popupText)
          .addTo(map);

        // Primeiro enquadramento inteligente
        if (originLat && originLng) {
          const bounds = L.latLngBounds([
            [effectiveDriverCoords.lat, effectiveDriverCoords.lng],
            [originLat, originLng]
          ]);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        } else {
          map.setView([effectiveDriverCoords.lat, effectiveDriverCoords.lng], 15);
        }
      } else {
        driverMarkerRef.current.setLatLng([effectiveDriverCoords.lat, effectiveDriverCoords.lng]);
        driverMarkerRef.current.setIcon(carIcon);
        driverMarkerRef.current.setPopupContent(popupText);

        if (isAutoFollow) {
          map.panTo([effectiveDriverCoords.lat, effectiveDriverCoords.lng], { animate: true, duration: 0.8 });
        }
      }
    }
  }, [realDriverCoords, isToPickup, isArrived, isInProgress, originLat, originLng, destLat, destLng, ride.driverName, ride.origin, ride.destination, isAutoFollow]);

  // 6. Atualização Inteligente da Rota por Ruas OSRM
  useEffect(() => {
    let isMounted = true;

    const loadRealRoute = async () => {
      let start: { latitude: number; longitude: number } | null = null;
      let end: { latitude: number; longitude: number } | null = null;

      if (isToPickup) {
        // Rota: Posição do motorista -> Ponto de Embarque
        if (realDriverCoords) {
          start = { latitude: realDriverCoords.lat, longitude: realDriverCoords.lng };
        } else if (originLat && originLng) {
          start = { latitude: originLat - 0.005, longitude: originLng - 0.005 };
        }
        if (originLat && originLng) {
          end = { latitude: originLat, longitude: originLng };
        }
      } else if (isInProgress) {
        // Rota: Posição atual do motorista -> Destino Final
        if (realDriverCoords) {
          start = { latitude: realDriverCoords.lat, longitude: realDriverCoords.lng };
        } else if (originLat && originLng) {
          start = { latitude: originLat, longitude: originLng };
        }
        if (destLat && destLng) {
          end = { latitude: destLat, longitude: destLng };
        }
      }

      if (!start || !end) return;

      // Otimização: evitar requisições repetidas se as coordenadas não mudaram mais de ~30 metros
      const last = lastRouteFetchCoordsRef.current;
      if (last) {
        const dLat = Math.abs(last.startLat - start.latitude);
        const dLng = Math.abs(last.startLng - start.longitude);
        if (dLat < 0.0003 && dLng < 0.0003 && last.endLat === end.latitude && last.endLng === end.longitude && routeCoordinates.length > 0) {
          return;
        }
      }

      lastRouteFetchCoordsRef.current = {
        startLat: start.latitude,
        startLng: start.longitude,
        endLat: end.latitude,
        endLng: end.longitude
      };

      try {
        const streetPoints = await fetchRouteGeometry(start, end);
        if (isMounted && streetPoints.length > 0) {
          setRouteCoordinates(streetPoints);
        }
      } catch (e) {
        console.warn('Erro ao carregar traçado OSRM:', e);
      }
    };

    loadRealRoute();
    return () => {
      isMounted = false;
    };
  }, [isToPickup, isInProgress, originLat, originLng, destLat, destLng, realDriverCoords?.lat, realDriverCoords?.lng]);

  // 7. Renderização do Traçado no Mapa sem Destruir a Instância Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeCoordinates.length > 0) {
      const lineColor = isToPickup ? '#f59e0b' : '#3b82f6';

      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(routeCoordinates, {
          color: lineColor,
          weight: 6,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        try {
          map.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] });
        } catch {}
      } else {
        routeLineRef.current.setLatLngs(routeCoordinates);
        routeLineRef.current.setStyle({ color: lineColor });
      }
    } else if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
  }, [routeCoordinates, isToPickup]);

  // Ações do Usuário: Centralizar no Carro ou Ver Traçado Todo
  const handleFocusOnCar = () => {
    setIsAutoFollow(true);
    const map = mapInstanceRef.current;
    const target = realDriverCoords || (originLat && originLng ? { lat: originLat, lng: originLng } : null);
    if (map && target) {
      map.setView([target.lat, target.lng], 16, { animate: true });
    }
  };

  const handleFitRouteBounds = () => {
    setIsAutoFollow(false);
    const map = mapInstanceRef.current;
    if (!map) return;

    const points: [number, number][] = [];
    if (realDriverCoords) points.push([realDriverCoords.lat, realDriverCoords.lng]);
    if (originLat && originLng) points.push([originLat, originLng]);
    if (destLat && destLng && isInProgress) points.push([destLat, destLng]);

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Banner de Viagem em Tempo Real */}
      <div style={{
        background: isToPickup 
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.15))' 
          : isArrived
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(79, 70, 229, 0.15))'
          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15))',
        border: `1px solid ${isToPickup ? 'rgba(245, 158, 11, 0.4)' : isArrived ? 'rgba(99, 102, 241, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: isToPickup ? '#f59e0b' : isArrived ? '#6366f1' : '#3b82f6',
            color: '#fff',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <Car size={22} className="animate-car" />
          </div>
          <div>
            <span style={{
              fontSize: '0.75rem',
              color: isToPickup ? '#fbbf24' : isArrived ? '#a5b4fc' : '#60a5fa',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {isArrived
                ? '📍 MOTORISTA NO LOCAL DE EMBARQUE'
                : isToPickup 
                ? '🚗 MOTORISTA A CAMINHO DO EMBARQUE' 
                : '🔴 CORRIDA EM ANDAMENTO'}
            </span>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 0', color: '#fff' }}>
              {isArrived
                ? `${ride.driverName || 'Motorista'} chegou! Embarque no veículo.`
                : isToPickup 
                ? `${ride.driverName || 'Motorista Parceiro'} está se deslocando até você` 
                : 'Motorista em Trânsito com Você até o Destino'}
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isInProgress ? 'Tempo de Corrida Contabilizado' : 'Status do Trajeto'}
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: isToPickup ? '#f59e0b' : isArrived ? '#818cf8' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Clock size={16} />
              <span>
                {isArrived
                  ? 'Aguardando Embarque'
                  : isToPickup 
                  ? 'Em Deslocamento' 
                  : formatTimer(elapsedSeconds)}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Período Contratado</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              {ride.hours} Horas ({formatCurrency(ride.hourlyRate)}/h)
            </div>
          </div>
        </div>
      </div>

      {/* Mapa do Leaflet com Controles Interativos e Indicador de GPS Ao Vivo */}
      <div style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        height: '360px',
        position: 'relative'
      }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#090d16' }} />

        {/* Badge Flutuante Superior: Indicador de Transmissão GPS Ao Vivo */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 500,
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: secondsSincePing !== null && secondsSincePing < 20 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: secondsSincePing !== null && secondsSincePing < 20 ? '#10b981' : '#f59e0b',
              boxShadow: secondsSincePing !== null && secondsSincePing < 20 ? '0 0 10px #10b981' : '0 0 10px #f59e0b',
              display: 'inline-block'
            }} />
            <span>
              {secondsSincePing !== null
                ? `GPS Ao Vivo • Há ${secondsSincePing}s`
                : 'Conectando ao GPS do Parceiro...'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFocusOnCar}
            title="Seguir e centralizar no veículo do motorista"
            style={{
              background: isAutoFollow ? 'rgba(59, 130, 246, 0.9)' : 'rgba(15, 23, 42, 0.85)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <Crosshair size={14} />
            <span>Focar no Carro</span>
          </button>

          <button
            type="button"
            onClick={handleFitRouteBounds}
            title="Ver o trajeto completo no mapa"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <Navigation size={14} />
            <span>Rota Completa</span>
          </button>
        </div>

        {/* Rodapé Flutuante do Mapa */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '0.75rem',
          color: '#fff',
          zIndex: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isToPickup ? '#f59e0b' : isArrived ? '#6366f1' : '#10b981'
          }}></span>
          <span>Motorista: <strong>{ride.driverName || 'Motorista Parceiro'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: isToPickup ? '#fbbf24' : isArrived ? '#a5b4fc' : '#10b981', fontWeight: 700 }}>
            {isArrived 
              ? 'No ponto de embarque'
              : isToPickup 
              ? 'A caminho do embarque' 
              : 'Em rota até o destino'}
          </span>
        </div>
      </div>
    </div>
  );
}
