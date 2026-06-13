-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BUILDER', 'PRO');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CLICK', 'SCROLL', 'NAVIGATE', 'ERROR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('RAGE_CLICK', 'CONFUSION_LOOP', 'DROP_OFF_WALL', 'DEAD_FEATURE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "country" TEXT,
    "city" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "page" TEXT NOT NULL,
    "element" TEXT,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "errors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "page" TEXT NOT NULL,
    "affectedUsers" INTEGER NOT NULL DEFAULT 1,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" "ErrorStatus" NOT NULL DEFAULT 'OPEN',
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "data" JSONB NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_googleId_key" ON "customers"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_token_key" ON "projects"("token");

-- CreateIndex
CREATE INDEX "sessions_projectId_idx" ON "sessions"("projectId");

-- CreateIndex
CREATE INDEX "sessions_sessionKey_idx" ON "sessions"("sessionKey");

-- CreateIndex
CREATE INDEX "events_projectId_idx" ON "events"("projectId");

-- CreateIndex
CREATE INDEX "events_sessionId_idx" ON "events"("sessionId");

-- CreateIndex
CREATE INDEX "events_timestamp_idx" ON "events"("timestamp");

-- CreateIndex
CREATE INDEX "errors_projectId_idx" ON "errors"("projectId");

-- CreateIndex
CREATE INDEX "insights_projectId_idx" ON "insights"("projectId");

-- CreateIndex
CREATE INDEX "insights_date_idx" ON "insights"("date");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "errors" ADD CONSTRAINT "errors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
