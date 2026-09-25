import { Badge } from '@/components/ui/Badge';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import type { OrderStatus as OrderStatusEnum } from '@/types/common';

export function BookingStatus({ status }: { status: OrderStatusEnum | null }) {
  if (!status) {
    return <Badge tone="neutral">Buyurtma yaratilmagan</Badge>;
  }
  return <OrderStatus status={status} />;
}
