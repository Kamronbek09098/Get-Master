export type Role = 'CUSTOMER' | 'MASTER' | 'ADMIN';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'DELETED';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MATCHING'
  | 'OFFERS_RECEIVED'
  | 'BOOKED'
  | 'CANCELLED'
  | 'EXPIRED';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MATCHING'
  | 'OFFERS_RECEIVED'
  | 'BOOKED'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'WAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DISPUTED';

export type OrderActor = 'CUSTOMER' | 'MASTER' | 'ADMIN' | 'SYSTEM';

export type WorkStage = 'BEFORE' | 'DURING' | 'AFTER';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentProvider = 'CASH' | 'CLICK' | 'PAYME' | 'UZUM' | 'OTHER';

export type RefundReason =
  | 'CUSTOMER_REQUEST'
  | 'DISPUTE'
  | 'CANCELLATION'
  | 'WARRANTY'
  | 'ADMIN_DECISION'
  | 'PAYMENT_ERROR'
  | 'OTHER';

export type MediaAssetKind =
  | 'PROBLEM_ATTACHMENT'
  | 'WORK_PROOF'
  | 'MESSAGE_ATTACHMENT'
  | 'MASTER_VERIFICATION_DOCUMENT'
  | 'MASTER_PORTFOLIO'
  | 'SUBSCRIPTION_RECEIPT';

export type MediaAssetStatus =
  | 'UPLOADING'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'PROCESSING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export type AttachmentType = 'PHOTO' | 'VIDEO' | 'VOICE' | 'DOCUMENT' | 'OTHER';

export type LinkTargetType = 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile' | 'Subscription';
