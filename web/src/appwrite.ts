import { Client, Databases, Account, Storage } from 'appwrite';

export const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.agenc-ia.net/v1';
export const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '6afc487f000271f31bd1';
export const APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '6afc48a8003363fd02db';

export const appwriteClient = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

export const appwriteDatabases = new Databases(appwriteClient);
export const appwriteAccount = new Account(appwriteClient);
export const appwriteStorage = new Storage(appwriteClient);

export const APPWRITE_COLLECTIONS = {
    PROFILES: 'profiles',
    DRIVERS: 'drivers',
    BACKGROUND_CHECKS: 'background_checks',
    INSPECTION_PARTNERS: 'inspection_partners',
    VEHICLE_INSPECTIONS: 'vehicle_inspections',
    RIDES: 'rides',
    INSURANCE_SETTINGS: 'insurance_settings',
    EMAIL_TEMPLATES: 'email_templates'
};

// Funções utilitárias seguras para obter dados de configuração
export const getAppwriteConfig = () => ({
    endpoint: APPWRITE_ENDPOINT,
    projectId: APPWRITE_PROJECT_ID,
    databaseId: APPWRITE_DATABASE_ID
});

