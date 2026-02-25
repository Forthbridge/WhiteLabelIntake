/**
 * Backfill: Create price lists for seller orgs that have pricing data but no SellerPriceList rows.
 * Also clears the dead isDefault flag on all existing rows.
 *
 * For each qualifying seller:
 *   1. Creates one public SellerPriceList named "{orgName} Standard"
 *   2. Copies clinic_visit basePricePerVisit → SellerPriceListVisit
 *   3. Copies all SellerOrgSubService unitPrice → SellerPriceListSubService
 *
 * Usage: npx tsx scripts/backfill-seller-price-lists.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Step 1: Clear isDefault on all existing price lists (dead flag)
  const cleared = await prisma.sellerPriceList.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });
  console.log(`Cleared isDefault on ${cleared.count} existing price list(s)`);

  // Step 2: Find seller affiliates with pricing data but no price lists
  const sellers = await prisma.affiliate.findMany({
    where: {
      isSeller: true,
      deletedAt: null,
    },
    select: {
      id: true,
      legalName: true,
      _count: {
        select: { sellerPriceLists: true },
      },
    },
  });

  for (const seller of sellers) {
    if (seller._count.sellerPriceLists > 0) {
      console.log(`SKIP ${seller.legalName} — already has ${seller._count.sellerPriceLists} price list(s)`);
      continue;
    }

    // Check if this seller has any pricing data
    const [offerings, subServices] = await Promise.all([
      prisma.sellerServiceOffering.findMany({
        where: { affiliateId: seller.id, selected: true },
        select: { serviceType: true, basePricePerVisit: true },
      }),
      prisma.sellerOrgSubService.findMany({
        where: { affiliateId: seller.id, selected: true },
        select: { serviceType: true, subType: true, unitPrice: true },
      }),
    ]);

    if (offerings.length === 0 && subServices.length === 0) {
      console.log(`SKIP ${seller.legalName} — no pricing data`);
      continue;
    }

    // Create the price list
    const listName = `${seller.legalName ?? "Unnamed"} Standard`;
    const pl = await prisma.sellerPriceList.create({
      data: {
        affiliateId: seller.id,
        name: listName,
        isPublic: true,
        isDefault: false,
      },
    });

    // Copy clinic_visit basePricePerVisit → SellerPriceListVisit
    const clinicVisit = offerings.find((o) => o.serviceType === "clinic_visit");
    if (clinicVisit?.basePricePerVisit != null) {
      await prisma.sellerPriceListVisit.create({
        data: {
          priceListId: pl.id,
          serviceType: "clinic_visit",
          pricePerVisit: clinicVisit.basePricePerVisit,
        },
      });
    }

    // Copy all sub-service prices → SellerPriceListSubService
    const subServiceData = subServices
      .filter((s) => s.unitPrice != null)
      .map((s) => ({
        priceListId: pl.id,
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice,
      }));

    if (subServiceData.length > 0) {
      await prisma.sellerPriceListSubService.createMany({ data: subServiceData });
    }

    console.log(
      `CREATED "${listName}" for ${seller.legalName} — ` +
      `${clinicVisit?.basePricePerVisit != null ? 1 : 0} visit price(s), ` +
      `${subServiceData.length} sub-service price(s)`
    );
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
