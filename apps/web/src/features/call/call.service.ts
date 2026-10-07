import { apiGet, apiPost } from '@/services/api.client';
import type { CallMode, CallView, IceServers, SignalKind, StartCallResult, CallPeer } from './types';

export const callService = {
  iceServers() {
    return apiGet<IceServers>('/calls/ice-servers');
  },
  current() {
    return apiGet<{ call: CallView; peer: CallPeer } | null>('/calls/current');
  },
  start(conversationId: string, mode: CallMode) {
    return apiPost<StartCallResult>('/calls', { conversationId, mode });
  },
  accept(id: string) {
    return apiPost<{ call: CallView }>(`/calls/${id}/accept`);
  },
  decline(id: string) {
    return apiPost<{ call: CallView }>(`/calls/${id}/decline`);
  },
  cancel(id: string) {
    return apiPost<{ call: CallView }>(`/calls/${id}/cancel`);
  },
  end(id: string, reason?: 'failed') {
    return apiPost<{ call: CallView }>(`/calls/${id}/end`, reason ? { reason } : {});
  },
  ping(id: string) {
    return apiPost<{ alive: boolean }>(`/calls/${id}/ping`);
  },
  signal(id: string, kind: SignalKind, payload: Record<string, unknown>) {
    return apiPost<{ relayed: boolean }>(`/calls/${id}/signal`, { kind, payload });
  },
};
