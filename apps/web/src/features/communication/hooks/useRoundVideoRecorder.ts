import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';

export const ROUND_MAX_SECONDS = 60;

export interface RoundVideoResult {
  file: File;
  seconds: number;
}

function pickFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = [
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4', ext: 'mp4' },
  ];
  return list.find((item) => MediaRecorder.isTypeSupported(item.mime)) ?? null;
}

export const roundVideoSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && pickFormat() !== null;

/** Telegramdagi kabi dumaloq video xabar: old kameradan (kvadrat) yozadi, 60 soniyagacha; tugagach avtomatik to‘xtaydi. */
export function useRoundVideoRecorder() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [ms, setMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const media = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const accum = useRef(0);
  const elapsed = useCallback(() => accum.current + (startedAt.current ? Date.now() - startedAt.current : 0), []);
  const timer = useRef<number | undefined>(undefined);
  const facing = useRef<'user' | 'environment'>('user');
  const finish = useRef<((result: RoundVideoResult | null) => void) | null>(null);

  const release = useCallback(() => {
    window.clearInterval(timer.current);
    media.current?.getTracks().forEach((track) => track.stop());
    media.current = null;
    recorder.current = null;
    chunks.current = [];
    setStream(null);
    setRecording(false);
    setPaused(false);
    setMs(0);
    accum.current = 0;
    startedAt.current = 0;
  }, []);

  useEffect(() => release, [release]);

  /** Kamerani ochadi (ko‘rinish uchun); yozish `start` bilan boshlanadi. */
  const open = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!roundVideoSupported()) {
      setError(t('Bu qurilmada video yozib bo‘lmaydi.'));
      return false;
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing.current, width: { ideal: 480 }, height: { ideal: 480 }, aspectRatio: { ideal: 1 }, frameRate: { ideal: 30, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      media.current = next;
      setStream(next);
      return true;
    } catch {
      release();
      setError(t('Kamera yoki mikrofonga ruxsat berilmadi'));
      return false;
    }
  }, [release]);

  const stop = useCallback(
    () =>
      new Promise<RoundVideoResult | null>((resolve) => {
        const instance = recorder.current;
        const format = pickFormat();
        if (!instance || !format || instance.state === 'inactive') {
          release();
          resolve(null);
          return;
        }
        const total = Math.max(1, Math.round(elapsed() / 1000));
        instance.onstop = () => {
          const type = format.mime.split(';')[0] ?? 'video/webm';
          const blob = new Blob(chunks.current, { type });
          release();
          if (blob.size < 2000) resolve(null);
          else resolve({ file: new File([blob], `round-${Date.now()}-d${total}.${format.ext}`, { type }), seconds: total });
        };
        instance.stop();
      }),
    [elapsed, release],
  );

  const start = useCallback(
    (onAutoStop: (result: RoundVideoResult | null) => void) => {
      const current = media.current;
      const format = pickFormat();
      if (!current || !format) return;
      finish.current = onAutoStop;
      const instance = new MediaRecorder(current, { mimeType: format.mime, videoBitsPerSecond: 700_000, audioBitsPerSecond: 48_000 });
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.current = instance;
      instance.start(500);
      accum.current = 0;
      startedAt.current = Date.now();
      setMs(0);
      setRecording(true);
      timer.current = window.setInterval(() => {
        const now = elapsed();
        setMs(now);
        if (now >= ROUND_MAX_SECONDS * 1000) {
          window.clearInterval(timer.current);
          void stop().then((result) => finish.current?.(result));
        }
      }, 250);
    },
    [elapsed, stop],
  );

  const togglePause = useCallback(() => {
    const instance = recorder.current;
    if (!instance) return;
    if (instance.state === 'recording') {
      instance.pause();
      accum.current += Date.now() - startedAt.current;
      startedAt.current = 0;
      setPaused(true);
    } else if (instance.state === 'paused') {
      instance.resume();
      startedAt.current = Date.now();
      setPaused(false);
    }
  }, []);

  const flip = useCallback(async () => {
    if (recording) return;
    facing.current = facing.current === 'user' ? 'environment' : 'user';
    media.current?.getTracks().forEach((track) => track.stop());
    await open();
  }, [open, recording]);

  const cancel = useCallback(() => {
    const instance = recorder.current;
    if (instance && instance.state !== 'inactive') {
      instance.onstop = null;
      instance.stop();
    }
    release();
  }, [release]);

  return { stream, recording, paused, ms, seconds: Math.floor(ms / 1000), error, open, start, stop, cancel, flip, togglePause, mirrored: facing.current === 'user' };
}
