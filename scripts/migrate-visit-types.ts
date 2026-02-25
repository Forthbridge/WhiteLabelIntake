/**
 * Migration: Collapse visit types + consolidate imaging
 *
 * 1. Merge primary_care + urgent_care → clinic_visit across:
 *    - SellerServiceOffering (org-level)
 *    - SellerLocationServiceConfig (location-level)
 *
 * 2. Merge all imaging sub-types → single "all-xrays" across:
 *    - SellerOrgSubService (org-level)
 *    - SellerLocationSubService (location-level)
 *    - SubService (affiliate program-level)
 *
 * Usage: npx tsx scripts/migrate-visit-types.ts [--dry-run]
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(`${isDryRun ? "[DRY RUN] " : ""}${msg}`);
}

async function migrateVisitTypes() {
  log("=== Step 1: SellerServiceOffering — primary_care/urgent_care → clinic_visit ===");

  // Find all affiliates that have primary_care or urgent_care offerings
  const oldOfferings = await prisma.sellerServiceOffering.findMany({
    where: { serviceType: { in: ["primary_care", "urgent_care"] } },
  });

  // Group by affiliateId
  const byAffiliate = new Map<string, typeof oldOfferings>();
  for (const o of oldOfferings) {
    if (!byAffiliate.has(o.affiliateId)) byAffiliate.set(o.affiliateId, []);
    byAffiliate.get(o.affiliateId)!.push(o);
  }

  for (const [affiliateId, offerings] of byAffiliate) {
    const anySelected = offerings.some((o) => o.selected);
    // Take the higher basePricePerVisit from the two
    const prices = offerings
      .map((o) => o.basePricePerVisit)
      .filter((p): p is Prisma.Decimal => p != null);
    const maxPrice = prices.length > 0 ? prices.reduce((a, b) => (a.greaterThan(b) ? a : b)) : null;

    log(`  Affiliate ${affiliateId}: ${offerings.length} old offerings → clinic_visit (selected=${anySelected}, price=${maxPrice})`);

    if (!isDryRun) {
      // Upsert clinic_visit
      await prisma.sellerServiceOffering.upsert({
        where: { affiliateId_serviceType: { affiliateId, serviceType: "clinic_visit" } },
        create: {
          affiliateId,
          serviceType: "clinic_visit",
          selected: anySelected,
          basePricePerVisit: maxPrice,
        },
        update: {
          selected: anySelected,
          basePricePerVisit: maxPrice,
        },
      });

      // Delete old rows
      await prisma.sellerServiceOffering.deleteMany({
        where: { affiliateId, serviceType: { in: ["primary_care", "urgent_care"] } },
      });
    }
  }

  log(`  Migrated ${byAffiliate.size} affiliate(s) for SellerServiceOffering`);

  log("\n=== Step 2: SellerLocationServiceConfig — primary_care/urgent_care → clinic_visit ===");

  const oldLocConfigs = await prisma.sellerLocationServiceConfig.findMany({
    where: { serviceType: { in: ["primary_care", "urgent_care"] } },
  });

  // Group by sellerLocationId
  const configByLocation = new Map<string, typeof oldLocConfigs>();
  for (const c of oldLocConfigs) {
    if (!configByLocation.has(c.sellerLocationId)) configByLocation.set(c.sellerLocationId, []);
    configByLocation.get(c.sellerLocationId)!.push(c);
  }

  for (const [sellerLocationId, configs] of configByLocation) {
    const anyAvailable = configs.some((c) => c.available);
    log(`  Location ${sellerLocationId}: ${configs.length} old configs → clinic_visit`);

    if (!isDryRun) {
      await prisma.sellerLocationServiceConfig.upsert({
        where: { sellerLocationId_serviceType: { sellerLocationId, serviceType: "clinic_visit" } },
        create: {
          sellerLocationId,
          serviceType: "clinic_visit",
          available: anyAvailable,
        },
        update: {
          available: anyAvailable,
        },
      });

      await prisma.sellerLocationServiceConfig.deleteMany({
        where: { sellerLocationId, serviceType: { in: ["primary_care", "urgent_care"] } },
      });
    }
  }

  log(`  Migrated ${configByLocation.size} location(s) for SellerLocationServiceConfig`);
}

async function migrateImaging() {
  log("\n=== Step 3: SellerOrgSubService — imaging → all-xrays ===");

  const oldOrgSubs = await prisma.sellerOrgSubService.findMany({
    where: { serviceType: "imaging" },
  });

  // Group by affiliateId
  const byAffiliate = new Map<string, typeof oldOrgSubs>();
  for (const s of oldOrgSubs) {
    if (!byAffiliate.has(s.affiliateId)) byAffiliate.set(s.affiliateId, []);
    byAffiliate.get(s.affiliateId)!.push(s);
  }

  for (const [affiliateId, subs] of byAffiliate) {
    const anySelected = subs.some((s) => s.selected);
    const prices = subs.map((s) => s.unitPrice).filter((p): p is Prisma.Decimal => p != null);
    const maxPrice = prices.length > 0 ? prices.reduce((a, b) => (a.greaterThan(b) ? a : b)) : null;

    log(`  Affiliate ${affiliateId}: ${subs.length} imaging subs → all-xrays (selected=${anySelected}, price=${maxPrice})`);

    if (!isDryRun) {
      await prisma.sellerOrgSubService.upsert({
        where: { affiliateId_serviceType_subType: { affiliateId, serviceType: "imaging", subType: "all-xrays" } },
        create: {
          affiliateId,
          serviceType: "imaging",
          subType: "all-xrays",
          selected: anySelected,
          unitPrice: maxPrice,
        },
        update: {
          selected: anySelected,
          unitPrice: maxPrice,
        },
      });

      // Delete old imaging rows (except all-xrays)
      await prisma.sellerOrgSubService.deleteMany({
        where: { affiliateId, serviceType: "imaging", subType: { not: "all-xrays" } },
      });
    }
  }

  log(`  Migrated ${byAffiliate.size} affiliate(s) for SellerOrgSubService imaging`);

  log("\n=== Step 4: SellerLocationSubService — imaging → all-xrays ===");

  const oldLocSubs = await prisma.sellerLocationSubService.findMany({
    where: { serviceType: "imaging" },
  });

  // Group by sellerLocationId
  const byLocation = new Map<string, typeof oldLocSubs>();
  for (const s of oldLocSubs) {
    if (!byLocation.has(s.sellerLocationId)) byLocation.set(s.sellerLocationId, []);
    byLocation.get(s.sellerLocationId)!.push(s);
  }

  for (const [sellerLocationId, subs] of byLocation) {
    const anyAvailable = subs.some((s) => s.available);

    log(`  Location ${sellerLocationId}: ${subs.length} imaging subs → all-xrays`);

    if (!isDryRun) {
      await prisma.sellerLocationSubService.upsert({
        where: { sellerLocationId_serviceType_subType: { sellerLocationId, serviceType: "imaging", subType: "all-xrays" } },
        create: {
          sellerLocationId,
          serviceType: "imaging",
          subType: "all-xrays",
          available: anyAvailable,
        },
        update: {
          available: anyAvailable,
        },
      });

      await prisma.sellerLocationSubService.deleteMany({
        where: { sellerLocationId, serviceType: "imaging", subType: { not: "all-xrays" } },
      });
    }
  }

  log(`  Migrated ${byLocation.size} location(s) for SellerLocationSubService imaging`);

  log("\n=== Step 5: SubService (affiliate program) — imaging → all-xrays ===");

  const oldProgramSubs = await prisma.subService.findMany({
    where: { serviceType: "imaging" },
  });

  // Group by programId
  const byProgram = new Map<string, typeof oldProgramSubs>();
  for (const s of oldProgramSubs) {
    if (!byProgram.has(s.programId)) byProgram.set(s.programId, []);
    byProgram.get(s.programId)!.push(s);
  }

  for (const [programId, subs] of byProgram) {
    const anySelected = subs.some((s) => s.selected);

    log(`  Program ${programId}: ${subs.length} imaging subs → all-xrays (selected=${anySelected})`);

    if (!isDryRun) {
      // Check if all-xrays already exists
      const existing = await prisma.subService.findFirst({
        where: { programId, serviceType: "imaging", subType: "all-xrays" },
      });

      if (existing) {
        await prisma.subService.update({
          where: { id: existing.id },
          data: { selected: anySelected },
        });
      } else {
        await prisma.subService.create({
          data: {
            programId,
            serviceType: "imaging",
            subType: "all-xrays",
            selected: anySelected,
          },
        });
      }

      // Delete old imaging rows (except all-xrays)
      await prisma.subService.deleteMany({
        where: { programId, serviceType: "imaging", subType: { not: "all-xrays" } },
      });
    }
  }

  log(`  Migrated ${byProgram.size} program(s) for SubService imaging`);
}

async function main() {
  log("Starting migration: Collapse visit types + consolidate imaging\n");

  await migrateVisitTypes();
  await migrateImaging();

  log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
