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
    projectId: '',
    apiKey: '',
    authDomain: '',
    messagingSenderId: '',
    appId: '',
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
  vehicleCategories: DEFAULT_VEHICLE_CATEGORIES
};

const STORAGE_KEY = 'drivehora_system_settings_v1';

export const getSystemSettings = (): SystemSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      firebase: { ...DEFAULT_SETTINGS.firebase, ...(parsed.firebase || {}) },
      notificationRules: { ...DEFAULT_SETTINGS.notificationRules, ...(parsed.notificationRules || {}) },
      paymentGateway: { ...DEFAULT_SETTINGS.paymentGateway, ...(parsed.paymentGateway || {}) },
      rates: { ...DEFAULT_SETTINGS.rates, ...(parsed.rates || {}) },
      vehicleCategories: (parsed.vehicleCategories && parsed.vehicleCategories.length > 0) 
        ? parsed.vehicleCategories 
        : DEFAULT_VEHICLE_CATEGORIES
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSystemSettings = (settings: SystemSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Erro ao salvar configurações do sistema:', e);
  }
};
