import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, ExternalLink, Flag, LocateFixed, MapPinOff, Navigation, RefreshCw, Route as RouteIcon, Undo2, Volume2, VolumeX, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cx } from '@/lib/utils';
import { geoService } from '@/features/geo/geo.service';
import type { NavRoute } from '@/features/geo/geo.service';
import { useArrive, useStartTravel } from '@/features/order/hooks/useOrders';
import { useOrder } from '@/features/order/hooks/useOrders';
import { NavMap } from '@/features/navigation/components/NavMap';
import { formatDistance, formatDuration, maneuverOf, progressOn } from '@/features/navigation/geometry';
import type { LatLon, Maneuver } from '@/features/navigation/geometry';
import { maneuverText } from '@/features/navigation/instructions';
import { useLiveLocation } from '@/features/navigation/useLiveLocation';
import { NavVoice, tierFor } from '@/features/navigation/voice';
import type { Tier } from '@/features/navigation/voice';
import { t } from '@/i18n';
import '@/features/navigation/components/navigation.css';

const ICON: Record<Maneuver, LucideIcon> = {
  straight: ArrowUp,
  depart: Navigation,
  left: CornerUpLeft,
  right: CornerUpRight,
  'slight-left': ArrowUpLeft,
  'slight-right': ArrowUpRight,
  'sharp-left': CornerUpLeft,
  'sharp-right': CornerUpRight,
  uturn: Undo2,
  roundabout: RefreshCw,
  arrive: Flag,
};

const OFF_ROUTE_M = 70;
const ARRIVED_M = 45;
const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const externalLinks = (to: LatLon) => [
  { name: 'Yandex Maps', href: `https://yandex.com/maps/?rtext=~${to.lat},${to.lon}&rtt=auto` },
  { name: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=driving` },
];

/** Ilova ichidagi navigatsiya: usta mijoz manziliga marshrut bo‘yicha boradi (xarita, burilishlar, masofa, vaqt, muqobil yo‘llar). */
export function NavigationPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const order = useOrder(id);
  const startTravel = useStartTravel(id);
  const arrive = useArrive(id);
  const demo = params.get('demo') === '1';

  const dest: LatLon | null = useMemo(() => {
    const lat = num(order.data?.location?.latitude);
    const lon = num(order.data?.location?.longitude);
    return lat != null && lon != null ? { lat, lon } : null;
  }, [order.data?.location?.latitude, order.data?.location?.longitude]);

  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [follow, setFollow] = useState(true);
  const [headingUp, setHeadingUp] = useState(true);
  const [voice, setVoice] = useState(true);
  const engine = useRef<NavVoice | null>(null);
  if (!engine.current) engine.current = new NavVoice();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [simPath, setSimPath] = useState<Array<[number, number]> | null>(null);
  const hint = useRef(0);
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  const spoken = useRef(new Set<string>());
  const announcedRoute = useRef(false);

  const live = useLiveLocation(!!dest, simPath);
  const position = live.position;

  // Marshrutni birinchi aniq joylashuvdan boshlab quramiz (yoki yo‘ldan chiqilganda qayta quramiz).
  useEffect(() => {
    if (!origin && position) setOrigin({ lat: position.lat, lon: position.lon });
  }, [origin, position]);

  const routes = useQuery({
    queryKey: ['nav-route', origin?.lat.toFixed(3), origin?.lon.toFixed(3), dest?.lat, dest?.lon, origin?.lat],
    queryFn: () => geoService.route(origin as LatLon, dest as LatLon),
    enabled: !!origin && !!dest,
    retry: 1,
    staleTime: 30_000,
  });
  const list: NavRoute[] = routes.data?.routes ?? [];
  const route = list[Math.min(routeIndex, Math.max(0, list.length - 1))] ?? null;

  // Demo: marshrutning o‘zi bo‘ylab harakat (faqat ?demo=1)
  useEffect(() => {
    if (demo && route && !simPath) setSimPath(route.geometry);
  }, [demo, route, simPath]);

  const progress = useMemo(() => (route && position ? progressOn(route, position, hint.current) : null), [route, position]);
  useEffect(() => {
    if (progress) hint.current = progress.index;
  }, [progress]);

  // Yo‘ldan chiqish: ketma-ket 3 ta nuqta 70 m dan uzoq bo‘lsa — qayta marshrut.
  useEffect(() => {
    if (!progress || !position) return;
    if (progress.offRouteM > OFF_ROUTE_M) offCount.current += 1;
    else offCount.current = 0;
    if (offCount.current >= 3 && Date.now() - lastReroute.current > 15_000) {
      lastReroute.current = Date.now();
      offCount.current = 0;
      hint.current = 0;
      spoken.current.clear();
      setRouteIndex(0);
      setOrigin({ lat: position.lat, lon: position.lon });
      engine.current?.event('reroute', 'Yo‘ldan chiqdingiz. Marshrut qayta hisoblanmoqda');
    }
  }, [progress, position]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Ekran o‘chib qolmasin
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((value) => (lock = value)).catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, []);

  const next = route && progress ? route.steps[Math.min(progress.stepIndex + 1, route.steps.length - 1)] : null;
  const maneuver: Maneuver = next ? maneuverOf(next) : 'straight';
  const arrived = !!progress && progress.remainingM <= ARRIVED_M;
  const instruction = arrived ? maneuverText('arrive', '') : next ? maneuverText(maneuver, next.name) : '';

  // O‘zbekcha ovozli ko‘rsatma (tayyor neyron ovoz fayllari): bosqichlar bo‘yicha — 3 km, 1 km, 500 m, 200 m va burilish paytida.
  useEffect(() => {
    engine.current!.enabled = voice;
    if (!voice) engine.current!.stop();
    else engine.current!.preload();
    return () => engine.current?.stop();
  }, [voice]);
  useEffect(() => {
    if (!voice || !progress || !next || !route || arrived) return;
    const stepLength = route.steps[progress.stepIndex]?.distanceM ?? progress.toNextM;
    const tier: Tier | null = tierFor(progress.toNextM, Math.max(stepLength, progress.toNextM));
    if (tier == null) return;
    const key = `${routeIndex}:${progress.stepIndex}:${tier}`;
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    engine.current!.announce(maneuver, tier, next.name);
  }, [voice, progress, next, route, maneuver, arrived, routeIndex]);
  useEffect(() => {
    if (!voice || !route || announcedRoute.current) return;
    announcedRoute.current = true;
    engine.current!.event('route-ready', 'Marshrut tayyor');
  }, [voice, route]);
  useEffect(() => {
    if (voice && arrived) engine.current!.announce('arrive', 0);
  }, [voice, arrived]);

  const speedKmh = Math.max(0, Math.round((position?.speed ?? 0) * 3.6));
  const after = route && progress ? route.steps[Math.min(progress.stepIndex + 2, route.steps.length - 1)] : null;
  const afterManeuver = after && next && after !== next ? maneuverOf(after) : null;
  const eta = progress ? new Date(Date.now() + progress.remainingS * 1000) : null;
  const goBack = `${order.data?.viewerRole === 'CUSTOMER' ? '/mijoz' : '/usta'}/buyurtmalar/${id}`;
  const recenter = useCallback(() => setFollow(true), []);
  const address = [order.data?.location?.title, order.data?.location?.addressLine].filter(Boolean).join(', ');

  // ---- Fail-safe holatlar ----
  if (order.isLoading) return <div className="gn gn--center"><Spinner /></div>;
  if (!order.data || order.isError)
    return (
      <div className="gn gn--center">
        <FailCard icon={<MapPinOff size={30} />} title={t('Buyurtma topilmadi')} text={t('Buyurtmani qayta ochib ko‘ring.')} back={goBack} />
      </div>
    );
  if (!dest)
    return (
      <div className="gn gn--center">
        <FailCard icon={<MapPinOff size={30} />} title={t('Manzil koordinatasi yo‘q')} text={address ? t('Mijoz manzili xaritada belgilanmagan: {address}. Mijoz bilan chat orqali aniqlang.', { address }) : t('Mijoz manzili xaritada belgilanmagan. Mijoz bilan chat orqali aniqlang.')} back={goBack} />
      </div>
    );

  const gpsProblem = live.status === 'denied' || live.status === 'unavailable' || live.status === 'timeout';
  const routeProblem = !!origin && routes.isError;

  return (
    <div className="gn" onPointerDown={() => engine.current?.unlock()}>
      <NavMap
        route={route?.geometry ?? null}
        passed={progress?.index ?? 0}
        alternatives={list.filter((_, i) => i !== routeIndex).map((item) => item.geometry)}
        position={position}
        destination={dest}
        follow={follow && !!position && !arrived}
        onUserMove={() => setFollow(false)}
        headingUp={headingUp}
        onToggleHeadingUp={() => {
          setHeadingUp((value) => !value);
          setFollow(true);
        }}
        fitKey={`${routeIndex}:${list.length}`}
        followZoom={speedKmh < 20 ? 18 : speedKmh < 55 ? 17 : speedKmh < 90 ? 16 : 15}
      />

      <header className="gn-top">
        <Link to={goBack} className="gn-iconbtn" aria-label={t('Buyurtmaga qaytish')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        {next && !gpsProblem ? (
          <div className={cx('gn-turn', arrived && 'is-arrived')} role="status" aria-live="polite">
            <span className="gn-turn__icon">{(() => { const Icon = ICON[arrived ? 'arrive' : maneuver]; return <Icon size={34} strokeWidth={2.4} aria-hidden="true" />; })()}</span>
            <span className="gn-turn__body">
              <strong>{arrived ? t('Manzilga yetdingiz') : formatDistance(progress?.toNextM ?? 0)}</strong>
              <span>{instruction}</span>
            </span>
          </div>
        ) : (
          <div className="gn-turn gn-turn--idle" role="status">
            <span className="gn-turn__body">
              <strong>{t('Navigatsiya')}</strong>
              <span>{address || t('Mijoz manzili')}</span>
            </span>
          </div>
        )}
        {(
          <button type="button" className="gn-iconbtn" aria-pressed={voice} aria-label={voice ? t('Ovozni o‘chirish') : t('Ovozni yoqish')} onClick={() => setVoice(!voice)}>
            {voice ? <Volume2 size={21} aria-hidden="true" /> : <VolumeX size={21} aria-hidden="true" />}
          </button>
        )}
      </header>

      {afterManeuver && !arrived && !gpsProblem && (
        <p className="gn-then" aria-label={t('Keyingi burilish')}>
          {t('Keyin')} {(() => { const Icon = ICON[afterManeuver]; return <Icon size={18} aria-hidden="true" />; })()}
        </p>
      )}
      {position && speedKmh > 0 && (
        <p className="gn-speed" aria-label={t('Tezlik')}>
          <strong>{speedKmh}</strong>
          <span>km/soat</span>
        </p>
      )}
      {!online && (
        <p className="gn-banner" role="status">
          <WifiOff size={16} aria-hidden="true" /> {t('Internet yo‘q: marshrut saqlanadi, xarita va qayta hisoblash ishlamaydi')}
        </p>
      )}
      {live.status === 'locating' && !position && !gpsProblem && (
        <p className="gn-banner" role="status">
          <Spinner /> {t('Joylashuvingiz aniqlanmoqda…')}
        </p>
      )}
      {routes.isFetching && origin && list.length > 0 && (
        <p className="gn-banner" role="status">
          <RefreshCw size={16} aria-hidden="true" /> {t('Marshrut qayta hisoblanmoqda…')}
        </p>
      )}

      {gpsProblem && (
        <div className="gn-fail">
          <FailCard
            icon={<MapPinOff size={30} />}
            title={live.status === 'denied' ? t('Joylashuvga ruxsat berilmagan') : t('Joylashuv aniqlanmadi')}
            text={live.status === 'denied' ? t('Navigatsiya uchun telefon sozlamalarida GetMaster’ga joylashuvga ruxsat bering, so‘ng qayta urinib ko‘ring.') : t('GPS signali topilmadi. Ochiq joyga chiqing yoki joylashuv (GPS) yoqilganini tekshiring.')}
            actions={
              <>
                <Button onClick={live.retry}>{t('Qayta urinish')}</Button>
                {externalLinks(dest).map((link) => (
                  <a key={link.name} className="gm-button gm-button--secondary" href={link.href} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" /> {link.name}
                  </a>
                ))}
              </>
            }
            back={goBack}
          />
        </div>
      )}

      {routeProblem && !gpsProblem && (
        <div className="gn-fail">
          <FailCard
            icon={<RouteIcon size={30} />}
            title={t('Marshrut qurib bo‘lmadi')}
            text={t('Marshrut xizmati javob bermadi yoki bu manzilga yo‘l topilmadi. Qayta urinib ko‘ring yoki boshqa xarita ilovasidan foydalaning.')}
            actions={
              <>
                <Button onClick={() => void routes.refetch()}>{t('Qayta urinish')}</Button>
                {externalLinks(dest).map((link) => (
                  <a key={link.name} className="gm-button gm-button--secondary" href={link.href} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" /> {link.name}
                  </a>
                ))}
              </>
            }
            back={goBack}
          />
        </div>
      )}

      {!follow && position && !arrived && (
        <button type="button" className="gn-recenter" onClick={recenter}>
          <LocateFixed size={18} aria-hidden="true" /> {t('Joyimga qaytish')}
        </button>
      )}

      <section className="gn-panel" aria-label={t('Marshrut ma’lumoti')}>
        {list.length > 1 && (
          <div className="gn-alts" role="group" aria-label={t('Muqobil yo‘llar')}>
            {list.map((item, index) => (
              <button
                key={index}
                type="button"
                className={cx('gn-alt', index === routeIndex && 'is-on')}
                aria-pressed={index === routeIndex}
                onClick={() => {
                  hint.current = 0;
                  spoken.current.clear();
                  setRouteIndex(index);
                }}
              >
                <strong>{formatDuration(item.durationS)}</strong>
                <span>{formatDistance(item.distanceM)}{index === 0 ? ` · ${t('Tezkor')}` : ''}</span>
              </button>
            ))}
          </div>
        )}
        <div className="gn-stats">
          <div>
            <strong>{eta ? eta.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : route ? '—' : '…'}</strong>
            <span>{t('Yetib borish')}</span>
          </div>
          <div>
            <strong>{progress ? formatDuration(progress.remainingS) : route ? formatDuration(route.durationS) : '…'}</strong>
            <span>{t('Qolgan vaqt')}</span>
          </div>
          <div>
            <strong>{progress ? formatDistance(progress.remainingM) : route ? formatDistance(route.distanceM) : '…'}</strong>
            <span>{t('Qolgan masofa')}</span>
          </div>
        </div>
        {address && <p className="gn-addr"><Flag size={14} aria-hidden="true" /> {address}</p>}
        <div className="gn-actions">
          {order.data.status === 'CONFIRMED' && (
            <Button size="lg" fullWidth loading={startTravel.isPending} onClick={() => startTravel.mutate()}>
              {t('Yo‘lga chiqdim')}
            </Button>
          )}
          {(arrived || order.data.status === 'ON_THE_WAY') && order.data.status === 'ON_THE_WAY' && (
            <Button size="lg" fullWidth variant={arrived ? 'primary' : 'secondary'} loading={arrive.isPending} onClick={() => arrive.mutate(undefined, { onSuccess: () => undefined })}>
              {t('Yetib keldim')}
            </Button>
          )}
          {order.data.status === 'ARRIVED' && (
            <Link to={goBack} className="gm-button gm-button--primary gm-button--lg gm-button--full">
              {t('Buyurtmaga o‘tish')}
            </Link>
          )}
          {!gpsProblem && !routeProblem && (
            <a className="gn-ext" href={externalLinks(dest)[0]!.href} target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden="true" /> {t('Boshqa xarita ilovasida ochish')}
            </a>
          )}
        </div>
        {startTravel.isError && <p className="gn-err" role="alert">{t('Holatni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.')}</p>}
      </section>
    </div>
  );
}

function FailCard({ icon, title, text, actions, back }: { icon: React.ReactNode; title: string; text: string; actions?: React.ReactNode; back: string }) {
  return (
    <div className="gn-card" role="alert">
      <span className="gn-card__icon" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {actions && <div className="gn-card__actions">{actions}</div>}
      <Link to={back} className="gn-card__back">{t('Buyurtmaga qaytish')}</Link>
    </div>
  );
}

