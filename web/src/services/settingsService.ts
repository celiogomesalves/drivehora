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
    vapidKey: '',
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
    activeGateway: 'mercadopago',
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
  vehicleCategories: DEFAULT_VEHICLE_CATEGORIES
};

import { getSupabase } from '../supabase';

const STORAGE_KEY = 'drivehora_system_settings_v1';
const DB_SETTINGS_KEY = 'global_platform_settings';

export const getSystemSettings = (): SystemSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved);
    const fb = parsed.firebase || {};

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
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
        : DEFAULT_VEHICLE_CATEGORIES
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

    const { data, error } = await sb
      .from('system_settings')
      .select('value')
      .eq('key', DB_SETTINGS_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      // Se ainda não existir no banco, salva os padrões iniciais no Supabase
      await saveSystemSettingsToDb(local);
      return local;
    }

    const dbConfig = data.value;
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
        : DEFAULT_VEHICLE_CATEGORIES
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
    await saveSystemSettingsToDb(settings);
  } catch (e) {
    console.error('Erro ao salvar configurações do sistema:', e);
  }
};

export const saveSystemSettingsToDb = async (settings: SystemSettings): Promise<void> => {
  try {
    const sb = getSupabase();
    if (!sb) return;

    await sb
      .from('system_settings')
      .upsert({
        key: DB_SETTINGS_KEY,
        value: settings,
        updated_at: new Date().toISOString()
      });
  } catch (e) {
    console.warn('Aviso: Não foi possível sincronizar com o banco Supabase:', e);
  }
};
