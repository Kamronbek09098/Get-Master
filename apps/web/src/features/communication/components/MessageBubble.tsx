import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Copy, CornerUpLeft, Eye, FileText, History, Lock, MoreHorizontal, Pencil, Phone, RotateCw, Trash2, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { accountName } from '@/lib/account-name';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { mediaService } from '@/features/media/services/media.service';
import { canEdit, clock, replySnippet } from '../format';
import { describeCallLog, parseCallLog } from '@/features/call/call-log';
import type { ChatAttachment, ChatMessage } from '../types';
import { Linkified } from './Linkified';
import { FeedShareCard } from '@/features/feed/components/FeedShareCard';
import { feedPostId } from '@/features/feed/format';
import { ChatOrderCard } from './ChatOrderCard';
import { VoicePlayer } from './VoicePlayer';
import { RoundVideoPlayer } from './RoundVideoPlayer';
import { t } from '@/i18n';

const isRoundVideo = (item: { name: string; mimeType: string }) => /^round-/i.test(item.name) && item.mimeType.startsWith('video/');
const isVoice = (item: ChatAttachment) => /^voice-/i.test(item.name) || item.mimeType.startsWith('audio/');

const SWIPE_TRIGGER = 56;
const SWIPE_MAX = 84;
const LONG_PRESS_MS = 450;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  meId?: string;
  first: boolean;
  last: boolean;
  read: boolean;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage, emoji: string | null) => void;
  onJump?: (messageId: string) => void;
}

function Ticks({ message, read }: { message: ChatMessage; read: boolean }) {
  if (message.status === 'pending') return <Clock size={13} aria-label={t('Yuborilmoqda')} />;
  if (message.status === 'failed') return <AlertCircle size={13} aria-label={t('Yuborilmadi')} />;
  return read ? <CheckCheck size={15} aria-label={t('O‘qildi')} /> : <Check size={15} aria-label={t('Yuborildi')} />;
}

function FileChip({ attachment }: { attachment: ChatAttachment }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const { url } = await mediaService.getSignedUrl(attachment.mediaAssetId, 'original');
      window.open(url, '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="gm-attach-file" onClick={() => void open()} disabled={busy}>
      <FileText size={20} aria-hidden="true" />
      <span>{attachment.name}</span>
    </button>
  );
}

function Attachments({ items }: { items: ChatAttachment[] }) {
  return (
    <div className="gm-attach">
      {items.map((item) =>
        isRoundVideo(item) ? (
          <RoundVideoPlayer key={item.mediaAssetId} assetId={item.mediaAssetId} seconds={Number(/-d(\d+)\.[a-z0-9]+$/i.exec(item.name)?.[1] ?? 0)} />
        ) : isVoice(item) ? (
          <VoicePlayer key={item.mediaAssetId} assetId={item.mediaAssetId} seconds={Number(/-d(\d+)\.[a-z0-9]+$/i.exec(item.name)?.[1] ?? 0)} />
        ) : item.mimeType.startsWith('image/') ? (
          <MediaViewer key={item.mediaAssetId} assetId={item.mediaAssetId} alt={item.name} label={item.name} size="lg" />
        ) : (
          <FileChip key={item.mediaAssetId} attachment={item} />
        ),
      )}
    </div>
  );
}

export function MessageBubble({ message, mine, meId, first, last, read, onEdit, onDelete, onRetry, onReply, onReact, onJump }: MessageBubbleProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const swipe = useRef<{ x: number; y: number; active: boolean; offset: number } | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const failed = message.status === 'failed';
  const settled = !message.deleted && !message.status;
  const editable = mine && canEdit(message);
  const deletable = settled && message.type !== 'ORDER';
  const [showHistory, setShowHistory] = useState(false);
  const customerPanel = (env.appRole ?? useAuthStore.getState().preferredRole) === 'CUSTOMER';
  const hasText = !!message.text;
  const callEntry = message.type === 'SYSTEM' ? parseCallLog(message.text) : null;
  const callLog = callEntry ? describeCallLog(callEntry, meId) : null;
  const callLogMode = callEntry?.mode;
  const panel = env.appRole ?? '';
  // Faqat rasm(lar)dan iborat xabar — Telegramdagidek ramkasiz, rasm pufakchani to‘liq egallaydi.
  const feedShare = !!feedPostId(message.text) && !message.deleted;
  const mediaOnly =
    settled && message.type !== 'ORDER' && !hasText && !!message.attachments?.length && message.attachments.every((a) => a.mimeType.startsWith('image/') || isRoundVideo(a));

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent | KeyboardEvent | Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setMenu(null);
      } else if (event.type === 'scroll' || event.type === 'resize') setMenu(null);
      else if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  function moveBubble(offset: number, animate: boolean) {
    const bubble = bubbleRef.current;
    if (bubble) {
      bubble.style.transition = animate ? 'transform 0.2s ease' : 'none';
      bubble.style.transform = offset ? `translateX(${offset}px)` : '';
    }
    const hint = hintRef.current;
    if (hint) {
      const ratio = Math.min(1, Math.abs(offset) / SWIPE_TRIGGER);
      hint.style.opacity = String(ratio);
      hint.style.transform = `scale(${0.6 + 0.4 * ratio})`;
    }
  }

  // Telegramdagidek: xabarni chapga surib qo‘yib yuborish — javob berish.
  const swipeHandlers =
    settled && onReply
      ? {
          onTouchStart: (event: TouchEvent<HTMLDivElement>) => {
            const touch = event.touches[0];
            if (!touch) return;
            swipe.current = { x: touch.clientX, y: touch.clientY, active: false, offset: 0 };
            longPressed.current = false;
            window.clearTimeout(pressTimer.current);
            const { clientX, clientY } = touch;
            pressTimer.current = window.setTimeout(() => {
              longPressed.current = true;
              navigator.vibrate?.(15);
              openMenuAt(clientX, clientY);
            }, LONG_PRESS_MS);
          },
          onTouchMove: (event: TouchEvent<HTMLDivElement>) => {
            const state = swipe.current;
            if (!state) return;
            const touch = event.touches[0];
            if (!touch) return;
            const dx = touch.clientX - state.x;
            const dy = touch.clientY - state.y;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) window.clearTimeout(pressTimer.current);
            if (!state.active) {
              if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
                swipe.current = null;
                return;
              }
              if (dx < -12 && Math.abs(dx) > Math.abs(dy)) state.active = true;
              else return;
            }
            state.offset = Math.max(-SWIPE_MAX, Math.min(0, dx));
            moveBubble(state.offset, false);
          },
          onTouchEnd: (event: TouchEvent<HTMLDivElement>) => {
            window.clearTimeout(pressTimer.current);
            if (longPressed.current && event.cancelable) event.preventDefault();
            const state = swipe.current;
            swipe.current = null;
            if (!state?.active) return;
            moveBubble(0, true);
            if (state.offset <= -SWIPE_TRIGGER) {
              navigator.vibrate?.(12);
              onReply(message);
            }
          },
          onTouchCancel: () => {
            window.clearTimeout(pressTimer.current);
            swipe.current = null;
            moveBubble(0, true);
          },
        }
      : {};

  function openMenuAt(clientX: number, clientY: number) {
    const width = 232;
    const height = 330;
    setMenu({
      x: Math.max(8, Math.min(clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(clientY, window.innerHeight - height - 8)),
    });
  }

  function openMenu(event: MouseEvent) {
    if (!settled) return;
    event.preventDefault();
    openMenuAt(event.clientX, event.clientY);
  }

  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of message.reactions ?? []) {
    const entry = groups.get(reaction.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (reaction.userId === meId && reaction.panel === panel) entry.mine = true;
    groups.set(reaction.emoji, entry);
  }
  const myReaction = [...groups.entries()].find(([, value]) => value.mine)?.[0] ?? null;

  const reply = message.replyTo;
  const replyName = reply ? (reply.senderId === meId && (reply.senderPanel ?? panel) === panel ? 'Siz' : accountName(reply.sender)) : '';

  return (
    <div id={`msg-${message.id}`} className={cx('gm-msg', mine && 'gm-msg--mine', first && 'gm-msg--first', last && 'gm-msg--last')} {...swipeHandlers}>
      {settled && onReply && (
        <span className="gm-msg__swipe-hint" ref={hintRef} aria-hidden="true">
          <CornerUpLeft size={16} />
        </span>
      )}
      <div
        ref={bubbleRef}
        className={cx('gm-bubble', mine && 'gm-bubble--mine', message.deleted && 'gm-bubble--deleted', failed && 'gm-bubble--failed', mediaOnly && 'gm-bubble--media', feedShare && 'gm-bubble--feed')}
        onContextMenu={openMenu}
        onDoubleClick={settled && onReply ? () => onReply(message) : undefined}
      >
        {reply && (
          <button type="button" className="gm-quote" onClick={() => onJump?.(reply.id)}>
            <strong>{replyName}</strong>
            <span>{replySnippet(reply)}</span>
          </button>
        )}
        {message.deleted ? (
          <>
            <span className="gm-bubble__text">{message.original ? <s>{t('Xabar o‘chirilgan')}</s> : t('Xabar o‘chirilgan')}</span>
            {message.original ? (
              <span className="gm-revealed" role="note">
                <span className="gm-revealed__tag"><Eye size={12} aria-hidden="true" /> {t('Plus: o‘chirilgan xabar')}</span>
                {message.original.attachments && message.original.attachments.length > 0 && <Attachments items={message.original.attachments} />}
                {message.original.text && <span className="gm-revealed__text"><Linkified text={message.original.text} /></span>}
              </span>
            ) : (
              !mine && customerPanel && (
                <Link to="/mijoz/obuna" className="gm-revealed__lock">
                  <Lock size={12} aria-hidden="true" /> {t('Plus bilan ko‘ring')}
                </Link>
              )
            )}
          </>
        ) : (
          <>
            {message.type === 'ORDER' && message.orderId && <ChatOrderCard orderId={message.orderId} />}
            {message.attachments && message.attachments.length > 0 && <Attachments items={message.attachments} />}
            {callLog && (
              <span className={cx('gm-calllog', callLog.failed && 'is-failed')}>
                {callLogMode === 'VIDEO' ? <Video size={16} /> : <Phone size={16} />}
                <span>
                  <strong>{callLog.title}</strong>
                  {callLog.detail && <small>{callLog.detail}</small>}
                </span>
              </span>
            )}
            {hasText && !callLog && message.type !== 'ORDER' && (
              <span className="gm-bubble__text">
                {feedPostId(message.text) ? <FeedShareCard postId={feedPostId(message.text) as string} /> : <Linkified text={message.text ?? ''} />}
              </span>
            )}
          </>
        )}
        {showHistory && message.editHistory && (
          <ul className="gm-revealed gm-revealed--history" aria-label={t('Tahrir tarixi')}>
            {message.editHistory.map((edit, index) => (
              <li key={`${edit.editedAt}-${index}`}>
                <small>{clock(edit.editedAt)}</small>
                <span>{edit.previousText ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
        <span className="gm-bubble__meta">
          {message.editedAt && !message.deleted && (message.editHistory?.length ? (
            <button type="button" className="gm-bubble__edited" aria-expanded={showHistory} onClick={() => setShowHistory((open) => !open)}>
              <History size={11} aria-hidden="true" /> tahrirlangan
            </button>
          ) : <em>tahrirlangan</em>)}
          <time dateTime={message.createdAt}>{clock(message.createdAt)}</time>
          {mine && !message.deleted && (
            <span className={cx('gm-bubble__ticks', read && 'gm-bubble__ticks--read')}>
              <Ticks message={message} read={read} />
            </span>
          )}
        </span>

        {settled && (
          <button
            type="button"
            className="gm-bubble__menu-trigger gm-bubble__menu-trigger--float"
            aria-label={t('Xabar amallari')}
            aria-haspopup="menu"
            aria-expanded={!!menu}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setMenu(menu ? null : { x: Math.min(rect.left, window.innerWidth - 240), y: Math.min(rect.bottom + 4, window.innerHeight - 338) });
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>

      {groups.size > 0 && (
        <div className="gm-reactions" role="group" aria-label={t('Reaksiyalar')}>
          {[...groups.entries()].map(([emoji, value]) => (
            <button
              key={emoji}
              type="button"
              className={cx('gm-reaction', value.mine && 'gm-reaction--mine')}
              aria-pressed={value.mine}
              onClick={() => onReact?.(message, value.mine ? null : emoji)}
            >
              <span>{emoji}</span>
              <b>{value.count}</b>
            </button>
          ))}
        </div>
      )}

      {failed && (
        <button type="button" className="gm-msg__retry" onClick={() => onRetry(message)}>
          <RotateCw size={13} />{' '}{t('Yuborilmadi — qayta urinish')}</button>
      )}

      {menu && (
        <div className="gm-ctx" ref={menuRef} role="menu" style={{ left: menu.x, top: menu.y }}>
          {onReact && (
            <div className="gm-ctx__reactions">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={cx(myReaction === emoji && 'is-active')}
                  aria-label={t('Reaksiya {emoji}', { emoji })}
                  onClick={() => {
                    setMenu(null);
                    onReact(message, myReaction === emoji ? null : emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {onReply && (
            <button type="button" role="menuitem" onClick={() => { setMenu(null); onReply(message); }}>
              <CornerUpLeft size={16} />{' '}{t('Javob berish')}</button>
          )}
          {hasText && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                void navigator.clipboard?.writeText(message.text ?? '');
              }}
            >
              <Copy size={16} />{' '}{t('Nusxalash')}</button>
          )}
          {editable && (
            <button type="button" role="menuitem" onClick={() => { setMenu(null); onEdit(message); }}>
              <Pencil size={16} />{' '}{t('Tahrirlash')}</button>
          )}
          {deletable && (
            <button type="button" role="menuitem" className="gm-ctx__danger" onClick={() => { setMenu(null); onDelete(message); }}>
              <Trash2 size={16} />{' '}{t('O‘chirish')}</button>
          )}
        </div>
      )}
    </div>
  );
}
