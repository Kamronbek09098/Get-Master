import { useCallback, useRef, useState } from 'react';
import { mediaService } from '@/features/media/services/media.service';
import type { ChatAttachment } from '../types';
import { t } from '@/i18n';

export interface PendingAttachment {
  key: string;
  name: string;
  mimeType: string;
  status: 'uploading' | 'ready' | 'error';
  assetId?: string;
  error?: string;
}

const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;
const POLL_MS = 1000;
const MAX_POLLS = 90;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Faylni yuklaydi va skaner tugashini kutadi; tayyor bo‘lsa xabarga qo‘shiladigan ma’lumotni qaytaradi. */
export async function uploadAttachment(file: File, conversationId: string): Promise<ChatAttachment> {
  if (file.size > MAX_BYTES) throw new Error('Fayl 25 MB dan katta');
  const asset = await mediaService.upload(file, 'MESSAGE_ATTACHMENT', 'Conversation', conversationId);
  let status = asset.status;
  let mime = asset.detectedMimeType ?? (file.type || 'application/octet-stream');
  for (let attempt = 0; attempt < MAX_POLLS && status !== 'READY' && status !== 'REJECTED' && status !== 'FAILED'; attempt += 1) {
    await wait(POLL_MS);
    const fresh = await mediaService.getStatus(asset.id);
    status = fresh.status;
    mime = fresh.detectedMimeType ?? mime;
  }
  if (status !== 'READY') throw new Error(status === 'REJECTED' ? 'Fayl rad etildi' : 'Fayl qayta ishlanmadi');
  return { mediaAssetId: asset.id, mimeType: mime, name: file.name };
}

/** Suhbatga fayl biriktirish: yuklaydi, tekshiruv (skaner) tugashini kutadi va tayyor fayllarni qaytaradi. */
export function useAttachments(conversationId: string) {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const removed = useRef(new Set<string>());

  const patch = useCallback((key: string, change: Partial<PendingAttachment>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const add = useCallback(
    (files: File[]) => {
      const room = MAX_FILES - items.length;
      for (const file of files.slice(0, Math.max(room, 0))) {
        const key = crypto.randomUUID();
        const entry: PendingAttachment = { key, name: file.name, mimeType: file.type || 'application/octet-stream', status: 'uploading' };
        if (file.size > MAX_BYTES) {
          setItems((current) => [...current, { ...entry, status: 'error', error: t('Fayl 25 MB dan katta.') }]);
          continue;
        }
        setItems((current) => [...current, entry]);
        void (async () => {
          try {
            const asset = await mediaService.upload(file, 'MESSAGE_ATTACHMENT', 'Conversation', conversationId);
            let status = asset.status;
            let mime = asset.detectedMimeType ?? entry.mimeType;
            for (let attempt = 0; attempt < MAX_POLLS && status !== 'READY' && status !== 'REJECTED' && status !== 'FAILED'; attempt += 1) {
              await wait(POLL_MS);
              if (removed.current.has(key)) return;
              const fresh = await mediaService.getStatus(asset.id);
              status = fresh.status;
              mime = fresh.detectedMimeType ?? mime;
            }
            if (removed.current.has(key)) return;
            if (status === 'READY') patch(key, { status: 'ready', assetId: asset.id, mimeType: mime });
            else patch(key, { status: 'error', error: status === 'REJECTED' ? t('Fayl rad etildi') : t('Fayl qayta ishlanmadi') });
          } catch (error) {
            patch(key, { status: 'error', error: error instanceof Error ? error.message : t('Yuklab bo‘lmadi') });
          }
        })();
      }
    },
    [conversationId, items.length, patch],
  );

  const remove = useCallback((key: string) => {
    removed.current.add(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => {
    for (const item of items) removed.current.add(item.key);
    setItems([]);
  }, [items]);

  const uploading = items.some((item) => item.status === 'uploading');
  const ready: ChatAttachment[] = items
    .filter((item) => item.status === 'ready' && item.assetId)
    .map((item) => ({ mediaAssetId: item.assetId as string, mimeType: item.mimeType, name: item.name }));

  return { items, add, remove, clear, uploading, ready };
}
