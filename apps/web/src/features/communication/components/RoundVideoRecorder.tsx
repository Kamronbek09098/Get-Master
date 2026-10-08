import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, Repeat, Send } from 'lucide-react';
import { cx } from '@/lib/utils';
import { ROUND_MAX_SECONDS, useRoundVideoRecorder } from '../hooks/useRoundVideoRecorder';
import type { RoundVideoResult } from '../hooks/useRoundVideoRecorder';
import { t } from '@/i18n';

const R = 126;
const CIRC = 2 * Math.PI * R;

const clock = (ms: number) => {
  const total = Math.floor(ms / 100) / 10;
  const minutes = Math.floor(total / 60);
  const rest = (total % 60).toFixed(1).replace('.', ',').padStart(4, '0');
  return `${minutes}:${rest}`;
};

/**
 * Dumaloq video yozish (Telegram uslubida): kamera ochilishi bilan yozuv o‘zi boshlanadi.
 * Katta dumaloq ko‘rinish chat ustida turadi (oq progress yoyi bilan), xabar maydoni o‘rnida esa vaqt, «Bekor qilish»,
 * pauza va katta «Yuborish» tugmasi chiqadi.
 */
export function RoundVideoRecorder({ onSend, onClose }: { onSend: (result: RoundVideoResult) => Promise<void> | void; onClose: () => void }) {
  const rec = useRoundVideoRecorder();
  const video = useRef<HTMLVideoElement>(null);
  const [busy, setBusy] = useState(false);
  const opened = useRef(false);
  const started = useRef(false);

  async function deliver(result: RoundVideoResult | null) {
    if (!result) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onSend(result);
    } finally {
      setBusy(false);
      onClose();
    }
  }

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void rec.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    node.srcObject = rec.stream;
    if (rec.stream) void node.play().catch(() => undefined);
    // Kamera tayyor bo‘lishi bilan yozuv avtomatik boshlanadi (bir bosishda).
    if (rec.stream && !started.current && !rec.recording) {
      started.current = true;
      rec.start((result) => void deliver(result));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.stream]);

  function send() {
    if (busy || !rec.recording) return;
    void rec.stop().then(deliver);
  }

  function cancel() {
    rec.cancel();
    onClose();
  }

  const progress = Math.min(rec.ms / (ROUND_MAX_SECONDS * 1000), 1);
  return (
    <div className="gm-round" role="dialog" aria-label={t('Dumaloq video')}>
      <div className={cx('gm-round__stage', rec.recording && !rec.paused && 'is-live')}>
        <svg className="gm-round__ring" viewBox="0 0 280 280" aria-hidden="true">
          <circle cx="140" cy="140" r={R} className="gm-round__ring-fg" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
        </svg>
        <div className="gm-round__circle">
          <video ref={video} muted playsInline autoPlay className={cx(rec.mirrored && 'is-mirrored')} />
          {!rec.stream && !rec.error && <Loader2 className="gm-spin gm-round__wait" size={30} />}
          {rec.error && <p className="gm-round__error" role="alert">{rec.error}</p>}
          {rec.paused && <span className="gm-round__paused" aria-hidden="true"><Pause size={30} /></span>}
        </div>
      </div>

      <div className="gm-round__bar">
        <span className="gm-round__clock" aria-live="off">
          <i className={cx(rec.paused && 'is-paused')} aria-hidden="true" />
          {clock(rec.ms)}
        </span>
        <button type="button" className="gm-round__cancel" onClick={cancel} disabled={busy}>
          {t('Bekor qilish')}
        </button>
        <button type="button" className="gm-round__small" onClick={() => void rec.flip()} aria-label={t('Kamerani almashtirish')} disabled={rec.paused || busy || !rec.stream}>
          <Repeat size={19} />
        </button>
        <button type="button" className="gm-round__small" onClick={rec.togglePause} aria-label={rec.paused ? t('Davom ettirish') : t('To‘xtatib turish')} disabled={!rec.recording || busy}>
          {rec.paused ? <Play size={19} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}
        </button>
        <button type="button" className={cx('gm-round__send', rec.recording && !rec.paused && 'is-live')} onClick={send} disabled={!rec.recording || busy} aria-label={t('Yuborish')}>
          {busy ? <Loader2 size={24} className="gm-spin" /> : <Send size={24} />}
        </button>
      </div>
    </div>
  );
}
