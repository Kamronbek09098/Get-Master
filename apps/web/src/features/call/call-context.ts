import { createContext, useContext } from 'react';
import type { MediaFlags } from './call-engine';
import type { CallMode, CallPeer, CallView } from './types';

export type CallPhase = 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallSession {
  call: CallView;
  peer: CallPeer;
  role: 'caller' | 'callee';
  mode: CallMode;
  phase: CallPhase;
  /** Aloqa o‘rnatilgan payt (taymer uchun). */
  connectedAt: number | null;
  /** Aloqa vaqtincha uzilib, tiklanmoqda. */
  reconnecting: boolean;
  /** Tugagan qo‘ng‘iroq uchun qisqa izoh. */
  note: string | null;
  remoteMedia: MediaFlags;
  cameraMissing: boolean;
  /** Mening kamera/mikrofon holatim. */
  localMedia: MediaFlags;
  multipleCameras: boolean;
  mirrored: boolean;
}

export interface CallContextValue {
  session: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Foydalanuvchi shu panelda qo‘ng‘iroq qila oladimi (mijoz/usta, brauzer qo‘llaydi). */
  enabled: boolean;
  startCall: (conversationId: string, mode: CallMode, peerName?: string) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
}

export const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const value = useContext(CallContext);
  if (!value) {
    // Provider tashqarisida (masalan, testlarda) — qo‘ng‘iroq o‘chirilgan.
    return {
      session: null,
      localStream: null,
      remoteStream: null,
      enabled: false,
      startCall: async () => undefined,
      accept: async () => undefined,
      decline: async () => undefined,
      hangup: async () => undefined,
      toggleMute: () => undefined,
      toggleCamera: async () => undefined,
      switchCamera: async () => undefined,
    };
  }
  return value;
}
