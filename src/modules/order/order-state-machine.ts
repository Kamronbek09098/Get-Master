import { OrderActor, OrderStatus } from '@prisma/client';
import { InvalidTransitionException } from '../../common/exceptions/business.exception';

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  actorTypes: OrderActor[];
}

const TRANSITIONS: Transition[] = [
  { from: 'BOOKED', to: 'CONFIRMED', actorTypes: ['MASTER'] },
  { from: 'BOOKED', to: 'CANCELLED', actorTypes: ['CUSTOMER', 'MASTER', 'ADMIN'] },
  { from: 'BOOKED', to: 'EXPIRED', actorTypes: ['SYSTEM'] },
  { from: 'CONFIRMED', to: 'ON_THE_WAY', actorTypes: ['MASTER'] },
  { from: 'CONFIRMED', to: 'CANCELLED', actorTypes: ['CUSTOMER', 'MASTER', 'ADMIN'] },
  { from: 'ON_THE_WAY', to: 'ARRIVED', actorTypes: ['MASTER'] },
  { from: 'ARRIVED', to: 'IN_PROGRESS', actorTypes: ['MASTER'] },
  { from: 'IN_PROGRESS', to: 'WAITING_CONFIRMATION', actorTypes: ['MASTER'] },
  { from: 'IN_PROGRESS', to: 'DISPUTED', actorTypes: ['CUSTOMER', 'MASTER'] },
  { from: 'WAITING_CONFIRMATION', to: 'COMPLETED', actorTypes: ['CUSTOMER', 'SYSTEM'] },
  { from: 'WAITING_CONFIRMATION', to: 'DISPUTED', actorTypes: ['CUSTOMER', 'MASTER'] },
  { from: 'DISPUTED', to: 'COMPLETED', actorTypes: ['ADMIN'] },
  { from: 'DISPUTED', to: 'CANCELLED', actorTypes: ['ADMIN'] },
];

export function assertTransition(from: OrderStatus, to: OrderStatus, actorType: OrderActor): void {
  const allowed = TRANSITIONS.some((t) => t.from === from && t.to === to && t.actorTypes.includes(actorType));
  if (!allowed) throw new InvalidTransitionException(from, to);
}
