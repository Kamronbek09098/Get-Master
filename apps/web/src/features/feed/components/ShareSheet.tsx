import { useState } from 'react';
import { Check, Link2, MessageCircle, Send as SendIcon, Share2 } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { accountName } from '@/lib/account-name';
import { env } from '@/lib/env';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { useConversations } from '@/features/communication/hooks/useCommunication';
import { communicationService } from '@/features/communication/services/communication.service';
import { t } from '@/i18n';
import { feedService } from '../feed.service';
import { postLink } from '../format';
import type { FeedPost } from '../types';
import { Sheet } from './Sheet';

/** Ulashish: GetMaster chatlari, yaqinda muloqot qilinganlar va tashqi ilovalar. Chatda post kartochka bo‘lib ko‘rinadi. */
export function ShareSheet({ post, onClose }: { post: FeedPost | null; onClose: () => void }) {
  const toast = useAppStore((state) => state.pushToast);
  const conversations = useConversations();
  const [sent, setSent] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const base = env.appRole === 'MASTER' ? '/usta' : '/mijoz';
  const list = (conversations.data?.items ?? []).filter((item) => item.counterpart && item.type !== 'SUPPORT');
  const recent = list.slice(0, 6);
  const link = post ? postLink(post.id, base) : '';
  const shareText = post ? `${post.master.name} — ${post.caption ?? post.service?.name ?? t('Bajarilgan ish')}` : '';

  async function sendTo(conversationId: string) {
    if (!post || busy) return;
    setBusy(conversationId);
    try {
      await communicationService.sendMessage(conversationId, { text: link });
      void feedService.share(post.id).catch(() => undefined);
      setSent((value) => [...value, conversationId]);
      toast(t('Chatga yuborildi'), 'success');
    } catch {
      toast(t('Yuborib bo‘lmadi. Qayta urinib ko‘ring.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(link);
      void feedService.share(post.id).catch(() => undefined);
      toast(t('Havola nusxalandi'), 'success');
    } catch {
      toast(t('Nusxalab bo‘lmadi'), 'error');
    }
  }

  async function nativeShare() {
    if (!post) return;
    try {
      await navigator.share({ title: 'GetMaster', text: shareText, url: link });
      void feedService.share(post.id).catch(() => undefined);
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  }

  const external = [
    { key: 'tg', label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`, tone: '#2aabee' },
    { key: 'wa', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}`, tone: '#25d366' },
  ];

  const row = (conversationId: string, name: string, seed: string) => {
    const done = sent.includes(conversationId);
    return (
      <li key={conversationId}>
        <ChatAvatar name={name} seed={seed} size="md" />
        <strong>{name}</strong>
        <button type="button" className={done ? 'gf-btn gf-btn--done' : 'gf-btn'} disabled={busy === conversationId || done} onClick={() => void sendTo(conversationId)}>
          {done ? <><Check size={15} aria-hidden="true" /> {t('Yuborildi')}</> : busy === conversationId ? t('Yuborilmoqda…') : t('Yuborish')}
        </button>
      </li>
    );
  };

  return (
    <Sheet open={!!post} onClose={onClose} title={t('Ulashish')} subtitle={t('Videoni do‘stlaringiz bilan baham ko‘ring')}>
      {post && (
        <>
          <section aria-label={t('Yaqinda muloqot qilinganlar')}>
            <h3 className="gf-h3">{t('Yaqinda muloqot qilinganlar')}</h3>
            {conversations.isLoading ? (
              <div className="gf-recent" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="gf-skel gf-skel--avatar" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="gf-note">{t('Hali chatlar yo‘q. Havola orqali ulashing.')}</p>
            ) : (
              <div className="gf-recent">
                {recent.map((item) => {
                  const name = accountName(item.counterpart);
                  const done = sent.includes(item.id);
                  return (
                    <button key={item.id} type="button" className="gf-recent__item" disabled={busy === item.id || done} onClick={() => void sendTo(item.id)} aria-label={t('{name}ga yuborish', { name })}>
                      <span className="gf-recent__ava">
                        <ChatAvatar name={name} seed={item.id} size="lg" />
                        {done && <i><Check size={14} aria-hidden="true" /></i>}
                      </span>
                      <span>{name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label={t('GetMaster chatlari')}>
            <button type="button" className="gf-listbtn" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
              <span className="gf-listbtn__ico gf-listbtn__ico--blue"><MessageCircle size={18} aria-hidden="true" /></span>
              <strong>{t('GetMaster chatlari')}</strong>
              <em>{list.length}</em>
            </button>
            {showAll && (
              <ul className="gf-people">
                {list.length === 0 && <li className="gf-note">{t('Chatlar topilmadi.')}</li>}
                {list.map((item) => row(item.id, accountName(item.counterpart), item.id))}
              </ul>
            )}
          </section>

          <section aria-label={t('Havola orqali ulashish')}>
            <h3 className="gf-h3">{t('Havola orqali ulashish')}</h3>
            <div className="gf-apps">
              <button type="button" className="gf-app" onClick={() => void copy()}>
                <span className="gf-app__ico"><Link2 size={22} aria-hidden="true" /></span>
                <span>{t('Havola')}</span>
              </button>
              {external.map((app) => (
                <a key={app.key} className="gf-app" href={app.href} target="_blank" rel="noreferrer" onClick={() => void feedService.share(post.id).catch(() => undefined)}>
                  <span className="gf-app__ico" style={{ background: app.tone }}><SendIcon size={22} aria-hidden="true" /></span>
                  <span>{app.label}</span>
                </a>
              ))}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button type="button" className="gf-app" onClick={() => void nativeShare()}>
                  <span className="gf-app__ico"><Share2 size={22} aria-hidden="true" /></span>
                  <span>{t('Ko‘proq')}</span>
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </Sheet>
  );
}
