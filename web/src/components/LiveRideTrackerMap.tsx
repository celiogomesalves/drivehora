import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Car, Clock } from 'lucide-react';
import type { DbRide } from '../services/dbService';
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

  // Coordenadas simuladas para o trajeto
  const defaultOrigin = { lat: -19.8157, lng: -43.9542 }; // Piratininga / BH
  const defaultDest = { lat: -19.9245, lng: -43.9352 };   // Centro / Destino BH

  const originLat = ride.originLat || defaultOrigin.lat;
  const originLng = ride.originLng || defaultOrigin.lng;
  const destLat = ride.destLat || defaultDest.lat;
  const destLng = ride.destLng || defaultDest.lng;

  // 1. Cronômetro da Viagem
  useEffect(() => {
    const startTime = ride.startedAt || Date.now();
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(sec > 0 ? sec : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [ride.startedAt]);

  // 2. Animação de Deslocamento do Motorista
  useEffect(() => {
    const animInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 95) return 15; // Loop suave
        return prev + 1.2;
      });
    }, 1500);
    return () => clearInterval(animInterval);
  }, []);

  // 3. Inicializar Mapa Leaflet UMA ÚNICA VEZ (Sem piscar)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [(originLat + destLat) / 2, (originLng + destLng) / 2],
      zoom: 13,
      zoomControl: true,
      fadeAnimation: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Ícone de Partida
    const originIcon = L.divIcon({
      className: 'origin-marker',
      html: `
        <div style="background: #6366f1; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.6);">
          📍
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    // Ícone de Destino
    const destIcon = L.divIcon({
      className: 'dest-marker',
      html: `
        <div style="background: #10b981; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.6);">
          🏁
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const origM = L.marker([originLat, originLng], { icon: originIcon })
      .bindPopup(`<strong>Partida:</strong><br/>${ride.origin}`)
      .addTo(map);
    originMarkerRef.current = origM;

    const destM = L.marker([destLat, destLng], { icon: destIcon })
      .bindPopup(`<strong>Destino:</strong><br/>${ride.destination}`)
      .addTo(map);
    destMarkerRef.current = destM;

    // Traçado da rota
    const polyline = L.polyline([
      [originLat, originLng],
      [originLat + (destLat - originLat) * 0.4, originLng + (destLng - originLng) * 0.3],
      [originLat + (destLat - originLat) * 0.7, originLng + (destLng - originLng) * 0.8],
      [destLat, destLng]
    ], {
      color: '#6366f1',
      weight: 5,
      opacity: 0.8,
      dashArray: '8, 8'
    }).addTo(map);

    routeLineRef.current = polyline;

    // Ícone do Motorista em Movimento
    const carIcon = L.divIcon({
      className: 'live-driver-car',
      html: `
        <div style="
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
          border: 2px solid #fff;
        ">
          🚗
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const initialDriverPos: [number, number] = [
      originLat + (destLat - originLat) * 0.15,
      originLng + (destLng - originLng) * 0.15
    ];

    const driverMarker = L.marker(initialDriverPos, { icon: carIcon })
      .bindPopup(`<strong>${ride.driverName || 'Motorista Parceiro'}</strong><br/>Em deslocamento em tempo real`)
      .addTo(map);

    driverMarkerRef.current = driverMarker;
    mapInstanceRef.current = map;

    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 4. Atualizar posição do motorista conforme o progresso suavemente
  useEffect(() => {
    if (!driverMarkerRef.current) return;

    const currentFraction = progressPercent / 100;
    const curLat = originLat + (destLat - originLat) * currentFraction;
    const curLng = originLng + (destLng - originLng) * currentFraction;

    driverMarkerRef.current.setLatLng([curLat, curLng]);
  }, [progressPercent, originLat, originLng, destLat, destLng]);

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
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '12px' }}>
            <Car size={22} className="animate-car" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔴 RASTREAMENTO GPS AO VIVO
            </span>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 0', color: '#fff' }}>
              Motorista em Trânsito com Você
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tempo Decorrido</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={16} />
              <span>{formatTimer(elapsedSeconds)}</span>
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
          background: 'rgba(15, 23, 42, 0.9)',
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
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
          <span>Motorista: <strong>{ride.driverName || 'Motorista Parceiro'}</strong></span>
        </div>
      </div>
    </div>
  );
}
