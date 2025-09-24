-- CreateEnum
CREATE TYPE "public"."ServiceType" AS ENUM ('UBER', 'LYFT', 'TAXI');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromLat" DOUBLE PRECISION NOT NULL,
    "fromLng" DOUBLE PRECISION NOT NULL,
    "toName" TEXT NOT NULL,
    "toLat" DOUBLE PRECISION NOT NULL,
    "toLng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedRouteId" TEXT NOT NULL,
    "service" "public"."ServiceType" NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RideHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "savedRouteId" TEXT,
    "service" "public"."ServiceType" NOT NULL,
    "estimatedFare" DOUBLE PRECISION NOT NULL,
    "finalFare" DOUBLE PRECISION,
    "waitTimeMinutes" INTEGER,
    "surgeMultiplier" DOUBLE PRECISION,
    "comparisonSnapshot" JSONB NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "SavedRoute_userId_idx" ON "public"."SavedRoute"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "public"."PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_savedRouteId_idx" ON "public"."PriceAlert"("savedRouteId");

-- CreateIndex
CREATE INDEX "RideHistory_userId_idx" ON "public"."RideHistory"("userId");

-- CreateIndex
CREATE INDEX "RideHistory_savedRouteId_idx" ON "public"."RideHistory"("savedRouteId");

-- AddForeignKey
ALTER TABLE "public"."SavedRoute" ADD CONSTRAINT "SavedRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceAlert" ADD CONSTRAINT "PriceAlert_savedRouteId_fkey" FOREIGN KEY ("savedRouteId") REFERENCES "public"."SavedRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideHistory" ADD CONSTRAINT "RideHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RideHistory" ADD CONSTRAINT "RideHistory_savedRouteId_fkey" FOREIGN KEY ("savedRouteId") REFERENCES "public"."SavedRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
