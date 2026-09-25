import { DisputeList } from '@/features/dispute/components/DisputeList';

export function DisputesPage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Nizolarim</h1>
          <p className="gm-page-lead">Buyurtmalar bo‘yicha ochilgan nizolar.</p>
        </div>
      </div>
      <DisputeList />
    </div>
  );
}
