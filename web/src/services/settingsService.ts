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

import { appwriteDatabases, APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS } from '../appwrite';
import { ID, Query } from 'appwrite';

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
 * Busca configurações diretamente do Appwrite e sincroniza o cache local
 */
export const fetchSystemSettingsFromDb = async (): Promise<SystemSettings> => {
  const local = getSystemSettings();
  try {
    const res = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.APP_SETTINGS,
      [Query.equal('settings_key', DB_SETTINGS_KEY)]
    );

    if (res.documents.length > 0) {
      const doc = res.documents[0] as any;
      if (doc.settings_json) {
        const parsed = JSON.parse(doc.settings_json);
        const merged: SystemSettings = {
          ...local,
          ...parsed,
          branding: { ...local.branding, ...(parsed.branding || {}) },
          firebase: { ...local.firebase, ...(parsed.firebase || {}) },
          notificationRules: { ...local.notificationRules, ...(parsed.notificationRules || {}) },
          paymentGateway: { ...local.paymentGateway, ...(parsed.paymentGateway || {}) },
          rates: { ...local.rates, ...(parsed.rates || {}) },
          insurance: { ...local.insurance, ...(parsed.insurance || {}) }
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        return merged;
      }
    }
    return local;
  } catch (e) {
    console.warn('[Settings] Erro ao buscar configurações no Appwrite:', e);
    return local;
  }
};

/**
 * Salva as configurações localmente no cache e na nuvem no Appwrite
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
    const res = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.APP_SETTINGS,
      [Query.equal('settings_key', DB_SETTINGS_KEY)]
    );

    const payload = {
      settings_key: DB_SETTINGS_KEY,
      settings_json: JSON.stringify(settings)
    };

    if (res.documents.length > 0) {
      await appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.APP_SETTINGS,
        res.documents[0].$id,
        payload
      );
    } else {
      await appwriteDatabases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.APP_SETTINGS,
        ID.unique(),
        payload
      );
    }
  } catch (e) {
    console.warn('[Settings] Falha ao sincronizar configurações no Appwrite:', e);
  }
};
