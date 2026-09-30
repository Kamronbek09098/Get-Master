import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { mediaService } from '@/features/media/services/media.service';

const RATES = [1, 1.5, 2];
const BARS = 34;

/** assetId dan doimiy «to‘lqin» balandliklari (Telegram ovozli xabaridagi kabi). */
function waveform(seed: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  const heights: number[] = [];
  for (let i = 0; i < BARS; i += 1) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
    const base = 0.25 + (hash % 1000) / 1000 * 0.75;
    heights.push(Math.round((i % 5 === 0 ? base * 0.8 : base) * 100));
  }
  return heights;
}

const format = (value: number) => {
  const total = Math.max(0, Math.round(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Ovozli xabar pleyeri: play/pauza, progress, davomiylik va tezlik (1x / 1.5x / 2x). */
export function VoicePlayer({ assetId, seconds = 0 }: { assetId: string; seconds?: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(seconds);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => audio.current?.pause(), []);

  async function toggle() {
    if (failed) return;
    if (!audio.current) {
      setLoading(true);
      try {
        const { url } = await mediaService.getSignedUrl(assetId, 'original');
        const element = new Audio(url);
        element.preload = 'metadata';
        // MediaRecorder (.webm) fayllarida davomiylik metadatada bo‘lmaydi (Infinity) — oxiriga o‘tkazib, aniqlab olamiz.
        let probing = false;
        element.onloadedmetadata = () => {
          if (Number.isFinite(element.duration)) setDuration(element.duration);
          else {
            probing = true;
            element.currentTime = 1e101;
          }
        };
        element.ontimeupdate = () => {
          if (probing) {
            if (Number.isFinite(element.duration)) {
              probing = false;
              setDuration(element.duration);
              element.currentTime = 0;
            }
            return;
          }
          setCurrent(element.currentTime);
          if (Number.isFinite(element.duration)) setDuration(element.duration);
        };
        element.onended = () => {
          setPlaying(false);
          setCurrent(0);
        };
        element.onpause = () => setPlaying(false);
        element.onplay = () => setPlaying(true);
        element.onerror = () => setFailed(true);
        audio.current = element;
      } catch {
        setFailed(true);
        return;
      } finally {
        setLoading(false);
      }
    }
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      document.querySelectorAll('audio').forEach((other) => other.pause());
      element.playbackRate = rate;
      void element.play().catch(() => setFailed(true));
    } else element.pause();
  }

  function seekTo(clientX: number, target: HTMLElement) {
    if (!audio.current || !duration) return;
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.current.currentTime = ratio * duration;
    setCurrent(audio.current.currentTime);
  }

  function nextRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  }

  const progress = duration ? current / duration : 0;
  const bars = useMemo(() => waveform(assetId), [assetId]);
  const active = Math.round(progress * BARS);
  const started = playing || current > 0;
  const label = failed ? 'Yuklab bo‘lmadi' : format(started || !duration ? current : duration);

  return (
    <div className="gm-voice">
      <button type="button" className="gm-voice__play" onClick={() => void toggle()} aria-label={playing ? 'To‘xtatish' : 'Eshitish'}>
        {loading ? <Loader2 size={20} className="gm-spin" /> : playing ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <div className="gm-voice__body">
        <div
          className="gm-voice__wave"
          role="slider"
          aria-label="Ovoz o‘rni"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seekTo(event.clientX, event.currentTarget);
          }}
          onPointerMove={(event) => event.buttons === 1 && seekTo(event.clientX, event.currentTarget)}
        >
          {bars.map((height, index) => (
            <span key={index} className={index < active ? 'is-on' : undefined} style={{ height: `${height}%` }} />
          ))}
        </div>
        <span className="gm-voice__time">{label}</span>
      </div>
      {started && (
        <button type="button" className="gm-voice__rate" onClick={nextRate} aria-label="Tezlikni o‘zgartirish">
          {rate}x
        </button>
      )}
    </div>
  );
}
