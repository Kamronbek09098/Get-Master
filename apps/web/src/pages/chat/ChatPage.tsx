import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

/** Administrator: foydalanuvchi shu suhbatga yozishi mumkinmi — belgilaydi. */
function ReplyAccessSwitch({ conversationId, allowed }: { conversationId: string; allowed: boolean }) {
  const setAccess = useSetReplyAccess(conversationId);
  return (
    <div className="gm-messenger__access" title="Yoqilsa, foydalanuvchi shu suhbatga javob yoza oladi">
      <Switch label="Foydalanuvchi yoza oladi" checked={allowed} disabled={setAccess.isPending} onChange={(checked) => setAccess.mutate(checked)} />
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
          <h1>Xabarlar hali yo‘q</h1>
          <p>Foydalanuvchiga yozish uchun «Foydalanuvchilar» bo‘limida kerakli akkauntni oching va «Chat orqali yozish» tugmasini bosing. Xabar foydalanuvchida oddiy chat kabi, «Admin» nomi bilan ko‘rinadi.</p>
          <Link to="/admin/foydalanuvchilar" className="gm-blank__cta">
            <Users size={16} aria-hidden="true" /> Foydalanuvchilar
          </Link>
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
          <h1>Suhbatlar hali yo‘q</h1>
          <p>
            {asMaster
              ? 'Mijozlar sizga yozganda yoki buyurtma qabul qilinganda suhbat shu yerda paydo bo‘ladi. Ko‘proq mijoz topish uchun faol takliflarga javob bering.'
              : 'Ustani tanlab, uning sahifasidagi «Chat orqali bog‘lanish» tugmasi bilan birinchi suhbatingizni boshlang.'}
          </p>
          <Link to={asMaster ? '/ustalar/faol-takliflar' : '/ustalar-katalogi'} className="gm-blank__cta">
            {asMaster ? 'Faol takliflarni ko‘rish' : 'Ustalarni ko‘rish'}
          </Link>
          <ul className="gm-blank__features">
            <li>
              <ImagePlus size={20} aria-hidden="true" />
              <strong>Rasm va fayl</strong>
              <span>Muammo suratini yoki hujjatni yuboring</span>
            </li>
            <li>
              <Reply size={20} aria-hidden="true" />
              <strong>Javob va reaksiya</strong>
              <span>Xabarga javob bering, emoji qo‘ying</span>
            </li>
            <li>
              <Pencil size={20} aria-hidden="true" />
              <strong>Tahrirlash</strong>
              <span>Yuborilgan xabarni 48 soat ichida tuzating</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={cx('gm-messenger', selectedId && 'gm-messenger--open')}>
      <aside className="gm-messenger__list" aria-label="Suhbatlar">
        <header className="gm-messenger__title">
          <h1>{isAdmin ? 'Xabarlar' : 'Chat'}</h1>
        </header>
        <div className="gm-messenger__scroll">
          <ConversationList selectedId={selectedId} onSelect={select} />
        </div>
      </aside>

      <section className="gm-messenger__thread" aria-label="Suhbat">
        {selected ? (
          <>
            <header className="gm-messenger__head">
              <button type="button" className="gm-messenger__back" onClick={() => select(null)} aria-label="Suhbatlarga qaytish">
                <ArrowLeft size={20} />
              </button>
              <ChatAvatar name={name} seed={selected.counterpart?.id ?? selected.id} admin={selected.type === 'SUPPORT' && !isAdmin} />
              <div className="gm-messenger__who">
                <strong>{name}</strong>
                <span>{selected.type === 'SUPPORT' ? (isAdmin ? 'Administrator xabarlari' : 'Administrator') : selected.type === 'DIRECT' ? 'Buyurtmadan oldingi suhbat' : 'Buyurtma suhbati'}</span>
              </div>
              {isAdmin && selected.type === 'SUPPORT' && <ReplyAccessSwitch conversationId={selected.id} allowed={selected.userCanReply === true} />}
            </header>
            <ChatThread key={selected.id} conversation={selected} />
          </>
        ) : (
          <div className="gm-messenger__placeholder">
            <span className="gm-messenger__placeholder-icon">
              <MessageCircle size={38} strokeWidth={1.5} />
            </span>
            <strong>Suhbatni tanlang</strong>
            <p>Chapdagi ro‘yxatdan suhbatni oching. Xabarlaringiz shu yerda, real vaqtga yaqin tezlikda ko‘rinadi.</p>
            <ul className="gm-messenger__tips">
              <li>
                <Pencil size={14} aria-hidden="true" /> Xabarni ikki marta bosib tahrirlang
              </li>
              <li>
                <Keyboard size={14} aria-hidden="true" /> ↑ tugmasi oxirgi xabaringizni tahrirlaydi
              </li>
              <li>
                <CornerDownLeft size={14} aria-hidden="true" /> Enter yuboradi, Shift+Enter yangi qator
              </li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
