import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, CreditCard, Heart, KeyRound, LogOut, Mail, MapPin, Package, Pencil, Phone, RotateCcw, ShieldCheck, Settings, TrendingDown, TrendingUp, UserRound, Users, XCircle, Fingerprint, IdCard, BarChart3, Zap, Hash } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AvatarEditor } from '@/features/profile/AvatarEditor';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { useProfileOverview } from '@/features/customer/hooks/useCustomer';
import { useFavorites } from '@/features/customer/hooks/useFavorites';
import { useMe } from '@/features/session/hooks/useMe';
import { accountName } from '@/lib/account-name';
import { cx, formatDate, formatNumber } from '@/lib/utils';
import type { CustomerProfile } from '@/features/customer/types';
import { t } from '@/i18n';
import './CustomerProfileDashboard.css';

const BASE = '/mijoz/profil';
const PERIODS = [7, 30, 90] as const;

function relativeJoined(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days < 1) return t('Bugun');
  if (days < 30) return t('{count} kun oldin', { count: days });
  if (days < 365) return t('{count} oy oldin', { count: Math.floor(days / 30) });
  return t('{count} yil oldin', { count: Math.floor(days / 365) });
}

function Trend({ value, previous, inverse = false }: { value: number; previous: number; inverse?: boolean }) {
  if (previous === 0) return <em className="gm-cp-trend is-flat">{value > 0 ? t('Yangi') : '0%'}</em>;
  const pct = Math.round(((value - previous) / previous) * 100);
  if (pct === 0) return <em className="gm-cp-trend is-flat">0%</em>;
  const up = pct > 0;
  const good = inverse ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return <em className={cx('gm-cp-trend', good ? 'is-good' : 'is-bad')}><Icon size={12} aria-hidden="true" /> {up ? '+' : ''}{pct}%</em>;
}

function Card({ icon: Icon, title, action, children, className }: { icon: LucideIcon; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('gm-cp-card', className)}>
      <header>
        <h2><Icon size={18} aria-hidden="true" /> {title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Mijoz profili: ma’lumotlar, faoliyat statistikasi va xavfsizlik bitta sahifada (barchasi backenddan). */
export function CustomerProfileDashboard({ profile }: { profile: CustomerProfile }) {
  const me = useMe();
  const favorites = useFavorites();
  const [days, setDays] = useState<number>(30);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const overview = useProfileOverview(days);
  const data = overview.data;
  const name = accountName(profile);
  const hasName = Boolean(profile.firstName && profile.lastName);
  const city = data?.address ? [data.address.city, data.address.district].filter(Boolean).join(', ') || data.address.addressLine : null;
  const avatar = me.data?.avatar;

  const checks = [hasName, profile.phoneVerified, Boolean(profile.email), Boolean(avatar), Boolean(data?.address)];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const loading = overview.isLoading;
  const num = (value: number | undefined) => (loading || value === undefined ? '…' : formatNumber(value));

  const links: Array<{ to: string; icon: LucideIcon; title: string; hint: string; tone: string }> = [
    { to: '/mijoz/tolovlar', icon: CreditCard, title: t('To‘lovlar'), hint: t('To‘lov tarixingiz va hisobotlar'), tone: 'blue' },
    { to: '/mijoz/buyurtmalar', icon: Package, title: t('Buyurtmalar'), hint: t('Barcha buyurtmalaringiz'), tone: 'green' },
    { to: `${BASE}/saqlangan`, icon: Users, title: t('Ustalar'), hint: t('Saqlangan ustalar va hamkorlar'), tone: 'purple' },
    { to: '/mijoz/manzillar', icon: MapPin, title: t('Manzillar'), hint: t('Xizmat uchun manzillar'), tone: 'orange' },
  ];
  const quick: Array<{ to: string; icon: LucideIcon; title: string; hint: string }> = [
    { to: `${BASE}/tahrirlash`, icon: Pencil, title: t('Profilni tahrirlash'), hint: t('Shaxsiy ma’lumotlaringizni yangilang') },
    { to: '/mijoz/manzillar', icon: MapPin, title: t('Manzillarim'), hint: t('Xizmat manzillarini boshqaring') },
    { to: `${BASE}/ustalar`, icon: Users, title: t('Birga ishlagan ustalar'), hint: t('O‘tgan buyurtmalaringizdagi ustalar') },
    { to: `${BASE}/saqlangan`, icon: Heart, title: t('Saqlangan ustalar'), hint: t('Sevimli ustalaringiz ro‘yxati') },
    { to: '/sozlamalar', icon: Settings, title: t('Sozlamalar'), hint: t('Hisob va xavfsizlik sozlamalari') },
  ];

  const stats = data?.period;
  const tiles: Array<{ key: string; icon: LucideIcon; label: string; cur?: { value: number; previous: number }; tone: string; inverse?: boolean }> = [
    { key: 'req', icon: ClipboardList, label: t('Jami so‘rovlar'), cur: stats?.requests, tone: 'green' },
    { key: 'ord', icon: Package, label: t('Jami buyurtmalar'), cur: stats?.orders, tone: 'blue' },
    { key: 'can', icon: XCircle, label: t('Bekor qilingan'), cur: stats?.cancelled, tone: 'purple', inverse: true },
    { key: 'ref', icon: RotateCcw, label: t('Qaytarilgan'), cur: stats?.refunded, tone: 'orange', inverse: true },
  ];

  return (
    <div className="gm-cp">
      <nav className="gm-cp-crumbs" aria-label={t('Sahifa yo‘li')}>
        <Link to="/mijoz/lenta">{t('Bosh sahifa')}</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{t('Profil')}</span>
      </nav>

      <section className="gm-cp-hero">
        <Link to={`${BASE}/tahrirlash`} className="gm-cp-hero__edit"><Pencil size={15} aria-hidden="true" /> {t('Profilni tahrirlash')}</Link>
        <div className="gm-cp-hero__who">
          <AvatarEditor name={name} seed={profile.id} size="lg" src={avatar} canEdit={me.data?.canSetAvatar !== false} />
          <div>
            <h1>{name}{profile.phoneVerified && <BadgeCheck size={22} className="gm-cp-hero__check" aria-label={t('Tasdiqlangan')} />}</h1>
            {profile.phone && <p className="gm-cp-hero__phone">{profile.phone}</p>}
            <span className={cx('gm-cp-pill', profile.phoneVerified ? 'is-ok' : 'is-warn')}>
              <CheckCircle2 size={13} aria-hidden="true" /> {profile.phoneVerified ? t('Telefon tasdiqlangan') : t('Telefon tasdiqlanmagan')}
            </span>
          </div>
        </div>
        <dl className="gm-cp-hero__stats">
          <div>
            <span className="gm-cp-ico gm-cp-ico--blue"><ClipboardList size={18} aria-hidden="true" /></span>
            <dd>{num(data?.totals.requests)}</dd>
            <dt>{t('So‘rovlar')}</dt>
            <Link to="/mijoz/buyurtmalar">{t('Batafsil')} <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          <div>
            <span className="gm-cp-ico gm-cp-ico--green"><Package size={18} aria-hidden="true" /></span>
            <dd>{num(data?.totals.orders)}</dd>
            <dt>{t('Buyurtmalar')}</dt>
            <Link to="/mijoz/buyurtmalar">{t('Batafsil')} <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          <div>
            <span className="gm-cp-ico gm-cp-ico--purple"><Users size={18} aria-hidden="true" /></span>
            <dd>{num(data?.totals.masters)}</dd>
            <dt>{t('Birga ishlagan ustalar')}</dt>
            <Link to={`${BASE}/ustalar`}>{t('Batafsil')} <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          <div className="gm-cp-hero__joined">
            <CalendarDays size={15} aria-hidden="true" />
            <dt>{t('A’zo bo‘lgan sana')}</dt>
            <dd>{formatDate(profile.createdAt)}</dd>
            <small>({relativeJoined(profile.createdAt)})</small>
          </div>
        </dl>
      </section>

      <div className="gm-cp-links">
        {links.map((item) => (
          <Link key={item.title} to={item.to} className="gm-cp-link">
            <span className={cx('gm-cp-ico gm-cp-ico--lg', `gm-cp-ico--${item.tone}`)}><item.icon size={22} aria-hidden="true" /></span>
            <span><b>{item.title}</b><small>{item.hint}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div className="gm-cp-grid">
        <Card icon={IdCard} title={t('Shaxsiy ma’lumotlar')} className="gm-cp-a">
          <dl className="gm-cp-info">
            <div><dt><UserRound size={16} aria-hidden="true" /> {t('Ism')}</dt><dd>{hasName || profile.firstName ? name : <span className="gm-cp-muted">{t('Kiritilmagan')}</span>}</dd></div>
            <div><dt><Phone size={16} aria-hidden="true" /> {t('Telefon raqam')}</dt><dd>{profile.phone ?? <span className="gm-cp-muted">{t('Kiritilmagan')}</span>}{profile.phone && <span className={cx('gm-cp-tag', profile.phoneVerified ? 'is-ok' : 'is-warn')}>{profile.phoneVerified ? t('Tasdiqlangan') : t('Tasdiqlanmagan')}</span>}</dd></div>
            <div><dt><Mail size={16} aria-hidden="true" /> {t('Email')}</dt><dd>{profile.email ?? <span className="gm-cp-muted">{t('Kiritilmagan')}</span>}</dd></div>
            <div><dt><Hash size={16} aria-hidden="true" /> {t('Akkaunt ID')}</dt><dd>#{profile.accountNumber}</dd></div>
            <div><dt><CalendarDays size={16} aria-hidden="true" /> {t('Ro‘yxatdan o‘tgan')}</dt><dd>{formatDate(profile.createdAt)}</dd></div>
            <div><dt><MapPin size={16} aria-hidden="true" /> {t('Shahar')}</dt><dd>{loading ? '…' : city ?? <span className="gm-cp-muted">{t('Kiritilmagan')}</span>}</dd></div>
          </dl>
          <div className={cx('gm-cp-progress', percent === 100 && 'is-full')}>
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <b>{percent === 100 ? t('Profilingiz 100% to‘ldirilgan') : t('Profilingiz {percent}% to‘ldirilgan', { percent })}</b>
              <small>{percent === 100 ? t('Bu sizga ko‘proq imkoniyatlar beradi') : t('Qolgan ma’lumotlarni to‘ldiring')}</small>
              <div className="gm-cp-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }} /></div>
            </div>
            <span>{percent}%</span>
          </div>
        </Card>

        <Card icon={Zap} title={t('Tezkor amallar')} className="gm-cp-b">
          <ul className="gm-cp-quick">
            {quick.map((item) => (
              <li key={item.title}>
                <Link to={item.to}>
                  <span className="gm-cp-ico gm-cp-ico--blue"><item.icon size={18} aria-hidden="true" /></span>
                  <span><b>{item.title}</b><small>{item.hint}{item.to.endsWith('saqlangan') && favorites.data ? ` · ${favorites.data.length}` : ''}</small></span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="gm-cp-c">
          <Card
            icon={BarChart3}
            title={t('Faoliyat statistikasi')}
            action={
              <label className="gm-cp-period">
                <span className="gm-visually-hidden">{t('Davr')}</span>
                <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label={t('Davr')}>
                  {PERIODS.map((item) => <option key={item} value={item}>{t('So‘nggi {count} kun', { count: item })}</option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            }
          >
            <div className="gm-cp-tiles">
              {tiles.map((tile) => (
                <div key={tile.key} className={cx('gm-cp-tile', `is-${tile.tone}`)}>
                  <span className="gm-cp-ico"><tile.icon size={17} aria-hidden="true" /></span>
                  <b>{num(tile.cur?.value)}</b>
                  <small>{tile.label}</small>
                  {tile.cur && <Trend value={tile.cur.value} previous={tile.cur.previous} inverse={tile.inverse} />}
                </div>
              ))}
            </div>
          </Card>

          <Card icon={ShieldCheck} title={t('Xavfsizlik')} action={<Link to="/sozlamalar/xavfsizlik" className="gm-cp-more">{t('Batafsil')} <ArrowRight size={13} aria-hidden="true" /></Link>}>
            <ul className="gm-cp-sec">
              <li>
                <span className="gm-cp-ico gm-cp-ico--blue"><KeyRound size={16} aria-hidden="true" /></span>
                <b>{t('Parol')}</b>
                <span className="gm-cp-sec__val">{me.data?.hasPassword === false ? t('O‘rnatilmagan') : '••••••••'}</span>
                <Link to="/sozlamalar/xavfsizlik">{me.data?.hasPassword === false ? t('O‘rnatish') : t('O‘zgartirish')}</Link>
              </li>
              <li>
                <span className="gm-cp-ico gm-cp-ico--blue"><Fingerprint size={16} aria-hidden="true" /></span>
                <b>{t('Ikki bosqichli autentifikatsiya')}</b>
                <span className={cx('gm-cp-tag', me.data?.twoFactorEnabled ? 'is-ok' : 'is-muted')}>{me.data?.twoFactorEnabled ? t('Yoqilgan') : t('Faollashtirilmagan')}</span>
                <Link to="/sozlamalar/xavfsizlik">{me.data?.twoFactorEnabled ? t('Boshqarish') : t('Yoqish')}</Link>
              </li>
            </ul>
          </Card>
        </div>

        <section className="gm-cp-logout gm-cp-d">
          <span className="gm-cp-ico gm-cp-ico--red"><LogOut size={18} aria-hidden="true" /></span>
          <span><b>{t('Tizimdan chiqish')}</b><small>{t('Hisobingizdan xavfsiz chiqish')}</small></span>
          <button type="button" onClick={() => setLogoutOpen(true)}>{t('Chiqish')}</button>
        </section>
      </div>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
