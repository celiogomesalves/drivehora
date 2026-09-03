export type UserRole = 'client' | 'driver' | 'admin';

export const SUPER_ADMIN_EMAILS = [
  'celiogomesalves@gmail.com'
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
  createdAt?: string;
}

export interface ClientProfile {
  id: string;
  userId: string;
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
}

export type DriverVerificationStatus = 'pending_docs' | 'under_review' | 'approved' | 'rejected';

export interface DriverProfile {
  id: string;
  userId: string;
  cpf: string;
  phone: string;
  cnhNumber: string;
  cnhCategory: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehiclePlate: string;
  vehicleColor: string;
  cnhUrl?: string;
  crlvUrl?: string;
  selfieUrl?: string;
  verificationStatus: DriverVerificationStatus;
  rating: number;
  totalRides: number;
}
