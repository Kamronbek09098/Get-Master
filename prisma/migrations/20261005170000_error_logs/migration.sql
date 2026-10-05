-- CreateTable
CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "status" INTEGER,
    "code" VARCHAR(100),
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "method" VARCHAR(10),
    "path" VARCHAR(500),
    "page_url" VARCHAR(500),
    "request_id" VARCHAR(100),
    "user_id" UUID,
    "user_role" VARCHAR(20),
    "panel" VARCHAR(20),
    "platform" VARCHAR(20),
    "user_agent" VARCHAR(400),
    "ip_address" VARCHAR(64),
    "app_version" VARCHAR(40),
    "context" JSONB,
    "fingerprint" VARCHAR(64) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");
CREATE INDEX "error_logs_fingerprint_createdAt_idx" ON "error_logs"("fingerprint", "createdAt");
CREATE INDEX "error_logs_user_id_createdAt_idx" ON "error_logs"("user_id", "createdAt");
CREATE INDEX "error_logs_source_severity_createdAt_idx" ON "error_logs"("source", "severity", "createdAt");
CREATE INDEX "error_logs_resolved_at_idx" ON "error_logs"("resolved_at");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
