import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Camera, Check, ListChecks, MapPin, Plus } from 'lucide-react';
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
import type { ProblemRequest } from '../types';
import './RequestForm.css';

const TITLE_MAX = 255;
const DESCRIPTION_MIN_GOOD = 40;

const schema = z.object({
  serviceId: z.string().uuid('Xizmat turini tanlang'),
  addressId: z.string().optional(),
  title: z.string().trim().min(1, 'Sarlavhani kiriting').max(TITLE_MAX),
  description: z.string().trim().min(1, 'Muammoni tavsiflab bering'),
});
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
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { serviceId: '', addressId: '', title: '', description: '' } });

  const [serviceId, title, description, addressId] = watch(['serviceId', 'title', 'description', 'addressId']);
  const addressList = useMemo(() => addresses.data ?? [], [addresses.data]);

  useEffect(() => {
    if (addressId || addressList.length === 0) return;
    const preferred = addressList.find((address) => address.isDefault);
    if (preferred) setValue('addressId', preferred.id);
  }, [addressList, addressId, setValue]);

  const serviceName = useMemo(
    () => (categories.data ?? []).flatMap((category) => category.services ?? []).find((service) => service.id === serviceId)?.name,
    [categories.data, serviceId],
  );

  const checklist = [
    { label: 'Xizmat turi tanlandi', done: !!serviceId },
    { label: 'Sarlavha yozildi', done: title.trim().length > 0 },
    { label: 'Muammo tavsiflandi', done: description.trim().length > 0 },
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

        <Section step={1} title="Qanday xizmat kerak?" hint="Ustalar shu xizmat bo‘yicha qidiriladi.">
          <Controller
            control={control}
            name="serviceId"
            render={({ field }) => (
              <ServiceChooser label="Xizmat turi" required value={field.value} onChange={field.onChange} error={errors.serviceId?.message} />
            )}
          />
        </Section>

        <Section step={2} title="Muammoni tushuntiring" hint="Qancha aniq yozsangiz, ustalar shuncha aniq narx taklif qiladi.">
          <Input
            label="Muammo sarlavhasi"
            required
            maxLength={TITLE_MAX}
            placeholder={serviceName ? `Masalan: ${serviceName.toLowerCase()} kerak` : 'Masalan: Kran suv oqizyapti'}
            error={errors.title?.message}
            {...register('title')}
          />
          <Textarea
            label="Batafsil tavsif"
            required
            rows={5}
            placeholder="Nima buzilgan? Qachondan beri? Avval nima qilib ko‘rdingiz?"
            error={errors.description?.message}
            {...register('description')}
          />
          <p className={cx('gm-reqform__meter', descriptionLength >= DESCRIPTION_MIN_GOOD && 'gm-reqform__meter--good')} aria-live="polite">
            {descriptionLength === 0
              ? 'Kamida bir-ikki gap yozing'
              : descriptionLength < DESCRIPTION_MIN_GOOD
                ? `Yana biroz batafsilroq yozing (${descriptionLength}/${DESCRIPTION_MIN_GOOD})`
                : 'Yaxshi tavsif — ustalar tushunadi'}
          </p>
        </Section>

        <Section step={3} title="Usta qayerga borsin?" hint="Ixtiyoriy — keyinroq ham qo‘shishingiz mumkin.">
          {addressList.length > 0 ? (
            <div className="gm-reqform__addresses" role="radiogroup" aria-label="Manzil">
              <label className={cx('gm-reqform__address', !addressId && 'gm-reqform__address--checked')}>
                <input type="radio" value="" className="gm-visually-hidden" checked={!addressId} onChange={() => setValue('addressId', '')} />
                <MapPin size={18} aria-hidden="true" />
                <span>
                  <strong>Manzilsiz</strong>
                  <small>Keyinroq kelishaman</small>
                </span>
              </label>
              {addressList.map((address) => (
                <label key={address.id} className={cx('gm-reqform__address', addressId === address.id && 'gm-reqform__address--checked')}>
                  <input
                    type="radio"
                    value={address.id}
                    className="gm-visually-hidden"
                    checked={addressId === address.id}
                    onChange={() => setValue('addressId', address.id)}
                  />
                  <MapPin size={18} aria-hidden="true" />
                  <span>
                    <strong>{address.title || 'Manzil'}</strong>
                    <small>{address.addressLine}</small>
                  </span>
                  {addressId === address.id && <Check size={16} className="gm-reqform__address-check" aria-hidden="true" />}
                </label>
              ))}
            </div>
          ) : (
            <Link to="/mijozlar/manzillar" className="gm-reqform__add-address">
              <Plus size={16} aria-hidden="true" /> Manzil qo‘shish
            </Link>
          )}
        </Section>

        <div className="gm-reqform__submit">
          <Button type="submit" size="lg" loading={createRequest.isPending}>
            Davom etish
          </Button>
          <span>{remaining > 0 ? `Yana ${remaining} ta maydon qoldi` : 'Hammasi tayyor. Keyingi bosqichda rasm qo‘shasiz.'}</span>
        </div>
      </form>

      <aside className="gm-reqform__aside" aria-label="Maslahatlar">
        <div className="gm-reqform__card">
          <h3>Tayyorlik</h3>
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
          <h3>Yaxshi so‘rov uchun</h3>
          <ul>
            <li>
              <ListChecks size={18} />
              <span>Nima buzilganini va qachondan beri ekanini yozing.</span>
            </li>
            <li>
              <Camera size={18} />
              <span>Keyingi bosqichda muammoning suratini biriktiring — ustalar aniqroq narx beradi.</span>
            </li>
            <li>
              <MapPin size={18} />
              <span>Manzil qo‘shsangiz, usta yo‘l vaqtini hisoblab narx aytadi.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
