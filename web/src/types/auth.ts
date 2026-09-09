export type UserRole = 'client' | 'driver' | 'admin';

export const SUPER_ADMIN_EMAILS = [
  'celiogomesalves@gmail.com',
  'victorhugotortuga33@gmail.com',
  'admin@drivehora.com',
  'admin@agenc-ia.net'
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  activeSessionToken?: string;
  activeDeviceName?: string;
  lastActiveAt?: string;
  createdAt?: string;
}

export interface ClientProfile {
  id: string;
  userId: string;
  fullName?: string;
  email?: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  isProfileComplete: boolean;
  createdAt?: string;
}

export type DriverVerificationStatus = 'pending_docs' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export interface DriverProfile {
  id: string;
  userId: string;
  fullName?: string;
  driverName?: string;
  cpf: string;
  phone: string;
  cnhNumber: string;
  cnhCategory: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehiclePlate: string;
  vehicleColor: string;
  vehicleCategory?: string;
  cnhUrl?: string;
  crlvUrl?: string;
  selfieUrl?: string;
  verificationStatus: DriverVerificationStatus;
  rating: number;
  totalRides: number;
  isOnline?: boolean;
  currentLat?: number;
  currentLng?: number;
  bio?: string;
  languages?: string[];
  amenities?: string[];
  memberSince?: string;
  acceptsCash?: boolean;
  hasCardMachine?: boolean;
  pixKey?: string;
}

export interface DriverPublicProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  selfieUrl?: string;
  verificationStatus: DriverVerificationStatus;
  isVerified: boolean;
  rating: number;
  totalRides: number;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  vehiclePlate: string;
  vehicleCategory?: string;
  isOnline?: boolean;
  currentLat?: number;
  currentLng?: number;
  bio?: string;
  languages: string[];
  amenities: string[];
  memberSince: string;
  isFavorite?: boolean;
  acceptsCash?: boolean;
  hasCardMachine?: boolean;
  pixKey?: string;
}

export interface FavoriteDriver {
  id: string;
  clientId: string;
  driverId: string;
  createdAt: string;
  driver?: DriverPublicProfile;
}
