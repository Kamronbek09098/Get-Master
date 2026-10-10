import { useEffect, useState } from 'react';
import { ArrowLeft, Maximize2, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { useMe } from '@/features/session/hooks/useMe';
import { listTime, previewText } from '@/features/communication/format';
import { useConversations } from '@/features/communication/hooks/useCommunication';
import { counterpartName } from '@/features/communication/names';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { ChatThread } from '@/features/communication/components/ChatThread';
import { t } from '@/i18n';
import '@/features/communication/chat.css';
import './messages-panel.css';

/** Lenta ustida ochiladigan xabarlar oynasi (Instagramdagidek): sahifadan chiqmasdan suhbatlarni o‘qish va yozish. */
export function MessagesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const me = useMe();
  const conversations = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const base = env.appRole === 'MASTER' ? '/usta' : '/mijoz';
  const items = (conversations.data?.items ?? []).filter((item) => item.type !== 'SUPPORT' || true);
  const active = items.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => event.key === 'Escape' && (active ? setActiveId(null) : onClose());
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, active, onClose]);

  if (!open) return null;
  const name = active ? counterpartName(active, null) : '';
  return (
    <section className="gf-mp" role="dialog" aria-label={t('Xabarlar')}>
      <header className="gf-mp__head">
        {active ? (
          <button type="button" className="gf-iconbtn gf-iconbtn--sm" onClick={() => setActiveId(null)} aria-label={t('Suhbatlarga qaytish')}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        ) : null}
        <h2>{active ? name : t('Xabarlar')}</h2>
        <div className="gf-mp__tools">
          <button type="button" className="gf-iconbtn gf-iconbtn--sm" onClick={() => navigate(active ? `${base}/chat?suhbat=${active.id}` : `${base}/chat`)} aria-label={t('To‘liq ochish')}>
            <Maximize2 size={18} aria-hidden="true" />
          </button>
          <button type="button" className="gf-iconbtn gf-iconbtn--sm" onClick={onClose} aria-label={t('Yopish')}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      {active ? (
        <div className="gf-mp__thread">
          <ChatThread key={active.id} conversation={active} />
        </div>
      ) : (
        <ul className="gf-mp__list">
          {conversations.isLoading && [0, 1, 2, 3].map((i) => <li key={i} className="gf-skel gf-skel--row" aria-hidden="true" />)}
          {!conversations.isLoading && items.length === 0 && (
            <li className="gf-empty gf-empty--sm">
              <MessageCircle size={28} aria-hidden="true" />
              <strong>{t('Suhbatlar yo‘q')}</strong>
              <p>{t('Ustaga yozsangiz, suhbat shu yerda chiqadi.')}</p>
            </li>
          )}
          {items.map((conversation) => {
            const label = counterpartName(conversation, null);
            const time = conversation.lastMessage?.createdAt ?? conversation.updatedAt;
            return (
              <li key={conversation.id}>
                <button type="button" className={cx('gf-mp__row', conversation.unreadCount > 0 && 'is-unread')} onClick={() => setActiveId(conversation.id)}>
                  <ChatAvatar name={label} seed={conversation.counterpart?.id ?? conversation.id} src={conversation.counterpart?.avatar} size="lg" admin={conversation.type === 'SUPPORT'} />
                  <span className="gf-mp__body">
                    <strong>{label}</strong>
                    <span>
                      {previewText(conversation, me.data?.id)} · {listTime(time)}
                    </span>
                  </span>
                  {conversation.unreadCount > 0 && <i aria-label={t('{unreadCount} ta o‘qilmagan', { unreadCount: conversation.unreadCount })} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
