-- Add geohash clustering columns to Route table
ALTER TABLE "Route" ADD COLUMN "pickup_geohash" VARCHAR(12);
ALTER TABLE "Route" ADD COLUMN "destination_geohash" VARCHAR(12);
ALTER TABLE "Route" ADD COLUMN "geohash_precision" INTEGER NOT NULL DEFAULT 8;

-- Create composite index for efficient cluster lookups
CREATE INDEX "Route_pickup_geohash_destination_geohash_idx" ON "Route"("pickup_geohash", "destination_geohash");
