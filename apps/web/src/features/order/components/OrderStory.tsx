import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Camera } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMediaSignedUrl } from '@/features/media/hooks/useMedia';
import { prefersReducedMotion } from '@/lib/motion/tokens';
import type { OrderDetailsData, WorkProof } from '../types';
import './OrderStory.css';
import { t } from '@/i18n';

function StoryImage({ assetId, alt, className }: { assetId: string; alt: string; className?: string }) {
  const url = useMediaSignedUrl(assetId, 'medium', true);
  if (url.isLoading) return <Skeleton className={className ?? 'gm-story__img'} />;
  if (url.isError || !url.data) return <div className={`${className ?? 'gm-story__img'} gm-story__img--missing`}>{t('Rasm yuklanmadi')}</div>;
  return <img className={className ?? 'gm-story__img'} src={url.data.url} alt={alt} loading="lazy" decoding="async" />;
}

/** «Oldin / keyin» taqqoslash: sudrab yoki klaviatura (← →) bilan boshqariladi. */
function BeforeAfter({ before, after }: { before: string; after: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(50);
  const dragging = useRef(false);

  function setFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setValue(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  }

  return (
    <div
      ref={ref}
      className="gm-ba"
      style={{ ['--pos' as string]: `${value}%` }}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event);
      }}
      onPointerMove={(event) => dragging.current && setFromPointer(event)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <StoryImage assetId={after} alt={t('Ishdan keyingi natija')} className="gm-ba__img" />
      <div className="gm-ba__before">
        <StoryImage assetId={before} alt={t('Ishdan oldingi holat')} className="gm-ba__img" />
      </div>
      <span className="gm-ba__tag gm-ba__tag--before">{t('Oldin')}</span>
      <span className="gm-ba__tag gm-ba__tag--after">{t('Keyin')}</span>
      <span className="gm-ba__handle" aria-hidden="true" />
      <input className="gm-ba__range" type="range" min={0} max={100} value={Math.round(value)} onChange={(event) => setValue(Number(event.target.value))} aria-label={t('Oldin va keyin rasmlarini taqqoslash')} />
    </div>
  );
}

function Chapter({ label, title, children }: { label: string; title?: string; children?: ReactNode }) {
  return (
    <article className="gm-story__chapter" data-chapter>
      <p className="gm-story__label">{label}</p>
      {title && <h3>{title}</h3>}
      {children}
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="gm-story__empty">
      <Camera size={16} aria-hidden="true" /> {text}
    </p>
  );
}

function Gallery({ items, alt }: { items: WorkProof[]; alt: string }) {
  return (
    <ul className="gm-story__gallery">
      {items.map((proof) => proof.mediaAssetId && (
        <li key={proof.id}>
          <StoryImage assetId={proof.mediaAssetId} alt={alt} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Ish tafsilotlari: muammo → ish oldidan → jarayon → natija (holat bosqichlari esa yuqoridagi chiziqda).
 * Skroll qilinganda boblar birin-ketin ochiladi, chapdagi chiziq skroll bilan to‘ladi.
 * Hamma ma’lumot mavjud buyurtma/ish-isbotlaridan olinadi (backend o‘zgarmaydi).
 */
export function OrderStory({ data, proofs, loading }: { data: OrderDetailsData; proofs: WorkProof[] | undefined; loading: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const list = (proofs ?? []).filter((proof) => proof.mediaAssetId);
  const before = list.filter((proof) => proof.stage === 'BEFORE');
  const during = list.filter((proof) => proof.stage === 'DURING');
  const after = list.filter((proof) => proof.stage === 'AFTER');
  const started = ['ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED', 'DISPUTED'].includes(data.status);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'));
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      chapters.forEach((chapter) => chapter.classList.add('is-in'));
      root.style.setProperty('--p', '1');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-in')),
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );
    chapters.forEach((chapter) => io.observe(chapter));
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.6 - rect.top) / Math.max(1, rect.height)));
      root.style.setProperty('--p', p.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [list.length, data.status]);

  // Muammo tavsifi har doim ko‘rinadi; suratlar bo‘limlari usta yetib kelgach (bekor qilinganda — yo‘q).
  const showPhotos = started && data.status !== 'CANCELLED';
  const problem = data.request?.description;
  if (!showPhotos && !problem) return null;

  return (
    <section ref={rootRef} className="gm-story" aria-label={showPhotos ? t('Muammo va ish suratlari') : t('Muammo tavsifi')}>
      <header className="gm-story__head">
        <h2>{showPhotos ? t('Muammo va ish suratlari') : t('Muammo tavsifi')}</h2>
      </header>

      {problem && (
        <Chapter label={t('Muammo')}>
          <p className="gm-story__problem">{problem}</p>
        </Chapter>
      )}

      {showPhotos && (
        <>
          <Chapter label={t('Ishdan oldin')} title={t('Dastlabki holat')}>
            {loading ? <Skeleton className="gm-story__img" /> : before.length ? <Gallery items={before} alt={t('Ishdan oldingi holat')} /> : <Empty text={t('Usta ishni boshlashdan oldin suratga oladi — bu yerda ko‘rinadi.')} />}
          </Chapter>

          {(during.length > 0 || data.status === 'IN_PROGRESS') && (
            <Chapter label={t('Jarayon')} title={t('Ish bajarilmoqda')}>
              {during.length ? <Gallery items={during} alt={t('Ish jarayoni')} /> : <Empty text={t('Jarayon suratlari paydo bo‘lganda shu yerda ko‘rinadi.')} />}
            </Chapter>
          )}

          <Chapter label={t('Natija')} title={t('Ishdan keyin')}>
            {loading ? (
              <Skeleton className="gm-story__img" />
            ) : before[0]?.mediaAssetId && after[0]?.mediaAssetId ? (
              <>
                <BeforeAfter before={before[0].mediaAssetId} after={after[0].mediaAssetId} />
                <p className="gm-story__hint">{t('Chiziqni suring: oldin va keyin.')}</p>
              </>
            ) : after.length ? (
              <Gallery items={after} alt={t('Ishdan keyingi natija')} />
            ) : (
              <Empty text={t('Ish tugagach natija surati shu yerda paydo bo‘ladi.')} />
            )}
          </Chapter>

        </>
      )}
    </section>
  );
}
