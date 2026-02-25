/**
 * Migration: Move seller data from TPC → Novant
 *
 * TPC (cmls9xx7m0000l704ybq5pq1q) has orphaned seller records.
 * Novant (cmlux2o9f00eojpd4zk25mfrx) is flagged isSeller=true but has no data.
 *
 * Run: npx tsx scripts/migrate-seller-tpc-to-novant.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TPC_ID = "cmls9xx7m0000l704ybq5pq1q";
const NOVANT_ID = "cmlux2o9f00eojpd4zk25mfrx";

async function main() {
  // Pre-flight: verify both affiliates exist
  const [tpc, novant] = await Promise.all([
    prisma.affiliate.findUniqueOrThrow({ where: { id: TPC_ID }, select: { id: true, legalName: true, isSeller: true } }),
    prisma.affiliate.findUniqueOrThrow({ where: { id: NOVANT_ID }, select: { id: true, legalName: true, isSeller: true } }),
  ]);

  console.log(`TPC:    ${tpc.legalName} (isSeller=${tpc.isSeller})`);
  console.log(`Novant: ${novant.legalName} (isSeller=${novant.isSeller})`);

  // Pre-flight: count existing records on TPC
  const [locCount, ssoCount, ossCount, ncCount] = await Promise.all([
    prisma.sellerLocation.count({ where: { affiliateId: TPC_ID } }),
    prisma.sellerServiceOffering.count({ where: { affiliateId: TPC_ID } }),
    prisma.sellerOrgSubService.count({ where: { affiliateId: TPC_ID } }),
    prisma.networkContract.count({ where: { sellerId: TPC_ID } }),
  ]);

  console.log(`\nPre-migration counts (TPC):`);
  console.log(`  SellerLocation:        ${locCount}`);
  console.log(`  SellerServiceOffering: ${ssoCount}`);
  console.log(`  SellerOrgSubService:   ${ossCount}`);
  console.log(`  NetworkContract:       ${ncCount}`);

  // Check Novant has no existing seller data (safety check)
  const [novantLocs, novantSSO, novantOSS, novantNC] = await Promise.all([
    prisma.sellerLocation.count({ where: { affiliateId: NOVANT_ID } }),
    prisma.sellerServiceOffering.count({ where: { affiliateId: NOVANT_ID } }),
    prisma.sellerOrgSubService.count({ where: { affiliateId: NOVANT_ID } }),
    prisma.networkContract.count({ where: { sellerId: NOVANT_ID } }),
  ]);

  console.log(`\nPre-migration counts (Novant):`);
  console.log(`  SellerLocation:        ${novantLocs}`);
  console.log(`  SellerServiceOffering: ${novantSSO}`);
  console.log(`  SellerOrgSubService:   ${novantOSS}`);
  console.log(`  NetworkContract:       ${novantNC}`);

  if (novantLocs + novantSSO + novantOSS > 0) {
    console.error(`\nERROR: Novant already has seller location/service data! Aborting.`);
    process.exit(1);
  }

  // Execute migration in a single transaction
  console.log(`\nMigrating...`);

  const results = await prisma.$transaction([
    prisma.sellerLocation.updateMany({
      where: { affiliateId: TPC_ID },
      data: { affiliateId: NOVANT_ID },
    }),
    prisma.sellerServiceOffering.updateMany({
      where: { affiliateId: TPC_ID },
      data: { affiliateId: NOVANT_ID },
    }),
    prisma.sellerOrgSubService.updateMany({
      where: { affiliateId: TPC_ID },
      data: { affiliateId: NOVANT_ID },
    }),
    prisma.networkContract.updateMany({
      where: { sellerId: TPC_ID },
      data: { sellerId: NOVANT_ID },
    }),
  ]);

  console.log(`\nTransaction complete:`);
  console.log(`  SellerLocation moved:        ${results[0].count}`);
  console.log(`  SellerServiceOffering moved: ${results[1].count}`);
  console.log(`  SellerOrgSubService moved:   ${results[2].count}`);
  console.log(`  NetworkContract moved:       ${results[3].count}`);

  // Verification: count on Novant
  const [vLoc, vSSO, vOSS, vNC] = await Promise.all([
    prisma.sellerLocation.count({ where: { affiliateId: NOVANT_ID } }),
    prisma.sellerServiceOffering.count({ where: { affiliateId: NOVANT_ID } }),
    prisma.sellerOrgSubService.count({ where: { affiliateId: NOVANT_ID } }),
    prisma.networkContract.count({ where: { sellerId: NOVANT_ID } }),
  ]);

  console.log(`\nPost-migration counts (Novant):`);
  console.log(`  SellerLocation:        ${vLoc}`);
  console.log(`  SellerServiceOffering: ${vSSO}`);
  console.log(`  SellerOrgSubService:   ${vOSS}`);
  console.log(`  NetworkContract:       ${vNC}`);

  // Verify TPC has 0 seller records
  const [tLoc, tSSO, tOSS, tNC] = await Promise.all([
    prisma.sellerLocation.count({ where: { affiliateId: TPC_ID } }),
    prisma.sellerServiceOffering.count({ where: { affiliateId: TPC_ID } }),
    prisma.sellerOrgSubService.count({ where: { affiliateId: TPC_ID } }),
    prisma.networkContract.count({ where: { sellerId: TPC_ID } }),
  ]);

  console.log(`\nPost-migration counts (TPC — should all be 0):`);
  console.log(`  SellerLocation:        ${tLoc}`);
  console.log(`  SellerServiceOffering: ${tSSO}`);
  console.log(`  SellerOrgSubService:   ${tOSS}`);
  console.log(`  NetworkContract:       ${tNC}`);

  if (tLoc + tSSO + tOSS + tNC > 0) {
    console.error(`\nWARNING: TPC still has seller records!`);
  } else {
    console.log(`\nMigration verified successfully.`);
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
