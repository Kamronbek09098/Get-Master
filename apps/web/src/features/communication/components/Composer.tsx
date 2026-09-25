import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AlertCircle, Check, CornerUpLeft, FileText, Loader2, Paperclip, Pencil, Send, Smile, X } from 'lucide-react';
import { cx } from '@/lib/utils';
import { useAttachments } from '../hooks/useAttachments';
import { replySnippet } from '../format';
import type { ChatAttachment, ChatMessage } from '../types';

const MAX_LENGTH = 2000;
const EMOJIS = ['😀', '😂', '😊', '😍', '🥰', '😉', '😎', '🤝', '👍', '👌', '🙏', '👏', '🔥', '❤️', '✅', '❌', '⏰', '📍', '🔧', '🛠️', '💧', '⚡', '🏠', '💰', '📞', '📷', '😅', '🤔', '😢', '🎉', '👋', '🙌'];

const drafts = new Map<string, string>();

export interface ComposerProps {
  conversationId: string;
  editing: ChatMessage | null;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onEdit: (message: ChatMessage, text: string) => void;
  onCancelEdit: () => void;
  onEditLast?: () => void;
}

/** Xabar yozish maydoni: Enter — yuborish, Shift+Enter — yangi qator; tahrirlash rejimi va emoji. */
export function Composer({ conversationId, editing, replyTo = null, onCancelReply, onSend, onEdit, onCancelEdit, onEditLast }: ComposerProps) {
  const files = useAttachments(conversationId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => drafts.get(conversationId) ?? '');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) setText(editing.text ?? '');
    else setText(drafts.get(conversationId) ?? '');
    const area = areaRef.current;
    area?.focus();
    if (editing) requestAnimationFrame(() => area?.setSelectionRange((editing.text ?? '').length, (editing.text ?? '').length));
  }, [editing, conversationId]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 140)}px`;
  }, [text]);

  useEffect(() => {
    if (!emojiOpen) return;
    const close = (event: PointerEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [emojiOpen]);

  function change(value: string) {
    setText(value);
    if (!editing) drafts.set(conversationId, value);
  }

  function submit() {
    const value = text.trim();
    if (!editing && (files.uploading || (!value && files.ready.length === 0))) return;
    if (!value && editing) return;
    if (editing) {
      if (value !== (editing.text ?? '')) onEdit(editing, value);
      else onCancelEdit();
    } else {
      if (files.ready.length > 0) onSend(value, files.ready);
      else onSend(value);
      files.clear();
      drafts.delete(conversationId);
    }
    setText('');
    setEmojiOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape' && (editing || replyTo)) {
      if (editing) onCancelEdit();
      else onCancelReply?.();
    } else if (event.key === 'ArrowUp' && !editing && !text && onEditLast) {
      event.preventDefault();
      onEditLast();
    }
  }

  function insertEmoji(emoji: string) {
    const area = areaRef.current;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`.slice(0, MAX_LENGTH);
    change(next);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  const empty = editing ? !text.trim() : (!text.trim() && files.ready.length === 0) || files.uploading;

  return (
    <div className="gm-composer">
      {replyTo && !editing && (
        <div className="gm-composer__editing gm-composer__reply">
          <CornerUpLeft size={15} aria-hidden="true" />
          <div>
            <strong>Javob berish</strong>
            <span>{replySnippet(replyTo)}</span>
          </div>
          <button type="button" className="gm-composer__icon" aria-label="Javobni bekor qilish" onClick={onCancelReply}>
            <X size={16} />
          </button>
        </div>
      )}
      {files.items.length > 0 && !editing && (
        <ul className="gm-composer__files" aria-label="Biriktirilgan fayllar">
          {files.items.map((item) => (
            <li key={item.key} className={`gm-composer__file gm-composer__file--${item.status}`} title={item.error}>
              {item.status === 'uploading' && <Loader2 size={15} className="gm-spin" aria-hidden="true" />}
              {item.status === 'error' && <AlertCircle size={15} aria-hidden="true" />}
              {item.status === 'ready' && <FileText size={15} aria-hidden="true" />}
              <span>{item.name}</span>
              <button type="button" aria-label="Faylni olib tashlash" onClick={() => files.remove(item.key)}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className="gm-composer__editing">
          <Pencil size={15} aria-hidden="true" />
          <div>
            <strong>Xabarni tahrirlash</strong>
            <span>{editing.text}</span>
          </div>
          <button type="button" className="gm-composer__icon" aria-label="Tahrirlashni bekor qilish" onClick={onCancelEdit}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="gm-composer__row">
        <div className="gm-composer__emoji" ref={emojiRef}>
          <button
            type="button"
            className="gm-composer__icon"
            aria-label="Emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <Smile size={22} />
          </button>
          {emojiOpen && (
            <div className="gm-composer__emoji-grid" role="listbox" aria-label="Emoji tanlash">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" role="option" aria-selected={false} onClick={() => insertEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {!editing && (
          <>
            <input
              ref={fileInput}
              type="file"
              hidden
              multiple
              onChange={(event) => {
                files.add(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
            <button type="button" className="gm-composer__icon" aria-label="Fayl biriktirish" onClick={() => fileInput.current?.click()}>
              <Paperclip size={21} />
            </button>
          </>
        )}

        <textarea
          ref={areaRef}
          className="gm-composer__input"
          aria-label="Xabar"
          placeholder={editing ? 'Xabarni tahrirlang…' : 'Xabar yozing…'}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => change(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const pasted = Array.from(event.clipboardData.files);
            if (pasted.length > 0 && !editing) {
              event.preventDefault();
              files.add(pasted);
            }
          }}
        />

        <button
          type="button"
          className={cx('gm-composer__send', !empty && 'gm-composer__send--ready')}
          aria-label={editing ? 'Saqlash' : 'Yuborish'}
          disabled={empty}
          onClick={submit}
        >
          {editing ? <Check size={20} /> : <Send size={19} />}
        </button>
      </div>
      {text.length > MAX_LENGTH - 200 && (
        <span className="gm-composer__count" aria-live="polite">
          {text.length}/{MAX_LENGTH}
        </span>
      )}
    </div>
  );
}
