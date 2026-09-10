import { getSupabase } from '../supabase';
import type { UserProfile, ClientProfile, DriverProfile, DriverPublicProfile, DriverVerificationStatus } from '../types/auth';
import { isSuperAdminEmail } from '../types/auth';

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
  status: 'searching' | 'accepted' | 'to_pickup' | 'in_progress' | 'finished' | 'cancelled';
  paymentMethod?: 'pix' | 'credit_card' | 'cash' | 'card_machine';
  paymentStatus?: 'pending' | 'paid' | 'in_person_pending' | 'in_person_completed' | 'failed';
  paymentGateway?: 'asaas' | 'mercadopago' | 'stripe';
  paymentExternalId?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  driverAcknowledgedAt?: number;
}

// Timeout helper para chamadas de banco nunca travarem
const withTimeout = async (promise: any, timeoutMs = 12000): Promise<any> => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite de conexão com o banco esgotado (12s)')), timeoutMs))
  ]);
};

// Gerador determinístico de ID baseado no e-mail (garante consistência entre logins)
export const generateUserIdFromEmail = (email: string): string => {
  const clean = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const safeStr = clean.replace(/[^a-z0-9]/g, '').slice(0, 16);
  return `usr_${safeStr}_${Math.abs(hash).toString(36)}`;
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

// 0.1 Buscar perfil pelo e-mail com busca case-insensitive
export const dbFindProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await withTimeout(
        sb.from('profiles').select('*').ilike('email', email.trim()).maybeSingle(),
        6000
      );
      if (!res?.error && res?.data) {
        return {
          id: res.data.id,
          email: res.data.email,
          fullName: res.data.full_name || res.data.name || 'Usuário DriveHora',
          role: res.data.role || 'client',
          phone: res.data.phone || '',
          avatarUrl: res.data.avatar_url,
          isAdmin: isSuperAdminEmail(res.data.email),
          activeSessionToken: res.data.active_session_token,
          activeDeviceName: res.data.active_device_name,
          lastActiveAt: res.data.last_active_at,
          createdAt: res.data.created_at
        };
      }
    } catch (e) {
      console.warn('Busca de perfil por email:', e);
    }
  }
  return null;
};

// 1. Salvar ou atualizar Perfil de Usuário (E sincronizar automaticamente em clients ou drivers)
export const dbSaveProfile = async (profile: UserProfile): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(`drivehora_profile_${profile.id}`, JSON.stringify(profile));
  } catch (e) {}

  const sb = getSupabase();
  if (sb) {
    try {
      const upsertData: any = {
        id: profile.id,
        email: profile.email.toLowerCase().trim(),
        full_name: profile.fullName,
        role: profile.role,
        phone: profile.phone || '',
        avatar_url: profile.avatarUrl,
        updated_at: new Date().toISOString()
      };

      if (profile.activeSessionToken) {
        upsertData.active_session_token = profile.activeSessionToken;
      }
      if (profile.activeDeviceName) {
        upsertData.active_device_name = profile.activeDeviceName;
      }
      if (profile.lastActiveAt) {
        upsertData.last_active_at = profile.lastActiveAt;
      }

      await withTimeout(sb.from('profiles').upsert(upsertData), 8000);

      // Sincronizar automaticamente na tabela clients para o admin visualizar
      if (profile.role === 'client') {
        await withTimeout(sb.from('clients').upsert({
          id: 'client_' + profile.id,
          user_id: profile.id,
          phone: profile.phone || '',
          is_profile_complete: true
        }), 8000);
      } else if (profile.role === 'driver') {
        // APENAS cria a linha se ainda não existir — NUNCA sobrescreve o verification_status
        // pois ele é gerenciado exclusivamente pelo Admin
        await withTimeout(
          sb.from('drivers')
            .upsert({
              id: 'driver_' + profile.id,
              user_id: profile.id,
              phone: profile.phone || '',
              verification_status: 'pending_docs'
            }, { onConflict: 'id', ignoreDuplicates: true }),
          8000
        );
      }

      return { success: true };
    } catch (e: any) {
      console.warn('Erro ao salvar profile no Supabase:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: true };
};

// 1.1 Atualizar Token de Sessão Ativa do Usuário
export const dbUpdateUserSession = async (
  userId: string,
  sessionToken: string,
  deviceName: string
): Promise<boolean> => {
  if (!userId || !sessionToken) return false;
  const sb = getSupabase();
  if (!sb) return false;

  try {
    await withTimeout(
      sb.from('profiles').update({
        active_session_token: sessionToken,
        active_device_name: deviceName,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', userId),
      6000
    );
    return true;
  } catch (err) {
    console.warn('Erro ao atualizar sessão no Supabase:', err);
    return false;
  }
};

// 1.2 Verificar se a sessão local ainda é a sessão ativa autorizada
export const dbCheckUserSession = async (
  userId: string,
  localSessionToken: string
): Promise<{ valid: boolean; activeDevice?: string }> => {
  if (!userId || !localSessionToken) return { valid: true };
  const sb = getSupabase();
  if (!sb) return { valid: true };

  try {
    const res: any = await withTimeout(
      sb.from('profiles').select('active_session_token, active_device_name').eq('id', userId).maybeSingle(),
      4000
    );

    if (res?.data) {
      const serverToken = res.data.active_session_token;
      // Se não há token no servidor ainda, consideramos válida
      if (!serverToken) return { valid: true };
      
      // Se o token no servidor for diferente do local, outra sessão assumiu o controle!
      if (serverToken !== localSessionToken) {
        return { 
          valid: false, 
          activeDevice: res.data.active_device_name || 'Outro Dispositivo' 
        };
      }
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
};

// 1.3 Forçar Desconexão de Outros Dispositivos e Assumir Controle Deste Dispositivo
export const dbForceDisconnectOtherSessions = async (
  userId: string,
  newSessionToken: string,
  deviceName: string,
  role?: string
): Promise<boolean> => {
  if (!userId || !newSessionToken) return false;
  const sb = getSupabase();
  if (!sb) return false;

  try {
    // 1. Atualiza a sessão para este novo token e dispositivo
    await withTimeout(
      sb.from('profiles').update({
        active_session_token: newSessionToken,
        active_device_name: deviceName,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', userId),
      6000
    );

    // 2. Se for motorista, desliga o modo online para que ele religue no novo aparelho conscientemente
    if (role === 'driver') {
      await withTimeout(
        sb.from('drivers').update({ is_online: false }).eq('user_id', userId),
        6000
      );
    }

    return true;
  } catch (err) {
    console.warn('Erro ao forçar desconexão no Supabase:', err);
    return false;
  }
};

// 2. Salvar ou atualizar Perfil de Cliente (Passageiro) com Auto-garantia de Profile
export const dbSaveClientProfile = async (
  client: ClientProfile,
  userProfile?: UserProfile | null
): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(`drivehora_client_profile_${client.userId}`, JSON.stringify(client));
    localStorage.setItem(`drivehora_client_${client.userId}`, JSON.stringify(client));
  } catch (e) {}

  const sb = getSupabase();
  if (!sb) {
    return { success: true };
  }

  try {
    let current = userProfile;
    if (!current) {
      const saved = localStorage.getItem('drivehora_current_user');
      if (saved) {
        try { current = JSON.parse(saved); } catch (e) {}
      }
    }

    const resolvedFullName = client.fullName?.trim() || current?.fullName?.trim() || 'Passageiro DriveHora';
    const resolvedPhone = client.phone || current?.phone || '';
    const resolvedEmail = (current?.email || client.email || `client_${client.userId}@drivehora.com`).toLowerCase().trim();

    // 1. Atualizar profiles (garantindo que full_name seja gravado com o nome real digitado)
    await withTimeout(sb.from('profiles').upsert({
      id: client.userId,
      email: resolvedEmail,
      full_name: resolvedFullName,
      role: current?.role || 'client',
      phone: resolvedPhone,
      updated_at: new Date().toISOString()
    }), 8000);

    // 2. Atualizar clients (reutilizando o ID existente se já houver registro para o user_id)
    const existingClient = await sb.from('clients').select('id').eq('user_id', client.userId).maybeSingle();
    const targetClientId = existingClient?.data?.id || client.id || ('client_' + client.userId);

    const cRes: any = await withTimeout(sb.from('clients').upsert({
      id: targetClientId,
      user_id: client.userId,
      full_name: resolvedFullName,
      cpf: client.cpf ? client.cpf.replace(/\D/g, '') : null,
      phone: resolvedPhone,
      cep: client.cep ? client.cep.replace(/\D/g, '') : null,
      street: client.street || '',
      number: client.number || '',
      complement: client.complement || '',
      neighborhood: client.neighborhood || '',
      city: client.city || '',
      state: client.state || '',
      is_profile_complete: true
    }), 8000);

    if (cRes?.error) {
      console.warn('Erro ao salvar client no Supabase:', cRes.error);
    }

    // 3. Se o usuário também for motorista cadastrado, sincronizar o nome, cpf e telefone na tabela drivers
    try {
      await sb.from('drivers').update({
        driver_name: resolvedFullName,
        full_name: resolvedFullName,
        cpf: client.cpf,
        phone: resolvedPhone
      }).or(`user_id.eq.${client.userId},id.eq.driver_${client.userId}`);
    } catch (dErr) {}

    // 4. Sincronizar cache local do usuário ativo
    try {
      const savedUserStr = localStorage.getItem('drivehora_current_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u.id === client.userId || u.email?.toLowerCase() === resolvedEmail) {
          u.fullName = resolvedFullName;
          u.phone = resolvedPhone;
          localStorage.setItem('drivehora_current_user', JSON.stringify(u));
        }
      }
    } catch (e) {}

    return { success: true };
  } catch (e: any) {
    console.warn('Erro ao sincronizar client no Supabase (salvo localmente):', e);
    return { success: true };
  }
};

// 3. Obter Perfil de Cliente (com busca resiliente por userId e email e junção com profiles)
export const dbGetClientProfile = async (userId: string, email?: string): Promise<ClientProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      let pQuery = sb.from('profiles').select('*');
      if (userId) {
        pQuery = pQuery.eq('id', userId);
      } else if (email) {
        pQuery = pQuery.ilike('email', email.trim());
      }

      const [cRes, pRes] = await Promise.all([
        withTimeout(sb.from('clients').select('*').eq('user_id', userId).maybeSingle(), 5000),
        withTimeout(pQuery.maybeSingle(), 5000)
      ]);

      const clientData = cRes?.data;
      const profileData = pRes?.data;

      if (clientData || profileData) {
        const fullName = profileData?.full_name || clientData?.full_name || '';
        const profile: ClientProfile = {
          id: clientData?.id || ('client_' + (userId || profileData?.id)),
          userId: clientData?.user_id || userId || profileData?.id,
          fullName: fullName,
          email: profileData?.email || email || '',
          cpf: clientData?.cpf || '',
          phone: clientData?.phone || profileData?.phone || '',
          cep: clientData?.cep || '',
          street: clientData?.street || '',
          number: clientData?.number || '',
          complement: clientData?.complement || '',
          neighborhood: clientData?.neighborhood || '',
          city: clientData?.city || '',
          state: clientData?.state || '',
          isProfileComplete: Boolean(clientData?.is_profile_complete || (clientData?.cpf && clientData?.street))
        };

        try {
          localStorage.setItem(`drivehora_client_profile_${userId}`, JSON.stringify(profile));
        } catch (e) {}

        return profile;
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil do cliente:', e);
    }
  }

  try {
    const local = localStorage.getItem(`drivehora_client_profile_${userId}`);
    if (local) return JSON.parse(local);
  } catch (e) {}

  return null;
};

// 4. Salvar ou atualizar Perfil de Motorista
export const dbSaveDriverProfile = async (
  driver: DriverProfile, 
  userProfile?: UserProfile | null
): Promise<{ success: boolean; error?: string }> => {
  try {
    const lightweightDriver = { ...driver, cnhUrl: undefined, crlvUrl: undefined, selfieUrl: undefined };
    localStorage.setItem(`drivehora_driver_profile_${driver.userId}`, JSON.stringify(lightweightDriver));
    localStorage.setItem(`drivehora_driver_${driver.userId}`, JSON.stringify(lightweightDriver));
  } catch (e) {
    console.warn('Armazenamento local cheio, prosseguindo com gravação no banco.');
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: false, error: 'Banco de dados Supabase desconectado.' };
  }

  try {
    let current = userProfile;
    if (!current) {
      const saved = localStorage.getItem('drivehora_current_user');
      if (saved) {
        try { current = JSON.parse(saved); } catch (e) {}
      }
    }

    const resolvedName = driver.fullName?.trim() || driver.driverName?.trim() || current?.fullName?.trim() || 'Motorista Parceiro';
    const resolvedPhone = driver.phone || current?.phone || '';
    const resolvedEmail = (current?.email || `driver_${driver.userId}@drivehora.com`).toLowerCase().trim();

    // 1. Atualizar profiles (garantindo que full_name seja gravado com o nome do motorista)
    await withTimeout(sb.from('profiles').upsert({
      id: driver.userId,
      email: resolvedEmail,
      full_name: resolvedName,
      role: current?.role === 'admin' ? 'admin' : 'driver',
      phone: resolvedPhone,
      updated_at: new Date().toISOString()
    }), 8000);

    // 2. Atualizar drivers (reutilizando o ID existente se já houver registro para o user_id)
    const existingDriver = await sb.from('drivers').select('id').eq('user_id', driver.userId).maybeSingle();
    const targetDriverId = existingDriver?.data?.id || driver.id || ('driver_' + driver.userId);

    const res: any = await withTimeout(sb.from('drivers').upsert({
      id: targetDriverId,
      user_id: driver.userId,
      driver_name: resolvedName,
      full_name: resolvedName,
      cpf: driver.cpf ? driver.cpf.replace(/\D/g, '') : null,
      phone: resolvedPhone,
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

    // 3. Se houver registro em clients para este mesmo usuário, sincronizar CPF e Telefone também
    try {
      await sb.from('clients').update({
        cpf: driver.cpf,
        phone: resolvedPhone,
        full_name: resolvedName
      }).eq('user_id', driver.userId);
    } catch (cErr) {}

    // 4. Sincronizar cache local do usuário ativo
    try {
      const savedUserStr = localStorage.getItem('drivehora_current_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u.id === driver.userId || u.email?.toLowerCase() === resolvedEmail) {
          u.fullName = resolvedName;
          u.phone = resolvedPhone;
          localStorage.setItem('drivehora_current_user', JSON.stringify(u));
        }
      }
    } catch (e) {}

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
export const dbGetDriverProfile = async (userId: string, email?: string): Promise<DriverProfile | null> => {
  const sb = getSupabase();
  if (sb) {
    try {
      let res: any = await withTimeout(sb.from('drivers').select('*').eq('user_id', userId).maybeSingle(), 6000);
      let pData: any = null;

      if ((!res?.data || res?.error) && email) {
        const pRes: any = await withTimeout(
          sb.from('profiles').select('*').ilike('email', email.trim()).maybeSingle(),
          4000
        );
        if (pRes?.data?.id) {
          pData = pRes.data;
          res = await withTimeout(sb.from('drivers').select('*').eq('user_id', pRes.data.id).maybeSingle(), 4000);
        }
      }

      if (!pData && (res?.data?.user_id || userId)) {
        const pRes: any = await withTimeout(
          sb.from('profiles').select('*').eq('id', res?.data?.user_id || userId).maybeSingle(),
          4000
        );
        pData = pRes?.data;
      }

      if (!res?.error && res?.data) {
        let driverName = res.data.driver_name || res.data.full_name || pData?.full_name || 'Motorista Parceiro';
        if (driverName.includes('@')) {
          if (pData?.full_name && !pData.full_name.includes('@')) {
            driverName = pData.full_name;
          } else {
            const userPart = driverName.split('@')[0];
            driverName = userPart.replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          }
        }

        const profile: DriverProfile = {
          id: res.data.id,
          userId: res.data.user_id,
          fullName: driverName,
          driverName: driverName,
          cpf: res.data.cpf || pData?.cpf || '',
          phone: res.data.phone || pData?.phone || '',
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
          verificationStatus: dataVerificationStatus(res.data.verification_status),
          rating: Number(res.data.rating) || 5.0,
          totalRides: Number(res.data.total_rides) || 0,
          isOnline: Boolean(res.data.is_online)
        };

        try {
          localStorage.setItem(`drivehora_driver_profile_${res.data.user_id}`, JSON.stringify(profile));
          localStorage.setItem(`drivehora_driver_profile_${userId}`, JSON.stringify(profile));
          localStorage.setItem(`drivehora_driver_${res.data.user_id}`, JSON.stringify(profile));
        } catch (e) {}

        return profile;
      }
    } catch (e) {}
  }
  try {
    const local = localStorage.getItem(`drivehora_driver_profile_${userId}`) || localStorage.getItem(`drivehora_driver_${userId}`);
    return local ? JSON.parse(local) : null;
  } catch (e) {
    return null;
  }
};

const dataVerificationStatus = (status: string): DriverVerificationStatus => {
  if (status === 'approved' || status === 'under_review' || status === 'rejected' || status === 'suspended') {
    return status;
  }
  return 'pending_docs';
};

// 6. Criar Corrida
export const dbCreateRide = async (ride: DbRide): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const payload: any = {
        id: ride.id,
        client_id: ride.clientId,
        origin: ride.origin,
        destination: ride.destination,
        hours: Number(ride.hours) || 1,
        hourly_rate: Number(ride.hourlyRate) || 50,
        total: Number(ride.total) || 50,
        commission: Number(ride.commission) || 7.5,
        driver_net: Number(ride.driverNet) || 42.5,
        status: ride.status || 'searching'
      };
      if (ride.originLat) payload.origin_lat = ride.originLat;
      if (ride.originLng) payload.origin_lng = ride.originLng;
      if (ride.destLat) payload.dest_lat = ride.destLat;
      if (ride.destLng) payload.dest_lng = ride.destLng;

      const res = await sb.from('rides').insert([payload]);
      if (res?.error) {
        console.warn('Erro ao inserir corrida no Supabase:', res.error);
        return { success: false, error: res.error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Erro ao inserir corrida no Supabase:', e);
      return { success: false, error: e.message };
    }
  }

  try {
    await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ride)
    });
  } catch (e) {}
  return { success: true };
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
      if (updates.acceptedAt) payload.accepted_at = new Date(updates.acceptedAt).toISOString();
      if (updates.startedAt) payload.started_at = new Date(updates.startedAt).toISOString();
      if (updates.finishedAt) payload.finished_at = new Date(updates.finishedAt).toISOString();

      await sb.from('rides').update(payload).eq('id', rideId);
      return;
    } catch (e) {
      console.warn('Erro ao atualizar corrida no Supabase:', e);
    }
  }

  if (updates.status === 'accepted' && updates.driverId) {
    await fetch(`/api/rides/${rideId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: updates.driverId })
    });
  } else if (updates.status === 'to_pickup') {
    await fetch(`/api/rides/${rideId}/to-pickup`, { method: 'POST' }).catch(() => {});
  } else if (updates.status === 'in_progress') {
    await fetch(`/api/rides/${rideId}/start`, { method: 'POST' });
  } else if (updates.status === 'finished') {
    await fetch(`/api/rides/${rideId}/finish`, { method: 'POST' });
  }
};

// 7.1 Cancelar Corrida pelo Passageiro
export const dbCancelRide = async (rideId: string): Promise<void> => {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('rides').update({ status: 'cancelled' }).eq('id', rideId);
      return;
    } catch (e) {
      console.warn('Erro ao cancelar corrida no Supabase:', e);
    }
  }

  try {
    await fetch(`/api/rides/${rideId}/cancel`, { method: 'POST' });
  } catch (e) {}
};

// 7.1.1 Confirmar leitura de cancelamento pelo Motorista no Banco
export const dbAcknowledgeRide = async (rideId: string): Promise<void> => {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('rides').update({ driver_acknowledged_at: new Date().toISOString() }).eq('id', rideId);
    } catch (e) {
      console.warn('Erro ao atualizar driver_acknowledged_at no Supabase:', e);
    }
  }

  try {
    await fetch(`/api/rides/${rideId}/acknowledge`, { method: 'POST' });
  } catch (e) {}
};

// 7.2 Excluir Definitivamente Corrida pelo Passageiro / Admin
export const dbDeleteRide = async (rideId: string): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await sb.from('rides').delete().eq('id', rideId);
      if (res?.error) {
        console.warn('Erro ao excluir corrida no Supabase:', res.error);
        return { success: false, error: res.error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Erro ao excluir corrida no Supabase:', e);
      return { success: false, error: e.message };
    }
  }

  try {
    await fetch(`/api/rides/${rideId}`, { method: 'DELETE' });
  } catch (e) {}
  return { success: true };
};

// 8. Buscar todos os motoristas cadastrados (unindo profiles, drivers e clients)
export const dbGetAllDrivers = async (): Promise<DriverProfile[]> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const [driversRes, profilesRes, clientsRes] = await Promise.all([
        sb.from('drivers').select('*').order('created_at', { ascending: false }),
        sb.from('profiles').select('*'),
        sb.from('clients').select('*')
      ]);

      const profileMap = new Map<string, any>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.id) profileMap.set(p.id, p);
        if (p.email) profileMap.set(p.email.toLowerCase().trim(), p);
      });

      const clientMap = new Map<string, any>();
      (clientsRes.data || []).forEach((c: any) => {
        if (c.user_id) clientMap.set(c.user_id, c);
        if (c.id) clientMap.set(c.id, c);
      });

      const list: DriverProfile[] = (driversRes.data || []).map((d: any) => {
        const p = profileMap.get(d.user_id) || profileMap.get(d.id);
        const c = clientMap.get(d.user_id) || clientMap.get(p?.id);
        const isOnline = d.is_online === true || d.is_online === 'true' || d.is_online === 1 || Boolean(d.is_online);

        // Resolução de nome completa e inteligente
        let driverName = d.driver_name || d.full_name || p?.full_name || p?.name || c?.full_name || c?.fullName;
        if (!driverName || driverName.includes('@')) {
          if (p?.full_name && !p.full_name.includes('@')) {
            driverName = p.full_name;
          } else if (c?.full_name && !c.full_name.includes('@')) {
            driverName = c.full_name;
          } else if (driverName && driverName.includes('@')) {
            const userPart = driverName.split('@')[0];
            driverName = userPart.replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          } else {
            driverName = 'Motorista Parceiro';
          }
        }

        const resolvedCpf = d.cpf || c?.cpf || p?.cpf || '';
        const resolvedPhone = d.phone || p?.phone || c?.phone || '';

        return {
          id: d.id,
          userId: d.user_id,
          fullName: driverName,
          driverName: driverName,
          cpf: resolvedCpf,
          phone: resolvedPhone,
          cnhNumber: d.cnh_number || '',
          cnhCategory: d.cnh_category || 'B',
          vehicleBrand: d.vehicle_brand || 'Motorista',
          vehicleModel: d.vehicle_model || 'Veículo Particular',
          vehicleYear: d.vehicle_year || '',
          vehiclePlate: d.vehicle_plate || 'Mercosul',
          vehicleColor: d.vehicle_color || 'Prata',
          cnhUrl: d.cnh_url,
          crlvUrl: d.crlv_url,
          selfieUrl: d.selfie_url,
          verificationStatus: dataVerificationStatus(d.verification_status),
          rating: Number(d.rating) || 5.0,
          totalRides: Number(d.total_rides) || 0,
          isOnline: isOnline,
          currentLat: d.current_lat ? Number(d.current_lat) : undefined,
          currentLng: d.current_lng ? Number(d.current_lng) : undefined
        };
      });

      return list;
    } catch (e) {
      console.warn('Erro ao buscar motoristas no Supabase:', e);
    }
  }
  return [];
};

// 9. Buscar todos os clientes cadastrados (unindo profiles e clients para o Admin Dashboard)
export const dbGetAllClients = async (): Promise<ClientProfile[]> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const [profilesRes, clientsRes, driversRes] = await Promise.all([
        sb.from('profiles').select('*').order('created_at', { ascending: false }),
        sb.from('clients').select('*').order('created_at', { ascending: false }),
        sb.from('drivers').select('*')
      ]);

      const clientMap = new Map<string, any>();
      (clientsRes.data || []).forEach((c: any) => {
        if (c.user_id) clientMap.set(c.user_id, c);
        if (c.id) clientMap.set(c.id, c);
      });

      const driverMap = new Map<string, any>();
      (driversRes.data || []).forEach((d: any) => {
        if (d.user_id) driverMap.set(d.user_id, d);
        if (d.id) driverMap.set(d.id, d);
      });

      const list: ClientProfile[] = [];
      const seenUserIds = new Set<string>();

      (profilesRes.data || []).forEach((p: any) => {
        // Exibir se for client ou se tiver cadastro de passageiro
        const c = clientMap.get(p.id);
        const d = driverMap.get(p.id);
        seenUserIds.add(p.id);

        let resolvedName = p.full_name || c?.full_name || d?.driver_name || d?.full_name;
        if (!resolvedName || resolvedName.includes('@')) {
          if (resolvedName && resolvedName.includes('@')) {
            const userPart = resolvedName.split('@')[0];
            resolvedName = userPart.replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          } else {
            resolvedName = 'Cliente DriveHora';
          }
        }

        list.push({
          id: c?.id || 'client_' + p.id,
          userId: p.id,
          fullName: resolvedName,
          email: p.email,
          cpf: c?.cpf || d?.cpf || '',
          phone: p.phone || c?.phone || d?.phone || '',
          cep: c?.cep || '',
          street: c?.street || '',
          number: c?.number || '',
          complement: c?.complement || '',
          neighborhood: c?.neighborhood || '',
          city: c?.city || '',
          state: c?.state || '',
          isProfileComplete: Boolean(c?.is_profile_complete || (c?.cpf && c?.street)),
          createdAt: p.created_at || p.updated_at
        });
      });

      (clientsRes.data || []).forEach((c: any) => {
        if (!seenUserIds.has(c.user_id)) {
          list.push({
            id: c.id,
            userId: c.user_id,
            fullName: c.full_name || 'Passageiro',
            cpf: c.cpf || '',
            phone: c.phone || '',
            cep: c.cep || '',
            street: c.street || '',
            number: c.number || '',
            complement: c.complement || '',
            neighborhood: c.neighborhood || '',
            city: c.city || '',
            state: c.state || '',
            isProfileComplete: true,
            createdAt: c.created_at
          });
        }
      });

      return list;
    } catch (e) {
      console.warn('Erro ao buscar clientes no Supabase:', e);
    }
  }
  return [];
};

// 9.1 Atualizar Dados do Motorista pelo Administrador (Sincroniza profiles, drivers e clients)
export const dbAdminUpdateDriverProfile = async (
  driver: Partial<DriverProfile> & { id: string; userId: string }
): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  const resolvedName = driver.fullName || driver.driverName;

  try {
    if (sb) {
      // 1. Atualizar profiles
      if (resolvedName || driver.phone) {
        const pUpdate: any = { updated_at: new Date().toISOString() };
        if (resolvedName) pUpdate.full_name = resolvedName;
        if (driver.phone) pUpdate.phone = driver.phone;
        await sb.from('profiles').update(pUpdate).eq('id', driver.userId);
      }

      // 2. Atualizar drivers
      const updateData: any = {};
      if (resolvedName) {
        updateData.driver_name = resolvedName;
        updateData.full_name = resolvedName;
      }
      if (driver.cpf !== undefined) updateData.cpf = driver.cpf;
      if (driver.phone !== undefined) updateData.phone = driver.phone;
      if (driver.cnhNumber !== undefined) updateData.cnh_number = driver.cnhNumber;
      if (driver.cnhCategory !== undefined) updateData.cnh_category = driver.cnhCategory;
      if (driver.vehicleBrand !== undefined) updateData.vehicle_brand = driver.vehicleBrand;
      if (driver.vehicleModel !== undefined) updateData.vehicle_model = driver.vehicleModel;
      if (driver.vehicleYear !== undefined) updateData.vehicle_year = driver.vehicleYear;
      if (driver.vehiclePlate !== undefined) updateData.vehicle_plate = driver.vehiclePlate;
      if (driver.vehicleColor !== undefined) updateData.vehicle_color = driver.vehicleColor;
      if (driver.verificationStatus !== undefined) updateData.verification_status = driver.verificationStatus;

      await sb.from('drivers').update(updateData).or(`id.eq.${driver.id},user_id.eq.${driver.userId}`);

      // 3. Atualizar clients se existir
      try {
        const clientUpdate: any = {};
        if (driver.cpf) clientUpdate.cpf = driver.cpf;
        if (driver.phone) clientUpdate.phone = driver.phone;
        if (resolvedName) clientUpdate.full_name = resolvedName;
        await sb.from('clients').update(clientUpdate).eq('user_id', driver.userId);
      } catch (e) {}
    }

    // 4. Atualizar cache local
    try {
      const pKey = `drivehora_driver_profile_${driver.userId}`;
      const saved = localStorage.getItem(pKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(parsed, driver);
        if (resolvedName) {
          parsed.fullName = resolvedName;
          parsed.driverName = resolvedName;
        }
        localStorage.setItem(pKey, JSON.stringify(parsed));
      }
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    console.warn('Erro ao atualizar motorista pelo Admin:', err);
    return { success: false, error: err.message };
  }
};

// 9.2 Atualizar Dados do Cliente pelo Administrador (Sincroniza profiles, clients e drivers)
export const dbAdminUpdateClientProfile = async (
  client: Partial<ClientProfile> & { id: string; userId: string }
): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  try {
    if (sb) {
      if (client.fullName || client.phone) {
        const pUpdate: any = { updated_at: new Date().toISOString() };
        if (client.fullName) pUpdate.full_name = client.fullName;
        if (client.phone) pUpdate.phone = client.phone;
        await sb.from('profiles').update(pUpdate).eq('id', client.userId);
      }

      const clientUpdate: any = {};
      if (client.fullName) clientUpdate.full_name = client.fullName;
      if (client.cpf !== undefined) clientUpdate.cpf = client.cpf;
      if (client.phone !== undefined) clientUpdate.phone = client.phone;
      if (client.cep !== undefined) clientUpdate.cep = client.cep;
      if (client.street !== undefined) clientUpdate.street = client.street;
      if (client.number !== undefined) clientUpdate.number = client.number;
      if (client.complement !== undefined) clientUpdate.complement = client.complement;
      if (client.neighborhood !== undefined) clientUpdate.neighborhood = client.neighborhood;
      if (client.city !== undefined) clientUpdate.city = client.city;
      if (client.state !== undefined) clientUpdate.state = client.state;

      await sb.from('clients').update(clientUpdate).or(`id.eq.${client.id},user_id.eq.${client.userId}`);

      // Sincronizar na tabela drivers se for motorista
      try {
        const driverUpdate: any = {};
        if (client.fullName) {
          driverUpdate.driver_name = client.fullName;
          driverUpdate.full_name = client.fullName;
        }
        if (client.cpf) driverUpdate.cpf = client.cpf;
        if (client.phone) driverUpdate.phone = client.phone;
        await sb.from('drivers').update(driverUpdate).eq('user_id', client.userId);
      } catch (e) {}
    }

    try {
      const key = `drivehora_client_profile_${client.userId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(parsed, client);
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    console.warn('Erro ao atualizar cliente pelo Admin:', err);
    return { success: false, error: err.message };
  }
};

// 10. Atualizar Status de Verificação de Motorista pelo Admin
export const dbAdminUpdateDriverStatus = async (
  driverId: string, 
  status: DriverVerificationStatus
): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await sb
        .from('drivers')
        .update({ verification_status: status })
        .or(`id.eq.${driverId},user_id.eq.${driverId}`);
      if (res?.error) {
        console.warn('Erro ao atualizar status do motorista no Supabase:', res.error);
        return { success: false, error: res.error.message };
      }
    } catch (e: any) {
      console.warn('Erro ao atualizar status do motorista:', e);
      return { success: false, error: e.message };
    }
  }

  // Atualizar cache local do storage para consistência imediata
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('drivehora_driver_profile_')) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.id === driverId || parsed.userId === driverId) {
            parsed.verificationStatus = status;
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        }
      }
    }
  } catch (e) {}

  return { success: true };
};

// 10.1 Excluir Registro de Motorista pelo Admin
export const dbAdminDeleteDriver = async (
  driverId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  if (sb) {
    try {
      // 1. Excluir da tabela drivers
      let query = sb.from('drivers').delete();
      if (userId) {
        query = query.or(`id.eq.${driverId},user_id.eq.${userId}`);
      } else {
        query = query.or(`id.eq.${driverId},user_id.eq.${driverId}`);
      }
      const res: any = await query;
      if (res?.error) {
        console.warn('Erro ao excluir motorista do Supabase:', res.error);
        return { success: false, error: res.error.message };
      }
    } catch (e: any) {
      console.warn('Erro ao excluir motorista:', e);
      return { success: false, error: e.message };
    }
  }

  // Limpar do localStorage
  try {
    const targetUserId = userId || (driverId.startsWith('driver_') ? driverId.replace('driver_', '') : driverId);
    localStorage.removeItem(`drivehora_driver_profile_${targetUserId}`);
    localStorage.removeItem(`drivehora_driver_online_${targetUserId}`);
    localStorage.removeItem(`drivehora_driver_draft_${targetUserId}`);
  } catch (e) {}

  return { success: true };
};

// 11. Atualizar Status Online/Offline do Motorista no Banco Supabase
export const dbUpdateDriverOnlineStatus = async (
  userId: string,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(`drivehora_driver_online_${userId}`, String(isOnline));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('drivehora_driver_status_changed', {
          detail: { userId, isOnline }
        })
      );
    }
  } catch (e) {}

  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await withTimeout(
        sb.from('drivers').update({ is_online: isOnline }).or(`user_id.eq.${userId},id.eq.${userId}`),
        8000
      );
      if (res?.error) {
        console.warn('Erro ao atualizar status online no Supabase:', res.error);
        return { success: false, error: res.error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Erro de comunicação ao atualizar status online:', e);
      return { success: false, error: e.message || 'Tempo limite esgotado' };
    }
  }
  return { success: true };
};

// 11.0.1 Alternar Status do Motorista pelo Administrador (Controle Emergencial Remoto)
export const dbAdminToggleDriverOnline = async (
  userId: string,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> => {
  return dbUpdateDriverOnlineStatus(userId, isOnline);
};

// 11.1 Atualizar Preferências de Pagamento do Motorista (Dinheiro, Maquininha, Chave Pix)
export const dbUpdateDriverPaymentPrefs = async (
  userId: string,
  prefs: { acceptsCash: boolean; hasCardMachine: boolean; pixKey?: string }
): Promise<{ success: boolean }> => {
  try {
    localStorage.setItem(`drivehora_driver_payprefs_${userId}`, JSON.stringify(prefs));
  } catch (e) {}

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('drivers').update({
        accepts_cash: prefs.acceptsCash,
        has_card_machine: prefs.hasCardMachine,
        pix_key: prefs.pixKey
      }).eq('user_id', userId);
    } catch (e) {
      // Falha silenciosa caso as colunas ainda não existam no Supabase
    }
  }
  return { success: true };
};

// 12. Atualizar Localização Exata em Tempo Real do Motorista (GPS Tracker)
export const dbUpdateDriverLocation = async (
  userId: string,
  coords: { latitude: number; longitude: number }
): Promise<{ success: boolean; error?: string }> => {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('drivers').update({
        current_lat: coords.latitude,
        current_lng: coords.longitude
      }).eq('user_id', userId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
  return { success: true };
};

// 13. Assinar Atualizações em Tempo Real de Motoristas (Realtime Supabase)
export const dbSubscribeToDrivers = (onUpdate: () => void) => {
  const sb = getSupabase();
  if (!sb) return () => {};

  try {
    const channel = sb
      .channel('drivers-live-gps-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  } catch (e) {
    return () => {};
  }
};

// 14. Buscar Lista de IDs de Motoristas Favoritos do Cliente
export const dbGetFavoriteDriverIds = async (clientId: string): Promise<string[]> => {
  if (!clientId) return [];
  const sb = getSupabase();
  if (sb) {
    try {
      const res: any = await sb
        .from('favorite_drivers')
        .select('driver_id')
        .eq('client_id', clientId);
      if (res?.data) {
        return res.data.map((item: any) => item.driver_id);
      }
    } catch (e) {
      console.warn('Erro ao buscar favoritos no Supabase:', e);
    }
  }

  try {
    const local = localStorage.getItem(`drivehora_favs_${clientId}`);
    return local ? JSON.parse(local) : [];
  } catch (e) {
    return [];
  }
};

// 15. Alternar Favorito (Adicionar/Remover)
export const dbToggleFavoriteDriver = async (
  clientId: string, 
  driverId: string
): Promise<{ isFavorite: boolean }> => {
  if (!clientId || !driverId) return { isFavorite: false };

  let currentFavs: string[] = [];
  try {
    const local = localStorage.getItem(`drivehora_favs_${clientId}`);
    if (local) currentFavs = JSON.parse(local);
  } catch (e) {}

  const exists = currentFavs.includes(driverId);
  const nextFavs = exists 
    ? currentFavs.filter(id => id !== driverId) 
    : [...currentFavs, driverId];

  try {
    localStorage.setItem(`drivehora_favs_${clientId}`, JSON.stringify(nextFavs));
  } catch (e) {}

  const sb = getSupabase();
  if (sb) {
    try {
      if (exists) {
        await sb
          .from('favorite_drivers')
          .delete()
          .match({ client_id: clientId, driver_id: driverId });
      } else {
        await sb
          .from('favorite_drivers')
          .insert([{
            id: `fav_${clientId}_${driverId}`,
            client_id: clientId,
            driver_id: driverId,
            created_at: new Date().toISOString()
          }]);
      }
    } catch (e) {
      console.warn('Erro ao sincronizar favorito no Supabase:', e);
    }
  }

  return { isFavorite: !exists };
};

// 16. Buscar Ficha Pública Segura do Motorista (Ocultando Dados Sensíveis)
export const dbGetDriverPublicProfile = async (
  driverId: string,
  clientId?: string
): Promise<DriverPublicProfile | null> => {
  const allDrivers = await dbGetAllDrivers();
  const driver = allDrivers.find(d => d.id === driverId || d.userId === driverId);
  if (!driver) return null;

  let isFavorite = false;
  if (clientId) {
    const favs = await dbGetFavoriteDriverIds(clientId);
    isFavorite = favs.includes(driver.id) || favs.includes(driver.userId);
  }

  // Mascarar placa parcialmente se desejado ou exibir placa executiva
  return {
    id: driver.id,
    userId: driver.userId,
    displayName: driver.fullName || driver.driverName || 'Motorista Parceiro',
    avatarUrl: driver.selfieUrl || undefined,
    selfieUrl: driver.selfieUrl || undefined,
    verificationStatus: driver.verificationStatus,
    isVerified: driver.verificationStatus === 'approved',
    rating: driver.rating || 5.0,
    totalRides: driver.totalRides || 0,
    vehicleBrand: driver.vehicleBrand || 'Veículo Executivo',
    vehicleModel: driver.vehicleModel || 'Sedan Particular',
    vehicleYear: driver.vehicleYear || '2023',
    vehicleColor: driver.vehicleColor || 'Preto Executivo',
    vehiclePlate: driver.vehiclePlate || 'Mercosul',
    isOnline: driver.isOnline,
    currentLat: driver.currentLat,
    currentLng: driver.currentLng,
    bio: driver.bio || 'Motorista executivo dedicado a viagens confortáveis, pontuais e seguras.',
    languages: driver.languages || ['Português (Nativo)', 'Inglês (Básico)'],
    amenities: driver.amenities || ['❄️ Ar-condicionado', '📶 Wi-Fi 5G', '🔌 Carregador USB-C', '🍬 Água mineral'],
    memberSince: driver.memberSince || 'Membro desde 2025',
    isFavorite
  };
};

// 17. Buscar Lista de Motoristas Favoritos Completos
export const dbGetFavoriteDrivers = async (clientId: string): Promise<DriverPublicProfile[]> => {
  if (!clientId) return [];
  const favIds = await dbGetFavoriteDriverIds(clientId);
  if (favIds.length === 0) return [];

  const allDrivers = await dbGetAllDrivers();
  const list: DriverPublicProfile[] = [];

  for (const driver of allDrivers) {
    if (favIds.includes(driver.id) || favIds.includes(driver.userId)) {
      list.push({
        id: driver.id,
        userId: driver.userId,
        displayName: driver.fullName || driver.driverName || 'Motorista Parceiro',
        avatarUrl: driver.selfieUrl || undefined,
        selfieUrl: driver.selfieUrl || undefined,
        verificationStatus: driver.verificationStatus,
        isVerified: driver.verificationStatus === 'approved',
        rating: driver.rating || 5.0,
        totalRides: driver.totalRides || 0,
        vehicleBrand: driver.vehicleBrand || 'Veículo Executivo',
        vehicleModel: driver.vehicleModel || 'Sedan Particular',
        vehicleYear: driver.vehicleYear || '2023',
        vehicleColor: driver.vehicleColor || 'Preto Executivo',
        vehiclePlate: driver.vehiclePlate || 'Mercosul',
        isOnline: driver.isOnline,
        currentLat: driver.currentLat,
        currentLng: driver.currentLng,
        bio: driver.bio || 'Motorista executivo experiente focado em conforto e segurança.',
        languages: driver.languages || ['Português (Nativo)'],
        amenities: driver.amenities || ['❄️ Ar-condicionado', '🔌 Carregador', '🍬 Água'],
        memberSince: driver.memberSince || 'Membro desde 2025',
        isFavorite: true
      });
    }
  }

  return list;
};

// 18. Salvar Token de Dispositivo (FCM Device Token) no Banco de Dados
export const dbSaveUserDeviceToken = async (userId: string, token: string, role?: string): Promise<boolean> => {
  if (!userId || !token) return false;
  try {
    const sb = getSupabase();
    if (!sb) return false;

    // Atualiza na tabela principal de perfis
    await sb
      .from('profiles')
      .update({ fcm_token: token, updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Se for motorista, também atualiza na tabela de motoristas
    if (role === 'driver') {
      await sb
        .from('drivers')
        .update({ fcm_token: token })
        .eq('user_id', userId);
    }

    // Se for cliente, também atualiza na tabela de clientes
    if (role === 'client') {
      await sb
        .from('clients')
        .update({ fcm_token: token })
        .eq('user_id', userId);
    }

    console.log(`[FCM] Device token registrado com sucesso para o usuário ${userId}`);
    return true;
  } catch (err) {
    console.warn('Erro ao salvar device token no Supabase:', err);
    return false;
  }
};

// 19. Sistema de Ocorrências e Problemas Reportados (Ride Reports)
export interface RideReport {
  id: string;
  rideId: string;
  reporterId: string;
  reporterName: string;
  reporterRole: 'client' | 'driver';
  reporterPhone?: string;
  reporterEmail?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  driverPlate?: string;
  category: 'lost_item' | 'driver_behavior' | 'vehicle_condition' | 'route_billing' | 'safety' | 'cancellation_issue' | 'other';
  categoryLabel: string;
  description: string;
  status: 'pending' | 'in_review' | 'resolved';
  adminNotes?: string;
  createdAt: number;
  resolvedAt?: number;
}

const REPORTS_STORAGE_KEY = 'drivehora_ride_reports_v1';
const DB_REPORTS_PROFILE_ID = 'app_global_ride_reports';

export const dbGetRideReports = async (): Promise<RideReport[]> => {
  let localReports: RideReport[] = [];
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (raw) localReports = JSON.parse(raw);
  } catch {}

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('active_session_token')
        .eq('id', DB_REPORTS_PROFILE_ID)
        .maybeSingle();

      if (!error && data?.active_session_token) {
        const remote: RideReport[] = JSON.parse(data.active_session_token);
        // Mesclar com locais sem duplicar
        const map = new Map<string, RideReport>();
        remote.forEach(r => map.set(r.id, r));
        localReports.forEach(r => { if (!map.has(r.id)) map.set(r.id, r); });
        const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        try { localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(merged)); } catch {}
        return merged;
      }
    } catch (e) {
      console.warn('Erro ao buscar ocorrências no Supabase:', e);
    }
  }
  return localReports;
};

export const dbCreateRideReport = async (report: RideReport): Promise<{ success: boolean; error?: string }> => {
  try {
    const current = await dbGetRideReports();
    const updated = [report, ...current.filter(r => r.id !== report.id)];

    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drivehora_reports_updated', { detail: updated }));
      }
    } catch {}

    const sb = getSupabase();
    if (sb) {
      try {
        await sb.from('profiles').upsert({
          id: DB_REPORTS_PROFILE_ID,
          role: 'admin',
          email: 'reports@drivehora.app',
          phone: '00000000000',
          full_name: 'DriveHora Central de Ocorrências',
          active_session_token: JSON.stringify(updated),
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Aviso: falha ao sincronizar ocorrência na nuvem:', err);
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao registrar ocorrência.' };
  }
};

export const dbUpdateRideReportStatus = async (
  reportId: string,
  status: 'pending' | 'in_review' | 'resolved',
  adminNotes?: string
): Promise<boolean> => {
  try {
    const current = await dbGetRideReports();
    const updated = current.map(r => {
      if (r.id === reportId) {
        return {
          ...r,
          status,
          adminNotes: adminNotes !== undefined ? adminNotes : r.adminNotes,
          resolvedAt: status === 'resolved' ? Date.now() : r.resolvedAt
        };
      }
      return r;
    });

    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drivehora_reports_updated', { detail: updated }));
      }
    } catch {}

    const sb = getSupabase();
    if (sb) {
      await sb.from('profiles').upsert({
        id: DB_REPORTS_PROFILE_ID,
        role: 'admin',
        email: 'reports@drivehora.app',
        phone: '00000000000',
        full_name: 'DriveHora Central de Ocorrências',
        active_session_token: JSON.stringify(updated),
        updated_at: new Date().toISOString()
      });
    }
    return true;
  } catch (e) {
    console.warn('Erro ao atualizar ocorrência:', e);
    return false;
  }
};

