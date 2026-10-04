import type { CSSProperties } from 'react';
import {
  Armchair,
  Camera,
  Clock,
  Droplets,
  Hammer,
  MapPin,
  Mic,
  Navigation,
  Send,
  Snowflake,
  Sparkles,
  Type,
  Video,
  WashingMachine,
  Wrench,
  Zap,
} from 'lucide-react';
import { t } from '@/i18n';
import { BeforeAfter, CountUp, FilmFrame, JobTrack, Monogram, Stars, ToolsArt, Verified, type TrackStep } from './parts';

export interface SceneVisualProps {
  active: boolean;
}

const i = (n: number) => ({ '--i': n }) as CSSProperties;

const PROBLEMS = [
  { icon: Droplets, label: t('Kran oqyapti') },
  { icon: Zap, label: t('Rozetka uchqun chiqaryapti') },
  { icon: Snowflake, label: t('Konditsioner ishlamayapti') },
  { icon: WashingMachine, label: t('Kir mashina to‘xtadi') },
  { icon: Wrench, label: t('Quvur yorildi') },
  { icon: Armchair, label: t('Mebel buzildi') },
  { icon: Hammer, label: t('Devor ta’miri') },
  { icon: Sparkles, label: t('Uyni tozalash') },
];

export function Problem({ active }: SceneVisualProps) {
  return (
    <div className="gm-j-problem">
      <div className="gm-j-card gm-j-problem__film">
        <FilmFrame active={active} base="/media/stories/santexnika/film" poster="/media/stories/santexnika/film.jpg" />
        <span className="gm-j-alert">
          <i aria-hidden="true" /> {t('Quvur oqyapti')}
        </span>
      </div>
      <ul className="gm-j-chips">
        {PROBLEMS.map((item, n) => (
          <li key={item.label} style={i(n)}>
            <item.icon size={16} strokeWidth={2} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Describe() {
  const methods = [
    { icon: Type, label: t('Matn') },
    { icon: Camera, label: t('Foto') },
    { icon: Video, label: t('Video') },
    { icon: Mic, label: t('Ovoz') },
  ];
  return (
    <div className="gm-j-card gm-j-describe">
      <p className="gm-j-eyebrow">{t('Muammoingizni ayting')}</p>
      <div className="gm-j-methods">
        {methods.map((m, n) => (
          <span key={m.label} style={i(n)}>
            <m.icon size={16} aria-hidden="true" /> {m.label}
          </span>
        ))}
      </div>
      <p className="gm-j-bubble">{t('Oshxonadagi kran tagidan suv oqyapti, devor ho‘l bo‘lib qoldi.')}</p>
      <div className="gm-j-attach">
        <span className="gm-j-thumb" style={i(0)}>
          <Camera size={18} aria-hidden="true" />
          <small>2 {t('foto')}</small>
        </span>
        <span className="gm-j-thumb" style={i(1)}>
          <Video size={18} aria-hidden="true" />
          <small>0:12</small>
        </span>
        <span className="gm-j-thumb gm-j-thumb--wide" style={i(2)}>
          <Mic size={18} aria-hidden="true" />
          <span className="gm-j-wave" aria-hidden="true">
            {Array.from({ length: 14 }, (_, n) => (
              <b key={n} style={{ ...i(n), '--h': `${10 + ((n * 7) % 5) * 5}px` } as CSSProperties} />
            ))}
          </span>
        </span>
      </div>
      <div className="gm-j-send">
        <span className="gm-j-send__idle">
          <Send size={16} aria-hidden="true" /> {t('So‘rov yuborish')}
        </span>
        <span className="gm-j-send__done">{t('Yuborildi')} ✓</span>
      </div>
    </div>
  );
}

const MATCHES = [
  { name: 'Aziz R.', rating: 4.9, dist: '1,2 km' },
  { name: 'Bekzod T.', rating: 4.8, dist: '2,0 km' },
  { name: 'Sardor M.', rating: 4.8, dist: '2,7 km' },
];

export function Match() {
  return (
    <div className="gm-j-match">
      <div className="gm-j-radar" aria-hidden="true">
        <span className="gm-j-radar__ring" />
        <span className="gm-j-radar__ring" />
        <span className="gm-j-radar__ring" />
        <span className="gm-j-radar__sweep" />
        <span className="gm-j-radar__me">
          <MapPin size={16} />
        </span>
        {[
          [24, 30],
          [70, 24],
          [62, 72],
          [28, 66],
          [80, 54],
        ].map(([x, y], n) => (
          <span key={n} className="gm-j-radar__dot" style={{ left: `${x}%`, top: `${y}%`, ...i(n) }} />
        ))}
      </div>
      <div className="gm-j-list">
        <p className="gm-j-eyebrow">
          <b>
            <CountUp to={5} />
          </b>{' '}
          {t('usta topildi')} · {t('namuna')}
        </p>
        {MATCHES.map((m, n) => (
          <div key={m.name} className="gm-j-row" style={i(n)}>
            <Monogram name={m.name} tone={n} />
            <span className="gm-j-row__main">
              <strong>{m.name}</strong>
              <Verified />
            </span>
            <span className="gm-j-row__meta">
              <Stars value={m.rating} />
              <small>{m.dist}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const OFFERS = [
  { name: 'Aziz R.', price: 180, rating: 4.9, jobs: 412, time: '15', best: false },
  { name: 'Bekzod T.', price: 150, rating: 4.8, jobs: 268, time: '25', best: true },
  { name: 'Sardor M.', price: 210, rating: 4.8, jobs: 190, time: '10', best: false },
];

export function Compare() {
  return (
    <div className="gm-j-compare">
      {OFFERS.map((o, n) => (
        <article key={o.name} className={o.best ? 'gm-j-offer is-best' : 'gm-j-offer'} style={i(n)}>
          {o.best && <span className="gm-j-offer__flag">{t('Eng yaxshi')}</span>}
          <header>
            <Monogram name={o.name} tone={n} />
            <strong>{o.name}</strong>
          </header>
          <p className="gm-j-offer__price">
            {o.price} 000 <small>{t('so‘m')}</small>
          </p>
          <dl>
            <div>
              <dt>{t('Reyting')}</dt>
              <dd>
                <Stars value={o.rating} />
              </dd>
            </div>
            <div>
              <dt>{t('Ishlar')}</dt>
              <dd>{o.jobs}</dd>
            </div>
            <div>
              <dt>{t('Javob')}</dt>
              <dd>
                {o.time} {t('daq')}
              </dd>
            </div>
          </dl>
          <Verified />
        </article>
      ))}
    </div>
  );
}

export function Profile() {
  return (
    <div className="gm-j-card gm-j-profile">
      <div className="gm-j-profile__top">
        <Monogram name="Bekzod" tone={1} />
        <div>
          <h4>Bekzod T.</h4>
          <Verified />
        </div>
        <Stars value={4.8} />
      </div>
      <div className="gm-j-stats3">
        <span>
          <b>
            <CountUp to={8} />
          </b>
          <small>{t('yil tajriba')}</small>
        </span>
        <span>
          <b>
            <CountUp to={268} />
          </b>
          <small>{t('bajarilgan ish')}</small>
        </span>
        <span>
          <b>
            <CountUp to={97} suffix="%" />
          </b>
          <small>{t('javob berish')}</small>
        </span>
      </div>
      <div className="gm-j-tags">
        <span>{t('Santexnika')}</span>
        <span>{t('Quvur ta’miri')}</span>
        <span>{t('Isitish')}</span>
      </div>
      <div className="gm-j-portfolio">
        {[0, 1, 2].map((n) => (
          <span key={n} style={i(n)} aria-hidden="true" />
        ))}
      </div>
      <p className="gm-j-avail">
        <Clock size={14} aria-hidden="true" /> {t('Bugun 14:00 dan bo‘sh')}
      </p>
    </div>
  );
}

const CUSTOMER_STEPS: TrackStep[] = [
  { label: t('So‘rov'), note: t('Yuborildi') },
  { label: t('Qabul qilindi'), note: t('Usta tasdiqladi') },
  { label: t('Yo‘lda'), note: t('12 daqiqada yetib keladi') },
  { label: t('Yetib keldi'), note: t('Eshik oldida') },
  { label: t('Ishlayapti'), note: t('Ish jarayoni') },
  { label: t('Yakunlandi'), note: t('Tasdiqlash kutilmoqda') },
];
const MASTER_STEPS = CUSTOMER_STEPS.slice(1);

export function JobCustomer() {
  return <JobTrack steps={CUSTOMER_STEPS} eta={`ETA 12 ${t('daq')}`} />;
}
export function JobMaster() {
  return <JobTrack steps={MASTER_STEPS} eta={t('Mijoz kuzatmoqda')} />;
}

export function Work({ active }: SceneVisualProps) {
  return (
    <div className="gm-j-card gm-j-work">
      <FilmFrame active={active} base="/media/master/work">
        <ToolsArt />
      </FilmFrame>
      <div className="gm-j-work__tags">
        {[t('Asboblar'), t('Materiallar'), t('Haqiqiy ish')].map((label, n) => (
          <span key={label} style={i(n)}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Request() {
  const rows: Array<[string, string]> = [
    [t('Xizmat'), t('Santexnika')],
    [t('Muammo'), t('Kran tagidan suv oqyapti')],
    [t('Joy'), t('Chilonzor · 2,0 km')],
    [t('Mijoz'), 'Dilnoza A.'],
    [t('Qulay vaqt'), t('Bugun, 14:00–18:00')],
  ];
  return (
    <div className="gm-j-card gm-j-request">
      <p className="gm-j-new">
        <i aria-hidden="true" /> {t('YANGI ISH SO‘ROVI')}
      </p>
      <dl>
        {rows.map(([k, v], n) => (
          <div key={k} style={i(n)}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="gm-j-request__actions">
        <span className="gm-j-btn gm-j-btn--primary">{t('Taklif berish')}</span>
        <span className="gm-j-btn">{t('O‘tkazib yuborish')}</span>
      </div>
    </div>
  );
}

export function Offer() {
  const fields: Array<[string, string]> = [
    [t('Narx'), `150 000 ${t('so‘m')}`],
    [t('Kelish vaqti'), `25 ${t('daqiqa')}`],
    [t('Xabar'), t('Salom! Hozir yo‘ldaman, asboblar tayyor.')],
  ];
  return (
    <div className="gm-j-card gm-j-offerform">
      <ol>
        {fields.map(([k, v], n) => (
          <li key={k} style={i(n)}>
            <span>{String(n + 1).padStart(2, '0')}</span>
            <div>
              <small>{k}</small>
              <strong>{v}</strong>
            </div>
          </li>
        ))}
      </ol>
      <div className="gm-j-send">
        <span className="gm-j-send__idle">
          <Send size={16} aria-hidden="true" /> {t('Taklifni yuborish')}
        </span>
        <span className="gm-j-send__done">{t('Yuborildi')} ✓</span>
      </div>
    </div>
  );
}

export function Accepted() {
  return (
    <div className="gm-j-accepted">
      <span className="gm-j-burst" aria-hidden="true" />
      <span className="gm-j-burst gm-j-burst--2" aria-hidden="true" />
      <p className="gm-j-accepted__big">{t('SIZ ISHNI OLDINGIZ')}</p>
      <div className="gm-j-card gm-j-accepted__sum">
        <span>
          <Navigation size={14} aria-hidden="true" /> {t('Chilonzor, 12-kvartal')}
        </span>
        <span>
          <Clock size={14} aria-hidden="true" /> {t('Bugun 14:30')}
        </span>
        <strong>150 000 {t('so‘m')}</strong>
      </div>
    </div>
  );
}

export function Reputation() {
  return (
    <div className="gm-j-card gm-j-rep">
      <div className="gm-j-stats3">
        <span>
          <b>
            <CountUp to={4.9} decimals={1} />
          </b>
          <small>{t('reyting')}</small>
        </span>
        <span>
          <b>
            <CountUp to={268} />
          </b>
          <small>{t('bajarilgan ish')}</small>
        </span>
        <span>
          <b>
            <CountUp to={97} suffix="%" />
          </b>
          <small>{t('javob berish')}</small>
        </span>
      </div>
      <Verified label={t('Shaxsi tasdiqlangan')} />
      <figure style={i(0)}>
        <Stars value={5} />
        <blockquote>{t('Tez keldi, toza ishladi, narx aytilgandek.')}</blockquote>
      </figure>
      <figure style={i(1)}>
        <Stars value={5} />
        <blockquote>{t('Muammoni bir soatda hal qildi.')}</blockquote>
      </figure>
      <p className="gm-j-caption">{t('Namuna ko‘rinish')}</p>
    </div>
  );
}

export function Earnings() {
  const bars = [38, 52, 44, 68, 60, 82, 96];
  return (
    <div className="gm-j-card gm-j-earn">
      <div className="gm-j-stats3">
        <span>
          <b>
            <CountUp to={24} />
          </b>
          <small>{t('bajarilgan')}</small>
        </span>
        <span>
          <b>
            <CountUp to={3} />
          </b>
          <small>{t('joriy')}</small>
        </span>
        <span>
          <b>
            <CountUp to={7450} />
          </b>
          <small>000 {t('so‘m')}</small>
        </span>
      </div>
      <div className="gm-j-bars" aria-hidden="true">
        {bars.map((h, n) => (
          <span key={n} style={{ ...i(n), '--h': `${h}%` } as CSSProperties} />
        ))}
      </div>
      <p className="gm-j-caption">{t('Haftalik tushum · namuna')}</p>
    </div>
  );
}

export function ResultCustomer() {
  return <BeforeAfter caption={t('Chapga-o‘ngga suring: oldin ↔ keyin')} />;
}
export function ResultMaster() {
  return <BeforeAfter caption={t('Portfolioga avtomatik qo‘shiladi')} />;
}
