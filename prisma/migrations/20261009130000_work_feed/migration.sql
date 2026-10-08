-- Professional ish lentasi (Work Feed): postlar, layk, saqlash, izoh va kuzatish.
-- CreateEnum
CREATE TYPE "WorkPostKind" AS ENUM ('VIDEO', 'BEFORE_AFTER', 'PHOTO');

-- CreateEnum
CREATE TYPE "WorkPostStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "work_posts" (
    "id" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "kind" "WorkPostKind" NOT NULL,
    "status" "WorkPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "caption" VARCHAR(1000),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category_id" UUID,
    "service_id" UUID,
    "video_asset_id" UUID,
    "cover_asset_id" UUID,
    "before_asset_id" UUID,
    "after_asset_id" UUID,
    "duration_sec" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "save_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_post_likes" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_post_likes_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "work_post_saves" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_post_saves_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "work_post_comments" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_follows" (
    "userId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_follows_pkey" PRIMARY KEY ("userId","masterId")
);

-- CreateIndex
CREATE INDEX "work_posts_status_createdAt_idx" ON "work_posts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "work_posts_masterId_createdAt_idx" ON "work_posts"("masterId", "createdAt");

-- CreateIndex
CREATE INDEX "work_posts_category_id_idx" ON "work_posts"("category_id");

-- CreateIndex
CREATE INDEX "work_post_likes_userId_idx" ON "work_post_likes"("userId");

-- CreateIndex
CREATE INDEX "work_post_saves_userId_createdAt_idx" ON "work_post_saves"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "work_post_comments_postId_createdAt_idx" ON "work_post_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "master_follows_masterId_idx" ON "master_follows"("masterId");

-- AddForeignKey
ALTER TABLE "work_posts" ADD CONSTRAINT "work_posts_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_post_likes" ADD CONSTRAINT "work_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "work_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_post_likes" ADD CONSTRAINT "work_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_post_saves" ADD CONSTRAINT "work_post_saves_postId_fkey" FOREIGN KEY ("postId") REFERENCES "work_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_post_saves" ADD CONSTRAINT "work_post_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_post_comments" ADD CONSTRAINT "work_post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "work_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_post_comments" ADD CONSTRAINT "work_post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_follows" ADD CONSTRAINT "master_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_follows" ADD CONSTRAINT "master_follows_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

