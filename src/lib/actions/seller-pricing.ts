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

  const offerings = await prisma.sellerServiceOffering.findMany({
    where: {
      affiliateId: ctx.affiliateId,
      serviceType: { in: ["primary_care", "urgent_care"] },
      selected: true,
    },
    select: { serviceType: true, basePricePerVisit: true },
  });

  const priceMap = new Map(
    offerings.map((o) => [o.serviceType, o.basePricePerVisit])
  );

  return {
    primaryCarePrice: priceMap.get("primary_care")
      ? Number(priceMap.get("primary_care"))
      : null,
    urgentCarePrice: priceMap.get("urgent_care")
      ? Number(priceMap.get("urgent_care"))
      : null,
  };
}

// ─── Save ────────────────────────────────────────────────────────

export async function saveSellerPricing(
  data: SellerPricingData
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();
  const parsed = sellerPricingSchema.parse(data);

  // Update prices on existing offering rows (only for selected services)
  const updates: Promise<unknown>[] = [];

  if (parsed.primaryCarePrice !== undefined) {
    updates.push(
      prisma.sellerServiceOffering.updateMany({
        where: {
          affiliateId: ctx.affiliateId,
          serviceType: "primary_care",
          selected: true,
        },
        data: {
          basePricePerVisit: parsed.primaryCarePrice ?? null,
        },
      })
    );
  }

  if (parsed.urgentCarePrice !== undefined) {
    updates.push(
      prisma.sellerServiceOffering.updateMany({
        where: {
          affiliateId: ctx.affiliateId,
          serviceType: "urgent_care",
          selected: true,
        },
        data: {
          basePricePerVisit: parsed.urgentCarePrice ?? null,
        },
      })
    );
  }

  await Promise.all(updates);

  await writeSectionSnapshot(
    107, // S-7 → snapshot id 107
    parsed as unknown as Prisma.InputJsonValue,
    ctx.userId,
    ctx.affiliateId
  );

  return computeSellerStatuses(ctx.affiliateId);
}
