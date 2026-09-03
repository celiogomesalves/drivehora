export type UserRole = 'client' | 'driver';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string;
  avatarUrl?: string;
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
