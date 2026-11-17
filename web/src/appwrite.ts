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
  CLIENTS: 'clients',
  DRIVERS: 'drivers',
  RIDES: 'rides',
  WALLETS: 'wallets',
  APP_SETTINGS: 'app_settings',
  BACKGROUND_CHECKS: 'background_checks',
  INSPECTION_PARTNERS: 'inspection_partners',
  VEHICLE_INSPECTIONS: 'vehicle_inspections',
  INSURANCE_SETTINGS: 'insurance_settings',
  EMAIL_TEMPLATES: 'email_templates'
};

export const getAppwriteConfig = () => {
  const storageEndpoint = localStorage.getItem('drivehora_appwrite_endpoint') || '';
  const storageProjectId = localStorage.getItem('drivehora_appwrite_project_id') || '';
  const storageDatabaseId = localStorage.getItem('drivehora_appwrite_database_id') || '';

  const endpoint = storageEndpoint || APPWRITE_ENDPOINT;
  const projectId = storageProjectId || APPWRITE_PROJECT_ID;
  const databaseId = storageDatabaseId || APPWRITE_DATABASE_ID;

  return {
    endpoint,
    projectId,
    databaseId,
    isConfigured: Boolean(endpoint && projectId && databaseId)
  };
};

export const saveAppwriteConfig = (endpoint: string, projectId: string, databaseId: string) => {
  localStorage.setItem('drivehora_appwrite_endpoint', endpoint.trim());
  localStorage.setItem('drivehora_appwrite_project_id', projectId.trim());
  localStorage.setItem('drivehora_appwrite_database_id', databaseId.trim());

  appwriteClient.setEndpoint(endpoint.trim()).setProject(projectId.trim());
};
