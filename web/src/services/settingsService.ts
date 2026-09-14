export interface VehicleCategoryConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  rateMultiplier: number;
}

export interface SystemSettings {
  // Notificações Firebase FCM
  firebase: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    messagingSenderId: string;
    appId: string;
    vapidKey: string;
    serverKey: string;
    enabled: boolean;
  };
  // Regras de Notificação (Toggles de Eventos)
  notificationRules: {
    notifyNewRideToDrivers: boolean;
    notifyRideAcceptedToClient: boolean;
    notifyDriverArrival: boolean;
    notifyRideFinished: boolean;
    notifyNewDriverRegistered: boolean;
    notifyChatMessage: boolean;
    notifyScheduledRideReminder: boolean;
  };
  // Gateway de Pagamento
  paymentGateway: {
    activeGateway: 'mercadopago' | 'asaas' | 'stripe';
    environment: 'sandbox' | 'production';
    publicKey: string;
    secretKey: string;
    webhookUrl: string;
    enableAutoSplit: boolean;
  };
  // Tarifas & Comissões
  rates: {
    platformCommissionPercent: number; // ex: 15%
    defaultHourlyRate: number; // ex: 60
    minRideRate: number; // ex: 30
    freeCancellationMinutes: number; // ex: 5
  };
  // Domínio / URL do Aplicativo (para QR Code e links de acesso)
  appUrl: string;
  // Categorias de Veículos
  vehicleCategories: VehicleCategoryConfig[];
  // Identidade Visual e Sons Padrão do Aplicativo (Configurado pelo Administrador)
  branding: {
    logoOption: 1 | 2 | 3 | 'custom';
    customLogoUrl?: string;
    newRideSound: 'new_ride_a' | 'new_ride_b' | 'new_ride_c';
    acceptedSound: 'accepted_a';
    inProgressSound: 'in_progress_a';
    finishedSound: 'finished_a';
    timeAlertSound: 'time_alert';
  };
  // Gestão de Seguro de Acidentes Pessoais a Passageiros (Seguro APP / Lei 13.640/2018)
  insurance: {
    enabled: boolean;
    requireInsuranceToRequestRide: boolean; // O Administrador decide se exige apólice ativa ou libera sem seguro
    providerName: string;
    policyNumber: string;
    validUntil: string;
    coverageAmountMA: number;
    coverageAmountIPA: number;
    coverageAmountDMHO: number;
    emergencyHotline: string;
    costPerHour: number;
  };
}

export const DEFAULT_VEHICLE_CATEGORIES: VehicleCategoryConfig[] = [
  {
    id: 'basico',
    name: 'Básico',
    description: 'Veículos compactos, hatches e sedãs econômicos com ar-condicionado.',
    icon: '🚗',
    rateMultiplier: 1.0
  },
  {
    id: 'classico',
    name: 'Clássico',
    description: 'Sedãs médios e SUVs espaçosos (Corolla, Civic, T-Cross, Renegade).',
    icon: '🚘',
    rateMultiplier: 1.25
  },
  {
    id: 'executivo',
    name: 'Executivo',
    description: 'Veículos premium de alto luxo, motorista com terno e mimos VIP.',
    icon: '⭐',
    rateMultiplier: 1.6
  },
  {
    id: 'blindado',
    name: 'Blindado',
    description: 'Veículos com blindagem certificada Nível III-A para máxima segurança.',
    icon: '🛡️',
    rateMultiplier: 2.2
  }
];

const DEFAULT_SETTINGS: SystemSettings = {
  firebase: {
    projectId: 'drivehora',
    apiKey: 'AIzaSyCXJFdoJHbgUbEtIlLCJxvUvNbiHZ4nRZc',
    authDomain: 'drivehora.firebaseapp.com',
    messagingSenderId: '1017992679969',
    appId: '1:1017992679969:web:1a85c4d6007f51cd4f4960',
    vapidKey: 'BNPWXZbLEl64kql8ej1VQeCWRljWjzZrIA7B_K_e_VAyFWWrxLYuamzF-bUhElpTJfNBhzhrq8us90bYvAjcztQ',
    serverKey: '',
    enabled: true
  },
  notificationRules: {
    notifyNewRideToDrivers: true,
    notifyRideAcceptedToClient: true,
    notifyDriverArrival: true,
    notifyRideFinished: true,
    notifyNewDriverRegistered: true,
    notifyChatMessage: true,
    notifyScheduledRideReminder: true
  },
  paymentGateway: {
    activeGateway: 'asaas',
    environment: 'sandbox',
    publicKey: '',
    secretKey: '',
    webhookUrl: 'https://drivehora.agenc-ia.net/api/webhook/payment',
    enableAutoSplit: true
  },
  rates: {
    platformCommissionPercent: 15,
    defaultHourlyRate: 60,
    minRideRate: 30,
    freeCancellationMinutes: 5
  },
  appUrl: 'https://drivehora.agenc-ia.net',
  vehicleCategories: DEFAULT_VEHICLE_CATEGORIES,
  branding: {
    logoOption: 2, // Opção 2 recomendada
    newRideSound: 'new_ride_a', // Opção A aprovada pelo usuário
    acceptedSound: 'accepted_a',
    inProgressSound: 'in_progress_a',
    finishedSound: 'finished_a',
    timeAlertSound: 'time_alert'
  },
  insurance: {
    enabled: true,
    requireInsuranceToRequestRide: false, // O Administrador pode liberar ou bloquear a seu critério
    providerName: 'Porto Seguro Cia. de Seguros Gerais',
    policyNumber: 'APP-DRIVEHORA-2026-98214',
    validUntil: '2027-12-31',
    coverageAmountMA: 100000,
    coverageAmountIPA: 100000,
    coverageAmountDMHO: 10000,
    emergencyHotline: '0800 727 2727',
    costPerHour: 0.40
  }
};

import { getSupabase } from '../supabase';

const STORAGE_KEY = 'drivehora_system_settings_v1';
const DB_SETTINGS_KEY = 'global_platform_settings';

export const getSystemSettings = (): SystemSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const dedicatedLogo = typeof window !== 'undefined' ? localStorage.getItem('drivehora_selected_logo_option') : null;
    const dedicatedCustomUrl = typeof window !== 'undefined' ? localStorage.getItem('drivehora_custom_logo_url') : null;

    let activeLogoOption: 1 | 2 | 3 | 'custom' = DEFAULT_SETTINGS.branding.logoOption;
    if (dedicatedLogo === '1' || dedicatedLogo === '2' || dedicatedLogo === '3') {
      activeLogoOption = Number(dedicatedLogo) as 1 | 2 | 3;
    } else if (dedicatedLogo === 'custom') {
      activeLogoOption = 'custom';
    }

    if (!saved) {
      return {
        ...DEFAULT_SETTINGS,
        branding: {
          ...DEFAULT_SETTINGS.branding,
          logoOption: activeLogoOption,
          customLogoUrl: dedicatedCustomUrl || undefined
        }
      };
    }

    const parsed = JSON.parse(saved);
    const fb = parsed.firebase || {};
    const br = parsed.branding || {};

    if (dedicatedLogo !== '1' && dedicatedLogo !== '2' && dedicatedLogo !== '3' && dedicatedLogo !== 'custom') {
      if (br.logoOption === 1 || br.logoOption === 2 || br.logoOption === 3 || br.logoOption === 'custom') {
        activeLogoOption = br.logoOption;
      }
    }

    const customLogoUrl = dedicatedCustomUrl || br.customLogoUrl || undefined;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      branding: {
        logoOption: activeLogoOption,
        customLogoUrl,
        newRideSound: (br.newRideSound === 'new_ride_a' || br.newRideSound === 'new_ride_b' || br.newRideSound === 'new_ride_c') ? br.newRideSound : DEFAULT_SETTINGS.branding.newRideSound,
        acceptedSound: 'accepted_a',
        inProgressSound: 'in_progress_a',
        finishedSound: 'finished_a',
        timeAlertSound: 'time_alert'
      },
      firebase: {
        projectId: fb.projectId?.trim() || DEFAULT_SETTINGS.firebase.projectId,
        apiKey: fb.apiKey?.trim() || DEFAULT_SETTINGS.firebase.apiKey,
        authDomain: fb.authDomain?.trim() || DEFAULT_SETTINGS.firebase.authDomain,
        messagingSenderId: fb.messagingSenderId?.trim() || DEFAULT_SETTINGS.firebase.messagingSenderId,
        appId: fb.appId?.trim() || DEFAULT_SETTINGS.firebase.appId,
        vapidKey: fb.vapidKey?.trim() || DEFAULT_SETTINGS.firebase.vapidKey,
        serverKey: fb.serverKey?.trim() || DEFAULT_SETTINGS.firebase.serverKey,
        enabled: fb.enabled !== undefined ? fb.enabled : DEFAULT_SETTINGS.firebase.enabled
      },
      notificationRules: { ...DEFAULT_SETTINGS.notificationRules, ...(parsed.notificationRules || {}) },
      paymentGateway: { ...DEFAULT_SETTINGS.paymentGateway, ...(parsed.paymentGateway || {}) },
      rates: { ...DEFAULT_SETTINGS.rates, ...(parsed.rates || {}) },
      appUrl: parsed.appUrl?.trim() || DEFAULT_SETTINGS.appUrl,
      vehicleCategories: (parsed.vehicleCategories && parsed.vehicleCategories.length > 0) 
        ? parsed.vehicleCategories 
        : DEFAULT_VEHICLE_CATEGORIES,
      insurance: { ...DEFAULT_SETTINGS.insurance, ...(parsed.insurance || {}) }
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

/**
 * Busca configurações diretamente do Supabase e sincroniza o cache local
 */
export const fetchSystemSettingsFromDb = async (): Promise<SystemSettings> => {
  const local = getSystemSettings();
  try {
    const sb = getSupabase();
    if (!sb) return local;

    let dbConfig: any = null;

    // 1. Tenta buscar da tabela principal system_settings
    try {
      const { data, error } = await sb
        .from('system_settings')
        .select('value')
        .eq('key', DB_SETTINGS_KEY)
        .maybeSingle();

      if (!error && data?.value) {
        dbConfig = data.value;
      }
    } catch (err) {
      console.warn('system_settings select aviso:', err);
    }

    // 2. Fallback resiliente: busca da tabela profiles (liberada para anon sem bloqueio de RLS)
    if (!dbConfig) {
      try {
        const { data: profData, error: profErr } = await sb
          .from('profiles')
          .select('active_session_token')
          .eq('id', 'app_global_system_settings')
          .maybeSingle();

        if (!profErr && profData?.active_session_token) {
          dbConfig = JSON.parse(profData.active_session_token);
        }
      } catch (err) {
        console.warn('profiles fallback select aviso:', err);
      }
    }

    // Se não encontrou nenhuma configuração na nuvem ainda:
    if (!dbConfig) {
      // Se o local já tem chaves salvas (ex: admin já preencheu localmente), envia para a nuvem
      if (local.paymentGateway?.secretKey || local.paymentGateway?.publicKey) {
        await saveSystemSettingsToDb(local);
      }
      return local;
    }

    const merged: SystemSettings = {
      ...DEFAULT_SETTINGS,
      ...dbConfig,
      firebase: {
        projectId: dbConfig.firebase?.projectId?.trim() || DEFAULT_SETTINGS.firebase.projectId,
        apiKey: dbConfig.firebase?.apiKey?.trim() || DEFAULT_SETTINGS.firebase.apiKey,
        authDomain: dbConfig.firebase?.authDomain?.trim() || DEFAULT_SETTINGS.firebase.authDomain,
        messagingSenderId: dbConfig.firebase?.messagingSenderId?.trim() || DEFAULT_SETTINGS.firebase.messagingSenderId,
        appId: dbConfig.firebase?.appId?.trim() || DEFAULT_SETTINGS.firebase.appId,
        vapidKey: dbConfig.firebase?.vapidKey?.trim() || DEFAULT_SETTINGS.firebase.vapidKey,
        serverKey: dbConfig.firebase?.serverKey?.trim() || DEFAULT_SETTINGS.firebase.serverKey,
        enabled: dbConfig.firebase?.enabled !== undefined ? dbConfig.firebase.enabled : DEFAULT_SETTINGS.firebase.enabled
      },
      notificationRules: { ...DEFAULT_SETTINGS.notificationRules, ...(dbConfig.notificationRules || {}) },
      paymentGateway: { ...DEFAULT_SETTINGS.paymentGateway, ...(dbConfig.paymentGateway || {}) },
      rates: { ...DEFAULT_SETTINGS.rates, ...(dbConfig.rates || {}) },
      appUrl: dbConfig.appUrl?.trim() || DEFAULT_SETTINGS.appUrl,
      vehicleCategories: (dbConfig.vehicleCategories && dbConfig.vehicleCategories.length > 0) 
        ? dbConfig.vehicleCategories 
        : DEFAULT_VEHICLE_CATEGORIES,
      branding: {
        logoOption: (() => {
          const dedicated = typeof window !== 'undefined' ? localStorage.getItem('drivehora_selected_logo_option') : null;
          if (dedicated === '1' || dedicated === '2' || dedicated === '3') return Number(dedicated) as 1 | 2 | 3;
          if (dedicated === 'custom') return 'custom';
          if (dbConfig.branding?.logoOption) return dbConfig.branding.logoOption;
          if (local.branding?.logoOption) return local.branding.logoOption;
          return DEFAULT_SETTINGS.branding.logoOption;
        })(),
        customLogoUrl: dbConfig.branding?.customLogoUrl || local.branding?.customLogoUrl || undefined,
        newRideSound: dbConfig.branding?.newRideSound || local.branding?.newRideSound || DEFAULT_SETTINGS.branding.newRideSound,
        acceptedSound: 'accepted_a',
        inProgressSound: 'in_progress_a',
        finishedSound: 'finished_a',
        timeAlertSound: 'time_alert'
      },
      insurance: { ...DEFAULT_SETTINGS.insurance, ...(dbConfig.insurance || local.insurance || {}) }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('Erro ao buscar configurações no Supabase:', e);
    return local;
  }
};

/**
 * Salva as configurações localmente no cache e na nuvem no Supabase
 */
export const saveSystemSettings = async (settings: SystemSettings): Promise<void> => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivehora_settings_updated', { detail: settings }));
    }
    await saveSystemSettingsToDb(settings);
  } catch (e) {
    console.error('Erro ao salvar configurações do sistema:', e);
  }
};

export const saveSystemSettingsToDb = async (settings: SystemSettings): Promise<void> => {
  try {
    const sb = getSupabase();
    if (!sb) return;

    // 1. Tenta gravar na tabela system_settings
    try {
      await sb
        .from('system_settings')
        .upsert({
          key: DB_SETTINGS_KEY,
          value: settings,
          updated_at: new Date().toISOString()
        });
    } catch (e) {
      console.warn('system_settings upsert aviso:', e);
    }

    // 2. Grava simultaneamente na tabela profiles com ID reservado (garante sincronização global mesmo com RLS ativo)
    try {
      await sb
        .from('profiles')
        .upsert({
          id: 'app_global_system_settings',
          role: 'admin',
          email: 'settings@drivehora.app',
          phone: '00000000000',
          full_name: 'DriveHora Settings',
          active_session_token: JSON.stringify(settings),
          updated_at: new Date().toISOString()
        });
    } catch (e) {
      console.warn('profiles fallback upsert aviso:', e);
    }
  } catch (e) {
    console.warn('Aviso: Não foi possível sincronizar com o banco Supabase:', e);
  }
};
