"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";
import { locationServicesSchema, type LocationServicesData } from "@/lib/validations/location-services";
import { computeSellerStatuses } from "./seller-org";
import type { CompletionStatus, SellerSectionId } from "@/types";

// ─── Load (for a single seller location) ────────────────────────

export interface LocationServiceState {
  overrides: Array<{ serviceType: string; available: boolean; pricePerVisit: number | null }>;
  subServices: Array<{ serviceType: string; subType: string; available: boolean; unitPrice: number | null }>;
  hasOverrides: boolean;
}

export async function loadLocationServices(sellerLocationId: string): Promise<LocationServiceState> {
  await getSessionContext(); // auth gate

  const [configs, subs] = await Promise.all([
    prisma.sellerLocationServiceConfig.findMany({ where: { sellerLocationId } }),
    prisma.sellerLocationSubService.findMany({ where: { sellerLocationId } }),
  ]);

  return {
    overrides: configs.map((c) => ({
      serviceType: c.serviceType,
      available: c.available,
      pricePerVisit: c.pricePerVisit ? Number(c.pricePerVisit) : null,
    })),
    subServices: subs.map((s) => ({
      serviceType: s.serviceType,
      subType: s.subType,
      available: s.available,
      unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
    })),
    hasOverrides: configs.length > 0 || subs.length > 0,
  };
}

// ─── Load all seller location service configs for an affiliate ──

export async function loadAllLocationServices(affiliateId: string): Promise<
  Record<string, LocationServiceState>
> {
  const locations = await prisma.sellerLocation.findMany({
    where: { affiliateId },
    select: { id: true },
  });

  const locationIds = locations.map((l) => l.id);

  const [configs, subs] = await Promise.all([
    prisma.sellerLocationServiceConfig.findMany({ where: { sellerLocationId: { in: locationIds } } }),
    prisma.sellerLocationSubService.findMany({ where: { sellerLocationId: { in: locationIds } } }),
  ]);

  const result: Record<string, LocationServiceState> = {};
  for (const locId of locationIds) {
    const locConfigs = configs.filter((c) => c.sellerLocationId === locId);
    const locSubs = subs.filter((s) => s.sellerLocationId === locId);
    result[locId] = {
      overrides: locConfigs.map((c) => ({
        serviceType: c.serviceType,
        available: c.available,
        pricePerVisit: c.pricePerVisit ? Number(c.pricePerVisit) : null,
      })),
      subServices: locSubs.map((s) => ({
        serviceType: s.serviceType,
        subType: s.subType,
        available: s.available,
        unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
      })),
      hasOverrides: locConfigs.length > 0 || locSubs.length > 0,
    };
  }

  return result;
}

// ─── Save ────────────────────────────────────────────────────────

export async function saveLocationServices(
  data: LocationServicesData
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();
  const parsed = locationServicesSchema.parse(data);

  // Verify the seller location belongs to this affiliate
  const location = await prisma.sellerLocation.findFirst({
    where: { id: parsed.locationId, affiliateId: ctx.affiliateId },
    select: { id: true },
  });
  if (!location) throw new Error("Seller location not found");

  // Upsert overrides (including pricePerVisit)
  await Promise.all(
    parsed.overrides.map((o) =>
      prisma.sellerLocationServiceConfig.upsert({
        where: {
          sellerLocationId_serviceType: {
            sellerLocationId: parsed.locationId,
            serviceType: o.serviceType,
          },
        },
        update: {
          available: o.available,
          pricePerVisit: o.pricePerVisit ?? null,
        },
        create: {
          sellerLocationId: parsed.locationId,
          serviceType: o.serviceType,
          available: o.available,
          pricePerVisit: o.pricePerVisit ?? null,
        },
      })
    )
  );

  // Upsert sub-services (including unitPrice)
  await Promise.all(
    parsed.subServices.map((s) =>
      prisma.sellerLocationSubService.upsert({
        where: {
          sellerLocationId_serviceType_subType: {
            sellerLocationId: parsed.locationId,
            serviceType: s.serviceType,
            subType: s.subType,
          },
        },
        update: {
          available: s.available,
          unitPrice: s.unitPrice ?? null,
        },
        create: {
          sellerLocationId: parsed.locationId,
          serviceType: s.serviceType,
          subType: s.subType,
          available: s.available,
          unitPrice: s.unitPrice ?? null,
        },
      })
    )
  );

  return computeSellerStatuses(ctx.affiliateId);
}

// ─── Initialize a location from org defaults ─────────────────────

export async function initLocationFromOrgDefaults(
  sellerLocationId: string
): Promise<LocationServiceState> {
  const ctx = await getSessionContext();

  // Verify location belongs to this affiliate
  const location = await prisma.sellerLocation.findFirst({
    where: { id: sellerLocationId, affiliateId: ctx.affiliateId },
    select: { id: true },
  });
  if (!location) throw new Error("Seller location not found");

  // Load org-level sub-service defaults
  const orgSubs = await prisma.sellerOrgSubService.findMany({
    where: { affiliateId: ctx.affiliateId },
  });

  // Load org-level selected service offerings
  const orgServices = await prisma.sellerServiceOffering.findMany({
    where: { affiliateId: ctx.affiliateId, selected: true },
  });

  // Create service config rows (all available by default)
  const serviceConfigs = orgServices.map((svc) =>
    prisma.sellerLocationServiceConfig.upsert({
      where: {
        sellerLocationId_serviceType: {
          sellerLocationId,
          serviceType: svc.serviceType,
        },
      },
      update: { available: true },
      create: {
        sellerLocationId,
        serviceType: svc.serviceType,
        available: true,
      },
    })
  );

  // Copy org sub-service rows to location (including unitPrice)
  const subServiceUpserts = orgSubs.map((sub) =>
    prisma.sellerLocationSubService.upsert({
      where: {
        sellerLocationId_serviceType_subType: {
          sellerLocationId,
          serviceType: sub.serviceType,
          subType: sub.subType,
        },
      },
      update: {
        available: sub.selected,
        unitPrice: sub.unitPrice,
      },
      create: {
        sellerLocationId,
        serviceType: sub.serviceType,
        subType: sub.subType,
        available: sub.selected,
        unitPrice: sub.unitPrice,
      },
    })
  );

  await Promise.all([...serviceConfigs, ...subServiceUpserts]);

  // Return the new state
  return loadLocationServices(sellerLocationId);
}

// ─── Reset location to org defaults (delete all overrides) ───────

export async function resetLocationToDefaults(
  sellerLocationId: string
): Promise<void> {
  const ctx = await getSessionContext();

  // Verify location belongs to this affiliate
  const location = await prisma.sellerLocation.findFirst({
    where: { id: sellerLocationId, affiliateId: ctx.affiliateId },
    select: { id: true },
  });
  if (!location) throw new Error("Seller location not found");

  await Promise.all([
    prisma.sellerLocationServiceConfig.deleteMany({ where: { sellerLocationId } }),
    prisma.sellerLocationSubService.deleteMany({ where: { sellerLocationId } }),
  ]);
}
