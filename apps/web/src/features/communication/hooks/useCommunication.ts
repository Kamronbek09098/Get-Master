import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '@/lib/env';
import type { CursorPage } from '@/types/api';
import { useMe } from '@/features/session/hooks/useMe';
import { communicationService } from '../services/communication.service';
import type { ChatAttachment, ChatMessage } from '../types';

const messagesKey = (conversationId: string) => ['conversations', conversationId, 'messages'] as const;

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => communicationService.listConversations(),
    refetchInterval: 5_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messagesKey(conversationId ?? ''),
    queryFn: () => communicationService.listMessages(conversationId as string),
    enabled: !!conversationId,
    refetchInterval: 4_000,
  });
}

/** Xabar darhol ko‘rinadi (kutilmoqda); xato bo‘lsa «yuborilmadi» deb belgilanadi va qayta yuborish mumkin. */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const me = useMe();
  const key = messagesKey(conversationId);

  const patch = (update: (items: ChatMessage[]) => ChatMessage[]) =>
    queryClient.setQueryData<CursorPage<ChatMessage>>(key, (old) => ({
      items: update(old?.items ?? []),
      nextCursor: old?.nextCursor ?? null,
    }));

  return useMutation({
    mutationFn: ({ text, attachments, replyTo }: { text: string; tempId?: string; attachments?: ChatAttachment[]; replyTo?: ChatMessage | null }) =>
      communicationService.sendMessage(conversationId, {
        text: text || undefined,
        mediaAssetIds: attachments?.length ? attachments.map((item) => item.mediaAssetId) : undefined,
        replyToId: replyTo?.id,
      }),
    onMutate: async ({ text, tempId, attachments, replyTo }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const id = tempId ?? `tmp-${crypto.randomUUID()}`;
      const optimistic: ChatMessage = {
        id,
        conversationId,
        senderId: me.data?.id ?? '',
        senderPanel: env.appRole,
        type: attachments?.length ? (attachments.every((item) => item.mimeType.startsWith('image/')) ? 'IMAGE' : 'FILE') : 'TEXT',
        text: text || null,
        attachments: attachments?.length ? attachments : null,
        replyTo: replyTo
          ? { id: replyTo.id, text: replyTo.text, type: replyTo.type, senderId: replyTo.senderId, senderPanel: replyTo.senderPanel }
          : null,
        reactions: [],
        createdAt: new Date().toISOString(),
        editedAt: null,
        deleted: false,
        status: 'pending',
      };
      patch((items) => [optimistic, ...items.filter((item) => item.id !== id)]);
      return { tempId: id };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      patch((items) => items.map((item) => (item.id === context.tempId ? { ...item, status: 'failed' } : item)));
    },
    onSuccess: (_message, _variables, context) => {
      if (context) patch((items) => items.filter((item) => item.id !== context.tempId));
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ['conversations'], exact: true });
    },
  });
}

export function useEditMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) =>
      communicationService.editMessage(conversationId, messageId, text),
    onMutate: async ({ messageId, text }) => {
      const key = messagesKey(conversationId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CursorPage<ChatMessage>>(key);
      queryClient.setQueryData<CursorPage<ChatMessage>>(key, (old) =>
        old ? { ...old, items: old.items.map((item) => (item.id === messageId ? { ...item, text, editedAt: new Date().toISOString() } : item)) } : old,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(messagesKey(conversationId), context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: ['conversations'], exact: true });
    },
  });
}

export function useReactMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string | null }) =>
      communicationService.react(conversationId, messageId, emoji),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) }),
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { id: string; forEveryone?: boolean }) =>
      typeof input === 'string'
        ? communicationService.deleteMessage(conversationId, input)
        : communicationService.deleteMessage(conversationId, input.id, input.forEveryone ?? true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: ['conversations'], exact: true });
    },
  });
}

export function useOpenMasterChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (masterId: string) => communicationService.openWithMaster(masterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

/** Administrator foydalanuvchiga yozish uchun suhbat ochadi. */
export function useOpenSupportChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => communicationService.openSupport(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

/** Administrator: foydalanuvchiga suhbatda yozishga ruxsat beradi yoki oladi. */
export function useSetReplyAccess(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allowed: boolean) => communicationService.setReplyAccess(conversationId, allowed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
    },
  });
}

export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => communicationService.markRead(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'], exact: true }),
  });
}

/** Telegram uslubida: faqat mening ro‘yxatimdan yashiradi yoki (forEveryone) ikkala tomondan butunlay o‘chiradi. */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { id: string; forEveryone?: boolean }) =>
      typeof input === 'string'
        ? communicationService.deleteConversation(input)
        : communicationService.deleteConversation(input.id, input.forEveryone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}
