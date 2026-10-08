import { useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { mediaService } from '@/features/media/services/media.service';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';

const R = 118;
const CIRC = 2 * Math.PI * R;
const format = (value: number) => `${Math.floor(Math.max(0, value) / 60)}:${String(Math.floor(Math.max(0, value) % 60)).padStart(2, '0')}`;

/** Dumaloq video xabar pleyeri (Telegramdagidek): bosilsa ovoz bilan ijro etiladi, atrofida progress halqasi bor. */
export function RoundVideoPlayer({ assetId, seconds = 0 }: { assetId: string; seconds?: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(seconds);

  async function load(): Promise<string | null> {
    if (src) return src;
    setLoading(true);
    try {
      const { url } = await mediaService.getSignedUrl(assetId, 'original');
      setSrc(url);
      return url;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Birinchi kadr ko‘rinishi uchun fayl o‘zi yuklanadi.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function toggle() {
    if (failed) return;
    const url = await load();
    const node = video.current;
    if (!url || !node) return;
    if (node.paused) {
      node.muted = false;
      void node.play().catch(() => setFailed(true));
    } else node.pause();
  }

  const progress = duration > 0 ? Math.min(current / duration, 1) : 0;
  return (
    <button type="button" className={cx('gm-roundmsg', playing && 'is-playing')} onClick={() => void toggle()} aria-label={playing ? t('To‘xtatish') : t('Dumaloq videoni ijro etish')}>
      <svg className="gm-roundmsg__ring" viewBox="0 0 252 252" aria-hidden="true">
        <circle cx="126" cy="126" r={R} className="gm-roundmsg__ring-bg" />
        <circle cx="126" cy="126" r={R} className="gm-roundmsg__ring-fg" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
      </svg>
      <span className="gm-roundmsg__circle">
        {src && (
          <video
            ref={video}
            src={src}
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              const node = event.currentTarget;
              // MediaRecorder fayllarida davomiylik metadatada bo‘lmasligi mumkin; fayl nomidagi qiymat ishlatiladi.
              if (Number.isFinite(node.duration) && node.duration > 0) setDuration(node.duration);
              else if (node.currentTime === 0) node.currentTime = 0.01;
            }}
            onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setCurrent(0);
            }}
            onError={() => setFailed(true)}
          />
        )}
        {!playing && (
          <span className="gm-roundmsg__play">{loading ? <Loader2 size={26} className="gm-spin" /> : <Play size={26} fill="currentColor" />}</span>
        )}
        {failed && <span className="gm-roundmsg__fail">{t('Videoni ochib bo‘lmadi')}</span>}
      </span>
      <span className="gm-roundmsg__time">{format(playing ? current : duration)}</span>
    </button>
  );
}
