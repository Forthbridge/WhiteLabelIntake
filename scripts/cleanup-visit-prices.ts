/**
 * One-time cleanup: delete SellerPriceListVisit rows for non-visit service types.
 *
 * Only clinic_visit uses visit-level pricing. The backfill erroneously created
 * visit price rows for dme, imaging, immunizations, and labs — these are
 * sub-service-only categories and should not have visit price rows.
 *
 * Usage: npx tsx scripts/cleanup-visit-prices.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Count before
  const before = await prisma.sellerPriceListVisit.count({
    where: { serviceType: { not: "clinic_visit" } },
  });

  console.log(`Found ${before} non-clinic_visit visit price rows to delete`);

  if (before === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  const result = await prisma.sellerPriceListVisit.deleteMany({
    where: { serviceType: { not: "clinic_visit" } },
  });

  console.log(`Deleted ${result.count} rows`);

  // Verify
  const after = await prisma.sellerPriceListVisit.count({
    where: { serviceType: { not: "clinic_visit" } },
  });
  console.log(`Remaining non-clinic_visit rows: ${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
