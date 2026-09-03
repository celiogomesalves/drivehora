import { getSupabase } from '../supabase';
import type { UserProfile, ClientProfile, DriverProfile, DriverVerificationStatus } from '../types/auth';

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

// Timeout helper para chamadas de banco nunca travarem
const withTimeout = async (promise: any, timeoutMs = 12000): Promise<any> => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite de conexão com o banco esgotado (12s)')), timeoutMs))
  ]);
};

// 0. Testar status da conexão com o banco Supabase
export const dbCheckSupabaseStatus = async (): Promise<{ connected: boolean; message?: string }> => {
  const sb = getSupabase();
  if (!sb) {
    return { connected: false, message: 'Credenciais do Supabase não configuradas no sistema.' };
  }
  try {
    const res: any = await withTimeout(sb.from('profiles').select('id').limit(1), 6000);
    if (res?.error) {
      return { connected: false, message: `Erro ao conectar com Supabase: ${res.error.message}` };
    }
    return { connected: true };
  } catch (e: any) {
    return { connected: false, message: e.message || 'Falha de conexão com o banco de dados.' };
  }
};

// 1. Salvar ou atualizar Perfil de Usuário
export const dbSaveProfile = async (profile: UserProfile): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(`drivehora_profile_${profile.id}`, JSON.stringify(profile));
  } catch (e) {}

  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await withTimeout(sb.from('profiles').upsert({
        id: profile.id,
        email: profile.email,
        full_name: profile.fullName,
        role: profile.role,
        phone: profile.phone,
        avatar_url: profile.avatarUrl,
        updated_at: new Date().toISOString()
      }), 8000);
      if (res?.error) {
        console.warn('Erro ao salvar profile no Supabase:', res.error);
        return { success: false, error: res.error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Erro ao salvar profile no Supabase:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: true };
};

// 2. Salvar ou atualizar Perfil de Cliente (Passageiro) com Auto-garantia de Profile
export const dbSaveClientProfile = async (
  client: ClientProfile, 
  userProfile?: UserProfile | null
): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(`drivehora_client_profile_${client.userId}`, JSON.stringify(client));
  } catch (e) {}

  const sb = getSupabase();
  if (!sb) {
    return { success: false, error: 'Banco de dados Supabase desconectado. Conecte o banco antes de enviar.' };
  }

  try {
    // Garantir que a tabela 'profiles' possui o registro do usuário para não violar a Foreign Key
    let current = userProfile;
    if (!current) {
      const saved = localStorage.getItem('drivehora_current_user');
      if (saved) {
        try { current = JSON.parse(saved); } catch (e) {}
      }
    }

    await withTimeout(sb.from('profiles').upsert({
      id: client.userId,
      email: current?.email || `client_${client.userId}@drivehora.com`,
      full_name: current?.fullName || 'Passageiro DriveHora',
      role: 'client',
      phone: client.phone || current?.phone || '(11) 98765-4321',
      updated_at: new Date().toISOString()
    }), 8000);

    const res: any = await withTimeout(sb.from('clients').upsert({
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
    }), 8000);

    if (res?.error) {
      console.warn('Erro ao salvar client no Supabase:', res.error);
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn('Erro ao salvar client no Supabase:', e);
    return { success: false, error: e.message };
  }
};

// 3. Obter Perfil de Cliente
export const dbGetClientProfile = async (userId: string): Promise<ClientProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await withTimeout(sb.from('clients').select('*').eq('user_id', userId).maybeSingle(), 6000);
      if (!res?.error && res?.data) {
        return {
          id: res.data.id,
          userId: res.data.user_id,
          cpf: res.data.cpf || '',
          phone: res.data.phone || '',
          cep: res.data.cep || '',
          street: res.data.street || '',
          number: res.data.number || '',
          complement: res.data.complement || '',
          neighborhood: res.data.neighborhood || '',
          city: res.data.city || '',
          state: res.data.state || '',
          isProfileComplete: Boolean(res.data.is_profile_complete)
        };
      }
    } catch (e) {}
  }
  try {
    const local = localStorage.getItem(`drivehora_client_profile_${userId}`);
    return local ? JSON.parse(local) : null;
  } catch (e) {
    return null;
  }
};

// 4. Salvar ou atualizar Perfil de Motorista (Com auto-garantia de Profile e proteção contra timeout)
export const dbSaveDriverProfile = async (
  driver: DriverProfile, 
  userProfile?: UserProfile | null
): Promise<{ success: boolean; error?: string }> => {
  // Salvar no localStorage de forma segura (sem estourar cota)
  try {
    const lightweightDriver = { ...driver, cnhUrl: undefined, crlvUrl: undefined, selfieUrl: undefined };
    localStorage.setItem(`drivehora_driver_profile_${driver.userId}`, JSON.stringify(lightweightDriver));
  } catch (e) {
    console.warn('Armazenamento local cheio, prosseguindo com gravação no banco.');
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: false, error: 'Banco de dados Supabase desconectado. Conecte o banco de dados antes de enviar os documentos.' };
  }

  try {
    // 1. Garantir que a tabela 'profiles' possui o registro antes de inserir em 'drivers'
    let current = userProfile;
    if (!current) {
      const saved = localStorage.getItem('drivehora_current_user');
      if (saved) {
        try { current = JSON.parse(saved); } catch (e) {}
      }
    }

    await withTimeout(sb.from('profiles').upsert({
      id: driver.userId,
      email: current?.email || `driver_${driver.userId}@drivehora.com`,
      full_name: current?.fullName || 'Motorista Parceiro',
      role: 'driver',
      phone: driver.phone || current?.phone || '(11) 98765-4321',
      updated_at: new Date().toISOString()
    }), 8000);

    // 2. Inserir ou atualizar na tabela 'drivers'
    const res: any = await withTimeout(sb.from('drivers').upsert({
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
    }), 10000);

    if (res?.error) {
      console.warn('Erro ao salvar driver no Supabase:', res.error);
      return { success: false, error: `Erro no Supabase: ${res.error.message}` };
    }
    return { success: true };
  } catch (e: any) {
    console.warn('Erro ao salvar driver no Supabase:', e);
    return { success: false, error: e.message || 'Falha ao salvar no banco de dados.' };
  }
};

// 5. Obter Perfil de Motorista
export const dbGetDriverProfile = async (userId: string): Promise<DriverProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await withTimeout(sb.from('drivers').select('*').eq('user_id', userId).maybeSingle(), 6000);
      if (!res?.error && res?.data) {
        return {
          id: res.data.id,
          userId: res.data.user_id,
          cpf: res.data.cpf || '',
          phone: res.data.phone || '',
          cnhNumber: res.data.cnh_number || '',
          cnhCategory: res.data.cnh_category || 'B',
          vehicleBrand: res.data.vehicle_brand || '',
          vehicleModel: res.data.vehicle_model || '',
          vehicleYear: res.data.vehicle_year || '',
          vehiclePlate: res.data.vehicle_plate || '',
          vehicleColor: res.data.vehicle_color || '',
          cnhUrl: res.data.cnh_url,
          crlvUrl: res.data.crlv_url,
          selfieUrl: res.data.selfie_url,
          verificationStatus: res.data.verification_status || 'pending_docs',
          rating: Number(res.data.rating) || 5.0,
          totalRides: Number(res.data.total_rides) || 0
        };
      }
    } catch (e) {}
  }
  try {
    const local = localStorage.getItem(`drivehora_driver_profile_${userId}`);
    return local ? JSON.parse(local) : null;
  } catch (e) {
    return null;
  }
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

// ========================================================
// RECURSOS EXCLUSIVOS DO PAINEL DE ADMINISTRAÇÃO
// ========================================================

// 8. Buscar todos os motoristas cadastrados
export const dbGetAllDrivers = async (): Promise<DriverProfile[]> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('drivers').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          cpf: d.cpf || '',
          phone: d.phone || '',
          cnhNumber: d.cnh_number || '',
          cnhCategory: d.cnh_category || 'B',
          vehicleBrand: d.vehicle_brand || '',
          vehicleModel: d.vehicle_model || '',
          vehicleYear: d.vehicle_year || '',
          vehiclePlate: d.vehicle_plate || '',
          vehicleColor: d.vehicle_color || '',
          cnhUrl: d.cnh_url,
          crlvUrl: d.crlv_url,
          selfieUrl: d.selfie_url,
          verificationStatus: d.verification_status || 'pending_docs',
          rating: Number(d.rating) || 5.0,
          totalRides: Number(d.total_rides) || 0
        }));
      }
    } catch (e) {
      console.warn('Erro ao buscar motoristas:', e);
    }
  }
  return [];
};

// 9. Buscar todos os clientes cadastrados
export const dbGetAllClients = async (): Promise<ClientProfile[]> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          cpf: c.cpf || '',
          phone: c.phone || '',
          cep: c.cep || '',
          street: c.street || '',
          number: c.number || '',
          complement: c.complement || '',
          neighborhood: c.neighborhood || '',
          city: c.city || '',
          state: c.state || '',
          isProfileComplete: Boolean(c.is_profile_complete)
        }));
      }
    } catch (e) {
      console.warn('Erro ao buscar clientes:', e);
    }
  }
  return [];
};

// 10. Atualizar Status de Verificação de Motorista pelo Admin
export const dbAdminUpdateDriverStatus = async (
  driverId: string, 
  status: DriverVerificationStatus
): Promise<void> => {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('drivers').update({ verification_status: status }).eq('id', driverId);
    } catch (e) {
      console.warn('Erro ao atualizar status do motorista:', e);
    }
  }
};
