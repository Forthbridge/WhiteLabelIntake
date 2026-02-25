/**
 * Cleanup script: NULL all location-level price data before schema migration.
 *
 * NOTE: This script must be run BEFORE the migration that removes the
 * pricePerVisit/unitPrice columns. After migration, these columns no longer
 * exist in the schema, so this script becomes a no-op.
 *
 * Usage: npx tsx scripts/cleanup-location-prices.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up location-level price data...\n");

  // Use raw SQL since the columns may have already been removed from the Prisma schema
  const visitResult = await prisma.$executeRawUnsafe(
    `UPDATE seller_location_service_configs SET "pricePerVisit" = NULL WHERE "pricePerVisit" IS NOT NULL`
  ).catch(() => 0);
  console.log(`  SellerLocationServiceConfig: NULLed pricePerVisit on ${visitResult} rows`);

  const subResult = await prisma.$executeRawUnsafe(
    `UPDATE seller_location_sub_services SET "unitPrice" = NULL WHERE "unitPrice" IS NOT NULL`
  ).catch(() => 0);
  console.log(`  SellerLocationSubService: NULLed unitPrice on ${subResult} rows`);

  console.log("\nDone. Safe to run prisma migrate dev now.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
