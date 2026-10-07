import { apiPostBlob } from '@/services/api.client';

/** Telegram bot fayl chegarasi 50 MB: yozuv shu hajmga yaqinlashganda (faqat shunda) yangi faylga o‘tiladi. */
const ROTATE_BYTES = 42 * 1024 * 1024;
const MIN_BYTES = 600;
const CANVAS_W = 640;
const CANVAS_H = 480;
const FPS = 15;

function pickMime(video: boolean): string | undefined {
  const list = video ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return list.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
}

/**
 * Qo‘ng‘iroqda foydalanuvchining o‘z mikrofon/kamerasini BIR UZLUKSIZ fayl qilib yozadi (ishtirokchilarga ekranda ogohlantiriladi).
 * Kamera yoqilsa/o‘chirilsa yoki almashtirilsa ham yozuv uzilmaydi (kamera o‘chiq payti qora kadr yoziladi).
 * Yozuv qurilmada saqlanmaydi: qo‘ng‘iroq tugagach serverga yuboriladi, server uni Telegram guruhiga uzatadi va saqlamaydi.
 */
export class CallRecorder {
  private recorder: MediaRecorder | null = null;
  private composite: MediaStream | null = null;
  private bytes = 0;
  private mime = '';
  private stopped = false;
  private part = 0;
  private pending: Promise<void> = Promise.resolve();
  // video qo‘ng‘iroq uchun kanvas
  private source: HTMLVideoElement | null = null;
  private drawTimer: number | undefined;
  private audioCtx: AudioContext | null = null;

  constructor(
    private readonly callId: string,
    private readonly video: boolean,
  ) {}

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  /** Mahalliy oqim o‘zgarganda chaqiriladi; yozuv uzilmaydi. */
  setStream(stream: MediaStream | null): void {
    if (this.stopped || !stream || !CallRecorder.supported()) return;
    if (this.video) this.attachVideo(stream);
    if (!this.recorder) this.begin(stream);
  }

  private attachVideo(stream: MediaStream): void {
    if (!this.source) {
      const el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      this.source = el;
    }
    const tracks = stream.getVideoTracks().filter((track) => track.readyState === 'live');
    this.source.srcObject = tracks.length > 0 ? new MediaStream(tracks) : null;
    if (tracks.length > 0) void this.source.play().catch(() => undefined);
  }

  private compositeStream(stream: MediaStream): MediaStream | null {
    const audio = stream.getAudioTracks().find((track) => track.readyState === 'live');
    if (!this.video) return audio ? new MediaStream([audio]) : null;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return audio ? new MediaStream([audio]) : null;
    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const v = this.source;
      if (v && v.srcObject && v.videoWidth > 0) {
        const scale = Math.min(CANVAS_W / v.videoWidth, CANVAS_H / v.videoHeight);
        const w = v.videoWidth * scale;
        const h = v.videoHeight * scale;
        ctx.drawImage(v, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
      }
    };
    draw();
    this.drawTimer = window.setInterval(draw, 1000 / FPS);
    const out = canvas.captureStream(FPS);
    if (audio) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const context = new Ctx();
        const destination = context.createMediaStreamDestination();
        context.createMediaStreamSource(new MediaStream([audio])).connect(destination);
        this.audioCtx = context;
        destination.stream.getAudioTracks().forEach((track) => out.addTrack(track));
      } catch {
        out.addTrack(audio);
      }
    }
    return out;
  }

  private begin(stream: MediaStream): void {
    const composite = this.composite ?? this.compositeStream(stream);
    if (!composite || composite.getTracks().length === 0) return;
    this.composite = composite;
    this.startRecorder();
  }

  private startRecorder(): void {
    const composite = this.composite;
    if (!composite) return;
    const mime = pickMime(this.video);
    try {
      const recorder = new MediaRecorder(composite, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000, videoBitsPerSecond: 380_000 });
      const chunks: Blob[] = [];
      const part = ++this.part;
      this.bytes = 0;
      this.mime = (recorder.mimeType || mime || (this.video ? 'video/webm' : 'audio/webm')).split(';')[0] ?? 'video/webm';
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        chunks.push(event.data);
        if (recorder === this.recorder) {
          this.bytes += event.data.size;
          if (this.bytes >= ROTATE_BYTES && !this.stopped) this.rotate();
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: this.mimeOf(recorder) });
        if (blob.size >= MIN_BYTES) this.enqueue(blob, part);
      };
      recorder.start(1000);
      this.recorder = recorder;
    } catch {
      this.recorder = null;
    }
  }

  private mimeOf(recorder: MediaRecorder): string {
    return (recorder.mimeType || this.mime).split(';')[0] ?? this.mime;
  }

  /** Telegram chegarasiga yaqinlashganda yozuv uzilmasdan yangi faylga o‘tadi. */
  private rotate(): void {
    const old = this.recorder;
    this.recorder = null;
    try {
      if (old && old.state !== 'inactive') old.stop();
    } catch {
      /* allaqachon to‘xtagan */
    }
    this.startRecorder();
  }

  private enqueue(blob: Blob, part: number): void {
    // Server qo‘ng‘iroqni yopib bo‘lishi uchun biroz kutiladi; xato bo‘lsa yozuv tashlab yuboriladi (qurilmada saqlanmaydi).
    this.pending = this.pending
      .then(() => new Promise<void>((resolve) => window.setTimeout(resolve, 1500)))
      .then(() => apiPostBlob(`/calls/${this.callId}/recording?part=${part}`, blob))
      .catch(() => undefined);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const recorder = this.recorder;
    this.recorder = null;
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch {
      /* allaqachon to‘xtagan */
    }
    // Yakuniy bo‘lak onstop ichida yuboriladi; kanvas va audio resurslari esa darhol bo‘shatiladi.
    window.setTimeout(() => {
      window.clearInterval(this.drawTimer);
      this.composite?.getTracks().forEach((track) => track.stop());
      void this.audioCtx?.close().catch(() => undefined);
      if (this.source) this.source.srcObject = null;
    }, 500);
  }
}
