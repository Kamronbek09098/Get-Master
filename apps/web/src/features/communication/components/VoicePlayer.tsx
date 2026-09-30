import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { mediaService } from '@/features/media/services/media.service';

const RATES = [1, 1.5, 2];

const format = (value: number) => {
  const total = Math.max(0, Math.round(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Ovozli xabar pleyeri: play/pauza, progress, davomiylik va tezlik (1x / 1.5x / 2x). */
export function VoicePlayer({ assetId }: { assetId: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
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

  function seek(value: number) {
    if (!audio.current || !duration) return;
    audio.current.currentTime = (value / 100) * duration;
    setCurrent(audio.current.currentTime);
  }

  function nextRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  }

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div className="gm-voice">
      <button type="button" className="gm-voice__play" onClick={() => void toggle()} aria-label={playing ? 'To‘xtatish' : 'Eshitish'}>
        {loading ? <Loader2 size={20} className="gm-spin" /> : playing ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <div className="gm-voice__body">
        <input
          type="range"
          className="gm-voice__seek"
          min={0}
          max={100}
          step={0.5}
          value={progress}
          disabled={!audio.current}
          style={{ ['--gm-voice-progress' as string]: `${progress}%` }}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Ovoz o‘rni"
        />
        <span className="gm-voice__time">{failed ? 'Yuklab bo‘lmadi' : duration || playing ? `${format(current)} / ${format(duration)}` : 'Ovozli xabar'}</span>
      </div>
      <button type="button" className="gm-voice__rate" onClick={nextRate} aria-label="Tezlikni o‘zgartirish">
        {rate}x
      </button>
    </div>
  );
}
