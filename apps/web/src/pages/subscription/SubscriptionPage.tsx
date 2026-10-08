import { env } from '@/lib/env';
import { SubscriptionView } from '@/features/subscription/SubscriptionView';
import { useAuthStore } from '@/store/auth.store';

/** Obuna sahifasi: mijoz panelida «Plus», usta panelida «Pro». */
export function SubscriptionPage() {
  const preferred = useAuthStore((state) => state.preferredRole);
  const role = env.appRole ?? preferred;
  return <SubscriptionView audience={role === 'MASTER' ? 'MASTER' : 'CUSTOMER'} />;
}
