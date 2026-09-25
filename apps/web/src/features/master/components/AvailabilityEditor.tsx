import { useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import {
  useAvailability,
  useRemoveAvailability,
  useSaveAvailability,
  useToggleAvailability,
} from '../hooks/useMasterManage';

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const DAY_OPTIONS = DAYS.map((label, index) => ({ value: String(index), label }));

export function AvailabilityEditor() {
  const availability = useAvailability();
  const save = useSaveAvailability();
  const toggle = useToggleAvailability();
  const remove = useRemoveAvailability();
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate({ dayOfWeek: Number(dayOfWeek), startTime, endTime, isAvailable: true });
  }

  const items = [...(availability.data ?? [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  return (
    <div className="gm-form">
      <form className="gm-inline-form" onSubmit={handleSubmit}>
        <Select label="Kun" options={DAY_OPTIONS} value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} />
        <Input label="Boshlanishi" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label="Tugashi" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <Button type="submit" loading={save.isPending}>
          Qo‘shish
        </Button>
      </form>
      {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
      {(toggle.isError || remove.isError) && <Alert tone="danger">{getErrorMessage(toggle.error ?? remove.error)}</Alert>}

      {availability.isLoading && <PageLoader label="Jadval yuklanmoqda…" />}
      {availability.isError && <Alert tone="danger">{getErrorMessage(availability.error)}</Alert>}
      {availability.data && items.length === 0 && (
        <EmptyState title="Ish jadvali bo‘sh" description="Mijozlar band qila olishi uchun ish vaqtlarini qo‘shing." />
      )}
      <div className="gm-list">
        {items.map((slot) => (
          <div key={slot.id} className="gm-card">
            <div className="gm-card__header">
              <h3>
                {DAYS[slot.dayOfWeek]}: {slot.startTime} – {slot.endTime}
              </h3>
              <Badge tone={slot.isAvailable ? 'success' : 'neutral'}>{slot.isAvailable ? 'Faol' : 'O‘chirilgan'}</Badge>
            </div>
            <div className="gm-action-row">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggle.mutate({ id: slot.id, isAvailable: !slot.isAvailable })}
              >
                {slot.isAvailable ? 'Vaqtincha o‘chirish' : 'Yoqish'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(slot.id)}>
                O‘chirish
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
