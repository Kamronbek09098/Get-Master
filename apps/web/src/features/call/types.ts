export type CallMode = 'AUDIO' | 'VIDEO';
export type CallStatus = 'RINGING' | 'ACTIVE' | 'ENDED' | 'DECLINED' | 'MISSED' | 'CANCELED' | 'FAILED';

export interface CallView {
  id: string;
  conversationId: string;
  mode: CallMode;
  status: CallStatus;
  callerId: string;
  calleeId: string;
  createdAt: string;
  answeredAt: string | null;
}

export interface CallPeer {
  id: string;
  name: string;
}

export interface StartCallResult {
  call: CallView;
  peer: CallPeer;
  calleeOnline: boolean;
}

export interface IceServers {
  iceServers: RTCIceServer[];
  hasTurn: boolean;
}

export type SignalKind = 'offer' | 'answer' | 'candidate' | 'media';

export interface CallEndedPayload {
  callId: string;
  status: CallStatus;
  reason: string;
  seconds: number;
}

/** Chat tarixidagi qo‘ng‘iroq yozuvi (SYSTEM xabari: `call:{json}`). */
export interface CallLogEntry {
  callId: string;
  mode: CallMode;
  status: CallStatus;
  seconds: number;
  callerId: string;
}
