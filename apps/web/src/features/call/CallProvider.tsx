import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { apiPostKeepalive, openEventStream } from '@/services/api.client';
import type { StreamEvent } from '@/services/api.client';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { CallEngine, CallMediaError } from './call-engine';
import { CallRecorder } from './call-recorder';
import type { EngineState } from './call-engine';
import { formatDuration } from './call-log';
import { CallContext } from './call-context';
import type { CallContextValue, CallSession } from './call-context';
import { callService } from './call.service';
import { CallScreen } from './CallScreen';
import { IncomingCall } from './IncomingCall';
import { Ringtone } from './ringtone';
import type { CallEndedPayload, CallMode, CallPeer, CallView, SignalKind } from './types';
import { t } from '@/i18n';

const FALLBACK_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];
const ENDED_VISIBLE_MS = 2600;

const mediaErrorText = (kind: CallMediaError['kind']): string => {
  switch (kind) {
    case 'unsupported':
      return t('Qo‘ng‘iroq faqat xavfsiz (HTTPS) ulanishda va yangi brauzerda ishlaydi.');
    case 'denied':
      return t('Mikrofon yoki kameraga ruxsat berilmagan. Brauzer sozlamalarida ruxsat bering.');
    case 'busy':
      return t('Mikrofon yoki kamera boshqa ilova tomonidan band.');
    case 'missing':
      return t('Mikrofon topilmadi.');
    default:
      return t('Mikrofon yoki kamerani yoqib bo‘lmadi.');
  }
};

/**
 * Qo‘ng‘iroqlar: kiruvchi qo‘ng‘iroqlarni server hodisalari (SSE) orqali tinglaydi, chiquvchi qo‘ng‘iroq boshlaydi
 * va audio/video aloqani (WebRTC) boshqaradi. Ilovaning kirilgan qismida bir marta o‘rnatiladi.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const hasSession = useAuthStore((state) => state.hasSession);
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const pushToast = useAppStore((state) => state.pushToast);
  const role = env.appRole ?? preferredRole;
  const enabled = hasSession && (role === 'CUSTOMER' || role === 'MASTER') && CallEngine.supported();

  const [session, setSessionState] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const engineRef = useRef<CallEngine | null>(null);
  const incomingRing = useRef(new Ringtone('incoming'));
  const outgoingRing = useRef(new Ringtone('outgoing'));
  const endTimer = useRef<number | undefined>(undefined);
  const iceCache = useRef<{ at: number; servers: RTCIceServer[] } | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const recorder = useRef<CallRecorder | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const handlerRef = useRef<(event: StreamEvent) => void>(() => undefined);

  const setSession = useCallback((next: CallSession | null | ((previous: CallSession | null) => CallSession | null)) => {
    const value = typeof next === 'function' ? next(sessionRef.current) : next;
    sessionRef.current = value;
    setSessionState(value);
  }, []);

  const stopRings = useCallback(() => {
    incomingRing.current.stop();
    outgoingRing.current.stop();
  }, []);

  const iceServers = useCallback(async (): Promise<RTCIceServer[]> => {
    const cached = iceCache.current;
    if (cached && Date.now() - cached.at < 20 * 60_000) return cached.servers;
    try {
      const { iceServers: servers } = await callService.iceServers();
      iceCache.current = { at: Date.now(), servers: servers.length > 0 ? servers : FALLBACK_ICE };
      return iceCache.current.servers;
    } catch {
      return FALLBACK_ICE;
    }
  }, []);

  const releaseEngine = useCallback(() => {
    recorder.current?.stop();
    recorder.current = null;
    localRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  /** Qo‘ng‘iroq tugadi: resurslar bo‘shatiladi, qisqa izoh ko‘rsatiladi va oyna yopiladi. */
  const finishLocal = useCallback(
    (note: string | null) => {
      stopRings();
      releaseEngine();
      void wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
      const current = sessionRef.current;
      if (!current) return;
      if (!note) {
        setSession(null);
        return;
      }
      setSession({ ...current, phase: 'ended', note, reconnecting: false });
      window.clearTimeout(endTimer.current);
      const id = current.call.id;
      endTimer.current = window.setTimeout(() => {
        if (sessionRef.current?.call.id === id && sessionRef.current.phase === 'ended') setSession(null);
      }, ENDED_VISIBLE_MS);
    },
    [releaseEngine, setSession, stopRings],
  );

  const noteFor = useCallback((payload: CallEndedPayload, current: CallSession): string | null => {
    const name = current.peer.name;
    const caller = current.role === 'caller';
    if (payload.reason === 'lost' || payload.reason === 'failed') return t('Aloqa uzildi');
    switch (payload.status) {
      case 'DECLINED':
        return caller ? t('{name} qo‘ng‘iroqni rad etdi', { name }) : null;
      case 'MISSED':
        return caller ? t('{name} javob bermadi', { name }) : t('O‘tkazib yuborilgan qo‘ng‘iroq');
      case 'CANCELED':
        return caller ? null : t('{name} qo‘ng‘iroqni bekor qildi', { name });
      default:
        return payload.seconds > 0 ? t('Qo‘ng‘iroq tugadi · {time}', { time: formatDuration(payload.seconds) }) : t('Qo‘ng‘iroq tugadi');
    }
  }, []);

  const makeEngine = useCallback(
    async (call: CallView, video: boolean, isCaller: boolean) => {
      const engine = new CallEngine({
        iceServers: await iceServers(),
        video,
        isCaller,
        send: (kind: SignalKind, payload: Record<string, unknown>) => callService.signal(call.id, kind, payload),
        onLocalStream: (stream) => {
          localRef.current = stream;
          setLocalStream(stream);
          recorder.current?.setStream(stream);
        },
        onRemoteStream: setRemoteStream,
        onRemoteMedia: (remoteMedia) => setSession((previous) => (previous && previous.call.id === call.id ? { ...previous, remoteMedia } : previous)),
        onState: (state: EngineState) => {
          const current = sessionRef.current;
          if (!current || current.call.id !== call.id) return;
          if (state === 'connected') {
            stopRings();
            if (!recorder.current && CallRecorder.supported()) {
              recorder.current = new CallRecorder(call.id, current.mode === 'VIDEO');
              recorder.current.setStream(localRef.current);
            }
            setSession({ ...current, phase: 'active', reconnecting: false, connectedAt: current.connectedAt ?? Date.now() });
          } else if (state === 'reconnecting') setSession({ ...current, reconnecting: true });
          else if (state === 'failed') {
            void callService.end(call.id, 'failed').catch(() => undefined);
            finishLocal(t('Aloqa uzildi'));
          }
        },
      });
      engineRef.current = engine;
      return engine;
    },
    [finishLocal, iceServers, setSession, stopRings],
  );

  const showIncoming = useCallback(
    (call: CallView, peer: CallPeer) => {
      window.clearTimeout(endTimer.current);
      setSession({
        call,
        peer,
        role: 'callee',
        mode: call.mode,
        phase: 'ringing',
        connectedAt: null,
        reconnecting: false,
        note: null,
        remoteMedia: { video: call.mode === 'VIDEO', audio: true },
        cameraMissing: false,
        localMedia: { video: call.mode === 'VIDEO', audio: true },
        multipleCameras: false,
        mirrored: true,
      });
      incomingRing.current.start();
    },
    [setSession],
  );

  // ---- server hodisalari ----
  handlerRef.current = (streamEvent: StreamEvent) => {
    const data = streamEvent.data as Record<string, unknown>;
    const current = sessionRef.current;
    switch (streamEvent.event) {
      case 'call.incoming': {
        if (current && current.phase !== 'ended') return;
        const incoming = data as unknown as { call: CallView; from: CallPeer };
        showIncoming(incoming.call, incoming.from);
        break;
      }
      case 'call.current': {
        const restored = data as unknown as { call: CallView; peer: CallPeer };
        if (current) return;
        if (restored.call.status === 'RINGING' && restored.call.calleeId !== undefined && restored.peer.id === restored.call.callerId) showIncoming(restored.call, restored.peer);
        else if (restored.call.status === 'RINGING') void callService.cancel(restored.call.id).catch(() => undefined);
        else void callService.end(restored.call.id).catch(() => undefined); // sahifa yangilangan: media tiklanmaydi, qo‘ng‘iroq yopiladi
        break;
      }
      case 'call.accepted': {
        if (!current || current.call.id !== data.callId || current.role !== 'caller') return;
        outgoingRing.current.stop();
        setSession({ ...current, phase: 'connecting' });
        void engineRef.current?.startOffer().catch(() => undefined);
        break;
      }
      case 'call.signal': {
        if (!current || current.call.id !== data.callId) return;
        void engineRef.current?.handle(data.kind as SignalKind, data.payload as Record<string, unknown>).catch(() => undefined);
        break;
      }
      case 'call.ended': {
        const ended = data as unknown as CallEndedPayload;
        if (!current || current.call.id !== ended.callId || current.phase === 'ended') return;
        finishLocal(noteFor(ended, current));
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (!enabled) return;
    return openEventStream('/calls/events', (event) => handlerRef.current(event));
  }, [enabled]);

  // Chiqish/akkaunt almashtirishda barcha narsa to‘xtatiladi.
  useEffect(() => {
    if (enabled) return;
    stopRings();
    releaseEngine();
    setSession(null);
  }, [enabled, releaseEngine, setSession, stopRings]);

  // ---- harakatlar ----
  const startCall = useCallback(
    async (conversationId: string, mode: CallMode, peerName?: string) => {
      if (sessionRef.current && sessionRef.current.phase !== 'ended') {
        pushToast(t('Siz hozir boshqa qo‘ng‘iroqdasiz.'), 'info');
        return;
      }
      if (!CallEngine.supported()) {
        pushToast(mediaErrorText('unsupported'), 'error');
        return;
      }
      window.clearTimeout(endTimer.current);
      setSession(null);
      // Avval mikrofon/kamera ruxsati olinadi (foydalanuvchi bosgan paytda) — rad etilsa, qo‘ng‘iroq yaratilmaydi.
      const placeholder = { id: 'pending', conversationId, mode, status: 'RINGING', callerId: '', calleeId: '', createdAt: new Date().toISOString(), answeredAt: null } as CallView;
      let engine: CallEngine;
      let cameraMissing = false;
      try {
        engine = await makeEngine(placeholder, mode === 'VIDEO', true);
        ({ cameraMissing } = await engine.prepare());
      } catch (error) {
        releaseEngine();
        pushToast(error instanceof CallMediaError ? mediaErrorText(error.kind) : getErrorMessage(error), 'error');
        return;
      }
      try {
        const started = await callService.start(conversationId, mode);
        if (!started.calleeOnline) {
          releaseEngine();
          pushToast(t('{name} hozir tarmoqda emas. Unga o‘tkazib yuborilgan qo‘ng‘iroq haqida xabar yuborildi.', { name: started.peer.name || peerName || t('Foydalanuvchi') }), 'info');
          return;
        }
        // Signal yuborish endi haqiqiy qo‘ng‘iroq identifikatoriga bog‘lanadi.
        engineRef.current?.stop();
        engine = await makeEngine(started.call, mode === 'VIDEO', true);
        ({ cameraMissing } = await engine.prepare());
        setSession({
          call: started.call,
          peer: started.peer,
          role: 'caller',
          mode,
          phase: 'calling',
          connectedAt: null,
          reconnecting: false,
          note: null,
          remoteMedia: { video: mode === 'VIDEO', audio: true },
          cameraMissing,
          localMedia: engine.flags,
          multipleCameras: mode === 'VIDEO' ? await engine.hasMultipleCameras() : false,
          mirrored: engine.mirrored,
        });
        outgoingRing.current.start();
      } catch (error) {
        releaseEngine();
        pushToast(error instanceof CallMediaError ? mediaErrorText(error.kind) : getErrorMessage(error), 'error');
      }
    },
    [makeEngine, pushToast, releaseEngine, setSession],
  );

  const accept = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.phase !== 'ringing') return;
    incomingRing.current.stop();
    setSession({ ...current, phase: 'connecting' });
    try {
      const engine = await makeEngine(current.call, current.mode === 'VIDEO', false);
      const { cameraMissing } = await engine.prepare();
      setSession((previous) =>
        previous && previous.call.id === current.call.id
          ? { ...previous, cameraMissing, localMedia: engine.flags, mirrored: engine.mirrored }
          : previous,
      );
      await callService.accept(current.call.id);
      if (current.mode === 'VIDEO') {
        const multiple = await engine.hasMultipleCameras();
        setSession((previous) => (previous && previous.call.id === current.call.id ? { ...previous, multipleCameras: multiple } : previous));
      }
    } catch (error) {
      void callService.decline(current.call.id).catch(() => undefined);
      releaseEngine();
      setSession(null);
      pushToast(error instanceof CallMediaError ? mediaErrorText(error.kind) : getErrorMessage(error), 'error');
    }
  }, [makeEngine, pushToast, releaseEngine, setSession]);

  const decline = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    stopRings();
    setSession(null);
    await callService.decline(current.call.id).catch(() => undefined);
  }, [setSession, stopRings]);

  const hangup = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.phase === 'ended') return;
    const id = current.call.id;
    const request =
      current.phase === 'calling' ? callService.cancel(id) : current.phase === 'ringing' ? callService.decline(id) : callService.end(id);
    const seconds = current.connectedAt ? Math.round((Date.now() - current.connectedAt) / 1000) : 0;
    finishLocal(current.phase === 'active' ? (seconds > 0 ? t('Qo‘ng‘iroq tugadi · {time}', { time: formatDuration(seconds) }) : t('Qo‘ng‘iroq tugadi')) : null);
    await request.catch(() => undefined);
  }, [finishLocal]);

  const toggleMute = useCallback(() => {
    const engine = engineRef.current;
    const current = sessionRef.current;
    if (!engine || !current) return;
    const audio = !current.localMedia.audio;
    engine.setAudioEnabled(audio);
    setSession({ ...current, localMedia: { ...current.localMedia, audio } });
  }, [setSession]);

  const toggleCamera = useCallback(async () => {
    const engine = engineRef.current;
    const current = sessionRef.current;
    if (!engine || !current) return;
    const next = !current.localMedia.video;
    const ok = await engine.setVideoEnabled(next);
    if (!ok && next) {
      pushToast(t('Kamerani yoqib bo‘lmadi.'), 'error');
      return;
    }
    setSession((previous) => (previous ? { ...previous, localMedia: engine.flags, mirrored: engine.mirrored } : previous));
  }, [pushToast, setSession]);

  const switchCamera = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (await engine.switchCamera()) setSession((previous) => (previous ? { ...previous, mirrored: engine.mirrored } : previous));
  }, [setSession]);

  // ---- yordamchi effektlar ----
  // Davom etayotgan qo‘ng‘iroqda «tirikman» belgisi (brauzer to‘satdan yopilsa, server qo‘ng‘iroqni yopib qo‘yadi).
  const phase = session?.phase;
  const callId = session?.call.id;
  useEffect(() => {
    if (!callId || (phase !== 'active' && phase !== 'connecting')) return;
    const timer = window.setInterval(() => void callService.ping(callId).catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [callId, phase]);

  // Ekran o‘chib qolmasin.
  useEffect(() => {
    if (phase !== 'active') return;
    const wake = (navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    void wake?.request('screen').then((lock) => (wakeLock.current = lock)).catch(() => undefined);
    return () => {
      void wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
    };
  }, [phase]);

  // Kiruvchi qo‘ng‘iroqda sahifa sarlavhasi yonib-o‘chadi (boshqa oynada bo‘lsa ham sezilsin).
  useEffect(() => {
    if (phase !== 'ringing') return;
    const original = document.title;
    let on = false;
    const timer = window.setInterval(() => {
      on = !on;
      document.title = on ? `📞 ${t('Kiruvchi qo‘ng‘iroq')}` : original;
    }, 900);
    return () => {
      window.clearInterval(timer);
      document.title = original;
    };
  }, [phase]);

  // Sahifa yopilsa/yangilansa, qo‘ng‘iroq osilib qolmasin.
  useEffect(() => {
    const onHide = () => {
      const current = sessionRef.current;
      if (!current || current.phase === 'ended') return;
      const action = current.phase === 'calling' ? 'cancel' : current.phase === 'ringing' ? 'decline' : 'end';
      apiPostKeepalive(`/calls/${current.call.id}/${action}`);
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  useEffect(
    () => () => {
      stopRings();
      engineRef.current?.stop();
      window.clearTimeout(endTimer.current);
    },
    [stopRings],
  );

  const value = useMemo<CallContextValue>(
    () => ({ session, localStream, remoteStream, enabled, startCall, accept, decline, hangup, toggleMute, toggleCamera, switchCamera }),
    [session, localStream, remoteStream, enabled, startCall, accept, decline, hangup, toggleMute, toggleCamera, switchCamera],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {session?.phase === 'ringing' ? <IncomingCall /> : session ? <CallScreen /> : null}
    </CallContext.Provider>
  );
}
