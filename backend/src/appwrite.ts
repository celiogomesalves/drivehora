import { Client, Databases, Users, Storage } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

export const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://appwrite.agenc-ia.net/v1';
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '6afc487f000271f31bd1';
export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || '6afc48a8003363fd02db';
export const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || 'standard_fba9e83079fd358877c1fbfce8da5cd751dc7def21c0980aeb2414f57c4f60c24b262466d193506a474aed901fd70361939573890439ba98ca2ede9c2b6a19ea11726585204ec903735d6610f310ad00de20a70dfb2e0533bf7f15943fba41eabbd1717cd225ea78b778551081cbe550f6a8771361c6bc65d96e01208c90f460';

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

export const appwriteDb = new Databases(client);
export const appwriteUsers = new Users(client);
export const appwriteStorage = new Storage(client);
export const appwriteClient = client;

export const COLLECTIONS = {
    PROFILES: 'profiles',
    DRIVERS: 'drivers',
    BACKGROUND_CHECKS: 'background_checks',
    INSPECTION_PARTNERS: 'inspection_partners',
    VEHICLE_INSPECTIONS: 'vehicle_inspections',
    RIDES: 'rides',
    INSURANCE_SETTINGS: 'insurance_settings',
    EMAIL_TEMPLATES: 'email_templates'
};

