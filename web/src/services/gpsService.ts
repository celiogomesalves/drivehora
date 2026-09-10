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

// 3. Busca Inteligente de Endereços / Lugares ao digitar (Autocomplete Multi-Provedor com Suporte a Número Predial)
export const searchAddressPlaces = async (
  query: string,
  userCoords?: Coordinates | { lat: number; lng: number } | null
): Promise<string[]> => {
  const clean = query.trim();
  if (clean.length < 2) return [];

  // Detecta número predial digitado (ex: "Rua Norma, 174", "Av Brasil 500", "Rua das Flores nº 12")
  const numberMatch = clean.match(/(?:,\s*|\s+n[º°]?\s*|\s+)(\d+[a-zA-Z]?)(?:[,\s]|$)/i);
  const typedNumber = numberMatch ? numberMatch[1] : null;
  // Nome da rua sem o número para buscar caso a base OSM não tenha o número indexado
  const streetOnly = typedNumber 
    ? clean.replace(new RegExp(`(?:,\\s*|\\s+n[º°]?\\s*|\\s+)${typedNumber}(?:[,\\s]|$)`, 'i'), ' ').trim()
    : clean;

  const results: string[] = [];

  // Coordenadas de ancoragem para priorizar a região do usuário (padrão RMBH / MG / Brasil)
  const rawLat = userCoords && ('latitude' in userCoords ? userCoords.latitude : userCoords.lat);
  const rawLng = userCoords && ('longitude' in userCoords ? userCoords.longitude : userCoords.lng);
  const biasLat = rawLat || -19.9245;
  const biasLng = rawLng || -43.9352;

  // Provedor 1: Photon OpenStreetMap (Com filtro por país BR e proximidade por coordenadas)
  try {
    const queryToSearch = streetOnly.length >= 2 ? streetOnly : clean;
    const encoded = encodeURIComponent(queryToSearch);
    const photonUrl = `https://photon.komoot.io/api/?q=${encoded}&lat=${biasLat}&lon=${biasLng}&limit=12`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        data.features.forEach((feat: any) => {
          const p = feat.properties || {};
          
          // Ignorar resultados fora do Brasil (ex: Buenos Aires, outros países)
          const country = (p.country || '').toLowerCase();
          const countryCode = (p.countrycode || '').toLowerCase();
          if (countryCode && countryCode !== 'br') return;
          if (country && !country.includes('brasil') && !country.includes('brazil')) return;

          const name = p.name || '';
          const street = p.street || '';
          // Se a base OSM tiver housenumber usa ele, senão usa o número digitado pelo usuário
          const housenumber = p.housenumber 
            ? `, ${p.housenumber}` 
            : typedNumber 
            ? `, ${typedNumber}` 
            : '';
          const district = p.district || p.suburb || p.locality || '';
          const city = p.city || '';
          const state = p.state || '';

          let formatted = '';
          if (name && street && name.toLowerCase() !== street.toLowerCase()) {
            formatted = `${name} (${street}${housenumber})${district ? ` - ${district}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
          } else if (name) {
            formatted = `${name}${housenumber}${district ? ` - ${district}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
          } else if (street) {
            formatted = `${street}${housenumber}${district ? ` - ${district}` : ''}${city ? `, ${city}` : ''}${state ? ` - ${state}` : ''}`;
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

  // Provedor 2: Nominatim OpenStreetMap (Restrito a countrycodes=br com suporte a número)
  if (results.length < 8) {
    try {
      const encoded = encodeURIComponent(clean);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=8&addressdetails=1`;
      const res = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'DriveHoraApp/1.0 (contact@drivehora.com)',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            const addr = item.address || {};
            const name = item.name || '';
            const road = addr.road || addr.pedestrian || addr.street || '';
            const houseNumber = addr.house_number 
              ? `, ${addr.house_number}` 
              : typedNumber 
              ? `, ${typedNumber}` 
              : '';
            const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
            const city = addr.city || addr.town || addr.municipality || addr.village || '';
            const state = addr.state || '';

            let formatted = '';
            if (name && road && name.toLowerCase() !== road.toLowerCase()) {
              formatted = `${name} - ${road}${houseNumber}${suburb ? `, ${suburb}` : ''}${city ? ` - ${city}` : ''}${state ? `/${state}` : ''}`;
            } else if (name && (suburb || city)) {
              formatted = `${name}${houseNumber}${suburb ? ` - ${suburb}` : ''}${city ? `, ${city}` : ''}${state ? `/${state}` : ''}`;
            } else if (road && (suburb || city)) {
              formatted = `${road}${houseNumber}${suburb ? ` - ${suburb}` : ''}${city ? `, ${city}` : ''}${state ? `/${state}` : ''}`;
            } else if (item.display_name) {
              formatted = item.display_name.split(',').slice(0, 3).join(', ');
            }

            if (formatted && !results.includes(formatted)) {
              results.push(formatted);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Busca Nominatim fallback:', e);
    }
  }

  // Se o usuário digitou um número, mas nenhuma das sugestões veio com o número exato, adiciona o endereço digitado no topo
  if (typedNumber && clean.length > 5) {
    if (!results.some(r => r.includes(typedNumber))) {
      results.unshift(clean);
    }
  }

  return results.slice(0, 8);
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

// 5. Geocodificação Real de Endereço em Texto para Coordenadas (Nominatim / Photon)
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  const clean = address.trim();
  if (clean.length < 3) return null;

  try {
    const encoded = encodeURIComponent(clean);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DriveHoraApp/1.0 (contact@drivehora.com)',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
    }
  } catch (err) {
    console.warn('Erro geocodeAddress Nominatim:', err);
  }

  // Fallback Photon
  try {
    const encoded = encodeURIComponent(clean);
    const res = await fetch(`https://photon.komoot.io/api/?q=${encoded}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const [lon, lat] = data.features[0].geometry.coordinates;
        return { latitude: lat, longitude: lon };
      }
    }
  } catch (err) {
    console.warn('Erro geocodeAddress Photon:', err);
  }

  return null;
};

// 6. Obter Traçado de Rota Real por Ruas (OpenStreetMap / OSRM Routing)
export const fetchRouteGeometry = async (start: Coordinates, end: Coordinates): Promise<[number, number][]> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates;
        // OSRM retorna [lng, lat], convertemos para [lat, lng] compatível com Leaflet
        return coords.map(([lng, lat]: [number, number]) => [lat, lng]);
      }
    }
  } catch (err) {
    console.warn('Erro ao obter traçado OSRM:', err);
  }

  // Fallback linear caso o serviço esteja temporariamente indisponível
  return [
    [start.latitude, start.longitude],
    [end.latitude, end.longitude]
  ];
};
