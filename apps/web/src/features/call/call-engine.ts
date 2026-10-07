import type { SignalKind } from './types';

export type EngineState = 'new' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed';
export type MediaErrorKind = 'unsupported' | 'denied' | 'busy' | 'missing' | 'unknown';

export class CallMediaError extends Error {
  constructor(readonly kind: MediaErrorKind) {
    super(kind);
  }
}

export interface MediaFlags {
  video: boolean;
  audio: boolean;
}

export interface CallEngineOptions {
  iceServers: RTCIceServer[];
  /** Video qo‘ng‘iroqmi (audio qo‘ng‘iroqda kamera ishlatilmaydi). */
  video: boolean;
  isCaller: boolean;
  send: (kind: SignalKind, payload: Record<string, unknown>) => Promise<unknown>;
  onRemoteStream: (stream: MediaStream | null) => void;
  onLocalStream: (stream: MediaStream | null) => void;
  onState: (state: EngineState) => void;
  onRemoteMedia: (media: MediaFlags) => void;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_CONSTRAINTS = (facing: 'user' | 'environment'): MediaTrackConstraints => ({
  facingMode: facing,
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
});

function classify(error: unknown): MediaErrorKind {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'missing';
  return 'unknown';
}

/**
 * Bitta qo‘ng‘iroqning WebRTC qismi: mikrofon/kamera, RTCPeerConnection, signallar (offer/answer/ICE) va aloqani tiklash.
 * Signallar tashuvchi (server) bilan bog‘lanmagan: `send` va `handle` orqali ulanadi.
 */
export class CallEngine {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private facing: 'user' | 'environment' = 'user';
  private queued: RTCIceCandidateInit[] = [];
  private closed = false;
  private restartTimer: number | undefined;
  private restarts = 0;
  private videoOn = false;
  private audioOn = true;
  private readyResolve!: () => void;
  private readonly ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  constructor(private readonly opts: CallEngineOptions) {}

  get flags(): MediaFlags {
    return { video: this.videoOn, audio: this.audioOn };
  }

  static supported(): boolean {
    return typeof window !== 'undefined' && !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
  }

  /** Mikrofon (va video qo‘ng‘iroqda kamera)ni oladi va ulanishni tayyorlaydi. Ruxsat berilmasa — CallMediaError. */
  async prepare(): Promise<{ cameraMissing: boolean }> {
    if (!CallEngine.supported()) throw new CallMediaError('unsupported');
    let cameraMissing = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: this.opts.video ? VIDEO_CONSTRAINTS(this.facing) : false });
    } catch (error) {
      const kind = classify(error);
      if (this.opts.video && kind === 'missing') {
        // Kamera yo‘q — audio bilan davom etamiz.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
          cameraMissing = true;
        } catch (inner) {
          throw new CallMediaError(classify(inner));
        }
      } else {
        throw new CallMediaError(kind);
      }
    }
    this.local = stream;
    this.audioOn = true;
    this.videoOn = stream.getVideoTracks().length > 0;
    this.opts.onLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2 });
    this.pc = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    if (this.opts.video && stream.getVideoTracks().length === 0) pc.addTransceiver('video', { direction: 'recvonly' });

    const remote = new MediaStream();
    pc.ontrack = (event) => {
      const incoming = event.streams[0];
      if (incoming) this.opts.onRemoteStream(incoming);
      else {
        remote.addTrack(event.track);
        this.opts.onRemoteStream(remote);
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) void this.opts.send('candidate', event.candidate.toJSON() as Record<string, unknown>).catch(() => undefined);
    };
    pc.onconnectionstatechange = () => this.onConnectionState();
    this.opts.onState('connecting');
    this.readyResolve();
    return { cameraMissing };
  }

  private onConnectionState(): void {
    const pc = this.pc;
    if (!pc || this.closed) return;
    window.clearTimeout(this.restartTimer);
    switch (pc.connectionState) {
      case 'connected':
        this.restarts = 0;
        this.opts.onState('connected');
        void this.announce();
        break;
      case 'disconnected':
        this.opts.onState('reconnecting');
        // Qisqa uzilish o‘zi tiklanishi mumkin; bo‘lmasa — chaqiruvchi tomon ICE'ni qayta ishga tushiradi.
        this.restartTimer = window.setTimeout(() => void this.restartIce(), 4000);
        break;
      case 'failed':
        this.opts.onState('reconnecting');
        void this.restartIce();
        break;
      case 'closed':
        this.opts.onState('closed');
        break;
      default:
        break;
    }
  }

  private async restartIce(): Promise<void> {
    const pc = this.pc;
    if (!pc || this.closed) return;
    if (!this.opts.isCaller) {
      // Qayta taklifni chaqiruvchi yuboradi; chaqirilgan tomon kutadi, uzoq davom etsa — xato.
      this.restartTimer = window.setTimeout(() => this.opts.onState('failed'), 15_000);
      return;
    }
    this.restarts += 1;
    if (this.restarts > 3) {
      this.opts.onState('failed');
      return;
    }
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await this.opts.send('offer', { type: offer.type, sdp: offer.sdp });
      this.restartTimer = window.setTimeout(() => {
        if (this.pc && this.pc.connectionState !== 'connected') void this.restartIce();
      }, 8000);
    } catch {
      this.opts.onState('failed');
    }
  }

  /** Chaqiruvchi: javob berilgach taklif (offer) yuboradi. */
  async startOffer(): Promise<void> {
    await this.ready;
    const pc = this.pc;
    if (!pc || this.closed) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.opts.send('offer', { type: offer.type, sdp: offer.sdp });
  }

  /** Serverdan kelgan signalni qayta ishlaydi (ulanish tayyor bo‘lguncha kutadi). */
  async handle(kind: SignalKind, payload: Record<string, unknown>): Promise<void> {
    await this.ready;
    const pc = this.pc;
    if (!pc || this.closed) return;
    if (kind === 'media') {
      this.opts.onRemoteMedia({ video: payload.video === true, audio: payload.audio !== false });
      return;
    }
    if (kind === 'offer') {
      await pc.setRemoteDescription(payload as unknown as RTCSessionDescriptionInit);
      await this.flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.opts.send('answer', { type: answer.type, sdp: answer.sdp });
      return;
    }
    if (kind === 'answer') {
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(payload as unknown as RTCSessionDescriptionInit);
      await this.flushCandidates();
      return;
    }
    if (kind === 'candidate') {
      if (pc.remoteDescription) await pc.addIceCandidate(payload as unknown as RTCIceCandidateInit).catch(() => undefined);
      else this.queued.push(payload as unknown as RTCIceCandidateInit);
    }
  }

  private async flushCandidates(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const items = this.queued.splice(0);
    for (const candidate of items) await pc.addIceCandidate(candidate).catch(() => undefined);
  }

  /** Ikkinchi tomonga kamera/mikrofon holatini bildiradi. */
  async announce(): Promise<void> {
    await this.opts.send('media', { ...this.flags }).catch(() => undefined);
  }

  setAudioEnabled(enabled: boolean): void {
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    this.audioOn = enabled;
    void this.announce();
  }

  /** Kamerani o‘chirganda qurilma ham bo‘shatiladi (chiroq o‘chadi), yoqganda qayta olinadi. */
  async setVideoEnabled(enabled: boolean): Promise<boolean> {
    const pc = this.pc;
    if (!pc || !this.local) return false;
    const sender = pc.getSenders().find((item) => item.track?.kind === 'video') ?? pc.getTransceivers().find((item) => item.receiver.track.kind === 'video')?.sender;
    if (!enabled) {
      this.local.getVideoTracks().forEach((track) => {
        track.stop();
        this.local?.removeTrack(track);
      });
      await sender?.replaceTrack(null).catch(() => undefined);
      this.videoOn = false;
      this.opts.onLocalStream(new MediaStream(this.local.getTracks()));
      await this.announce();
      return true;
    }
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS(this.facing) });
      const track = camera.getVideoTracks()[0];
      if (!track) return false;
      this.local.addTrack(track);
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, this.local);
      this.videoOn = true;
      this.opts.onLocalStream(new MediaStream(this.local.getTracks()));
      await this.announce();
      return true;
    } catch {
      return false;
    }
  }

  async hasMultipleCameras(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((item) => item.kind === 'videoinput').length > 1;
    } catch {
      return false;
    }
  }

  async switchCamera(): Promise<boolean> {
    const pc = this.pc;
    if (!pc || !this.local || !this.videoOn) return false;
    const next = this.facing === 'user' ? 'environment' : 'user';
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS(next) });
      const track = camera.getVideoTracks()[0];
      if (!track) return false;
      const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
      this.local.getVideoTracks().forEach((old) => {
        old.stop();
        this.local?.removeTrack(old);
      });
      this.local.addTrack(track);
      await sender?.replaceTrack(track);
      this.facing = next;
      this.opts.onLocalStream(new MediaStream(this.local.getTracks()));
      return true;
    } catch {
      return false;
    }
  }

  get mirrored(): boolean {
    return this.facing === 'user';
  }

  stop(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.restartTimer);
    this.local?.getTracks().forEach((track) => track.stop());
    this.local = null;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
    }
    this.pc = null;
    this.readyResolve();
    this.opts.onLocalStream(null);
    this.opts.onRemoteStream(null);
    this.opts.onState('closed');
  }
}
