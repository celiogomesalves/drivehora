// Serviço de Navegação GPS Externa para Motoristas (Waze, Google Maps, Apple Maps)

export type GpsNavigationApp = 'waze' | 'google_maps' | 'apple_maps' | 'ask';

const PREFERRED_GPS_KEY = 'drivehora_driver_preferred_gps';

// 1. Obter GPS preferido do motorista
export const getDriverPreferredGps = (): GpsNavigationApp => {
  try {
    const saved = localStorage.getItem(PREFERRED_GPS_KEY);
    if (saved && ['waze', 'google_maps', 'apple_maps', 'ask'].includes(saved)) {
      return saved as GpsNavigationApp;
    }
  } catch {}
  return 'ask';
};

// 2. Salvar GPS preferido do motorista
export const setDriverPreferredGps = (app: GpsNavigationApp): void => {
  try {
    localStorage.setItem(PREFERRED_GPS_KEY, app);
  } catch {}
};

// 3. Gerar URL de Navegação por Aplicativo
export const buildNavigationUrl = (
  destination: string,
  provider: 'waze' | 'google_maps' | 'apple_maps',
  coords?: { lat: number; lng: number }
): string => {
  const cleanDest = destination.trim();

  if (provider === 'waze') {
    if (coords && coords.lat && coords.lng) {
      return `https://www.waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
    }
    return `https://www.waze.com/ul?q=${encodeURIComponent(cleanDest)}&navigate=yes`;
  }

  if (provider === 'apple_maps') {
    if (coords && coords.lat && coords.lng) {
      return `https://maps.apple.com/?daddr=${coords.lat},${coords.lng}&dirflg=d`;
    }
    return `https://maps.apple.com/?daddr=${encodeURIComponent(cleanDest)}&dirflg=d`;
  }

  // Padrão: Google Maps
  if (coords && coords.lat && coords.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanDest)}&travelmode=driving`;
};

// 4. Abrir aplicativo de GPS no dispositivo
export const launchNavigationApp = (
  destination: string,
  provider: 'waze' | 'google_maps' | 'apple_maps',
  coords?: { lat: number; lng: number }
): boolean => {
  const url = buildNavigationUrl(destination, provider, coords);
  try {
    window.open(url, '_blank');
    return true;
  } catch (err) {
    console.warn('Erro ao abrir app de GPS externo:', err);
    return false;
  }
};
