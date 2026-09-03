export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedAddress {
  displayName: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  lat?: number;
  lon?: number;
}

// 1. Obter coordenadas atuais via GPS do dispositivo
export const getCurrentPosition = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada pelo navegador'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
};

// 2. Geocodificação reversa (Coordenadas -> Nome da Rua/Bairro/Cidade)
export const reverseGeocode = async (coords: Coordinates): Promise<string> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'DriveHora-App/1.0'
      }
    });

    if (!res.ok) throw new Error('Falha na geocodificação');
    const data = await res.json();

    const address = data.address || {};
    const road = address.road || address.pedestrian || address.street || '';
    const houseNumber = address.house_number ? `, ${address.house_number}` : '';
    const suburb = address.suburb || address.neighbourhood || '';
    const city = address.city || address.town || address.municipality || '';

    if (road && suburb) {
      return `${road}${houseNumber} - ${suburb}, ${city}`;
    }

    return data.display_name?.split(',').slice(0, 3).join(',') || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  } catch (err) {
    console.warn('Erro ao obter endereço via GPS:', err);
    return `Localização atual (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
  }
};

// 3. Busca Automática de Endereços / Lugares ao digitar (Geocodificação Direta)
export const searchAddressPlaces = async (query: string): Promise<string[]> => {
  const clean = query.trim();
  if (clean.length < 3) return [];

  try {
    const encoded = encodeURIComponent(clean);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'DriveHora-App/1.0'
      }
    });

    if (!res.ok) return [];
    const data = await res.json();

    return data.map((item: any) => {
      const addr = item.address || {};
      const road = addr.road || addr.pedestrian || addr.street || item.name || '';
      const suburb = addr.suburb || addr.neighbourhood || '';
      const city = addr.city || addr.town || addr.municipality || '';
      const state = addr.state || '';

      if (road && (suburb || city)) {
        return `${road}${suburb ? ` - ${suburb}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
      }
      return item.display_name.split(',').slice(0, 3).join(',');
    });
  } catch (err) {
    console.warn('Erro na busca de locais:', err);
    return [];
  }
};

// 4. Cálculo de distância em Km (Fórmula de Haversine)
export const calculateDistanceKm = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
};
