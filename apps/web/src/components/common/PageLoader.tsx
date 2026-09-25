import { Spinner } from '@/components/ui/Spinner';
import './PageLoader.css';

export function PageLoader({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="gm-page-loader" role="status" aria-live="polite">
      <Spinner size="md" />
      <span>{label}</span>
    </div>
  );
}
