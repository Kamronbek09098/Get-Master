import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { ChatMessage, ChatReaction, Conversation } from '../types';

export const communicationService = {
  unreadCount() {
    return apiGet<{ count: number }>('/conversations/unread-count');
  },
  listConversations() {
    return apiGet<CursorPage<Conversation>>('/conversations');
  },
  openWithMaster(masterId: string) {
    return apiPost<Conversation>('/conversations/direct', { masterId });
  },
  openForOrder(orderId: string) {
    return apiPost<Conversation>('/conversations', { orderId });
  },
  listMessages(conversationId: string) {
    return apiGet<CursorPage<ChatMessage>>(`/conversations/${conversationId}/messages`);
  },
  sendMessage(conversationId: string, input: { text?: string; mediaAssetIds?: string[]; replyToId?: string }) {
    return apiPost<ChatMessage>(`/conversations/${conversationId}/messages`, input);
  },
  react(conversationId: string, messageId: string, emoji: string | null) {
    return apiPut<{ reactions: ChatReaction[] }>(`/conversations/${conversationId}/messages/${messageId}/reaction`, { emoji });
  },
  editMessage(conversationId: string, messageId: string, text: string) {
    return apiPatch<ChatMessage>(`/conversations/${conversationId}/messages/${messageId}`, { text });
  },
  deleteMessage(conversationId: string, messageId: string) {
    return apiDelete<{ deleted: boolean }>(`/conversations/${conversationId}/messages/${messageId}`);
  },
  markRead(conversationId: string) {
    return apiPost<unknown>(`/conversations/${conversationId}/read`);
  },
};
