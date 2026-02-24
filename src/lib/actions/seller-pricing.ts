"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot } from "./helpers";
import { sellerPricingSchema, type SellerPricingData } from "@/lib/validations/seller-pricing";
import { computeSellerStatuses } from "./seller-org";
import type { Prisma } from "@prisma/client";
import type { CompletionStatus, SellerSectionId } from "@/types";

// ─── Load ────────────────────────────────────────────────────────

export async function loadSellerPricing(): Promise<SellerPricingData> {
  const ctx = await getSessionContext();

  const [offerings, orgSubs] = await Promise.all([
    prisma.sellerServiceOffering.findMany({
      where: {
        affiliateId: ctx.affiliateId,
        serviceType: { in: ["primary_care", "urgent_care"] },
        selected: true,
      },
      select: { serviceType: true, basePricePerVisit: true },
    }),
    prisma.sellerOrgSubService.findMany({
      where: {
        affiliateId: ctx.affiliateId,
        selected: true,
      },
      select: { serviceType: true, subType: true, unitPrice: true },
    }),
  ]);

  return {
    visitPrices: offerings.map((o) => ({
      serviceType: o.serviceType,
      price: o.basePricePerVisit ? Number(o.basePricePerVisit) : null,
    })),
    subServicePrices: orgSubs.map((s) => ({
      serviceType: s.serviceType,
      subType: s.subType,
      unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
    })),
  };
}

// ─── Save ────────────────────────────────────────────────────────

export async function saveSellerPricing(
  data: SellerPricingData
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();
  const parsed = sellerPricingSchema.parse(data);

  // Update visit prices on existing offering rows
  const visitUpdates: Promise<unknown>[] = [];
  for (const vp of parsed.visitPrices ?? []) {
    visitUpdates.push(
      prisma.sellerServiceOffering.updateMany({
        where: {
          affiliateId: ctx.affiliateId,
          serviceType: vp.serviceType,
          selected: true,
        },
        data: {
          basePricePerVisit: vp.price ?? null,
        },
      })
    );
  }

  // Batch-update sub-service unit prices in chunks
  const subUpdates: Promise<unknown>[] = [];
  for (const sp of parsed.subServicePrices ?? []) {
    subUpdates.push(
      prisma.sellerOrgSubService.updateMany({
        where: {
          affiliateId: ctx.affiliateId,
          serviceType: sp.serviceType,
          subType: sp.subType,
        },
        data: {
          unitPrice: sp.unitPrice ?? null,
        },
      })
    );
  }

  // Run all in a transaction for consistency
  await prisma.$transaction(
    [...visitUpdates, ...subUpdates].map((p) => p as Prisma.PrismaPromise<unknown>)
  );

  await writeSectionSnapshot(
    107, // S-7 → snapshot id 107
    parsed as unknown as Prisma.InputJsonValue,
    ctx.userId,
    ctx.affiliateId
  );

  return computeSellerStatuses(ctx.affiliateId);
}
