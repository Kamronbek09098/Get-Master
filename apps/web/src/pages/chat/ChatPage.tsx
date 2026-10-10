import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CallButtons } from '@/features/call/CallButtons';
import { ArrowLeft, CornerDownLeft, ImagePlus, Keyboard, MessageCircle, Pencil, Reply, Users } from 'lucide-react';
import { env } from '@/lib/env';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { ChatThread } from '@/features/communication/components/ChatThread';
import { ConversationList } from '@/features/communication/components/ConversationList';
import { useConversations, useSetReplyAccess } from '@/features/communication/hooks/useCommunication';
import { Switch } from '@/components/ui/Switch';
import { counterpartName } from '@/features/communication/names';
import { useAuthStore } from '@/store/auth.store';
import { cx } from '@/lib/utils';
import '@/features/communication/chat.css';
import { t } from '@/i18n';

/** Administrator: foydalanuvchi shu suhbatga yozishi mumkinmi — belgilaydi. */
function ReplyAccessSwitch({ conversationId, allowed }: { conversationId: string; allowed: boolean }) {
  const setAccess = useSetReplyAccess(conversationId);
  return (
    <div className="gm-messenger__access" title={t('Yoqilsa, foydalanuvchi shu suhbatga javob yoza oladi.')}>
      <Switch label={t('Foydalanuvchi yoza oladi')} checked={allowed} disabled={setAccess.isPending} onChange={(checked) => setAccess.mutate(checked)} />
    </div>
  );
}

export function ChatPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('suhbat');
  const conversations = useConversations();
  const role = useAuthStore((state) => state.preferredRole);
  const selected = useMemo(
    () => conversations.data?.items.find((item) => item.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );

  const select = (id: string | null) => setParams(id ? { suhbat: id } : {}, { replace: true });
  const name = selected ? counterpartName(selected, role) : '';

  // Ism bosilsa: mijoz paneli — ustaning profili; usta paneli — mijozning profili (administrator suhbatida profil yo‘q).
  const accountNumber = selected?.counterpart?.accountNumber;
  const profileHref =
    selected && selected.type !== 'SUPPORT' && accountNumber !== undefined
      ? (env.appRole ?? role) === 'MASTER'
        ? `/usta/mijozlar/${accountNumber}`
        : (env.appRole ?? role) === 'CUSTOMER' && selected.counterpartIsMaster
          ? `/mijoz/ustalar/${accountNumber}`
          : null
      : null;

  const noConversations = conversations.isSuccess && conversations.data.items.length === 0;
  const asMaster = (env.appRole ?? role) === 'MASTER';
  const isAdmin = (env.appRole ?? role) === 'ADMIN';

  if (noConversations && isAdmin) {
    return (
      <div className="gm-messenger gm-messenger--blank">
        <div className="gm-blank">
          <span className="gm-blank__icon">
            <MessageCircle size={40} strokeWidth={1.5} />
          </span>
          <h1>{t('Xabarlar hali yo‘q')}</h1>
          <p>{t('Foydalanuvchiga yozish uchun «Foydalanuvchilar» bo‘limida kerakli akkauntni oching va «Chat orqali yozish» tugmasini bosing. Xabar foydalanuvchida oddiy chat kabi, «Admin» nomi bilan ko‘rinadi.')}</p>
          <Link to="/admin/foydalanuvchilar" className="gm-blank__cta">
            <Users size={16} aria-hidden="true" />{' '}{t('Foydalanuvchilar')}</Link>
        </div>
      </div>
    );
  }

  if (noConversations) {
    return (
      <div className="gm-messenger gm-messenger--blank">
        <div className="gm-blank">
          <span className="gm-blank__icon">
            <MessageCircle size={40} strokeWidth={1.5} />
          </span>
          <h1>{t('Suhbatlar hali yo‘q')}</h1>
          <p>
            {asMaster
              ? t('Mijozlar sizga yozganda yoki buyurtma qabul qilinganda suhbat shu yerda paydo bo‘ladi. Ko‘proq mijoz topish uchun faol takliflarga javob bering.')
              : t('Ustani tanlab, uning sahifasidagi «Chat orqali bog‘lanish» tugmasi bilan birinchi suhbatingizni boshlang.')}
          </p>
          <Link to={asMaster ? '/usta/takliflar' : '/mijoz/ustalar'} className="gm-blank__cta">
            {asMaster ? t('Takliflarni ko‘rish') : t('Ustalarni ko‘rish')}
          </Link>
          <ul className="gm-blank__features">
            <li>
              <ImagePlus size={20} aria-hidden="true" />
              <strong>{t('Rasm va fayl')}</strong>
              <span>{t('Muammo suratini yoki hujjatni yuboring')}</span>
            </li>
            <li>
              <Reply size={20} aria-hidden="true" />
              <strong>{t('Javob va reaksiya')}</strong>
              <span>{t('Xabarga javob bering, emoji qo‘ying')}</span>
            </li>
            <li>
              <Pencil size={20} aria-hidden="true" />
              <strong>{t('Tahrirlash')}</strong>
              <span>{t('Yuborilgan xabarni 48 soat ichida tuzating')}</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={cx('gm-messenger', selectedId && 'gm-messenger--open')}>
      <aside className="gm-messenger__list" aria-label={t('Suhbatlar')}>
        <header className="gm-messenger__title">
          <h1>{isAdmin ? t('Xabarlar') : t('Chat')}</h1>
        </header>
        <div className="gm-messenger__scroll">
          <ConversationList selectedId={selectedId} onSelect={select} />
        </div>
      </aside>

      <section className="gm-messenger__thread" aria-label={t('Suhbat')}>
        {selected ? (
          <>
            <header className="gm-messenger__head">
              <button type="button" className="gm-messenger__back" onClick={() => select(null)} aria-label={t('Suhbatlarga qaytish')}>
                <ArrowLeft size={20} />
              </button>
              {profileHref ? (
                <Link to={profileHref} className="gm-messenger__who-link" aria-label={t('{name} profilini ochish', { name })}>
                  <ChatAvatar name={name} seed={selected.counterpart?.id ?? selected.id} src={selected.counterpart?.avatar} />
                  <div className="gm-messenger__who">
                    <strong>{name}</strong>
                    <span>{selected.type === 'DIRECT' ? t('Buyurtmadan oldingi suhbat') : t('Buyurtma suhbati')}</span>
                  </div>
                </Link>
              ) : (
                <>
                  <ChatAvatar name={name} seed={selected.counterpart?.id ?? selected.id} src={selected.counterpart?.avatar} admin={selected.type === 'SUPPORT' && !isAdmin} />
                  <div className="gm-messenger__who">
                    <strong>{name}</strong>
                    <span>{selected.type === 'SUPPORT' ? (isAdmin ? t('Administrator xabarlari') : t('Administrator')) : selected.type === 'DIRECT' ? t('Buyurtmadan oldingi suhbat') : t('Buyurtma suhbati')}</span>
                  </div>
                </>
              )}
              {!isAdmin && selected.type !== 'SUPPORT' && selected.counterpart && (
                <div className="gm-messenger__calls">
                  <CallButtons conversationId={selected.id} peerName={name} />
                </div>
              )}
              {isAdmin && selected.type === 'SUPPORT' && <ReplyAccessSwitch conversationId={selected.id} allowed={selected.userCanReply === true} />}
            </header>
            <ChatThread key={selected.id} conversation={selected} />
          </>
        ) : (
          <div className="gm-messenger__placeholder">
            <span className="gm-messenger__placeholder-icon">
              <MessageCircle size={38} strokeWidth={1.5} />
            </span>
            <strong>{t('Suhbatni tanlang')}</strong>
            <p>{t('Chapdagi ro‘yxatdan suhbatni oching. Xabarlaringiz shu yerda, real vaqtga yaqin tezlikda ko‘rinadi.')}</p>
            <ul className="gm-messenger__tips">
              <li>
                <Pencil size={14} aria-hidden="true" />{' '}{t('Xabarni ikki marta bosib tahrirlang')}</li>
              <li>
                <Keyboard size={14} aria-hidden="true" />{' '}{t('↑ tugmasi oxirgi xabaringizni tahrirlaydi')}</li>
              <li>
                <CornerDownLeft size={14} aria-hidden="true" />{' '}{t('Enter yuboradi, Shift+Enter yangi qator')}</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
