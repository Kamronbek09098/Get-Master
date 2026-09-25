import { apiGet, apiPatch } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { AppNotification } from '../types';

export const notificationService = {
  listMine() {
    return apiGet<CursorPage<AppNotification>>('/notifications');
  },
  unreadCount() {
    return apiGet<{ count: number }>('/notifications/meta/unread-count');
  },
  markAsRead(id: string) {
    return apiPatch<AppNotification>(`/notifications/${id}/read`);
  },
  markAllAsRead() {
    return apiPatch<unknown>('/notifications/read-all');
  },
};
