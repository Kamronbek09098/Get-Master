import { Spinner } from '@/components/ui/Spinner';
import './LoadingScreen.css';

export function LoadingScreen() {
  return (
    <div className="gm-loading-screen" role="status" aria-live="polite">
      <Spinner size="lg" />
      <p>Yuklanmoqda…</p>
    </div>
  );
}
