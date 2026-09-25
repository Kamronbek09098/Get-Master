import { Input } from '@/components/ui/Input';
import type { RangeInputs } from '../range';

export function DateRangeFilter({ value, onChange }: { value: RangeInputs; onChange: (next: RangeInputs) => void }) {
  return (
    <div className="gm-toolbar">
      <Input label="Boshlanish sanasi" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      <Input label="Tugash sanasi" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
    </div>
  );
}
