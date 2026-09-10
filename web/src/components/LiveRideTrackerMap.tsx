import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Car, Clock } from 'lucide-react';
import type { DbRide } from '../services/dbService';
import { dbGetDriverProfile } from '../services/dbService';
import { fetchRouteGeometry } from '../services/gpsService';
import { formatCurrency } from '../utils/formatters';

interface LiveRideTrackerMapProps {
  ride: DbRide;
}

export function LiveRideTrackerMap({ ride }: LiveRideTrackerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [realDriverCoords, setRealDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);

  // Fases: 'to_pickup' = motorista a caminho do passageiro; 'in_progress' = corrida iniciada até o destino
  const isToPickup = ride.status === 'to_pickup' || ride.status === 'accepted';
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

  // 2. Buscar continuamente a localização GPS REAL do motorista no banco / perfil
  useEffect(() => {
    const targetDriverId = ride.driverId;
    if (!targetDriverId) return;

    let isMounted = true;
    const fetchDriverGps = async () => {
      try {
        const dp = await dbGetDriverProfile(targetDriverId);
        if (dp && dp.currentLat && dp.currentLng && isMounted) {
          setRealDriverCoords({ lat: Number(dp.currentLat), lng: Number(dp.currentLng) });
        }
      } catch {}
    };

    fetchDriverGps();
    const interval = setInterval(fetchDriverGps, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [ride.driverId]);

  // 3. Obter rota real por ruas via OSRM (OpenStreetMap Routing)
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
          // Pequeno offset inicial caso o GPS do motorista ainda esteja sincronizando
          start = { latitude: originLat - 0.005, longitude: originLng - 0.005 };
        }
        if (originLat && originLng) {
          end = { latitude: originLat, longitude: originLng };
        }
      } else if (isInProgress) {
        // Rota: Posição atual do motorista (ou embarque) -> Destino Final
        if (realDriverCoords) {
          start = { latitude: realDriverCoords.lat, longitude: realDriverCoords.lng };
        } else if (originLat && originLng) {
          start = { latitude: originLat, longitude: originLng };
        }
        if (destLat && destLng) {
          end = { latitude: destLat, longitude: destLng };
        }
      }

      if (start && end) {
        try {
          const streetPoints = await fetchRouteGeometry(start, end);
          if (isMounted && streetPoints.length > 0) {
            setRouteCoordinates(streetPoints);
          }
        } catch (e) {
          console.warn('Erro ao carregar traçado de ruas OSRM:', e);
        }
      }
    };

    loadRealRoute();
    return () => {
      isMounted = false;
    };
  }, [isToPickup, isInProgress, originLat, originLng, destLat, destLng, realDriverCoords?.lat, realDriverCoords?.lng]);

  // 4. Inicializar e atualizar Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Centro inicial: Prioriza a localização real do passageiro/origem
    const centerLat = originLat || realDriverCoords?.lat || -19.9245;
    const centerLng = originLng || realDriverCoords?.lng || -43.9352;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: true,
      fadeAnimation: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Marcador do Ponto de Embarque (Local Real do Passageiro)
    if (originLat && originLng) {
      const originIcon = L.divIcon({
        className: 'origin-marker',
        html: `
          <div style="background: #6366f1; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.7);">
            📍
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      L.marker([originLat, originLng], { icon: originIcon })
        .bindPopup(`<strong>Ponto de Embarque:</strong><br/>${ride.origin}`)
        .addTo(map);
    }

    // Marcador do Destino Final
    if (destLat && destLng && isInProgress) {
      const destIcon = L.divIcon({
        className: 'dest-marker',
        html: `
          <div style="background: #10b981; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.7);">
            🏁
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      L.marker([destLat, destLng], { icon: destIcon })
        .bindPopup(`<strong>Destino Final:</strong><br/>${ride.destination}`)
        .addTo(map);
    }

    // Traçado Real por Ruas
    if (routeCoordinates.length > 0) {
      const polyline = L.polyline(routeCoordinates, {
        color: isToPickup ? '#f59e0b' : '#3b82f6',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      routeLineRef.current = polyline;

      try {
        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      } catch {}
    }

    // Marcador do Motorista (Posicionado no GPS Real)
    const carPos: [number, number] = realDriverCoords
      ? [realDriverCoords.lat, realDriverCoords.lng]
      : originLat && originLng
      ? [originLat, originLng]
      : [centerLat, centerLng];

    const carIcon = L.divIcon({
      className: 'live-driver-car',
      html: `
        <div style="
          background: linear-gradient(135deg, ${isToPickup ? '#f59e0b, #d97706' : '#10b981, #059669'});
          color: #fff;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 0 20px ${isToPickup ? 'rgba(245, 158, 11, 0.9)' : 'rgba(16, 185, 129, 0.9)'};
          border: 2px solid #fff;
          transition: transform 0.4s ease;
        ">
          🚗
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const driverMarker = L.marker(carPos, { icon: carIcon })
      .bindPopup(`<strong>${ride.driverName || 'Motorista Parceiro'}</strong><br/>${isToPickup ? 'Em deslocamento até o passageiro' : 'Corrida em andamento com passageiro'}`)
      .addTo(map);

    driverMarkerRef.current = driverMarker;
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [ride.id, isToPickup, isInProgress, originLat, originLng, destLat, destLng, routeCoordinates]);

  // 5. Atualizar posição do marcador em tempo real exclusivamente quando as coordenadas GPS do motorista mudarem
  useEffect(() => {
    if (!driverMarkerRef.current || !realDriverCoords) return;
    driverMarkerRef.current.setLatLng([realDriverCoords.lat, realDriverCoords.lng]);
  }, [realDriverCoords]);

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
          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15))',
        border: `1px solid ${isToPickup ? 'rgba(245, 158, 11, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
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
            background: isToPickup ? '#f59e0b' : '#3b82f6',
            color: '#fff',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <Car size={22} className="animate-car" />
          </div>
          <div>
            <span style={{
              fontSize: '0.75rem',
              color: isToPickup ? '#fbbf24' : '#60a5fa',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {isToPickup ? '🚗 MOTORISTA A CAMINHO DO EMBARQUE' : '🔴 CORRIDA EM ANDAMENTO'}
            </span>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 0', color: '#fff' }}>
              {isToPickup 
                ? `${ride.driverName || 'Motorista Parceiro'} está se deslocando até você` 
                : 'Motorista em Trânsito com Você até o Destino'}
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isToPickup ? 'Status do Trajeto' : 'Tempo de Corrida Contabilizado'}
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: isToPickup ? '#f59e0b' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Clock size={16} />
              <span>{isToPickup ? 'Em Deslocamento' : formatTimer(elapsedSeconds)}</span>
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

      {/* Mapa do Leaflet */}
      <div style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        height: '340px',
        position: 'relative'
      }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#090d16' }} />

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
            background: isToPickup ? '#f59e0b' : '#10b981'
          }}></span>
          <span>Motorista: <strong>{ride.driverName || 'Motorista Parceiro'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: isToPickup ? '#fbbf24' : '#10b981', fontWeight: 700 }}>
            {isToPickup ? 'A caminho do embarque' : 'Em rota até o destino'}
          </span>
        </div>
      </div>
    </div>
  );
}
