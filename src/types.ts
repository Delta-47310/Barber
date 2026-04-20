export type AppointmentStatus = 'pending' | 'accepted' | 'in-process' | 'completed' | 'cancelled';

export interface Client {
  id?: string;
  name: string;
  phone: string;
  frequentServices: string[];
  registrationDate: string;
  uid: string;
  photoURL?: string;
}

export interface Barber {
  id?: string;
  name: string;
  email?: string;
  specialty: string;
  uid: string;
  role: 'admin' | 'barber' | 'client';
  photoURL?: string;
  active?: boolean;
  accessExpirationDate?: string;
  phone?: string;
}

export interface Service {
  id?: string;
  name: string;
  description?: string;
  price: number;
  estimatedDuration: number;
  active: boolean;
  barberId: string;
  photoURL?: string;
}

export interface Appointment {
  id?: string;
  clientId: string;
  clientName: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  rating?: number;
  clientRating?: number;
  clientReview?: string;
}

export interface Schedule {
  id?: string;
  barberId: string;
  day: string;
  startTime: string;
  endTime: string;
  active: boolean;
}
