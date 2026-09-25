import type { OrderStatus } from '@/types/common';

export interface ChatUser {
  id: string;
  accountNumber?: number;
  firstName: string | null;
  lastName: string | null;
}

export interface ChatAttachment {
  mediaAssetId: string;
  mimeType: string;
  name: string;
}

export interface ChatReaction {
  emoji: string;
  userId: string;
  panel: string;
}

export interface ChatReplyPreview {
  id: string;
  text: string | null;
  type: string;
  deletedAt?: string | null;
  senderId: string;
  senderPanel?: string | null;
  sender?: { id: string; accountNumber?: number; firstName: string | null; lastName: string | null };
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderPanel?: string | null;
  attachments?: ChatAttachment[] | null;
  replyTo?: ChatReplyPreview | null;
  reactions?: ChatReaction[];
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'SYSTEM';
  text: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  status?: 'pending' | 'failed';
}

export interface Conversation {
  id: string;
  type: 'ORDER' | 'SUPPORT' | 'DIRECT';
  orderId: string | null;
  order: { id: string; status: OrderStatus } | null;
  counterpart: ChatUser | null;
  counterpartLastReadAt: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}
