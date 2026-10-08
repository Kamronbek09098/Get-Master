import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AlertCircle, Check, CornerUpLeft, FileText, Loader2, Mic, Package, Paperclip, Pencil, Send, Smile, Trash2, Video, X } from 'lucide-react';
import { cx } from '@/lib/utils';
import { uploadAttachment, useAttachments } from '../hooks/useAttachments';
import { useVoiceRecorder, voiceSupported } from '../hooks/useVoiceRecorder';
import { roundVideoSupported } from '../hooks/useRoundVideoRecorder';
import { RoundVideoRecorder } from './RoundVideoRecorder';
import { replySnippet } from '../format';
import type { ChatAttachment, ChatMessage } from '../types';
import { t } from '@/i18n';

const MAX_LENGTH = 2000;
const EMOJIS = ['😀', '😂', '😊', '😍', '🥰', '😉', '😎', '🤝', '👍', '👌', '🙏', '👏', '🔥', '❤️', '✅', '❌', '⏰', '📍', '🔧', '🛠️', '💧', '⚡', '🏠', '💰', '📞', '📷', '😅', '🤔', '😢', '🎉', '👋', '🙌'];

/** Sensorli qurilmada (telefon) Enter — yangi qator, yuborish tugma orqali (Telegramdagidek). */
const isTouchDevice = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

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
  /** Berilsa, «Buyurtma yuborish» tugmasi ko‘rinadi (mijoz → usta suhbati). */
  onOrder?: () => void;
}

/** Xabar yozish maydoni: Enter — yuborish, Shift+Enter — yangi qator; tahrirlash rejimi va emoji. */
export function Composer({ conversationId, editing, replyTo = null, onCancelReply, onSend, onEdit, onCancelEdit, onEditLast, onOrder }: ComposerProps) {
  const files = useAttachments(conversationId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => drafts.get(conversationId) ?? '');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const voice = useVoiceRecorder();
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [roundOpen, setRoundOpen] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) setText(editing.text ?? '');
    else setText(drafts.get(conversationId) ?? '');
    const area = areaRef.current;
    // Telefonda suhbat ochilganda klaviatura o‘zi chiqib ketmasin.
    if (editing || !isTouchDevice()) area?.focus();
    if (editing) requestAnimationFrame(() => area?.setSelectionRange((editing.text ?? '').length, (editing.text ?? '').length));
  }, [editing, conversationId]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    const height = Math.min(area.scrollHeight, 140);
    area.style.height = `${height}px`;
    area.style.overflowY = area.scrollHeight > 140 ? 'auto' : 'hidden';
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

  async function sendVoice() {
    const recorded = await voice.stop();
    if (!recorded) return;
    setVoiceBusy(true);
    setVoiceError(null);
    try {
      const attachment = await uploadAttachment(recorded.file, conversationId);
      onSend('', [attachment]);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : t('Ovozli xabarni yuborib bo‘lmadi'));
    } finally {
      setVoiceBusy(false);
    }
  }

  async function sendRound(result: { file: File }) {
    try {
      const attachment = await uploadAttachment(result.file, conversationId);
      onSend('', [attachment]);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : t('Video xabarni yuborib bo‘lmadi'));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !isTouchDevice()) {
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

  const recording = voice.state === 'recording';
  const showMic = !editing && !text.trim() && files.items.length === 0 && voiceSupported();
  const voiceMessage = voiceError ?? voice.error;
  const empty = editing ? !text.trim() : (!text.trim() && files.ready.length === 0) || files.uploading;

  return (
    <div className="gm-composer">
      {replyTo && !editing && (
        <div className="gm-composer__editing gm-composer__reply">
          <CornerUpLeft size={15} aria-hidden="true" />
          <div>
            <strong>{t('Javob berish')}</strong>
            <span>{replySnippet(replyTo)}</span>
          </div>
          <button type="button" className="gm-composer__icon" aria-label={t('Javobni bekor qilish')} onClick={onCancelReply}>
            <X size={16} />
          </button>
        </div>
      )}
      {files.items.length > 0 && !editing && (
        <ul className="gm-composer__files" aria-label={t('Biriktirilgan fayllar')}>
          {files.items.map((item) => (
            <li key={item.key} className={`gm-composer__file gm-composer__file--${item.status}`} title={item.error}>
              {item.status === 'uploading' && <Loader2 size={15} className="gm-spin" aria-hidden="true" />}
              {item.status === 'error' && <AlertCircle size={15} aria-hidden="true" />}
              {item.status === 'ready' && <FileText size={15} aria-hidden="true" />}
              <span>{item.name}</span>
              <button type="button" aria-label={t('Faylni olib tashlash')} onClick={() => files.remove(item.key)}>
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
            <strong>{t('Xabarni tahrirlash')}</strong>
            <span>{editing.text}</span>
          </div>
          <button type="button" className="gm-composer__icon" aria-label={t('Tahrirlashni bekor qilish')} onClick={onCancelEdit}>
            <X size={16} />
          </button>
        </div>
      )}
      {voiceMessage && (
        <p className="gm-composer__voice-error" role="alert">
          {voiceMessage}
        </p>
      )}
      <div className="gm-composer__row">
        {recording ? (
          <div className="gm-composer__rec" role="status" aria-live="polite">
            <button type="button" className="gm-composer__icon" aria-label={t('Yozishni bekor qilish')} onClick={voice.cancel}>
              <Trash2 size={22} />
            </button>
            <span className="gm-composer__rec-dot" aria-hidden="true" />
            <span className="gm-composer__rec-time">
              {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
            </span>
            <span className="gm-composer__rec-wave" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <i key={index} style={{ animationDelay: `${index * 0.12}s` }} />
              ))}
            </span>
            <span className="gm-composer__rec-hint">{t('Yozilmoqda')}</span>
          </div>
        ) : (
        <div className="gm-composer__pill">
          <div className="gm-composer__emoji" ref={emojiRef}>
            <button
              type="button"
              className="gm-composer__icon"
              aria-label={t('Emoji')}
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((open) => !open)}
            >
              <Smile size={24} />
            </button>
            {emojiOpen && (
              <div className="gm-composer__emoji-grid" role="listbox" aria-label={t('Emoji tanlash')}>
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" role="option" aria-selected={false} onClick={() => insertEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            ref={areaRef}
            className="gm-composer__input"
            aria-label={t('Xabar')}
            placeholder={editing ? t('Xabarni tahrirlang') : t('Xabar')}
            rows={1}
            value={text}
            maxLength={MAX_LENGTH}
            enterKeyHint={isTouchDevice() ? 'enter' : 'send'}
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

          {onOrder && !editing && (
            <button type="button" className="gm-composer__icon" aria-label={t('Ustaga buyurtma yuborish')} title={t('Ustaga buyurtma yuborish')} onClick={onOrder}>
              <Package size={22} />
            </button>
          )}
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
              <button type="button" className="gm-composer__icon" aria-label={t('Fayl biriktirish')} onClick={() => fileInput.current?.click()}>
                <Paperclip size={22} />
              </button>
            </>
          )}
        </div>
        )}

        {showMic && !recording && !voiceBusy && roundVideoSupported() && (
          <button type="button" className="gm-composer__send gm-composer__send--ready gm-composer__send--round" aria-label={t('Dumaloq video yozish')} title={t('Dumaloq video yozish')} onClick={() => setRoundOpen(true)}>
            <Video size={20} />
          </button>
        )}
        {showMic || recording || voiceBusy ? (
          <button
            type="button"
            className="gm-composer__send gm-composer__send--ready"
            aria-label={recording ? t('Ovozli xabarni yuborish') : t('Ovozli xabar yozish')}
            disabled={voiceBusy}
            onClick={() => (recording ? void sendVoice() : void voice.start())}
          >
            {voiceBusy ? <Loader2 size={20} className="gm-spin" /> : recording ? <Send size={19} /> : <Mic size={21} />}
          </button>
        ) : (
        <button
          type="button"
          className={cx('gm-composer__send', !empty && 'gm-composer__send--ready')}
          aria-label={editing ? t('Saqlash') : t('Yuborish')}
          disabled={empty}
          onClick={submit}
        >
          {editing ? <Check size={20} /> : <Send size={19} />}
        </button>
        )}
      </div>
      {roundOpen && <RoundVideoRecorder onSend={sendRound} onClose={() => setRoundOpen(false)} />}
      {text.length > MAX_LENGTH - 200 && (
        <span className="gm-composer__count" aria-live="polite">
          {text.length}/{MAX_LENGTH}
        </span>
      )}
    </div>
  );
}
