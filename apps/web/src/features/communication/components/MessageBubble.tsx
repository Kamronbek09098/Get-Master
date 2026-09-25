import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Copy, CornerUpLeft, FileText, MoreHorizontal, Pencil, RotateCw, Trash2 } from 'lucide-react';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { accountName } from '@/lib/account-name';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { mediaService } from '@/features/media/services/media.service';
import { canEdit, clock, replySnippet } from '../format';
import type { ChatAttachment, ChatMessage } from '../types';
import { Linkified } from './Linkified';

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
  if (message.status === 'pending') return <Clock size={13} aria-label="Yuborilmoqda" />;
  if (message.status === 'failed') return <AlertCircle size={13} aria-label="Yuborilmadi" />;
  return read ? <CheckCheck size={15} aria-label="O‘qildi" /> : <Check size={15} aria-label="Yuborildi" />;
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
        item.mimeType.startsWith('image/') ? (
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
  const failed = message.status === 'failed';
  const settled = !message.deleted && !message.status;
  const editable = mine && canEdit(message);
  const deletable = mine && settled;
  const hasText = !!message.text;
  const panel = env.appRole ?? '';

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

  function openMenu(event: MouseEvent) {
    if (!settled) return;
    event.preventDefault();
    const width = 232;
    const height = 330;
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - width - 8),
      y: Math.min(event.clientY, window.innerHeight - height - 8),
    });
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
    <div id={`msg-${message.id}`} className={cx('gm-msg', mine && 'gm-msg--mine', first && 'gm-msg--first', last && 'gm-msg--last')}>
      <div
        className={cx('gm-bubble', mine && 'gm-bubble--mine', message.deleted && 'gm-bubble--deleted', failed && 'gm-bubble--failed')}
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
          <span className="gm-bubble__text">Xabar o‘chirilgan</span>
        ) : (
          <>
            {message.attachments && message.attachments.length > 0 && <Attachments items={message.attachments} />}
            {hasText && (
              <span className="gm-bubble__text">
                <Linkified text={message.text ?? ''} />
              </span>
            )}
          </>
        )}
        <span className="gm-bubble__meta">
          {message.editedAt && !message.deleted && <em>tahrirlangan</em>}
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
            aria-label="Xabar amallari"
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
        <div className="gm-reactions" role="group" aria-label="Reaksiyalar">
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
          <RotateCw size={13} /> Yuborilmadi — qayta urinish
        </button>
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
                  aria-label={`Reaksiya ${emoji}`}
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
              <CornerUpLeft size={16} /> Javob berish
            </button>
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
              <Copy size={16} /> Nusxalash
            </button>
          )}
          {editable && (
            <button type="button" role="menuitem" onClick={() => { setMenu(null); onEdit(message); }}>
              <Pencil size={16} /> Tahrirlash
            </button>
          )}
          {deletable && (
            <button type="button" role="menuitem" className="gm-ctx__danger" onClick={() => { setMenu(null); onDelete(message); }}>
              <Trash2 size={16} /> O‘chirish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
