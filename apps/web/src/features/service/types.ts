export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  services: ServiceItem[];
}

export interface MasterServiceItem {
  id: string;
  serviceId: string;
  description: string | null;
  basePrice: string | null;
  estimatedMinutes: number | null;
  isActive: boolean;
  service: { id: string; name: string; slug: string };
}

export interface MasterServiceInput {
  serviceId: string;
  description?: string;
  basePrice?: number;
  estimatedMinutes?: number;
}
