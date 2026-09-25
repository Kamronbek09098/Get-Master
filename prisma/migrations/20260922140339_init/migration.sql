-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'MASTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'CHANGE_PHONE');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('ACTIVE', 'VERIFIED', 'EXPIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('TERMS', 'PRIVACY', 'PUBLIC_OFFER', 'PLATFORM_RULES', 'PAYMENT', 'REFUND', 'CANCELLATION', 'WARRANTY');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MasterVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'CORRECTION_REQUESTED', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BUSY', 'RESTRICTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED', 'BOOKED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PHOTO', 'VIDEO', 'VOICE', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchingStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('CANDIDATE', 'NOTIFIED', 'DECLINED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED', 'BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OrderActor" AS ENUM ('CUSTOMER', 'MASTER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WorkStage" AS ENUM ('BEFORE', 'DURING', 'AFTER');

-- CreateEnum
CREATE TYPE "AdditionalWorkStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('ORDER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CLICK', 'PAYME', 'UZUM', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('CUSTOMER_REQUEST', 'DISPUTE', 'CANCELLATION', 'WARRANTY', 'ADMIN_DECISION', 'PAYMENT_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'FLAGGED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('COMPLAINT', 'DISPUTE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'MESSAGE', 'WORK_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "UserActionType" AS ENUM ('WARNING', 'FINE', 'RESTRICTION', 'SUSPENSION', 'BAN');

-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('REQUESTS', 'OFFERS', 'BOOKING', 'CHAT', 'PAYMENTS', 'FULL_ACCOUNT');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('REFUND', 'PARTIAL_REFUND', 'CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'SMS', 'TELEGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationDocumentType" AS ENUM ('IDENTITY', 'CERTIFICATE', 'LICENSE', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" TEXT,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "avatar_url" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "phone_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" VARCHAR(255) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "familyId" UUID NOT NULL,
    "deviceId" VARCHAR(255) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "phone" VARCHAR(32) NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'ACTIVE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "ip_address" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "type" "PolicyType" NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_acceptances" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(64),

    CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(100),
    "address_line" TEXT NOT NULL,
    "city" VARCHAR(100),
    "district" VARCHAR(100),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "profession" VARCHAR(150),
    "experience_years" INTEGER,
    "status" "MasterStatus" NOT NULL DEFAULT 'INACTIVE',
    "verification" "MasterVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "work_radius_km" DECIMAL(8,2),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "response_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cancellation_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "completed_orders" INTEGER NOT NULL DEFAULT 0,
    "reliability_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "pause_reason" VARCHAR(255),
    "paused_until" TIMESTAMP(3),
    "serviceAreas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_services" (
    "id" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(14,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_portfolio" (
    "id" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_availability" (
    "id" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_until" TIMESTAMP(3),

    CONSTRAINT "master_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_verifications" (
    "id" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "document_type" "VerificationDocumentType" NOT NULL,
    "document_url" TEXT,
    "status" "MasterVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_requests" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "categoryId" UUID,
    "serviceId" UUID,
    "addressId" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "preferred_start_at" TIMESTAMP(3),
    "preferred_end_at" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "cancellation_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_attachments" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_classifications" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "categoryId" UUID,
    "serviceId" UUID,
    "confidence" DECIMAL(5,4),
    "possible_questions" JSONB,
    "result" JSONB,
    "is_accepted" BOOLEAN,
    "corrected_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matching_runs" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "status" "MatchingStatus" NOT NULL DEFAULT 'PENDING',
    "algorithm_version" VARCHAR(50),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matching_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matching_results" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "score" DECIMAL(8,4),
    "distance_km" DECIMAL(10,3),
    "reason" JSONB,
    "status" "MatchStatus" NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matching_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "estimated_minutes" INTEGER,
    "message" TEXT,
    "available_at" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "serviceId" UUID,
    "scheduled_start_at" TIMESTAMP(3),
    "scheduled_end_at" TIMESTAMP(3),
    "agreed_price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "location_snapshot" JSONB,
    "service_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'BOOKED',
    "final_price" DECIMAL(14,2),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "actorId" UUID,
    "actorType" "OrderActor" NOT NULL,
    "oldStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_proofs" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "stage" "WorkStage" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "media_type" "AttachmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_work_requests" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "evidence" JSONB,
    "status" "AdditionalWorkStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "additional_work_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "type" "ConversationType" NOT NULL,
    "orderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_payment_id" VARCHAR(255),
    "amount" DECIMAL(14,2) NOT NULL,
    "refunded_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "failure_reason" TEXT,
    "succeeded_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" "RefundReason" NOT NULL,
    "provider_refund_id" VARCHAR(255),
    "idempotency_key" VARCHAR(255),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "conditions" TEXT,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "warrantyId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" JSONB,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "masterProfileId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "flagged_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "targetUserId" UUID,
    "orderId" UUID,
    "type" "CaseType" NOT NULL,
    "source" VARCHAR(50),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'REPORTED',
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "storage_key" TEXT,
    "text" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_actions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "caseId" UUID,
    "policyId" UUID,
    "type" "UserActionType" NOT NULL,
    "restrictionType" "RestrictionType",
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "lifted_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" UUID NOT NULL,
    "caseId" UUID,
    "actionId" UUID,
    "userId" UUID NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensations" (
    "id" UUID NOT NULL,
    "caseId" UUID,
    "recipientId" UUID NOT NULL,
    "type" "CompensationType" NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "template" VARCHAR(150),
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "userId" UUID,
    "endpoint" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(255),
    "response_status" INTEGER,
    "responseBody" JSONB,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_name" VARCHAR(150) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "last_error" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(150) NOT NULL,
    "target_type" VARCHAR(100),
    "target_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip_address" VARCHAR(64),
    "device" TEXT,
    "request_id" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- CreateIndex
CREATE INDEX "device_sessions_userId_status_idx" ON "device_sessions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_userId_deviceId_key" ON "device_sessions"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_deviceId_status_idx" ON "refresh_tokens"("userId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_status_idx" ON "refresh_tokens"("userId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_deviceId_status_idx" ON "refresh_tokens"("familyId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_status_idx" ON "otp_codes"("phone", "purpose", "status");

-- CreateIndex
CREATE INDEX "otp_codes_ip_address_purpose_createdAt_idx" ON "otp_codes"("ip_address", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "policy_versions_type_status_idx" ON "policy_versions"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_type_version_key" ON "policy_versions"("type", "version");

-- CreateIndex
CREATE INDEX "policy_acceptances_policyId_idx" ON "policy_acceptances"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_acceptances_userId_policyId_key" ON "policy_acceptances"("userId", "policyId");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "master_profiles_userId_key" ON "master_profiles"("userId");

-- CreateIndex
CREATE INDEX "master_profiles_status_verification_idx" ON "master_profiles"("status", "verification");

-- CreateIndex
CREATE INDEX "master_profiles_latitude_longitude_idx" ON "master_profiles"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "master_services_serviceId_is_active_idx" ON "master_services"("serviceId", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "master_services_masterId_serviceId_key" ON "master_services"("masterId", "serviceId");

-- CreateIndex
CREATE INDEX "master_portfolio_masterId_idx" ON "master_portfolio"("masterId");

-- CreateIndex
CREATE INDEX "master_availability_masterId_day_of_week_idx" ON "master_availability"("masterId", "day_of_week");

-- CreateIndex
CREATE INDEX "master_verifications_masterId_status_idx" ON "master_verifications"("masterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_is_active_sort_order_idx" ON "service_categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_categoryId_is_active_idx" ON "services"("categoryId", "is_active");

-- CreateIndex
CREATE INDEX "problem_requests_customerId_status_createdAt_idx" ON "problem_requests"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "problem_requests_categoryId_status_idx" ON "problem_requests"("categoryId", "status");

-- CreateIndex
CREATE INDEX "problem_requests_serviceId_status_idx" ON "problem_requests"("serviceId", "status");

-- CreateIndex
CREATE INDEX "problem_requests_status_createdAt_idx" ON "problem_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "problem_attachments_requestId_idx" ON "problem_attachments"("requestId");

-- CreateIndex
CREATE INDEX "ai_classifications_requestId_createdAt_idx" ON "ai_classifications"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_classifications_categoryId_idx" ON "ai_classifications"("categoryId");

-- CreateIndex
CREATE INDEX "ai_classifications_serviceId_idx" ON "ai_classifications"("serviceId");

-- CreateIndex
CREATE INDEX "matching_runs_requestId_createdAt_idx" ON "matching_runs"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "matching_results_masterId_createdAt_idx" ON "matching_results"("masterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "matching_results_runId_masterId_key" ON "matching_results"("runId", "masterId");

-- CreateIndex
CREATE INDEX "offers_requestId_status_expires_at_idx" ON "offers"("requestId", "status", "expires_at");

-- CreateIndex
CREATE INDEX "offers_masterId_status_createdAt_idx" ON "offers"("masterId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "offers_requestId_masterId_key" ON "offers"("requestId", "masterId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_requestId_key" ON "bookings"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_offerId_key" ON "bookings"("offerId");

-- CreateIndex
CREATE INDEX "bookings_customerId_created_at_idx" ON "bookings"("customerId", "created_at");

-- CreateIndex
CREATE INDEX "bookings_masterId_created_at_idx" ON "bookings"("masterId", "created_at");

-- CreateIndex
CREATE INDEX "bookings_scheduled_start_at_idx" ON "bookings"("scheduled_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_bookingId_key" ON "orders"("bookingId");

-- CreateIndex
CREATE INDEX "orders_customerId_status_createdAt_idx" ON "orders"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_masterId_status_createdAt_idx" ON "orders"("masterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "work_proofs_orderId_stage_idx" ON "work_proofs"("orderId", "stage");

-- CreateIndex
CREATE INDEX "work_proofs_uploadedById_idx" ON "work_proofs"("uploadedById");

-- CreateIndex
CREATE INDEX "additional_work_requests_orderId_status_idx" ON "additional_work_requests"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_orderId_key" ON "conversations"("orderId");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_orderId_status_idx" ON "payments"("orderId", "status");

-- CreateIndex
CREATE INDEX "payments_customerId_createdAt_idx" ON "payments"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_paymentId_status_idx" ON "refunds"("paymentId", "status");

-- CreateIndex
CREATE INDEX "payment_webhook_events_provider_processed_at_idx" ON "payment_webhook_events"("provider", "processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_orderId_key" ON "warranties"("orderId");

-- CreateIndex
CREATE INDEX "warranties_masterId_status_idx" ON "warranties"("masterId", "status");

-- CreateIndex
CREATE INDEX "warranties_expires_at_status_idx" ON "warranties"("expires_at", "status");

-- CreateIndex
CREATE INDEX "warranty_claims_warrantyId_status_idx" ON "warranty_claims"("warrantyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderId_key" ON "reviews"("orderId");

-- CreateIndex
CREATE INDEX "reviews_masterProfileId_status_createdAt_idx" ON "reviews"("masterProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "cases_openedById_createdAt_idx" ON "cases"("openedById", "createdAt");

-- CreateIndex
CREATE INDEX "cases_targetUserId_status_idx" ON "cases"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "cases_orderId_status_idx" ON "cases"("orderId", "status");

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("caseId");

-- CreateIndex
CREATE INDEX "user_actions_userId_type_expires_at_idx" ON "user_actions"("userId", "type", "expires_at");

-- CreateIndex
CREATE INDEX "user_actions_caseId_idx" ON "user_actions"("caseId");

-- CreateIndex
CREATE INDEX "user_actions_policyId_idx" ON "user_actions"("policyId");

-- CreateIndex
CREATE INDEX "appeals_userId_status_createdAt_idx" ON "appeals"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "appeals_caseId_idx" ON "appeals"("caseId");

-- CreateIndex
CREATE INDEX "appeals_actionId_idx" ON "appeals"("actionId");

-- CreateIndex
CREATE INDEX "compensations_caseId_idx" ON "compensations"("caseId");

-- CreateIndex
CREATE INDEX "compensations_recipientId_idx" ON "compensations"("recipientId");

-- CreateIndex
CREATE INDEX "notifications_userId_status_createdAt_idx" ON "notifications"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_channel_status_idx" ON "notifications"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_userId_endpoint_idx" ON "idempotency_keys"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_createdAt_idx" ON "audit_logs"("target_type", "target_id", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_profiles" ADD CONSTRAINT "master_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_services" ADD CONSTRAINT "master_services_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_services" ADD CONSTRAINT "master_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_portfolio" ADD CONSTRAINT "master_portfolio_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_availability" ADD CONSTRAINT "master_availability_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_verifications" ADD CONSTRAINT "master_verifications_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_verifications" ADD CONSTRAINT "master_verifications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_requests" ADD CONSTRAINT "problem_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_requests" ADD CONSTRAINT "problem_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_requests" ADD CONSTRAINT "problem_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_requests" ADD CONSTRAINT "problem_requests_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_attachments" ADD CONSTRAINT "problem_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "problem_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "problem_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "problem_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_results" ADD CONSTRAINT "matching_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "matching_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_results" ADD CONSTRAINT "matching_results_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "problem_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "problem_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_proofs" ADD CONSTRAINT "work_proofs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_proofs" ADD CONSTRAINT "work_proofs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_work_requests" ADD CONSTRAINT "additional_work_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_work_requests" ADD CONSTRAINT "additional_work_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_masterProfileId_fkey" FOREIGN KEY ("masterProfileId") REFERENCES "master_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "user_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fundament hardening (§25): monetary/rating invariants — application checks do not replace DB invariants
ALTER TABLE "offers" ADD CONSTRAINT "offers_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_agreed_price_nonnegative" CHECK ("agreed_price" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_final_price_nonnegative" CHECK ("final_price" IS NULL OR "final_price" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_nonnegative" CHECK ("amount" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_amount_bounded" CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "amount");
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_nonnegative" CHECK ("amount" >= 0);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "additional_work_requests" ADD CONSTRAINT "additional_work_requests_amount_nonnegative" CHECK ("amount" >= 0);

-- Fundament hardening (§3.2, §25): master double-booking must be impossible at the DB layer,
-- never rely on an application-level pre-check alone. btree_gist lets an exclusion constraint
-- combine an equality comparison (masterId) with a range-overlap comparison (the booking's
-- scheduled window) in one index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_master_time_no_overlap"
  EXCLUDE USING gist (
    "masterId" WITH =,
    tsrange("scheduled_start_at", "scheduled_end_at", '[)') WITH &&
  )
  WHERE ("scheduled_start_at" IS NOT NULL AND "scheduled_end_at" IS NOT NULL);
