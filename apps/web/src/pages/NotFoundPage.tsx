import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="gm-empty-state">
      <p className="gm-empty-state__title">404 — Sahifa topilmadi</p>
      <p className="gm-empty-state__description">Bunday sahifa mavjud emas yoki ko‘chirilgan.</p>
      <Link to="/">Bosh sahifaga qaytish</Link>
    </div>
  );
}
