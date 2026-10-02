import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';

export type VoiceState = 'idle' | 'recording';

export interface VoiceResult {
  file: File;
  seconds: number;
}

function pickMimeType(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' },
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mime)) ?? null;
}

export const voiceSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && pickMimeType() !== null;

/** Mikrofondan ovozli xabar yozadi (bosib yozish, to‘xtatib yuborish yoki bekor qilish). */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const release = useCallback(() => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
    chunks.current = [];
    setState('idle');
    setSeconds(0);
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    setError(null);
    const format = pickMimeType();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setError(t('Bu qurilmada ovoz yozib bo‘lmaydi'));
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const instance = new MediaRecorder(media, { mimeType: format.mime });
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.current = instance;
      instance.start(250);
      startedAt.current = Date.now();
      setSeconds(0);
      setState('recording');
      timer.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    } catch {
      release();
      setError(t('Mikrofonga ruxsat berilmadi'));
    }
  }, [release]);

  const stop = useCallback(
    () =>
      new Promise<VoiceResult | null>((resolve) => {
        const instance = recorder.current;
        const format = pickMimeType();
        if (!instance || !format) {
          release();
          resolve(null);
          return;
        }
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
        instance.onstop = () => {
          const blob = new Blob(chunks.current, { type: format.mime.split(';')[0] });
          release();
          if (blob.size < 800 || elapsed < 1) resolve(null);
          else resolve({ file: new File([blob], `voice-${Date.now()}-d${elapsed}.${format.ext}`, { type: format.mime.split(';')[0] }), seconds: elapsed });
        };
        instance.stop();
      }),
    [release],
  );

  const cancel = useCallback(() => {
    const instance = recorder.current;
    if (instance && instance.state !== 'inactive') {
      instance.onstop = null;
      instance.stop();
    }
    release();
  }, [release]);

  return { state, seconds, error, start, stop, cancel };
}
