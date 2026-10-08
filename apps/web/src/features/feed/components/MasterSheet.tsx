import { useState } from 'react';
import { Award, BadgeCheck, CalendarCheck, Clock, Eye, MapPin, MessageSquareText, Play, Star, Wrench } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ReviewList } from '@/features/review/components/ReviewList';
import { useMaster } from '@/features/master/hooks/useMaster';
import { cx, formatMoney } from '@/lib/utils';
import { t } from '@/i18n';
import { compact, initials } from '../format';
import { useFeed, useToggleFollow } from '../hooks';
import type { FeedPost } from '../types';
import { Sheet } from './Sheet';

type Tab = 'works' | 'services' | 'reviews';

/** Usta profili: portret, ko‘rsatkichlar, ishlar, xizmatlar, sharhlar va asosiy buyurtma tugmasi. */
export function MasterSheet({ post, canOrder, onClose, onOrder, onOpenPost }: { post: FeedPost | null; canOrder: boolean; onClose: () => void; onOrder: (post: FeedPost) => void; onOpenPost: (post: FeedPost) => void }) {
  const [tab, setTab] = useState<Tab>('works');
  const master = post?.master;
  const details = useMaster(master ? String(master.accountNumber) : '');
  const works = useFeed({ tab: 'foryou', category: '', q: '', master: master?.id });
  const follow = useToggleFollow();
  const items = works.data?.pages.flatMap((page) => page.items) ?? [];
  const data = details.data;
  const experience = master?.experienceYears ?? data?.experienceYears;
  const place = data?.regionName ?? data?.placeAddress;

  return (
    <Sheet open={!!post} onClose={onClose} title={master?.name ?? ''} subtitle={master?.profession ?? undefined} tall label={t('Usta profili')}>
      {post && master && (
        <div className="gf-profile">
          <header className="gf-profile__head">
            <span className="gf-profile__ava" aria-hidden="true">{initials(master.name)}</span>
            <div>
              <p className="gf-profile__name">
                {master.name}
                {master.verified && <BadgeCheck size={18} className="gf-verified" aria-label={t('Tasdiqlangan usta')} />}
                {master.isPro && <span className="gf-pro">Pro</span>}
              </p>
              <p className="gf-profile__meta">
                <Wrench size={13} aria-hidden="true" /> {master.profession ?? post.category?.name ?? t('Usta')}
                {place && (
                  <>
                    {' · '}
                    <MapPin size={13} aria-hidden="true" /> {place}
                  </>
                )}
              </p>
            </div>
          </header>

          <dl className="gf-stats">
            <div>
              <dt><Star size={14} aria-hidden="true" /> {t('Reyting')}</dt>
              <dd>{master.ratingCount > 0 ? master.ratingAvg.toFixed(1) : '—'}<small>{master.ratingCount > 0 ? ` (${master.ratingCount})` : ''}</small></dd>
            </div>
            <div>
              <dt><Award size={14} aria-hidden="true" /> {t('Bajarilgan ish')}</dt>
              <dd>{master.completedOrders}</dd>
            </div>
            <div>
              <dt><Clock size={14} aria-hidden="true" /> {t('Tajriba')}</dt>
              <dd>{experience ? t('{years} yil', { years: experience }) : '—'}</dd>
            </div>
          </dl>

          {data?.bio && <p className="gf-profile__bio">{data.bio}</p>}
          {data?.nextAvailable && (
            <p className="gf-profile__avail">
              <i aria-hidden="true" />
              {data.nextAvailable.now ? t('Hozir bo‘sh') : data.nextAvailable.dayOffset === 0 ? t('Bugun {time} dan bo‘sh', { time: data.nextAvailable.time }) : t('Ertaga {time} dan bo‘sh', { time: data.nextAvailable.time })}
            </p>
          )}

          <div className="gf-profile__actions">
            {canOrder && (
              <button type="button" className="gf-cta gf-cta--flat" onClick={() => onOrder(post)}>
                <CalendarCheck size={19} aria-hidden="true" /> {t('Xizmat buyurtma qilish')}
              </button>
            )}
            {!post.viewer.own && (
              <button type="button" className={cx('gf-btn gf-btn--lg', post.viewer.following && 'gf-btn--done')} aria-pressed={post.viewer.following} disabled={follow.isPending} onClick={() => follow.mutate({ masterId: master.id, on: !post.viewer.following })}>
                {post.viewer.following ? t('Kuzatilmoqda') : t('Kuzatish')}
              </button>
            )}
          </div>

          <div className="gf-tabs" role="tablist" aria-label={t('Usta ma’lumotlari')}>
            {([['works', t('Ishlar')], ['services', t('Xizmatlar')], ['reviews', t('Sharhlar')]] as Array<[Tab, string]>).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={cx(tab === id && 'is-on')} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'works' && (
            <>
              {works.isLoading && (
                <div className="gf-grid" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="gf-skel gf-skel--tile" />
                  ))}
                </div>
              )}
              {works.isError && <p className="gf-note gf-note--err" role="alert">{t('Ishlarni yuklab bo‘lmadi.')}</p>}
              {!works.isLoading && !works.isError && items.length === 0 && <EmptyState title={t('Hali ish joylanmagan')} description={t('Usta tez orada o‘z ishlarini shu yerda ko‘rsatadi.')} />}
              <ul className="gf-grid">
                {items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="gf-tile" onClick={() => onOpenPost(item)} aria-label={item.caption ?? t('Ishni ochish')}>
                      {(item.media.coverUrl ?? item.media.afterUrl) ? <img src={(item.media.coverUrl ?? item.media.afterUrl) as string} alt="" loading="lazy" draggable={false} /> : <span className="gf-tile__blank" />}
                      {item.kind === 'VIDEO' && <Play size={16} fill="currentColor" className="gf-tile__play" aria-hidden="true" />}
                      {item.kind === 'BEFORE_AFTER' && <span className="gf-tile__ba">{t('Oldin/Keyin')}</span>}
                      <span className="gf-tile__views"><Eye size={12} aria-hidden="true" /> {compact(item.counts.views)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'services' && (
            <ul className="gf-services">
              {details.isLoading && <li className="gf-skel gf-skel--row" aria-hidden="true" />}
              {(data?.services ?? []).map((item) => (
                <li key={item.serviceId}>
                  <span>{item.service.name}</span>
                  <strong>
                    {t('dan')} {formatMoney(item.basePrice)}
                  </strong>
                </li>
              ))}
              {!details.isLoading && (data?.services ?? []).length === 0 && <li className="gf-note">{t('Xizmatlar hali ko‘rsatilmagan.')}</li>}
            </ul>
          )}

          {tab === 'reviews' && (
            <div className="gf-reviews">
              <ReviewList masterId={master.id} />
              <p className="gf-note"><MessageSquareText size={14} aria-hidden="true" /> {t('Sharhlar faqat bajarilgan buyurtmalardan keyin qoldiriladi.')}</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
