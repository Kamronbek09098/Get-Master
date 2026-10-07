import { Phone, Video } from 'lucide-react';
import { t } from '@/i18n';
import { useCall } from './call-context';
import './call.css';

/** Chat sarlavhasidagi audio/video qo‘ng‘iroq tugmalari. */
export function CallButtons({ conversationId, peerName, disabled }: { conversationId: string; peerName?: string; disabled?: boolean }) {
  const { enabled, session, startCall } = useCall();
  if (!enabled) return null;
  const busy = disabled || (session !== null && session.phase !== 'ended');
  return (
    <div className="gm-callbtns">
      <button type="button" className="gm-callbtns__btn" disabled={busy} onClick={() => void startCall(conversationId, 'AUDIO', peerName)} aria-label={t('Audio qo‘ng‘iroq')} title={t('Audio qo‘ng‘iroq')}>
        <Phone size={19} />
      </button>
      <button type="button" className="gm-callbtns__btn" disabled={busy} onClick={() => void startCall(conversationId, 'VIDEO', peerName)} aria-label={t('Video qo‘ng‘iroq')} title={t('Video qo‘ng‘iroq')}>
        <Video size={19} />
      </button>
    </div>
  );
}
