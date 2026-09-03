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
    const res = await fetch(url);

    if (!res.ok) throw new Error('Falha na geocodificação');
    const data = await res.json();

    const address = data.address || {};
    const road = address.road || address.pedestrian || address.street || '';
    const houseNumber = address.house_number ? `, ${address.house_number}` : '';
    const suburb = address.suburb || address.neighbourhood || address.residential || '';
    const city = address.city || address.town || address.municipality || '';

    if (road && (suburb || city)) {
      return `${road}${houseNumber}${suburb ? ` - ${suburb}` : ''}${city ? `, ${city}` : ''}`;
    }

    if (data.display_name) {
      return data.display_name.split(',').slice(0, 3).join(', ');
    }

    return `Localização atual (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
  } catch (err) {
    console.warn('Erro ao obter endereço via GPS:', err);
    return `Localização atual (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
  }
};

// 3. Busca Inteligente de Endereços / Lugares ao digitar (Autocomplete Multi-Provedor)
export const searchAddressPlaces = async (query: string): Promise<string[]> => {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const results: string[] = [];

  // Provedor 1: Photon OpenStreetMap (Rápido e especializado em digitação em tempo real)
  try {
    const encoded = encodeURIComponent(clean);
    const photonUrl = `https://photon.komoot.io/api/?q=${encoded}&lang=pt&limit=6`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        data.features.forEach((feat: any) => {
          const p = feat.properties || {};
          const name = p.name || p.street || '';
          const street = p.street || '';
          const housenumber = p.housenumber ? `, ${p.housenumber}` : '';
          const district = p.district || p.suburb || p.locality || '';
          const city = p.city || '';
          const state = p.state || '';

          let formatted = '';
          if (name && street && name !== street) {
            formatted = `${name} (${street}${housenumber})${district ? ` - ${district}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
          } else if (name) {
            formatted = `${name}${housenumber}${district ? ` - ${district}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
          }

          if (formatted && !results.includes(formatted)) {
            results.push(formatted);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Busca Photon fallback:', e);
  }

  // Provedor 2: Nominatim OpenStreetMap (Garante cobertura de ruas específicas no Brasil)
  if (results.length < 4) {
    try {
      const encoded = encodeURIComponent(clean);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=6&addressdetails=1`;
      const res = await fetch(nominatimUrl);
      if (res.ok) {
        const data = await res.json();
        data.forEach((item: any) => {
          const addr = item.address || {};
          const road = addr.road || addr.pedestrian || addr.street || item.name || '';
          const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
          const suburb = addr.suburb || addr.neighbourhood || '';
          const city = addr.city || addr.town || addr.municipality || '';
          const state = addr.state || '';

          let formatted = '';
          if (road && (suburb || city)) {
            formatted = `${road}${houseNumber}${suburb ? ` - ${suburb}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
          } else if (item.display_name) {
            formatted = item.display_name.split(',').slice(0, 3).join(', ');
          }

          if (formatted && !results.includes(formatted)) {
            results.push(formatted);
          }
        });
      }
    } catch (e) {
      console.warn('Busca Nominatim fallback:', e);
    }
  }

  return results.slice(0, 6);
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
