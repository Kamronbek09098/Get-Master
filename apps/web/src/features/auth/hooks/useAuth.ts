import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import type { LoginInput, RegisterInput, VerifyOtpInput } from '../types';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { SESSION_EXPIRED_EVENT } from '@/services/api.client';

export function useRegister() {
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const setDevCode = useAuthStore((s) => s.setDevCode);
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    onSuccess: (result, variables) => {
      setPendingPhone(variables.phone);
      setDevCode(result.developmentCode ?? null);
    },
  });
}

export function useVerifyRegistration() {
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const pushToast = useAppStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => authService.verifyRegistration(phone, code),
    onSuccess: () => {
      setPendingPhone(null);
      pushToast('Ro‘yxatdan o‘tish tasdiqlandi. Endi tizimga kiring.', 'success');
    },
  });
}

export function useLogin() {
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const setDevCode = useAuthStore((s) => s.setDevCode);
  const setDeviceLimit = useAuthStore((s) => s.setDeviceLimit);
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (result, variables) => {
      setPendingPhone(variables.phone);
      setDevCode(result.developmentCode ?? null);
      setDeviceLimit(result.deviceLimit ? { max: result.deviceLimit.max, active: result.deviceLimit.active } : null);
    },
  });
}

export function useVerifyOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  return useMutation({
    mutationFn: (input: VerifyOtpInput) => authService.verifyOtp(input),
    onSuccess: () => {
      setSession(true);
      setPendingPhone(null);
      useAuthStore.getState().setDevCode(null);
      useAuthStore.getState().setDeviceLimit(null);
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (allDevices: boolean) => authService.logout(allDevices),
    onSuccess: () => {
      clear();
      queryClient.clear();
      navigate('/', { replace: true });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authService.listSessions(),
    refetchInterval: 60_000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useSessionExpiredListener() {
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    function onExpired() {
      clear();
      pushToast('Sessiya muddati tugadi. Iltimos, qayta kiring.', 'info');
      navigate('/login', { replace: true });
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [clear, navigate, pushToast]);
}
