import { Phone, PhoneOff, Video } from 'lucide-react';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { t } from '@/i18n';
import { useCall } from './call-context';
import './call.css';

/** Kiruvchi qo‘ng‘iroq: butun ekran (telefonda) / markazdagi karta (kompyuterda). */
export function IncomingCall() {
  const { session, accept, decline } = useCall();
  if (!session) return null;
  const video = session.mode === 'VIDEO';
  return (
    <div className="gm-call gm-call--incoming" role="alertdialog" aria-modal="true" aria-label={t('Kiruvchi qo‘ng‘iroq')}>
      <div className="gm-call__card">
        <div className="gm-call__pulse">
          <ChatAvatar name={session.peer.name} seed={session.peer.id} size="lg" />
        </div>
        <h2 className="gm-call__name">{session.peer.name}</h2>
        <p className="gm-call__status">{video ? t('Video qo‘ng‘iroq') : t('Audio qo‘ng‘iroq')}</p>
        <p className="gm-call__rec gm-call__rec--card" role="note"><i aria-hidden="true" /> {t('Qo‘ng‘iroq xavfsizlik uchun yozib olinadi')}</p>
        <div className="gm-call__row gm-call__row--incoming">
          <button type="button" className="gm-call__btn gm-call__btn--danger gm-call__btn--big" onClick={() => void decline()} aria-label={t('Rad etish')}>
            <PhoneOff size={26} />
            <span>{t('Rad etish')}</span>
          </button>
          <button type="button" className="gm-call__btn gm-call__btn--accept gm-call__btn--big" onClick={() => void accept()} aria-label={t('Javob berish')} autoFocus>
            {video ? <Video size={26} /> : <Phone size={26} />}
            <span>{t('Javob berish')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
