export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

/** Xizmat qayerda ko‘rsatiladi: mijoz manzilida (usta boradi) yoki ustaning joyida (mijoz boradi). */
export type ServiceMode = 'AT_CUSTOMER' | 'AT_MASTER';

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  modes?: ServiceMode[];
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
