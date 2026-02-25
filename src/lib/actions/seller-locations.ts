"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot } from "./helpers";
import { computeSellerStatuses } from "./seller-org";
import type { Section5Data, LocationData } from "@/lib/validations/section5";
import { Prisma } from "@prisma/client";
import type { CompletionStatus, SellerSectionId } from "@/types";

export interface SellerLocationData {
  id?: string;
  locationName: string;
  streetAddress: string;
  streetAddress2?: string;
  city: string;
  state: string;
  zip: string;
  closeByDescription?: string;
  locationNpi: string;
  phoneNumber: string;
  hoursOfOperation?: string;
  accessType: "walk_in" | "appointment_only" | "both" | null;
  hasOnSiteLabs: boolean;
  hasOnSiteRadiology: boolean;
  hasOnSitePharmacy: boolean;
  weeklySchedule?: Array<{ day: string; openTime?: string; closeTime?: string; closed: boolean }>;
  schedulingSystemOverride?: string | null;
  schedulingOverrideOtherName?: string | null;
  schedulingOverrideAcknowledged?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  schedulingIntegrations?: Array<{
    id?: string;
    serviceType: "office_365" | "google_calendar" | "other";
    serviceName?: string;
    accountIdentifier?: string;
  }>;
}

export interface SellerLocationsData {
  defaultSchedulingSystem: string | null;
  defaultSchedulingOtherName: string | null;
  defaultSchedulingAcknowledged: boolean;
  locations: SellerLocationData[];
}

// ─── Load ────────────────────────────────────────────────────────

export async function loadSellerLocations(): Promise<SellerLocationsData> {
  const ctx = await getSessionContext();

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: ctx.affiliateId },
    select: { defaultSchedulingSystem: true, defaultSchedulingOtherName: true, defaultSchedulingAcknowledged: true },
  });

  const locations = await prisma.sellerLocation.findMany({
    where: { affiliateId: ctx.affiliateId },
    include: { schedulingIntegrations: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    defaultSchedulingSystem: affiliate?.defaultSchedulingSystem ?? null,
    defaultSchedulingOtherName: affiliate?.defaultSchedulingOtherName ?? null,
    defaultSchedulingAcknowledged: affiliate?.defaultSchedulingAcknowledged ?? false,
    locations: locations.map((loc) => ({
      id: loc.id,
      locationName: loc.locationName ?? "",
      streetAddress: loc.streetAddress ?? "",
      streetAddress2: loc.streetAddress2 ?? "",
      city: loc.city ?? "",
      state: loc.state ?? "",
      zip: loc.zip ?? "",
      closeByDescription: loc.closeByDescription ?? "",
      locationNpi: loc.locationNpi ?? "",
      phoneNumber: loc.phoneNumber ?? "",
      hoursOfOperation: loc.hoursOfOperation ?? "",
      accessType: loc.accessType as SellerLocationData["accessType"],
      hasOnSiteLabs: loc.hasOnSiteLabs,
      hasOnSiteRadiology: loc.hasOnSiteRadiology,
      hasOnSitePharmacy: loc.hasOnSitePharmacy,
      weeklySchedule: (loc.weeklySchedule as SellerLocationData["weeklySchedule"]) ?? undefined,
      latitude: loc.latitude,
      longitude: loc.longitude,
      schedulingSystemOverride: loc.schedulingSystemOverride ?? null,
      schedulingOverrideOtherName: loc.schedulingOverrideOtherName ?? null,
      schedulingOverrideAcknowledged: loc.schedulingOverrideAcknowledged ?? false,
      schedulingIntegrations: loc.schedulingIntegrations.map((si) => ({
        id: si.id,
        serviceType: si.serviceType as "office_365" | "google_calendar" | "other",
        serviceName: si.serviceName ?? "",
        accountIdentifier: si.accountIdentifier ?? "",
      })),
    })),
  };
}

// ─── Save ────────────────────────────────────────────────────────

interface SaveSellerLocationsResult {
  statuses: Record<SellerSectionId, CompletionStatus>;
  locationIds: string[];
}

export async function saveSellerLocations(data: SellerLocationsData): Promise<SaveSellerLocationsResult> {
  const ctx = await getSessionContext();

  // Update default scheduling on affiliate
  await prisma.affiliate.update({
    where: { id: ctx.affiliateId },
    data: {
      defaultSchedulingSystem: data.defaultSchedulingSystem || null,
      defaultSchedulingOtherName: data.defaultSchedulingSystem === "other" ? (data.defaultSchedulingOtherName || null) : null,
      defaultSchedulingAcknowledged: data.defaultSchedulingSystem === "other" ? (data.defaultSchedulingAcknowledged ?? false) : false,
    },
  });

  const locationIds: string[] = [];

  for (const loc of data.locations) {
    const locationData = {
      locationName: loc.locationName || null,
      streetAddress: loc.streetAddress || null,
      streetAddress2: loc.streetAddress2 || null,
      city: loc.city || null,
      state: loc.state || null,
      zip: loc.zip || null,
      closeByDescription: loc.closeByDescription || null,
      locationNpi: loc.locationNpi || null,
      phoneNumber: loc.phoneNumber || null,
      hoursOfOperation: loc.hoursOfOperation || null,
      accessType: loc.accessType || null,
      hasOnSiteLabs: loc.hasOnSiteLabs ?? false,
      hasOnSiteRadiology: loc.hasOnSiteRadiology ?? false,
      hasOnSitePharmacy: loc.hasOnSitePharmacy ?? false,
      weeklySchedule: loc.weeklySchedule ? (loc.weeklySchedule as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      latitude: loc.latitude ?? null,
      longitude: loc.longitude ?? null,
      schedulingSystemOverride: loc.schedulingSystemOverride || null,
      schedulingOverrideOtherName: loc.schedulingSystemOverride === "other" ? (loc.schedulingOverrideOtherName || null) : null,
      schedulingOverrideAcknowledged: loc.schedulingSystemOverride === "other" ? (loc.schedulingOverrideAcknowledged ?? false) : false,
    };

    if (loc.id) {
      await prisma.sellerLocation.update({
        where: { id: loc.id },
        data: locationData,
      });

      if (loc.schedulingIntegrations) {
        await prisma.$transaction([
          prisma.sellerSchedulingIntegration.deleteMany({
            where: { sellerLocationId: loc.id },
          }),
          prisma.sellerSchedulingIntegration.createMany({
            data: loc.schedulingIntegrations.map((si) => ({
              sellerLocationId: loc.id!,
              serviceType: si.serviceType,
              serviceName: si.serviceName || null,
              accountIdentifier: si.accountIdentifier || null,
            })),
          }),
        ]);
      }
      locationIds.push(loc.id);
    } else {
      const created = await prisma.sellerLocation.create({
        data: {
          affiliateId: ctx.affiliateId,
          ...locationData,
        },
      });

      if (loc.schedulingIntegrations && loc.schedulingIntegrations.length > 0) {
        await prisma.sellerSchedulingIntegration.createMany({
          data: loc.schedulingIntegrations.map((si) => ({
            sellerLocationId: created.id,
            serviceType: si.serviceType,
            serviceName: si.serviceName || null,
            accountIdentifier: si.accountIdentifier || null,
          })),
        });
      }

      locationIds.push(created.id);
    }
  }

  await writeSectionSnapshot(
    102,
    { defaultSchedulingSystem: data.defaultSchedulingSystem, locationCount: locationIds.length },
    ctx.userId,
    ctx.affiliateId
  );

  // Geocode any locations missing lat/lng (e.g. CSV imports, manual entry without autocomplete)
  await geocodeSellerLocations(ctx.affiliateId);

  const statuses = await computeSellerStatuses(ctx.affiliateId);
  return { statuses, locationIds };
}

// ─── Geocode Missing Lat/Lng ─────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function geocodeSellerLocations(affiliateId: string): Promise<number> {
  const locations = await prisma.sellerLocation.findMany({
    where: {
      affiliateId,
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { id: true, streetAddress: true, city: true, state: true, zip: true },
  });

  let updated = 0;
  for (const loc of locations) {
    const parts = [loc.streetAddress, loc.city, loc.state, loc.zip].filter(Boolean);
    if (parts.length === 0) continue;
    const result = await geocodeAddress(parts.join(", "));
    if (result) {
      await prisma.sellerLocation.update({
        where: { id: loc.id },
        data: { latitude: result.lat, longitude: result.lng },
      });
      updated++;
    }
  }
  return updated;
}

// ─── Delete ──────────────────────────────────────────────────────

export async function deleteSellerLocation(locationId: string) {
  const ctx = await getSessionContext();

  const location = await prisma.sellerLocation.findFirst({
    where: { id: locationId, affiliateId: ctx.affiliateId },
  });
  if (!location) throw new Error("Seller location not found");

  await prisma.sellerLocation.delete({ where: { id: locationId } });
}
