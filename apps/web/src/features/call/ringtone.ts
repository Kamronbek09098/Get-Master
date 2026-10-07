/**
 * Jiringlash ovozi (fayl kerak emas): ikki tovushli signal, har ~2.4 soniyada. Brauzer ovozni foydalanuvchi harakatigacha
 * to‘sishi mumkin — shunda faqat tebranish va ekrandagi ko‘rinish ishlaydi.
 */
export class Ringtone {
  private ctx: AudioContext | null = null;
  private timer: number | undefined;
  private vibrate: number | undefined;

  constructor(private readonly kind: 'incoming' | 'outgoing') {}

  start(): void {
    this.stop();
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
        void this.ctx.resume().catch(() => undefined);
        this.beep();
        this.timer = window.setInterval(() => this.beep(), this.kind === 'incoming' ? 2400 : 3200);
      }
    } catch {
      /* ovoz mavjud emas */
    }
    if (this.kind === 'incoming' && 'vibrate' in navigator) {
      const buzz = () => navigator.vibrate?.([450, 250, 450]);
      buzz();
      this.vibrate = window.setInterval(buzz, 2400);
    }
  }

  private beep(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    const notes = this.kind === 'incoming' ? [[880, 0, 0.32], [660, 0.36, 0.32]] : [[440, 0, 0.9]];
    for (const [frequency, offset, length] of notes as Array<[number, number, number]>) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(this.kind === 'incoming' ? 0.22 : 0.12, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + length + 0.05);
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
    window.clearInterval(this.vibrate);
    this.timer = undefined;
    this.vibrate = undefined;
    navigator.vibrate?.(0);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
