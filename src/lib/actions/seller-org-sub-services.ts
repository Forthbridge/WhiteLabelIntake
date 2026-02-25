"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { Section11Data } from "@/lib/validations/section11";
import { computeSellerStatuses } from "./seller-org";
import type { CompletionStatus, SellerSectionId } from "@/types";

// ─── Load org-level sub-service defaults ─────────────────────────

export async function loadSellerOrgSubServices(
  affiliateId: string
): Promise<Section11Data> {
  const rows = await prisma.sellerOrgSubService.findMany({
    where: { affiliateId },
  });

  const rowMap = new Map(
    rows.map((r) => [`${r.serviceType}:${r.subType}`, r.selected])
  );

  // Build categories from what's stored (only service types that have rows)
  const serviceTypes = new Set(rows.map((r) => r.serviceType));
  const categories: Section11Data["categories"] = {};

  for (const serviceType of serviceTypes) {
    const subItems = SUB_SERVICE_TYPES[serviceType];
    if (!subItems) continue;
    categories[serviceType] = subItems.map((item) => ({
      subType: item.value,
      selected: rowMap.get(`${serviceType}:${item.value}`) ?? false,
    }));
  }

  return { categories };
}

// ─── Save org-level sub-service defaults ─────────────────────────

export async function saveSellerOrgSubServices(
  data: Section11Data
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();

  // Collect all upserts
  const upserts: Promise<unknown>[] = [];
  for (const [serviceType, items] of Object.entries(data.categories)) {
    for (const item of items) {
      upserts.push(
        prisma.sellerOrgSubService.upsert({
          where: {
            affiliateId_serviceType_subType: {
              affiliateId: ctx.affiliateId,
              serviceType,
              subType: item.subType,
            },
          },
          update: { selected: item.selected },
          create: {
            affiliateId: ctx.affiliateId,
            serviceType,
            subType: item.subType,
            selected: item.selected,
          },
        })
      );
    }
  }

  await Promise.all(upserts);

  return computeSellerStatuses(ctx.affiliateId);
}

// ─── Delete org sub-services for a deselected service type ───────

export async function deleteOrgSubServicesForType(
  serviceType: string
): Promise<void> {
  const ctx = await getSessionContext();
  await prisma.sellerOrgSubService.deleteMany({
    where: { affiliateId: ctx.affiliateId, serviceType },
  });
}
