import { getSupabase } from '../supabase';
import type { UserProfile, ClientProfile, DriverProfile } from '../types/auth';

export interface DbRide {
  id: string;
  clientId: string;
  clientName?: string;
  driverId?: string;
  driverName?: string;
  origin: string;
  destination: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  hours: number;
  hourlyRate: number;
  total: number;
  commission: number;
  driverNet: number;
  status: 'searching' | 'accepted' | 'in_progress' | 'finished' | 'cancelled';
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  finishedAt?: number;
}

// 1. Salvar ou atualizar Perfil de Usuário
export const dbSaveProfile = async (profile: UserProfile): Promise<void> => {
  localStorage.setItem(`drivehora_profile_${profile.id}`, JSON.stringify(profile));
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('profiles').upsert({
        id: profile.id,
        email: profile.email,
        full_name: profile.fullName,
        role: profile.role,
        phone: profile.phone,
        avatar_url: profile.avatarUrl,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Erro ao salvar profile no Supabase:', e);
    }
  }
};

// 2. Salvar ou atualizar Perfil de Cliente (Passageiro)
export const dbSaveClientProfile = async (client: ClientProfile): Promise<void> => {
  localStorage.setItem(`drivehora_client_profile_${client.userId}`, JSON.stringify(client));
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('clients').upsert({
        id: client.id,
        user_id: client.userId,
        cpf: client.cpf,
        phone: client.phone,
        cep: client.cep,
        street: client.street,
        number: client.number,
        complement: client.complement,
        neighborhood: client.neighborhood,
        city: client.city,
        state: client.state,
        is_profile_complete: client.isProfileComplete
      });
    } catch (e) {
      console.warn('Erro ao salvar client no Supabase:', e);
    }
  }
};

// 3. Obter Perfil de Cliente
export const dbGetClientProfile = async (userId: string): Promise<ClientProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('clients').select('*').eq('user_id', userId).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          userId: data.user_id,
          cpf: data.cpf || '',
          phone: data.phone || '',
          cep: data.cep || '',
          street: data.street || '',
          number: data.number || '',
          complement: data.complement || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
          isProfileComplete: Boolean(data.is_profile_complete)
        };
      }
    } catch (e) {}
  }
  const local = localStorage.getItem(`drivehora_client_profile_${userId}`);
  return local ? JSON.parse(local) : null;
};

// 4. Salvar ou atualizar Perfil de Motorista
export const dbSaveDriverProfile = async (driver: DriverProfile): Promise<void> => {
  localStorage.setItem(`drivehora_driver_profile_${driver.userId}`, JSON.stringify(driver));
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('drivers').upsert({
        id: driver.id,
        user_id: driver.userId,
        cpf: driver.cpf,
        phone: driver.phone,
        cnh_number: driver.cnhNumber,
        cnh_category: driver.cnhCategory,
        vehicle_brand: driver.vehicleBrand,
        vehicle_model: driver.vehicleModel,
        vehicle_year: driver.vehicleYear,
        vehicle_plate: driver.vehiclePlate,
        vehicle_color: driver.vehicleColor,
        cnh_url: driver.cnhUrl,
        crlv_url: driver.crlvUrl,
        selfie_url: driver.selfieUrl,
        verification_status: driver.verificationStatus,
        rating: driver.rating,
        total_rides: driver.totalRides
      });
    } catch (e) {
      console.warn('Erro ao salvar driver no Supabase:', e);
    }
  }
};

// 5. Obter Perfil de Motorista
export const dbGetDriverProfile = async (userId: string): Promise<DriverProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('drivers').select('*').eq('user_id', userId).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          userId: data.user_id,
          cpf: data.cpf || '',
          phone: data.phone || '',
          cnhNumber: data.cnh_number || '',
          cnhCategory: data.cnh_category || 'B',
          vehicleBrand: data.vehicle_brand || '',
          vehicleModel: data.vehicle_model || '',
          vehicleYear: data.vehicle_year || '',
          vehiclePlate: data.vehicle_plate || '',
          vehicleColor: data.vehicle_color || '',
          cnhUrl: data.cnh_url,
          crlvUrl: data.crlv_url,
          selfieUrl: data.selfie_url,
          verificationStatus: data.verification_status || 'pending_docs',
          rating: Number(data.rating) || 5.0,
          totalRides: Number(data.total_rides) || 0
        };
      }
    } catch (e) {}
  }
  const local = localStorage.getItem(`drivehora_driver_profile_${userId}`);
  return local ? JSON.parse(local) : null;
};

// 6. Criar Corrida
export const dbCreateRide = async (ride: DbRide): Promise<void> => {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('rides').insert([{
        id: ride.id,
        client_id: ride.clientId,
        client_name: ride.clientName,
        origin: ride.origin,
        destination: ride.destination,
        origin_lat: ride.originLat,
        origin_lng: ride.originLng,
        dest_lat: ride.destLat,
        dest_lng: ride.destLng,
        hours: ride.hours,
        hourly_rate: ride.hourlyRate,
        total: ride.total,
        commission: ride.commission,
        driver_net: ride.driverNet,
        status: ride.status
      }]);
      return;
    } catch (e) {
      console.warn('Erro ao inserir corrida no Supabase:', e);
    }
  }

  // Fallback API ou memória
  try {
    await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ride)
    });
  } catch (e) {}
};

// 7. Atualizar Status da Corrida
export const dbUpdateRide = async (
  rideId: string,
  updates: Partial<DbRide>
): Promise<void> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.driverId) payload.driver_id = updates.driverId;
      if (updates.driverName) payload.driver_name = updates.driverName;
      if (updates.acceptedAt) payload.accepted_at = new Date(updates.acceptedAt).toISOString();
      if (updates.startedAt) payload.started_at = new Date(updates.startedAt).toISOString();
      if (updates.finishedAt) payload.finished_at = new Date(updates.finishedAt).toISOString();

      await sb.from('rides').update(payload).eq('id', rideId);
      return;
    } catch (e) {
      console.warn('Erro ao atualizar corrida no Supabase:', e);
    }
  }

  // Fallback API
  if (updates.status === 'accepted' && updates.driverId) {
    await fetch(`/api/rides/${rideId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: updates.driverId })
    });
  } else if (updates.status === 'in_progress') {
    await fetch(`/api/rides/${rideId}/start`, { method: 'POST' });
  } else if (updates.status === 'finished') {
    await fetch(`/api/rides/${rideId}/finish`, { method: 'POST' });
  }
};
