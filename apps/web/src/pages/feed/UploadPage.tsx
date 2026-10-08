import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, Check, CircleCheck, Film, Image as ImageIcon, Images, Loader2, Plus, RotateCw, X } from 'lucide-react';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-messages';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { useMyServices } from '@/features/service/hooks/useServices';
import { mediaService } from '@/features/media/services/media.service';
import { prepareUpload } from '@/features/media/prepare-image';
import { useCreatePost } from '@/features/feed/hooks';
import type { FeedKind } from '@/features/feed/types';
import { clock } from '@/features/feed/format';
import { t } from '@/i18n';
import '@/features/feed/feed.css';
import '@/features/feed/upload.css';

const MAX_VIDEO_MB = 40;
const MAX_SECONDS = 90;
const STEPS = () => [t('Tur'), t('Fayl'), t('Tafsilot'), t('Joylash')];
const KINDS: Array<{ id: FeedKind; icon: typeof Film; title: () => string; text: () => string }> = [
  { id: 'VIDEO', icon: Film, title: () => t('Video'), text: () => t('Bajarilgan ish yoki ish jarayoni') },
  { id: 'BEFORE_AFTER', icon: Images, title: () => t('Oldin / Keyin'), text: () => t('Ikki rasm bilan natijani ko‘rsating') },
  { id: 'PHOTO', icon: ImageIcon, title: () => t('Rasm'), text: () => t('Tayyor ish natijasi') },
];

interface Picked {
  file: File;
  url: string;
}
type Phase = 'idle' | 'working' | 'error' | 'done';
interface Progress {
  label: string;
  state: 'wait' | 'run' | 'ok';
}

const waitReady = async (id: string): Promise<void> => {
  for (let i = 0; i < 80; i += 1) {
    const asset = await mediaService.getStatus(id);
    if (asset.status === 'READY') return;
    if (asset.status === 'REJECTED' || asset.status === 'FAILED') throw new Error(asset.rejectionReason ?? t('Fayl tekshiruvdan o‘tmadi'));
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  throw new Error(t('Fayl tayyorlanishi uzoq davom etdi. Qayta urinib ko‘ring.'));
};

/** Ish joylash: tur → fayl (muqova bilan) → tafsilot → joylash. Usta uchun eng sodda oqim. */
export function UploadPage() {
  const navigate = useNavigate();
  const base = env.appRole === 'MASTER' ? '/usta' : '/mijoz';
  const profile = useMyMasterProfile();
  const categories = useServiceCategories();
  const myServices = useMyServices();
  const create = useCreatePost();

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<FeedKind>('VIDEO');
  const [video, setVideo] = useState<Picked | null>(null);
  const [duration, setDuration] = useState(0);
  const [cover, setCover] = useState<Picked | null>(null);
  const [before, setBefore] = useState<Picked | null>(null);
  const [after, setAfter] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState('');
  const [caption, setCaption] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<Progress[]>([]);
  const uploaded = useRef<Record<string, string>>({});
  const videoEl = useRef<HTMLVideoElement>(null);
  const [scrub, setScrub] = useState(0);

  useEffect(() => () => [video, cover, before, after].forEach((item) => item && URL.revokeObjectURL(item.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const services = useMemo(() => (myServices.data ?? []).filter((item) => item.isActive), [myServices.data]);
  const category = (categories.data ?? []).find((item) => item.id === categoryId);
  const serviceChoices = category ? services.filter((item) => category.services.some((service) => service.id === item.serviceId)) : services;
  const ready = kind === 'VIDEO' ? !!video : kind === 'BEFORE_AFTER' ? !!before && !!after : !!after;

  const pick = (file: File | undefined, setter: (value: Picked | null) => void, previous: Picked | null) => {
    if (!file) return;
    if (previous) URL.revokeObjectURL(previous.url);
    setter({ file, url: URL.createObjectURL(file) });
  };

  function onVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setFileError('');
    if (!file) return;
    if (!/^video\/(mp4|quicktime|webm)$/.test(file.type)) return setFileError(t('Faqat MP4, MOV yoki WebM video yuklanadi.'));
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return setFileError(t('Video {mb} MB dan oshmasligi kerak. Qisqaroq yoki past sifatli video tanlang.', { mb: MAX_VIDEO_MB }));
    if (cover) URL.revokeObjectURL(cover.url);
    setCover(null);
    setScrub(0);
    pick(file, setVideo, video);
  }
  async function onImage(event: ChangeEvent<HTMLInputElement>, setter: (value: Picked | null) => void, previous: Picked | null) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setFileError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) return setFileError(t('Faqat rasm tanlang.'));
    pick(await prepareUpload(file), setter, previous);
  }

  function onMeta() {
    const el = videoEl.current;
    if (!el) return;
    setDuration(Math.round(el.duration));
    if (el.duration > MAX_SECONDS) {
      setFileError(t('Video {s} soniyadan uzun bo‘lmasin. Qisqaroq video tanlang.', { s: MAX_SECONDS }));
      setVideo(null);
    }
  }
  function onScrub(value: number) {
    setScrub(value);
    const el = videoEl.current;
    if (el && el.duration > 0) el.currentTime = (value / 100) * el.duration;
  }
  function captureCover() {
    const el = videoEl.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / el.videoWidth);
    canvas.width = Math.round(el.videoWidth * scale);
    canvas.height = Math.round(el.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (cover) URL.revokeObjectURL(cover.url);
        setCover({ file: new File([blob], 'cover.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.86,
    );
  }

  function addTag(raw: string) {
    const value = raw.trim().replace(/^#/, '').toLowerCase().slice(0, 30);
    if (value && !tags.includes(value) && tags.length < 8) setTags([...tags, value]);
    setTagText('');
  }
  const onTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      addTag(tagText);
    } else if (event.key === 'Backspace' && !tagText) setTags(tags.slice(0, -1));
  };

  async function publish() {
    const masterId = profile.data?.id;
    if (!masterId) return;
    setPhase('working');
    setError('');
    const plan: Array<{ key: string; label: string; file: Picked | null }> = [
      { key: 'video', label: t('Video yuklanmoqda'), file: kind === 'VIDEO' ? video : null },
      { key: 'cover', label: t('Muqova yuklanmoqda'), file: kind === 'VIDEO' ? cover : null },
      { key: 'before', label: t('«Oldin» rasmi yuklanmoqda'), file: kind === 'BEFORE_AFTER' ? before : null },
      { key: 'after', label: kind === 'BEFORE_AFTER' ? t('«Keyin» rasmi yuklanmoqda') : t('Rasm yuklanmoqda'), file: kind === 'VIDEO' ? null : after },
    ].filter((item) => item.file);
    const state: Progress[] = [...plan.map((item) => ({ label: item.label, state: 'wait' as const })), { label: t('Lentaga joylanmoqda'), state: 'wait' }];
    setProgress(state);
    const mark = (index: number, value: Progress['state']) => setProgress((list) => list.map((item, i) => (i === index ? { ...item, state: value } : item)));
    try {
      for (const [index, item] of plan.entries()) {
        mark(index, 'run');
        if (!uploaded.current[item.key]) {
          const asset = await mediaService.upload(item.file!.file, 'MASTER_PORTFOLIO', 'MasterProfile', masterId);
          await waitReady(asset.id);
          uploaded.current[item.key] = asset.id;
        }
        mark(index, 'ok');
      }
      mark(plan.length, 'run');
      await create.mutateAsync({
        kind,
        caption: caption.trim() || undefined,
        tags,
        categoryId: categoryId || undefined,
        serviceId: serviceId || undefined,
        videoAssetId: uploaded.current.video,
        coverAssetId: uploaded.current.cover,
        beforeAssetId: uploaded.current.before,
        afterAssetId: uploaded.current.after,
        durationSec: kind === 'VIDEO' && duration > 0 ? duration : undefined,
      });
      mark(plan.length, 'ok');
      setPhase('done');
    } catch (cause) {
      setPhase('error');
      setError(cause instanceof Error && cause.message ? cause.message : getErrorMessage(cause));
    }
  }

  if (profile.isLoading) return <div className="gu"><div className="gf-skel gf-skel--stage" style={{ position: 'static', height: 320 }} /></div>;
  if (!profile.data) {
    return (
      <div className="gu">
        <div className="gf-empty">
          <span className="gf-empty__ico"><AlertTriangle size={30} /></span>
          <strong>{t('Avval usta profilini yarating')}</strong>
          <p>{t('Ish joylash uchun usta profili kerak.')}</p>
          <button type="button" className="gf-btn gf-btn--lg" onClick={() => navigate(`${base}/profil`)}>{t('Profilga o‘tish')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gu gf-overlay-less">
      <div className="gf gu__frame" style={{ position: 'static' }}>
        <header className="gu__head">
          <button type="button" className="gf-iconbtn gf-iconbtn--glass" onClick={() => (step > 0 && phase === 'idle' ? setStep(step - 1) : navigate(`${base}/lenta`))} aria-label={t('Orqaga')}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <h1>{t('Ish joylash')}</h1>
        </header>
        <ol className="gu__steps" aria-label={t('Bosqichlar')}>
          {STEPS().map((label, index) => (
            <li key={label} className={cx(index === step && 'is-on', index < step && 'is-done')} aria-current={index === step ? 'step' : undefined}>
              <span>{index < step ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {phase === 'idle' && step === 0 && (
          <section className="gu__body">
            <h2>{t('Nimani joylaysiz?')}</h2>
            <div className="gu__kinds" role="radiogroup" aria-label={t('Tur')}>
              {KINDS.map((item) => (
                <button key={item.id} type="button" role="radio" aria-checked={kind === item.id} className={cx('gu__kind', kind === item.id && 'is-on')} onClick={() => setKind(item.id)}>
                  <item.icon size={26} aria-hidden="true" />
                  <strong>{item.title()}</strong>
                  <small>{item.text()}</small>
                </button>
              ))}
            </div>
            <button type="button" className="gf-cta" onClick={() => setStep(1)}>{t('Davom etish')}</button>
          </section>
        )}

        {phase === 'idle' && step === 1 && (
          <section className="gu__body">
            {kind === 'VIDEO' && (
              <>
                <h2>{t('Videoni tanlang')}</h2>
                {!video ? (
                  <label className="gu__drop">
                    <Film size={34} aria-hidden="true" />
                    <strong>{t('Video tanlash')}</strong>
                    <small>{t('MP4, MOV yoki WebM · {s} soniyagacha · {mb} MB gacha', { s: MAX_SECONDS, mb: MAX_VIDEO_MB })}</small>
                    <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={onVideo} />
                  </label>
                ) : (
                  <>
                    <div className="gu__video">
                      <video ref={videoEl} src={video.url} playsInline muted controls={false} preload="metadata" onLoadedMetadata={onMeta} />
                      <span className="gf-chip">{clock(duration)}</span>
                    </div>
                    <div className="gu__cover">
                      <label htmlFor="gu-scrub">{t('Muqova kadrini tanlang')}</label>
                      <input id="gu-scrub" type="range" min={0} max={100} step={0.5} value={scrub} onChange={(event) => onScrub(Number(event.target.value))} />
                      <div className="gu__cover-row">
                        <button type="button" className="gf-btn" onClick={captureCover}>
                          <Camera size={16} aria-hidden="true" /> {t('Muqova qilish')}
                        </button>
                        {cover ? <img src={cover.url} alt={t('Tanlangan muqova')} /> : <small>{t('Tanlamasangiz, video boshi ishlatiladi.')}</small>}
                      </div>
                    </div>
                    <label className="gu__change">
                      {t('Boshqa video tanlash')}
                      <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={onVideo} />
                    </label>
                  </>
                )}
              </>
            )}
            {kind === 'BEFORE_AFTER' && (
              <>
                <h2>{t('Ikki rasm tanlang')}</h2>
                <div className="gu__pair">
                  {([['before', t('Oldin'), before, setBefore], ['after', t('Keyin'), after, setAfter]] as const).map(([key, label, value, setter]) => (
                    <label key={key} className={cx('gu__slot', value && 'has')}>
                      {value ? <img src={value.url} alt={label} /> : <><Plus size={26} aria-hidden="true" /><strong>{label}</strong></>}
                      {value && <span className="gu__slot-tag">{label}</span>}
                      <input type="file" accept="image/*" onChange={(event) => void onImage(event, setter, value)} />
                    </label>
                  ))}
                </div>
              </>
            )}
            {kind === 'PHOTO' && (
              <>
                <h2>{t('Rasmni tanlang')}</h2>
                <label className={cx('gu__drop', after && 'has')}>
                  {after ? <img src={after.url} alt={t('Tanlangan rasm')} /> : <><ImageIcon size={34} aria-hidden="true" /><strong>{t('Rasm tanlash')}</strong></>}
                  <input type="file" accept="image/*" onChange={(event) => void onImage(event, setAfter, after)} />
                </label>
              </>
            )}
            {fileError && <p className="gf-note gf-note--err" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {fileError}</p>}
            <button type="button" className="gf-cta" disabled={!ready} onClick={() => setStep(2)}>{t('Davom etish')}</button>
          </section>
        )}

        {phase === 'idle' && step === 2 && (
          <section className="gu__body">
            <h2>{t('Ish haqida')}</h2>
            <div className="gu__field">
              <label htmlFor="gu-caption">{t('Tavsif')}</label>
              <textarea id="gu-caption" rows={4} maxLength={1000} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={t('Nima qildingiz va natija qanday bo‘ldi?')} />
              <small>{caption.length}/1000</small>
            </div>
            <div className="gu__field">
              <span id="gu-cat">{t('Kasb yo‘nalishi')}</span>
              <div className="gf-chips" role="group" aria-labelledby="gu-cat">
                {(categories.data ?? []).map((item) => (
                  <button key={item.id} type="button" className={cx('gf-chipbtn', categoryId === item.id && 'is-on')} aria-pressed={categoryId === item.id} onClick={() => { setCategoryId(categoryId === item.id ? '' : item.id); setServiceId(''); }}>
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
            {serviceChoices.length > 0 && (
              <div className="gu__field">
                <span id="gu-svc">{t('Xizmat turi')}</span>
                <div className="gf-chips" role="group" aria-labelledby="gu-svc">
                  {serviceChoices.map((item) => (
                    <button key={item.id} type="button" className={cx('gf-chipbtn', serviceId === item.serviceId && 'is-on')} aria-pressed={serviceId === item.serviceId} onClick={() => setServiceId(serviceId === item.serviceId ? '' : item.serviceId)}>
                      {item.service.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="gu__field">
              <label htmlFor="gu-tag">{t('Teglar')}</label>
              <div className="gu__tags">
                {tags.map((tag) => (
                  <span key={tag} className="gf-tag">
                    #{tag}
                    <button type="button" onClick={() => setTags(tags.filter((item) => item !== tag))} aria-label={t('{tag} tegini olib tashlash', { tag })}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input id="gu-tag" value={tagText} onChange={(event) => setTagText(event.target.value)} onKeyDown={onTagKey} onBlur={() => addTag(tagText)} placeholder={tags.length ? '' : t('masalan: kran, oshxona')} maxLength={30} />
              </div>
              <small>{t('Enter bilan qo‘shing · ko‘pi bilan 8 ta')}</small>
            </div>
            <button type="button" className="gf-cta" onClick={() => setStep(3)}>{t('Davom etish')}</button>
          </section>
        )}

        {phase === 'idle' && step === 3 && (
          <section className="gu__body">
            <h2>{t('Tekshirib, joylang')}</h2>
            <div className="gu__summary">
              <div className="gu__thumb">
                {(kind === 'VIDEO' ? (cover?.url ?? null) : (after?.url ?? null)) ? <img src={(kind === 'VIDEO' ? cover?.url : after?.url) as string} alt="" /> : kind === 'VIDEO' && video ? <video src={video.url} muted playsInline preload="metadata" /> : null}
              </div>
              <div>
                <strong>{KINDS.find((item) => item.id === kind)?.title()}</strong>
                <p>{caption.trim() || t('Tavsif yozilmagan')}</p>
                <small>{[category?.name, tags.map((tag) => `#${tag}`).join(' ')].filter(Boolean).join(' · ') || t('Yo‘nalish tanlanmagan')}</small>
              </div>
            </div>
            <p className="gf-note">{t('Joylangach ish darhol lentada ko‘rinadi. Uni istalgan vaqtda o‘chirishingiz mumkin.')}</p>
            <button type="button" className="gf-cta" onClick={() => void publish()}>{t('Joylash')}</button>
          </section>
        )}

        {phase !== 'idle' && (
          <section className="gu__body gu__progress" aria-live="polite">
            {phase === 'done' ? (
              <div className="gf-empty gf-empty--sm">
                <span className="gf-empty__ico" style={{ color: 'var(--gf-ok)' }}><CircleCheck size={32} /></span>
                <strong>{t('Ish lentaga joylandi')}</strong>
                <p>{t('Endi mijozlar uni ko‘ra oladi va sizni tanlashi mumkin.')}</p>
                <div className="gf-empty__actions">
                  <button type="button" className="gf-btn gf-btn--lg" onClick={() => navigate(`${base}/lenta`)}>{t('Lentaga o‘tish')}</button>
                </div>
              </div>
            ) : (
              <>
                <h2>{phase === 'error' ? t('Joylab bo‘lmadi') : t('Joylanmoqda…')}</h2>
                <ul className="gu__prog">
                  {progress.map((item) => (
                    <li key={item.label} className={`is-${item.state}`}>
                      {item.state === 'ok' ? <Check size={18} aria-hidden="true" /> : item.state === 'run' ? <Loader2 size={18} className="gu__spin" aria-hidden="true" /> : <span className="gu__dot" aria-hidden="true" />}
                      {item.label}
                    </li>
                  ))}
                </ul>
                {phase === 'error' && (
                  <>
                    <p className="gf-note gf-note--err" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>
                    <div className="gu__retry">
                      <button type="button" className="gf-cta" onClick={() => void publish()}><RotateCw size={18} aria-hidden="true" /> {t('Qayta urinish')}</button>
                      <button type="button" className="gf-btn gf-btn--lg" onClick={() => setPhase('idle')}>{t('Tahrirlash')}</button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
