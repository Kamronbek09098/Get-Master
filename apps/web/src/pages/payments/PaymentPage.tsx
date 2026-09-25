import { useParams, Link } from 'react-router-dom';
import { PaymentForm } from '@/features/payment/components/PaymentForm';

export function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  if (!orderId) return null;

  return (
    <div>
      <h1>To‘lov</h1>
      <PaymentForm orderId={orderId} />
      <p style={{ marginTop: 'var(--gm-space-4)' }}>
        <Link to={`/mijozlar/buyurtmalar/${orderId}`}>← Buyurtmaga qaytish</Link>
      </p>
    </div>
  );
}
