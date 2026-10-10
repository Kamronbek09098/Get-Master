import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Compass, ExternalLink, Globe, MapPinOff, MessageCircle, Moon, Navigation, RefreshCw, Route as RouteIcon, Settings, Volume2, VolumeX, WifiOff, Gauge, Eye, Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cx } from '@/lib/utils';
import { geoService } from '@/features/geo/geo.service';
import type { NavRoute } from '@/features/geo/geo.service';
import { useArrive, useStartTravel } from '@/features/order/hooks/useOrders';
import { useOrder } from '@/features/order/hooks/useOrders';
import { NavMap } from '@/features/navigation/components/NavMap';
import { Choice, MANEUVER_ICON, ManeuverSign, RoundBtn, RouteBar, SOUND_OPTIONS, THEME_OPTIONS, Toggle, VOLUME_OPTIONS } from '@/features/navigation/components/NavUi';
import { formatDistance, formatDuration, maneuverOf, progressOn } from '@/features/navigation/geometry';
import type { LatLon, Maneuver } from '@/features/navigation/geometry';
import { maneuverText } from '@/features/navigation/instructions';
import { useLiveLocation } from '@/features/navigation/useLiveLocation';
import { useDeviceHeading } from '@/features/navigation/useDeviceHeading';
import { useNavSettings, VOLUME_GAIN } from '@/features/navigation/settings';
import { NavVoice, tierFor } from '@/features/navigation/voice';
import type { Tier } from '@/features/navigation/voice';
import { t } from '@/i18n';
import '@/features/navigation/components/navigation.css';

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
  const [prefs, setPrefs] = useNavSettings();
  const headingUp = prefs.headingUp;
  const voice = prefs.sound !== 'off';
  const [showAlts, setShowAlts] = useState(false);
  const [sheet, setSheet] = useState<'collapsed' | 'expanded' | 'settings'>('collapsed');
  const [bearing, setBearing] = useState(0);
  const [signVisible, setSignVisible] = useState(false);
  const [overviewKey, setOverviewKey] = useState(0);
  const [panelH, setPanelH] = useState(130);
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
  const compass = useDeviceHeading(!!dest);

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
    if (!prefs.keepAwake) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((value) => (lock = value)).catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, [prefs.keepAwake]);

  // Marker: yo‘lga yopishtiriladi (GPS xatosi bo‘lsa ham yo‘lda turadi); yo‘nalish — harakatda GPS/yo‘l bo‘yicha, turganda telefon kompasi bo‘yicha.
  const moving = (position?.speed ?? 0) > 1.5;
  const snapped = position && progress && progress.offRouteM < 40 && position.accuracy < 70 ? progress.snapped : null;
  const course = position ? (snapped && moving ? progress!.segmentBearing : position.heading) : null;
  const cameraHeading = useRef<number | null>(null);
  if (moving && course != null) cameraHeading.current = course;
  const markerHeading = moving ? course : (compass.heading ?? course ?? cameraHeading.current);
  const mapPosition = useMemo(
    () => (position ? { ...position, lat: snapped?.lat ?? position.lat, lon: snapped?.lon ?? position.lon, heading: cameraHeading.current ?? position.heading ?? markerHeading } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position, snapped?.lat, snapped?.lon, markerHeading],
  );
  const next = route && progress ? route.steps[Math.min(progress.stepIndex + 1, route.steps.length - 1)] : null;
  const maneuver: Maneuver = next ? maneuverOf(next) : 'straight';
  const arrived = !!progress && progress.remainingM <= ARRIVED_M;
  const instruction = arrived ? maneuverText('arrive', '') : next ? maneuverText(maneuver, next.name) : '';

  // O‘zbekcha ovozli ko‘rsatma (tayyor neyron ovoz fayllari): bosqichlar bo‘yicha — 3 km, 1 km, 500 m, 200 m va burilish paytida.
  useEffect(() => {
    engine.current!.enabled = voice;
    engine.current!.importantOnly = prefs.sound === 'important';
    engine.current!.volume = VOLUME_GAIN[prefs.volume];
    if (!voice) engine.current!.stop();
    else engine.current!.preload();
  }, [voice, prefs.sound, prefs.volume]);
  useEffect(() => () => engine.current?.stop(), []);
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

  // Pastki panel balandligi o‘lchanadi: xarita va suzuvchi tugmalar shunga qarab joylashadi.
  const panelObserver = useRef<ResizeObserver | null>(null);
  const panelRef = useCallback((el: HTMLElement | null) => {
    panelObserver.current?.disconnect();
    if (!el) return;
    const apply = () => setPanelH(el.offsetHeight);
    apply();
    panelObserver.current = new ResizeObserver(apply);
    panelObserver.current.observe(el);
  }, []);

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

  const gpsProblem = !position && (live.status === 'denied' || live.status === 'unavailable' || live.status === 'timeout' || live.status === 'insecure');
  const native = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const routeProblem = !!origin && routes.isError;
  const total = route?.distanceM ?? 0;
  const remainingM = progress?.remainingM ?? total;
  const remainingS = progress?.remainingS ?? route?.durationS ?? 0;
  const maneuverPoint: LatLon | null = arrived ? dest : next ? { lat: next.location[1], lon: next.location[0] } : null;
  const showTopSign = !!next && !gpsProblem && !signVisible;
  const status = order.data.status;
  const expanded = sheet !== 'collapsed';
  const mapRotated = Math.abs(((bearing + 540) % 360) - 180) > 4;

  const compassButton = () => {
    if (headingUp) setPrefs({ headingUp: false });
    else setPrefs({ headingUp: true });
    setFollow(true);
  };
  const orderActions = (
    <>
      {status === 'CONFIRMED' && (
        <Button size="lg" fullWidth loading={startTravel.isPending} onClick={() => startTravel.mutate()}>
          {t('Yo‘lga chiqdim')}
        </Button>
      )}
      {status === 'ON_THE_WAY' && (
        <Button size="lg" fullWidth variant={arrived ? 'primary' : 'secondary'} loading={arrive.isPending} onClick={() => arrive.mutate(undefined, { onSuccess: () => undefined })}>
          {t('Yetib keldim')}
        </Button>
      )}
      {status === 'ARRIVED' && (
        <Link to={goBack} className="gm-button gm-button--primary gm-button--lg gm-button--full">
          {t('Buyurtmaga o‘tish')}
        </Link>
      )}
      {startTravel.isError && <p className="gn-err" role="alert">{t('Holatni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.')}</p>}
    </>
  );

  return (
    <div className="gn" style={{ '--gn-panel-h': `${panelH}px` } as React.CSSProperties} onPointerDown={() => { engine.current?.unlock(); if (compass.needsPermission) compass.request(); }}>
      <NavMap
        route={route?.geometry ?? null}
        passed={progress?.index ?? 0}
        alternatives={list.filter((_, i) => i !== routeIndex).map((item) => item.geometry)}
        position={mapPosition}
        markerHeading={markerHeading}
        compassActive={!moving && compass.heading != null}
        destination={dest}
        follow={follow && !!position && !arrived}
        onUserMove={() => setFollow(false)}
        headingUp={headingUp}
        mapTheme={prefs.mapTheme}
        maneuverAt={!gpsProblem ? maneuverPoint : null}
        maneuverSign={maneuverPoint ? <ManeuverSign maneuver={maneuver} meters={progress?.toNextM ?? 0} arrived={arrived} label={instruction} /> : null}
        onManeuverVisible={setSignVisible}
        onBearing={setBearing}
        bottomInset={panelH}
        overviewKey={overviewKey}
        fitKey={`${routeIndex}:${list.length}`}
        followZoom={speedKmh < 20 ? 18 : speedKmh < 55 ? 17 : speedKmh < 90 ? 16 : 15}
      />

      {showTopSign && (
        <div className="gn-topsign" aria-live="polite">
          <ManeuverSign maneuver={maneuver} meters={progress?.toNextM ?? 0} arrived={arrived} label={instruction} />
          <span className="gn-topsign__text">{instruction}</span>
        </div>
      )}
      {!next && !gpsProblem && (
        <div className="gn-topsign gn-topsign--idle">
          <span className="gn-topsign__text"><strong>{t('Navigatsiya')}</strong> {address || t('Mijoz manzili')}</span>
        </div>
      )}

      <div className="gn-fabs gn-fabs--top">
        <RoundBtn label={voice ? t('Ovozni o‘chirish') : t('Ovozni yoqish')} active={false} onClick={() => setPrefs({ sound: voice ? 'off' : 'all' })}>
          {voice ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}
        </RoundBtn>
      </div>

      {afterManeuver && !arrived && !gpsProblem && !showTopSign && (
        <p className="gn-then" aria-label={t('Keyingi burilish')}>
          {t('Keyin')} {(() => { const Icon = MANEUVER_ICON[afterManeuver]; return <Icon size={18} aria-hidden="true" />; })()}
        </p>
      )}
      {!online && (
        <p className="gn-banner" role="status">
          <WifiOff size={16} aria-hidden="true" /> {t('Internet yo‘q: marshrut saqlanadi, xarita va qayta hisoblash ishlamaydi')}
        </p>
      )}
      {live.status === 'locating' && !position && !gpsProblem && (
        <p className="gn-banner" role="status">
          <Spinner /> {t('Joylashuvingiz aniqlanmoqda… Ruxsat so‘ralsa, «Ruxsat berish»ni bosing.')}
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
            title={live.status === 'denied' ? t('Joylashuvga ruxsat berilmagan') : live.status === 'insecure' ? t('Joylashuv faqat xavfsiz (HTTPS) ulanishda ishlaydi') : t('Joylashuv aniqlanmadi')}
            text={
              live.status === 'denied'
                ? native
                  ? t('Telefon sozlamalari → Ilovalar → GetMaster → Ruxsatlar → Joylashuv bo‘limida «Ilova ishlatilayotganda ruxsat berish»ni tanlang, so‘ng bu yerga qaytib «Qayta urinish»ni bosing.')
                  : t('Brauzer manzil satridagi qulf belgisini bosing → «Joylashuv» → «Ruxsat berish», so‘ng «Qayta urinish»ni bosing.')
                : live.status === 'insecure'
                  ? t('Brauzer xavfsizlik uchun joylashuvni faqat HTTPS manzilida beradi. Saytni https:// orqali oching yoki telefon ilovasidan foydalaning.')
                  : native
                    ? t('GPS signali topilmadi. Telefonda «Joylashuv» xizmati yoqilganini tekshiring va ochiq joyga chiqing.')
                    : t('Qurilma joylashuvni aniqlay olmadi. Kompyuterda joylashuv Wi‑Fi orqali aniqlanadi: tizimdagi «Joylashuv xizmatlari» yoqilganini tekshiring yoki telefondan foydalaning.')
            }
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

      {/* Suzuvchi tugmalar: chapda — orqaga, o‘ngda — kompas va joyimga qaytish (panel balandligiga qarab) */}
      <div className="gn-fabs gn-fabs--left">
        <Link to={goBack} className="gn-round" aria-label={t('Buyurtmaga qaytish')} title={t('Buyurtmaga qaytish')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
      </div>
      <div className="gn-fabs gn-fabs--right">
        <RoundBtn label={headingUp ? t('Shimol tepada') : t('Yo‘nalish tepada')} onClick={compassButton} active={false}>
          <Compass size={22} style={{ transform: `rotate(${mapRotated ? -bearing : 0}deg)`, color: mapRotated ? '#e5384f' : undefined }} aria-hidden="true" />
        </RoundBtn>
        <RoundBtn label={t('Joyimga qaytish')} active={follow && !!position} onClick={recenter}>
          <Navigation size={22} aria-hidden="true" style={{ transform: 'rotate(-45deg)' }} />
        </RoundBtn>
      </div>

      <section ref={panelRef} className={cx('gn-sheet', expanded && 'is-expanded', sheet === 'settings' && 'is-settings')} aria-label={t('Marshrut ma’lumoti')}>
        {sheet !== 'settings' && (
          <>
            <div className="gn-sheet__bar">
              <span className="gn-sheet__speed" aria-label={t('Tezlik')}>
                <strong>{speedKmh}</strong>
                <small>km/s</small>
              </span>
              <div className="gn-sheet__info" aria-live="off">
                <strong>{route ? formatDuration(remainingS) : '…'}</strong>
                <span>{route ? `${formatDistance(remainingM)} · ${eta ? eta.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '—'}` : t('Marshrut tuzilmoqda…')}</span>
              </div>
              <button type="button" className="gn-sheet__toggle" aria-expanded={expanded} aria-label={expanded ? t('Panelni yig‘ish') : t('Panelni ochish')} onClick={() => setSheet(expanded ? 'collapsed' : 'expanded')}>
                {expanded ? <ChevronDown size={24} aria-hidden="true" /> : <ChevronUp size={24} aria-hidden="true" />}
              </button>
            </div>
            <RouteBar done={Math.max(0, total - remainingM)} total={total} />
            {!expanded && (status === 'CONFIRMED' || status === 'ON_THE_WAY' || status === 'ARRIVED') && <div className="gn-sheet__cta">{orderActions}</div>}
          </>
        )}

        {sheet === 'expanded' && (
          <div className="gn-sheet__body">
            <h2 className="gn-dest"><span>{t('Manzil')}</span>{address || t('Mijoz manzili')}</h2>
            <div className="gn-pair">
              <button type="button" disabled={list.length < 2} onClick={() => setShowAlts((value) => !value)} aria-expanded={showAlts}>
                <RouteIcon size={22} aria-hidden="true" />
                <span>{t('Muqobil yo‘llar')}{list.length > 1 ? ` (${list.length})` : ''}</span>
              </button>
              <button type="button" onClick={() => { setFollow(false); setOverviewKey((k) => k + 1); setSheet('collapsed'); }}>
                <Eye size={22} aria-hidden="true" />
                <span>{t('Marshrut sharhi')}</span>
              </button>
            </div>
            {showAlts && list.length > 1 && (
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
            <ul className="gn-menu">
              {order.data.conversationId && (
                <li>
                  <Link to={`${order.data.viewerRole === 'CUSTOMER' ? '/mijoz' : '/usta'}/chat?suhbat=${order.data.conversationId}`}>
                    <MessageCircle size={24} aria-hidden="true" />
                    <span>{t('Mijoz bilan chat')}</span>
                    <ChevronRight size={20} aria-hidden="true" />
                  </Link>
                </li>
              )}
              <li>
                <a href={externalLinks(dest)[0]!.href} target="_blank" rel="noreferrer">
                  <ExternalLink size={24} aria-hidden="true" />
                  <span>{t('Boshqa xarita ilovasida ochish')}</span>
                  <ChevronRight size={20} aria-hidden="true" />
                </a>
              </li>
              <li>
                <button type="button" onClick={() => setSheet('settings')}>
                  <Settings size={24} aria-hidden="true" />
                  <span>{t('Sozlamalar')}</span>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </li>
            </ul>
            <div className="gn-actions">{orderActions}</div>
            <Link to={goBack} className="gn-finish">{t('Yakunlash')}</Link>
          </div>
        )}

        {sheet === 'settings' && (
          <div className="gn-sheet__body gn-settings">
            <h2>{t('Sozlamalar')}</h2>
            <section className="gn-set">
              <h3>{t('Ovozli ko‘rsatmalar')}</h3>
              <Choice
                label={t('Ovoz rejimi')}
                value={prefs.sound}
                onChange={(sound) => setPrefs({ sound })}
                options={SOUND_OPTIONS({ off: <VolumeX size={22} aria-hidden="true" />, important: <AlertTriangle size={22} aria-hidden="true" />, all: <Volume2 size={22} aria-hidden="true" /> })}
              />
            </section>
            <section className="gn-set">
              <h3>{t('Ovoz balandligi')}</h3>
              <Choice label={t('Ovoz balandligi')} value={prefs.volume} onChange={(volume) => setPrefs({ volume })} options={VOLUME_OPTIONS()} />
            </section>
            <section className="gn-set gn-set--row">
              <span className="gn-toggle__icon" aria-hidden="true"><Globe size={22} /></span>
              <div>
                <strong>{t('Ovozli yordamchi')}</strong>
                <small>{t('O‘zbekcha · Neyron ovoz')}</small>
              </div>
              <button type="button" className="gn-chipbtn" onClick={() => engine.current?.sample()} disabled={!voice}>{t('Sinab ko‘rish')}</button>
            </section>
            <h3 className="gn-set__group">{t('Xarita va ekran')}</h3>
            <section className="gn-set">
              <h3><Moon size={16} aria-hidden="true" /> {t('Xarita mavzusi')}</h3>
              <Choice label={t('Xarita mavzusi')} value={prefs.mapTheme} onChange={(mapTheme) => setPrefs({ mapTheme })} options={THEME_OPTIONS()} />
            </section>
            <section className="gn-set gn-set--list">
              <Toggle icon={<Navigation size={22} />} label={t('Yo‘nalish bo‘yicha burilish (3D)')} hint={t('Xarita harakat yo‘nalishiga qarab buriladi')} checked={prefs.headingUp} onChange={(headingUp) => setPrefs({ headingUp })} />
              <Toggle icon={<Gauge size={22} />} label={t('Tezlikni ko‘rsatish')} checked={prefs.showSpeed} onChange={(showSpeed) => setPrefs({ showSpeed })} />
              <Toggle icon={<Bell size={22} />} label={t('Ekranni o‘chirmaslik')} hint={t('Navigatsiya paytida ekran yoniq turadi')} checked={prefs.keepAwake} onChange={(keepAwake) => setPrefs({ keepAwake })} />
            </section>
            <Button size="lg" fullWidth onClick={() => setSheet('expanded')}>{t('Orqaga')}</Button>
          </div>
        )}
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

