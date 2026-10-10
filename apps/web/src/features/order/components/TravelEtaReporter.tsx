import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { geoService } from '@/features/geo/geo.service';
import { progressOn } from '@/features/navigation/geometry';
import type { LatLon } from '@/features/navigation/geometry';
import { useLiveLocation } from '@/features/navigation/useLiveLocation';
import { FIX_MAX_AGE_MS } from '../arrival';
import { orderService } from '../services/order.service';

/**
 * Usta yo‘lda bo‘lib, navigator ochiq bo‘lmasa ham mijoz taxminiy yetib borish vaqtini ko‘rsin:
 * qurilma joylashuvidan marshrut hisoblanadi (navigatordagi bilan bir xil usulda) va serverga yuboriladi.
 * Ko‘rinmas komponent.
 */
export function TravelEtaReporter({ orderId, dest }: { orderId: string; dest: LatLon }) {
  const live = useLiveLocation(true);
  const position = live.position;
  const [origin, setOrigin] = useState<LatLon | null>(null);
  useEffect(() => {
    if (!origin && position) setOrigin({ lat: position.lat, lon: position.lon });
  }, [origin, position]);

  const routes = useQuery({
    queryKey: ['nav-route', origin?.lat.toFixed(3), origin?.lon.toFixed(3), dest.lat, dest.lon, origin?.lat],
    queryFn: () => geoService.route(origin as LatLon, dest),
    enabled: !!origin,
    retry: 1,
    staleTime: 30_000,
  });
  const route = routes.data?.routes?.[0] ?? null;
  const progress = useMemo(() => (route && position ? progressOn(route, position, 0) : null), [route, position]);

  const latest = useRef<{ s: number; m: number; at: number } | null>(null);
  latest.current = route && position ? { s: Math.round(progress?.remainingS ?? route.durationS), m: Math.round(progress?.remainingM ?? route.distanceM), at: position.at } : null;
  const ready = !!route;

  useEffect(() => {
    if (!ready) return;
    const send = () => {
      const value = latest.current;
      // Faqat hozirgi GPS nuqtasi bo‘yicha: nuqta eskirgan bo‘lsa yuborilmaydi.
      if (value && navigator.onLine && Date.now() - value.at <= FIX_MAX_AGE_MS) orderService.reportEta(orderId, { remainingS: value.s, remainingM: value.m }).catch(() => undefined);
    };
    send();
    const timer = window.setInterval(send, 20_000);
    return () => window.clearInterval(timer);
  }, [ready, orderId]);

  return null;
}
