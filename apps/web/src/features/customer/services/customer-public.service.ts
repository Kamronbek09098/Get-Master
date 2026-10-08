import { apiGet } from '@/services/api.client';

export interface PublicCustomer {
  accountNumber: number;
  firstName: string | null;
  lastName: string | null;
  memberSince: string;
  isPlus: boolean;
  completedOrders: number;
  ordersWithMe: number;
  conversationId: string;
}

export const customerPublicService = {
  get(accountNumber: string) {
    return apiGet<PublicCustomer>(`/customers/public/${encodeURIComponent(accountNumber)}`);
  },
};
