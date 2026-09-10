import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Car, Clock } from 'lucide-react';
import type { DbRide } from '../services/dbService';
import { dbGetDriverProfile } from '../services/dbService';
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

  const [progressPercent, setProgressPercent] = useState(15);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [realDriverCoords, setRealDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  const isApproaching = ride.status === 'accepted';

  // Coordenadas padrão para o trajeto
  const defaultOrigin = { lat: -19.8157, lng: -43.9542 }; // Piratininga / BH
  const defaultDest = { lat: -19.9245, lng: -43.9352 };   // Centro / BH

  const originLat = ride.originLat || defaultOrigin.lat;
  const originLng = ride.originLng || defaultOrigin.lng;
  const destLat = ride.destLat || defaultDest.lat;
  const destLng = ride.destLng || defaultDest.lng;

  // 1. Cronômetro da Viagem
  useEffect(() => {
    const startTime = (isApproaching ? ride.acceptedAt : ride.startedAt) || Date.now();
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(sec > 0 ? sec : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [ride.startedAt, ride.acceptedAt, isApproaching]);

  // 2. Tentar buscar periodicamente localização real do motorista do banco
  useEffect(() => {
    const targetDriverId = ride.driverId;
    if (!targetDriverId) return;

    const fetchDriverGps = async () => {
      try {
        const dp = await dbGetDriverProfile(targetDriverId);
        if (dp && dp.currentLat && dp.currentLng) {
          setRealDriverCoords({ lat: dp.currentLat, lng: dp.currentLng });
        }
      } catch {}
    };

    fetchDriverGps();
    const interval = setInterval(fetchDriverGps, 4000);
    return () => clearInterval(interval);
  }, [ride.driverId]);

  // 3. Animação suave do veículo ao longo da rota
  useEffect(() => {
    const animInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 95) return 15; // Loop contínuo
        return prev + 1.2;
      });
    }, 1200);
    return () => clearInterval(animInterval);
  }, []);

  // 4. Inicializar Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const startLat = isApproaching ? originLat + 0.015 : originLat;
    const startLng = isApproaching ? originLng - 0.015 : originLng;
    const targetLat = isApproaching ? originLat : destLat;
    const targetLng = isApproaching ? originLng : destLng;

    const map = L.map(mapContainerRef.current, {
      center: [(startLat + targetLat) / 2, (startLng + targetLng) / 2],
      zoom: 14,
      zoomControl: true,
      fadeAnimation: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Ícone de Partida / Embarque
    const originIcon = L.divIcon({
      className: 'origin-marker',
      html: `
        <div style="background: #6366f1; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.7);">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const origM = L.marker([originLat, originLng], { icon: originIcon })
      .bindPopup(`<strong>Ponto de Embarque:</strong><br/>${ride.origin}`)
      .addTo(map);
    originMarkerRef.current = origM;

    // Ícone de Destino Final (se em andamento)
    if (!isApproaching) {
      const destIcon = L.divIcon({
        className: 'dest-marker',
        html: `
          <div style="background: #10b981; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.7);">
            🏁
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const destM = L.marker([destLat, destLng], { icon: destIcon })
        .bindPopup(`<strong>Destino Final:</strong><br/>${ride.destination}`)
        .addTo(map);
      destMarkerRef.current = destM;
    }

    // Traçado da rota
    const routePoints: [number, number][] = isApproaching
      ? [
          [startLat, startLng],
          [startLat + (targetLat - startLat) * 0.4, startLng + (targetLng - startLng) * 0.3],
          [startLat + (targetLat - startLat) * 0.7, startLng + (targetLng - startLng) * 0.8],
          [targetLat, targetLng]
        ]
      : [
          [originLat, originLng],
          [originLat + (destLat - originLat) * 0.4, originLng + (destLng - originLng) * 0.3],
          [originLat + (destLat - originLat) * 0.7, originLng + (destLng - originLng) * 0.8],
          [destLat, destLng]
        ];

    const polyline = L.polyline(routePoints, {
      color: isApproaching ? '#f59e0b' : '#6366f1',
      weight: 5,
      opacity: 0.85,
      dashArray: '8, 8'
    }).addTo(map);

    routeLineRef.current = polyline;

    // Ícone do Motorista em Movimento
    const carIcon = L.divIcon({
      className: 'live-driver-car',
      html: `
        <div style="
          background: linear-gradient(135deg, ${isApproaching ? '#f59e0b, #d97706' : '#10b981, #059669'});
          color: #fff;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 0 20px ${isApproaching ? 'rgba(245, 158, 11, 0.9)' : 'rgba(16, 185, 129, 0.9)'};
          border: 2px solid #fff;
        ">
          🚗
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });

    const initialPos: [number, number] = [
      startLat + (targetLat - startLat) * 0.2,
      startLng + (targetLng - startLng) * 0.2
    ];

    const driverMarker = L.marker(initialPos, { icon: carIcon })
      .bindPopup(`<strong>${ride.driverName || 'Motorista Parceiro'}</strong><br/>${isApproaching ? 'A caminho do ponto de embarque' : 'Em deslocamento da corrida'}`)
      .addTo(map);

    driverMarkerRef.current = driverMarker;
    mapInstanceRef.current = map;

    try {
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } catch {}

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [ride.id, ride.status, isApproaching, originLat, originLng, destLat, destLng]);

  // 5. Atualizar posição do motorista
  useEffect(() => {
    if (!driverMarkerRef.current) return;

    if (realDriverCoords) {
      driverMarkerRef.current.setLatLng([realDriverCoords.lat, realDriverCoords.lng]);
      return;
    }

    const startLat = isApproaching ? originLat + 0.015 : originLat;
    const startLng = isApproaching ? originLng - 0.015 : originLng;
    const targetLat = isApproaching ? originLat : destLat;
    const targetLng = isApproaching ? originLng : destLng;

    const currentFraction = progressPercent / 100;
    const curLat = startLat + (targetLat - startLat) * currentFraction;
    const curLng = startLng + (targetLng - startLng) * currentFraction;

    driverMarkerRef.current.setLatLng([curLat, curLng]);
  }, [progressPercent, realDriverCoords, isApproaching, originLat, originLng, destLat, destLng]);

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
        background: isApproaching 
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.15))' 
          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15))',
        border: `1px solid ${isApproaching ? 'rgba(245, 158, 11, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
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
            background: isApproaching ? '#f59e0b' : '#3b82f6',
            color: '#fff',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <Car size={22} className="animate-car" />
          </div>
          <div>
            <span style={{
              fontSize: '0.75rem',
              color: isApproaching ? '#fbbf24' : '#60a5fa',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {isApproaching ? '🚗 MOTORISTA A CAMINHO DO EMBARQUE' : '🔴 RASTREAMENTO GPS AO VIVO'}
            </span>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 0', color: '#fff' }}>
              {isApproaching 
                ? `${ride.driverName || 'Motorista Parceiro'} está a caminho de você` 
                : 'Motorista em Trânsito com Você'}
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isApproaching ? 'Previsão de Chegada' : 'Tempo Decorrido'}
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: isApproaching ? '#f59e0b' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Clock size={16} />
              <span>{isApproaching ? '~ 3 a 5 min' : formatTimer(elapsedSeconds)}</span>
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

      {/* Mapa do Leaflet Estável */}
      <div style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        height: '320px',
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
            background: isApproaching ? '#f59e0b' : '#10b981'
          }}></span>
          <span>Motorista: <strong>{ride.driverName || 'Motorista Parceiro'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: isApproaching ? '#fbbf24' : '#10b981', fontWeight: 700 }}>
            {isApproaching ? 'A caminho do seu endereço' : 'Em trajeto com você'}
          </span>
        </div>
      </div>
    </div>
  );
}
