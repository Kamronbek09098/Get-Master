import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Camera, Check, Home, ListChecks, MapPin, Plus, Store } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ServiceChooser } from '@/features/service/components/ServiceChooser';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { useAddresses } from '@/features/customer/hooks/useCustomer';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { useCreateRequest } from '../hooks/useRequests';
import type { ServiceMode } from '@/features/service/types';
import type { ProblemRequest } from '../types';
import './RequestForm.css';
import { t } from '@/i18n';

const TITLE_MAX = 255;
const DESCRIPTION_MIN_GOOD = 40;

const schema = z
  .object({
    serviceId: z.string().uuid(t('Xizmat turini tanlang')),
    serviceMode: z.enum(['AT_CUSTOMER', 'AT_MASTER']),
    addressId: z.string(),
    title: z.string().trim().min(1, t('Sarlavhani kiriting')).max(TITLE_MAX),
    description: z.string().trim().min(1, t('Muammoni tavsiflab bering')),
  })
  // Usta mijozga kelsa — manzil majburiy; mijoz ustaning oldiga borsa — shart emas.
  .refine((values) => values.serviceMode === 'AT_MASTER' || values.addressId.length > 0, { path: ['addressId'], message: t('Manzilni tanlang yoki qo‘shing') });
type FormValues = z.infer<typeof schema>;

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="gm-reqform__section">
      <header className="gm-reqform__head">
        <span className="gm-reqform__num">{step}</span>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function RequestForm({ onCreated }: { onCreated: (request: ProblemRequest) => void }) {
  const createRequest = useCreateRequest();
  const addresses = useAddresses();
  const categories = useServiceCategories();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { serviceId: '', serviceMode: 'AT_CUSTOMER', addressId: '', title: '', description: '' } });

  const [serviceId, title, description, addressId, serviceMode] = watch(['serviceId', 'title', 'description', 'addressId', 'serviceMode']);
  const addressList = useMemo(() => addresses.data ?? [], [addresses.data]);

  useEffect(() => {
    if (addressId || addressList.length === 0) return;
    const preferred = addressList.find((address) => address.isDefault) ?? addressList[0];
    if (preferred) setValue('addressId', preferred.id);
  }, [addressList, addressId, setValue]);

  // Tanlangan xizmat kategoriyasi qaysi rejimlarni qo‘llab-quvvatlaydi (mijoz manzilida / ustaning joyida).
  const modes = useMemo<ServiceMode[]>(() => {
    const category = (categories.data ?? []).find((item) => (item.services ?? []).some((service) => service.id === serviceId));
    return category?.modes && category.modes.length > 0 ? category.modes : ['AT_CUSTOMER'];
  }, [categories.data, serviceId]);
  useEffect(() => {
    if (!modes.includes(serviceMode)) setValue('serviceMode', modes[0]!);
  }, [modes, serviceMode, setValue]);
  const atMaster = serviceMode === 'AT_MASTER';

  const serviceName = useMemo(
    () => (categories.data ?? []).flatMap((category) => category.services ?? []).find((service) => service.id === serviceId)?.name,
    [categories.data, serviceId],
  );

  const checklist = [
    { label: t('Xizmat turi tanlandi'), done: !!serviceId },
    { label: t('Sarlavha yozildi'), done: title.trim().length > 0 },
    { label: t('Muammo tavsiflandi'), done: description.trim().length > 0 },
    ...(atMaster ? [] : [{ label: t('Manzil tanlandi'), done: !!addressId }]),
  ];
  const remaining = checklist.filter((item) => !item.done).length;
  const descriptionLength = description.trim().length;

  function onSubmit(values: FormValues) {
    createRequest.mutate({ ...values, addressId: values.addressId || undefined }, { onSuccess: onCreated });
  }

  return (
    <div className="gm-create-layout gm-reqform">
      <form className="gm-reqform__form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {createRequest.isError && <Alert tone="danger">{getErrorMessage(createRequest.error)}</Alert>}

        <Section step={1} title={t('Qanday xizmat kerak?')} hint={t('Ustalar shu xizmat bo‘yicha qidiriladi.')}>
          <Controller
            control={control}
            name="serviceId"
            render={({ field }) => (
              <ServiceChooser label={t('Xizmat turi')} required value={field.value} onChange={field.onChange} error={errors.serviceId?.message} />
            )}
          />
        </Section>

        {serviceId && (
          <Section step={2} title={t('Xizmat qayerda bo‘ladi?')} hint={modes.length > 1 ? t('Ustani uyingizga chaqirishingiz yoki o‘zingiz ustaning oldiga borishingiz mumkin.') : atMaster ? t('Bu xizmat ustaning o‘z joyida ko‘rsatiladi: tanlangan usta manzilini ko‘rasiz.') : t('Usta siz ko‘rsatgan manzilga keladi.')}>
            <div className="gm-reqform__modes" role="radiogroup" aria-label={t('Xizmat qayerda bo‘ladi?')}>
              {modes.map((mode) => (
                <label key={mode} className={cx('gm-reqform__mode', serviceMode === mode && 'gm-reqform__mode--checked')}>
                  <input type="radio" className="gm-visually-hidden" checked={serviceMode === mode} disabled={modes.length === 1} onChange={() => setValue('serviceMode', mode)} />
                  {mode === 'AT_MASTER' ? <Store size={22} aria-hidden="true" /> : <Home size={22} aria-hidden="true" />}
                  <span>
                    <strong>{mode === 'AT_MASTER' ? t('Men ustaning oldiga boraman') : t('Usta menga keladi')}</strong>
                    <small>{mode === 'AT_MASTER' ? t('Sartaroshxona, ustaxona, avtoservis kabi joylarda') : t('Usta sizning manzilingizga keladi')}</small>
                  </span>
                  {serviceMode === mode && <Check size={16} className="gm-reqform__address-check" aria-hidden="true" />}
                </label>
              ))}
            </div>
          </Section>
        )}

        <Section step={serviceId ? 3 : 2} title={t('Muammoni tushuntiring')} hint={t('Qancha aniq yozsangiz, ustalar shuncha aniq narx taklif qiladi.')}>
          <Input
            label={t('Muammo sarlavhasi')}
            required
            maxLength={TITLE_MAX}
            placeholder={serviceName ? t('Masalan: {toLowerCase} kerak', { toLowerCase: serviceName.toLowerCase() }) : t('Masalan: Kran suv oqizyapti')}
            error={errors.title?.message}
            {...register('title')}
          />
          <Textarea
            label={t('Batafsil tavsif')}
            required
            rows={5}
            placeholder={t('Nima buzilgan? Qachondan beri? Avval nima qilib ko‘rdingiz?')}
            error={errors.description?.message}
            {...register('description')}
          />
          <p className={cx('gm-reqform__meter', descriptionLength >= DESCRIPTION_MIN_GOOD && 'gm-reqform__meter--good')} aria-live="polite">
            {descriptionLength === 0
              ? t('Kamida bir-ikki gap yozing')
              : descriptionLength < DESCRIPTION_MIN_GOOD
                ? t('Yana biroz batafsilroq yozing ({descriptionLength}/{DESCRIPTION_MIN_GOOD})', { descriptionLength, DESCRIPTION_MIN_GOOD })
                : t('Yaxshi tavsif — ustalar tushunadi')}
          </p>
        </Section>

        <Section step={serviceId ? 4 : 3} title={atMaster ? t('Sizning joylashuvingiz') : t('Usta qayerga borsin?')} hint={atMaster ? t('Ixtiyoriy — sizga yaqin ustalar birinchi ko‘rsatiladi.') : t('Majburiy — usta aniq shu manzilga keladi va yo‘l vaqtini hisoblab narx aytadi.')}>
          {addressList.length > 0 ? (
            <>
              <div className="gm-reqform__addresses" role="radiogroup" aria-label={t('Manzil')} aria-required="true" aria-invalid={!!errors.addressId}>
                {addressList.map((address) => (
                  <label key={address.id} className={cx('gm-reqform__address', addressId === address.id && 'gm-reqform__address--checked')}>
                    <input
                      type="radio"
                      value={address.id}
                      className="gm-visually-hidden"
                      checked={addressId === address.id}
                      onChange={() => setValue('addressId', address.id, { shouldValidate: true })}
                    />
                    <MapPin size={18} aria-hidden="true" />
                    <span>
                      <strong>{address.title || t('Manzil')}</strong>
                      <small>{address.addressLine}</small>
                    </span>
                    {addressId === address.id && <Check size={16} className="gm-reqform__address-check" aria-hidden="true" />}
                  </label>
                ))}
              </div>
              <Link to="/mijoz/manzillar" className="gm-reqform__add-address">
                <Plus size={16} aria-hidden="true" />{' '}{t('Yangi manzil qo‘shish')}</Link>
            </>
          ) : (
            <Link to="/mijoz/manzillar" className="gm-reqform__add-address">
              <Plus size={16} aria-hidden="true" />{' '}{t('Manzil qo‘shish')}</Link>
          )}
          {errors.addressId && !atMaster && (
            <p className="gm-reqform__error" role="alert">
              {addressList.length > 0 ? errors.addressId.message : t('So‘rov yuborish uchun avval manzil qo‘shing.')}
            </p>
          )}
        </Section>

        <div className="gm-reqform__submit">
          <Button type="submit" size="lg" loading={createRequest.isPending}>{t('Davom etish')}</Button>
          <span>{remaining > 0 ? t('Yana {remaining} ta maydon qoldi', { remaining }) : t('Hammasi tayyor. Keyingi bosqichda rasm qo‘shasiz.')}</span>
        </div>
      </form>

      <aside className="gm-reqform__aside" aria-label={t('Maslahatlar')}>
        <div className="gm-reqform__card">
          <h3>{t('Tayyorlik')}</h3>
          <ul className="gm-reqform__checklist">
            {checklist.map((item) => (
              <li key={item.label} className={cx(item.done && 'gm-reqform__checklist--done')}>
                <span aria-hidden="true">{item.done && <Check size={12} strokeWidth={3} />}</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="gm-tips">
          <h3>{t('Yaxshi so‘rov uchun')}</h3>
          <ul>
            <li>
              <ListChecks size={18} />
              <span>{t('Nima buzilganini va qachondan beri ekanini yozing.')}</span>
            </li>
            <li>
              <Camera size={18} />
              <span>{t('Keyingi bosqichda muammoning suratini biriktiring — ustalar aniqroq narx beradi.')}</span>
            </li>
            <li>
              <MapPin size={18} />
              <span>{t('Manzil majburiy: usta yo‘l vaqtini hisoblab, aniq narx aytadi.')}</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
