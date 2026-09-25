import { AvailabilityEditor } from '@/features/master/components/AvailabilityEditor';

export function MasterSchedulePage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Ish jadvali</h1>
          <p className="gm-page-lead">Mijozlar band qila oladigan ish vaqtlaringiz.</p>
        </div>
      </div>
      <AvailabilityEditor />
    </div>
  );
}
