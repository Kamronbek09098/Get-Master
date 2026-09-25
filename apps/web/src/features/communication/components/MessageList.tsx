import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, MessageCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/error-messages';
import { buildTimeline, isOwnMessage, isRead } from '../format';
import { useMarkRead, useMessages } from '../hooks/useCommunication';
import type { ChatMessage, Conversation } from '../types';
import { MessageBubble } from './MessageBubble';

export interface MessageListProps {
  conversation: Conversation;
  meId: string | undefined;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage, emoji: string | null) => void;
}

const NEAR_BOTTOM_PX = 120;

export function MessageList({ conversation, meId, onEdit, onDelete, onRetry, onReply, onReact }: MessageListProps) {
  const messages = useMessages(conversation.id);
  const { mutate: markAsRead } = useMarkRead(conversation.id);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const seen = useRef<{ count: number; lastId: string | null }>({ count: 0, lastId: null });
  const [unseen, setUnseen] = useState(0);

  const ordered = useMemo(() => [...(messages.data?.items ?? [])].reverse(), [messages.data]);
  const timeline = useMemo(() => buildTimeline(ordered, meId), [ordered, meId]);
  const last = ordered[ordered.length - 1];
  const lastIncomingId = [...ordered].reverse().find((message) => !isOwnMessage(message, meId) && !message.status)?.id;

  const scrollToBottom = useCallback((smooth: boolean) => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnseen(0);
  }, []);

  useEffect(() => {
    const previous = seen.current;
    const added = ordered.length - previous.count;
    const firstLoad = previous.count === 0;
    const lastIsMine = !!last && isOwnMessage(last, meId);
    if (firstLoad || stickToBottom.current || lastIsMine) {
      scrollToBottom(!firstLoad);
    } else if (added > 0 && last && last.id !== previous.lastId) {
      setUnseen((count) => count + added);
    }
    seen.current = { count: ordered.length, lastId: last?.id ?? null };
  }, [ordered.length, last, meId, scrollToBottom]);

  useEffect(() => {
    if (lastIncomingId) markAsRead();
  }, [lastIncomingId, markAsRead]);

  const jumpTo = useCallback((messageId: string) => {
    const target = document.getElementById(`msg-${messageId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('gm-msg--flash');
    window.setTimeout(() => target.classList.remove('gm-msg--flash'), 1400);
  }, []);

  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    stickToBottom.current = near;
    if (near) setUnseen(0);
  }

  return (
    <div className="gm-thread">
      <div className="gm-thread__scroll" ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label="Xabarlar">
        {messages.isLoading && (
          <div className="gm-thread__loading" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className={`gm-thread__skeleton${index % 2 ? ' gm-thread__skeleton--mine' : ''}`} />
            ))}
          </div>
        )}
        {messages.isError && <Alert tone="danger">{getErrorMessage(messages.error)}</Alert>}
        {!messages.isLoading && ordered.length === 0 && (
          <div className="gm-thread__empty">
            <span>
              <MessageCircle size={30} strokeWidth={1.6} />
            </span>
            <strong>Suhbatni boshlang</strong>
            <p>Birinchi xabarni yozing — usta javob bergach, shu yerda ko‘rasiz.</p>
          </div>
        )}

        {timeline.map((item) =>
          item.type === 'day' ? (
            <div key={item.key} className="gm-thread__day">
              <span>{item.label}</span>
            </div>
          ) : (
            <MessageBubble
              key={item.key}
              message={item.message}
              mine={item.mine}
              meId={meId}
              first={item.first}
              last={item.last}
              read={item.mine && isRead(item.message, conversation.counterpartLastReadAt)}
              onEdit={onEdit}
              onDelete={onDelete}
              onRetry={onRetry}
              onReply={onReply}
              onReact={onReact}
              onJump={jumpTo}
            />
          ),
        )}
      </div>

      {unseen > 0 && (
        <button type="button" className="gm-thread__jump" onClick={() => scrollToBottom(true)} aria-label={`${unseen} ta yangi xabar, pastga tushish`}>
          <ArrowDown size={18} />
          <span>{unseen}</span>
        </button>
      )}
    </div>
  );
}
