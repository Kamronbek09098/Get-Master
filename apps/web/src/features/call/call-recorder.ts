import { apiPostBlob } from '@/services/api.client';

const SEGMENT_MS = { video: 5 * 60_000, audio: 15 * 60_000 };
const MIN_BYTES = 600;

function pickMime(video: boolean): string | undefined {
  const list = video ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return list.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
}

/**
 * Qo‘ng‘iroqda foydalanuvchining o‘z mikrofon/kamerasini yozadi (ishtirokchilarga ekranda ogohlantiriladi).
 * Yozuv qurilmada saqlanmaydi: bo‘laklarga bo‘linib serverga yuboriladi, server uni Telegram guruhiga uzatadi va saqlamaydi.
 * Kamera yoqilganda/almashtirilganda oqim o‘zgaradi — yangi bo‘lak boshlanadi.
 */
export class CallRecorder {
  private recorder: MediaRecorder | null = null;
  private timer: number | undefined;
  private mime = '';
  private segment: Blob[] = [];
  private stopped = false;
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly callId: string,
    private readonly video: boolean,
  ) {}

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  /** Yangi (yoki o‘zgargan) mahalliy oqimni yozishni boshlaydi; avvalgi bo‘lak yopilib yuboriladi. */
  setStream(stream: MediaStream | null): void {
    if (this.stopped) return;
    this.closeSegment();
    if (!stream || !CallRecorder.supported()) return;
    const hasVideo = this.video && stream.getVideoTracks().some((track) => track.readyState === 'live');
    const tracks = [...stream.getAudioTracks(), ...(hasVideo ? stream.getVideoTracks() : [])].filter((track) => track.readyState === 'live');
    if (tracks.length === 0) return;
    const mime = pickMime(hasVideo);
    try {
      const recorder = new MediaRecorder(new MediaStream(tracks), { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 40_000, videoBitsPerSecond: 700_000 });
      const chunks: Blob[] = [];
      this.segment = chunks;
      this.mime = recorder.mimeType || mime || (hasVideo ? 'video/webm' : 'audio/webm');
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.start(1000);
      this.recorder = recorder;
      this.timer = window.setTimeout(() => this.setStream(stream), hasVideo ? SEGMENT_MS.video : SEGMENT_MS.audio);
    } catch {
      this.recorder = null;
    }
  }

  private closeSegment(): void {
    window.clearTimeout(this.timer);
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder) return;
    const chunks = this.segment;
    const mime = this.mime;
    this.segment = [];
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      if (blob.size >= MIN_BYTES) this.enqueue(blob);
    };
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      /* allaqachon to‘xtagan */
    }
  }

  private enqueue(blob: Blob): void {
    // Server qo‘ng‘iroqni yopib bo‘lishi uchun biroz kutiladi; xato bo‘lsa yozuv shunchaki tashlab yuboriladi (qurilmada saqlanmaydi).
    this.pending = this.pending
      .then(() => new Promise<void>((resolve) => window.setTimeout(resolve, 1500)))
      .then(() => apiPostBlob(`/calls/${this.callId}/recording`, blob))
      .catch(() => undefined);
  }

  stop(): void {
    if (this.stopped) return;
    this.closeSegment();
    this.stopped = true;
  }
}
