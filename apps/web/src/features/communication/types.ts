import type { OrderStatus } from '@/types/common';

export interface ChatUser {
  id: string;
  accountNumber?: number;
  firstName: string | null;
  lastName: string | null;
  avatar?: string | null;
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
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'SYSTEM' | 'ORDER';
  /** type = ORDER bo‘lsa: suhbatdan yuborilgan buyurtma. */
  orderId?: string | null;
  text: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  status?: 'pending' | 'failed';
  /** «Plus» obunasi: suhbatdosh o‘chirgan xabarning asl mazmuni. */
  original?: { text: string | null; attachments: ChatAttachment[] | null };
  /** «Plus» obunasi: suhbatdosh tahrirlagan xabarning avvalgi matnlari (eskidan yangiga). */
  editHistory?: Array<{ previousText: string | null; editedAt: string }>;
}

export interface Conversation {
  id: string;
  type: 'ORDER' | 'SUPPORT' | 'DIRECT';
  orderId: string | null;
  /** SUPPORT (admin) suhbati: foydalanuvchi yoza oladimi — administrator belgilaydi. */
  userCanReply?: boolean;
  order: { id: string; status: OrderStatus } | null;
  counterpart: ChatUser | null;
  /** Suhbatdoshi usta bo‘lsa, mijoz chatdan unga buyurtma yubora oladi. */
  counterpartIsMaster?: boolean;
  counterpartLastReadAt: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}
