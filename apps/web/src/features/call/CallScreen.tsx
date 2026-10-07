import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, MicOff, PhoneOff, RefreshCw, Video, VideoOff } from 'lucide-react';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { useCall } from './call-context';
import { formatDuration } from './call-log';
import './call.css';

function useTimer(since: number | null): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!since) return;
    const tick = () => setSeconds(Math.max(0, Math.round((Date.now() - since) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  return since ? seconds : 0;
}

function StreamVideo({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.srcObject = stream;
    if (stream) void node.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

/** Chiquvchi / davom etayotgan qo‘ng‘iroq oynasi (audio va video). */
export function CallScreen() {
  const { session, localStream, remoteStream, hangup, toggleMute, toggleCamera, switchCamera } = useCall();
  const seconds = useTimer(session?.connectedAt ?? null);
  const [swapped, setSwapped] = useState(false);
  if (!session) return null;

  const video = session.mode === 'VIDEO';
  const ended = session.phase === 'ended';
  const showRemoteVideo = video && session.phase === 'active' && session.remoteMedia.video && !!remoteStream;
  const showLocalVideo = video && session.localMedia.video && !!localStream;

  let status: string;
  if (ended) status = session.note ?? t('Qo‘ng‘iroq tugadi');
  else if (session.reconnecting) status = t('Aloqa tiklanmoqda…');
  else if (session.phase === 'calling') status = t('Chaqirilmoqda…');
  else if (session.phase === 'connecting') status = t('Ulanmoqda…');
  else status = formatDuration(seconds);

  return (
    <div className={cx('gm-call', 'gm-call--screen', showRemoteVideo && 'gm-call--video', ended && 'gm-call--ended')} role="dialog" aria-modal="true" aria-label={t('Qo‘ng‘iroq')}>
      {/* Masofadagi ovoz har doim eshitiladi (video bo‘lmasa ham). */}
      {remoteStream && !showRemoteVideo && <StreamVideo stream={remoteStream} className="gm-call__audio" />}
      {showRemoteVideo && <StreamVideo stream={swapped && showLocalVideo ? localStream : remoteStream} className={cx('gm-call__remote', swapped && showLocalVideo && session.mirrored && 'is-mirrored')} muted={swapped && showLocalVideo} />}

      {!showRemoteVideo && (
        <div className="gm-call__center">
          <div className={cx('gm-call__pulse', session.phase === 'calling' && 'is-ringing')}>
            <ChatAvatar name={session.peer.name} seed={session.peer.id} size="lg" />
          </div>
          <h2 className="gm-call__name">{session.peer.name}</h2>
          <p className="gm-call__status" aria-live="polite">{status}</p>
          {video && session.phase === 'active' && !session.remoteMedia.video && <p className="gm-call__hint">{t('Kamera o‘chirilgan')}</p>}
        </div>
      )}

      {showRemoteVideo && (
        <div className="gm-call__top">
          <strong>{session.peer.name}</strong>
          <span aria-live="polite">{status}</span>
        </div>
      )}

      {showLocalVideo && (
        <button type="button" className="gm-call__pip" onClick={() => setSwapped((value) => !value)} aria-label={t('Videoni almashtirish')}>
          <StreamVideo stream={swapped && showRemoteVideo ? remoteStream : localStream} muted className={cx(!(swapped && showRemoteVideo) && session.mirrored && 'is-mirrored')} />
        </button>
      )}

      {!ended && session.phase === 'active' && (
        <p className="gm-call__rec" role="note"><i aria-hidden="true" /> {t('Qo‘ng‘iroq xavfsizlik uchun yozib olinadi')}</p>
      )}

      {!ended && (
        <div className="gm-call__controls">
          <button type="button" className={cx('gm-call__btn', !session.localMedia.audio && 'is-off')} onClick={toggleMute} aria-pressed={!session.localMedia.audio} aria-label={session.localMedia.audio ? t('Ovozni o‘chirish') : t('Ovozni yoqish')}>
            {session.localMedia.audio ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          {video && (
            <button type="button" className={cx('gm-call__btn', !session.localMedia.video && 'is-off')} onClick={() => void toggleCamera()} aria-pressed={!session.localMedia.video} aria-label={session.localMedia.video ? t('Kamerani o‘chirish') : t('Kamerani yoqish')}>
              {session.localMedia.video ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
          )}
          {video && session.multipleCameras && session.localMedia.video && (
            <button type="button" className="gm-call__btn" onClick={() => void switchCamera()} aria-label={t('Kamerani almashtirish')}>
              <RefreshCw size={22} />
            </button>
          )}
          <button type="button" className="gm-call__btn gm-call__btn--danger" onClick={() => void hangup()} aria-label={t('Qo‘ng‘iroqni tugatish')}>
            <PhoneOff size={24} />
          </button>
        </div>
      )}
      {video && session.cameraMissing && !ended && (
        <p className="gm-call__notice"><Camera size={14} /> {t('Kamera topilmadi — faqat ovoz ishlaydi')}</p>
      )}
    </div>
  );
}
