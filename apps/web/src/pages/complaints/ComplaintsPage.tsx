import { ComplaintForm } from '@/features/complaint/components/ComplaintForm';
import { ComplaintList } from '@/features/complaint/components/ComplaintList';

export function ComplaintsPage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Shikoyatlar</h1>
          <p className="gm-page-lead">Shikoyat yuboring va ko‘rib chiqilishini kuzating.</p>
        </div>
      </div>
      <ComplaintList />
      <section className="gm-detail-section">
        <h2>Yangi shikoyat</h2>
        <ComplaintForm />
      </section>
    </div>
  );
}
