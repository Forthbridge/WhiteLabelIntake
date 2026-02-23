"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";
import type { Prisma } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────

export interface PricingItem {
  serviceType: string;
  label: string;
  price: string | null; // formatted price or null if not set
}

export interface NetworkLocationItem {
  id: string;
  sellerLocationId: string;
  locationName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  phoneNumber: string;
  hoursOfOperation: string;
  accessType: string | null;
  latitude: number | null;
  longitude: number | null;
  sellerOrgName: string | null;
  sellerOrgId: string;
  isSelfOwned: boolean;
  contractId: string;
  included: boolean;
  services: string[];
  pricing: PricingItem[] | null;
}

export interface NetworkContractSummary {
  contractId: string;
  sellerId: string;
  sellerName: string | null;
  locationCount: number;
  activeTermCount: number;
}

export interface NetworkDataPayload {
  locations: NetworkLocationItem[];
  contracts: NetworkContractSummary[];
  marketplaceEnabled: boolean;
  affiliateOrgId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Returns the latest term per (contract, sellerLocation) pair.
 * In Prisma we fetch all terms ordered by createdAt DESC and dedupe in JS.
 */
async function getTermsByContract(contractIds: string[]) {
  if (contractIds.length === 0) return new Map<string, { status: string; contractId: string; sellerLocationId: string }>();

  const terms = await prisma.networkContractTerm.findMany({
    where: { contractId: { in: contractIds } },
    select: {
      contractId: true,
      sellerLocationId: true,
      status: true,
      endDate: true,
    },
  });

  // One row per contract+location (unique constraint)
  const termMap = new Map<string, { status: string; contractId: string; sellerLocationId: string }>();
  for (const term of terms) {
    const key = `${term.contractId}:${term.sellerLocationId}`;
    const isExpired = term.endDate && term.endDate < new Date();
    termMap.set(key, {
      status: isExpired ? "INACTIVE" : term.status,
      contractId: term.contractId,
      sellerLocationId: term.sellerLocationId,
    });
  }
  return termMap;
}

// ─── Load Network Locations ─────────────────────────────────────────

export async function loadNetworkData(): Promise<NetworkDataPayload> {
  const ctx = await getSessionContext();
  const affiliateId = ctx.affiliateId;

  // Load marketplace flag
  const aff = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { marketplaceEnabled: true },
  });
  const marketplaceEnabled = aff?.marketplaceEnabled ?? false;

  // Auto-ensure self-contract exists if this affiliate has seller locations
  const selfLocations = await prisma.sellerLocation.findMany({
    where: { affiliateId },
    select: { id: true },
  });
  if (selfLocations.length > 0) {
    // Upsert the self-contract
    const selfContract = await prisma.networkContract.upsert({
      where: { affiliateId_sellerId: { affiliateId, sellerId: affiliateId } },
      update: {},
      create: { affiliateId, sellerId: affiliateId },
    });

    // Ensure ACTIVE terms exist for all self-locations (upsert each)
    for (const loc of selfLocations) {
      await prisma.networkContractTerm.upsert({
        where: { contractId_sellerLocationId: { contractId: selfContract.id, sellerLocationId: loc.id } },
        create: {
          contractId: selfContract.id,
          sellerLocationId: loc.id,
          status: "ACTIVE",
          acceptedByUserId: ctx.userId,
          updatedByUserId: ctx.userId,
        },
        update: {
          status: "ACTIVE",
          updatedByUserId: ctx.userId,
        },
      });
    }
  }

  const contracts = await prisma.networkContract.findMany({
    where: { affiliateId },
    include: {
      seller: { select: { id: true, legalName: true } },
    },
  });

  if (contracts.length === 0) {
    return { locations: [], contracts: [], marketplaceEnabled, affiliateOrgId: affiliateId };
  }

  const contractIds = contracts.map((c) => c.id);
  const sellerIds = contracts.map((c) => c.sellerId);

  // Get latest terms to determine inclusion
  const latestTerms = await getTermsByContract(contractIds);

  // Load all seller locations for contracted sellers
  const allLocations = await prisma.sellerLocation.findMany({
    where: { affiliateId: { in: sellerIds } },
    include: {
      serviceConfigs: {
        select: { serviceType: true, available: true, pricePerVisit: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Load org-level service offerings for pricing resolution
  const orgOfferings = await prisma.sellerServiceOffering.findMany({
    where: { affiliateId: { in: sellerIds }, selected: true },
    select: { affiliateId: true, serviceType: true, basePricePerVisit: true },
  });

  // Build a map: sellerId -> serviceType -> orgPrice
  const orgPriceMap = new Map<string, Map<string, Prisma.Decimal | null>>();
  for (const o of orgOfferings) {
    if (!orgPriceMap.has(o.affiliateId)) {
      orgPriceMap.set(o.affiliateId, new Map());
    }
    orgPriceMap.get(o.affiliateId)!.set(o.serviceType, o.basePricePerVisit);
  }

  const locations: NetworkLocationItem[] = [];

  for (const contract of contracts) {
    const sellerLocations = allLocations.filter((l) => l.affiliateId === contract.sellerId);

    for (const loc of sellerLocations) {
      const termKey = `${contract.id}:${loc.id}`;
      const latestTerm = latestTerms.get(termKey);
      const included = latestTerm?.status === "ACTIVE";

      const enabledServices = loc.serviceConfigs
        .filter((sc) => sc.available)
        .map((sc) => sc.serviceType);

      // Resolve pricing
      const sellerPrices = orgPriceMap.get(contract.sellerId);
      let pricing: PricingItem[] | null = null;
      if (sellerPrices) {
        const pricedServiceTypes = new Set<string>();
        const pricingItems: PricingItem[] = [];

        for (const svc of enabledServices) {
          const locConfig = loc.serviceConfigs.find((sc) => sc.serviceType === svc);
          const locPrice = locConfig?.pricePerVisit;
          const orgPrice = sellerPrices.get(svc);
          const resolvedPrice = locPrice ?? orgPrice;
          if (resolvedPrice) {
            pricingItems.push({
              serviceType: svc,
              label: svc,
              price: `$${Number(resolvedPrice).toFixed(2)}`,
            });
            pricedServiceTypes.add(svc);
          }
        }

        for (const [svc, orgPrice] of sellerPrices) {
          if (!pricedServiceTypes.has(svc) && orgPrice) {
            pricingItems.push({
              serviceType: svc,
              label: svc,
              price: `$${Number(orgPrice).toFixed(2)}`,
            });
          }
        }

        if (pricingItems.length > 0) {
          pricing = pricingItems;
        }
      }

      locations.push({
        id: `${contract.id}:${loc.id}`,
        sellerLocationId: loc.id,
        locationName: loc.locationName ?? "",
        streetAddress: loc.streetAddress ?? "",
        city: loc.city ?? "",
        state: loc.state ?? "",
        zip: loc.zip ?? "",
        phoneNumber: loc.phoneNumber ?? "",
        hoursOfOperation: loc.hoursOfOperation ?? "",
        accessType: loc.accessType,
        latitude: loc.latitude,
        longitude: loc.longitude,
        sellerOrgName: contract.seller.legalName,
        sellerOrgId: contract.sellerId,
        isSelfOwned: contract.sellerId === affiliateId,
        contractId: contract.id,
        included,
        services: enabledServices,
        pricing,
      });
    }
  }

  // Build contract summaries
  const contractSummaries: NetworkContractSummary[] = [];
  for (const contract of contracts) {
    const totalLocations = allLocations.filter((l) => l.affiliateId === contract.sellerId).length;
    let activeCount = 0;
    for (const [key, term] of latestTerms) {
      if (term.contractId === contract.id && term.status === "ACTIVE") {
        activeCount++;
      }
    }

    contractSummaries.push({
      contractId: contract.id,
      sellerId: contract.sellerId,
      sellerName: contract.seller.legalName,
      locationCount: totalLocations,
      activeTermCount: activeCount,
    });
  }

  return { locations, contracts: contractSummaries, marketplaceEnabled, affiliateOrgId: affiliateId };
}

// Keep these for backward compatibility
export async function loadNetworkLocations(): Promise<NetworkLocationItem[]> {
  const data = await loadNetworkData();
  return data.locations;
}

export async function loadMyNetworkContracts(): Promise<NetworkContractSummary[]> {
  const data = await loadNetworkData();
  return data.contracts;
}

// ─── Add Location Term (creates ACTIVE term) ───────────────────────

export async function addLocationTerm(
  contractId: string,
  sellerLocationId: string,
  acceptedPricing: unknown,
  endDate?: Date,
): Promise<void> {
  const ctx = await getSessionContext();

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { affiliateId: true, sellerId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  // Verify location belongs to this seller
  const loc = await prisma.sellerLocation.findUnique({
    where: { id: sellerLocationId },
    select: { affiliateId: true },
  });
  if (!loc || loc.affiliateId !== contract.sellerId) {
    throw new Error("Location not found for this seller");
  }

  await prisma.networkContractTerm.upsert({
    where: { contractId_sellerLocationId: { contractId, sellerLocationId } },
    create: {
      contractId,
      sellerLocationId,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: endDate ?? null,
      acceptedPricing: acceptedPricing as Prisma.InputJsonValue,
      acceptedByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    },
    update: {
      status: "ACTIVE",
      startDate: new Date(),
      endDate: endDate ?? null,
      acceptedPricing: acceptedPricing as Prisma.InputJsonValue,
      inactiveReason: null,
      inactiveNote: null,
      updatedByUserId: ctx.userId,
    },
  });
}

// ─── Remove Location Term (updates existing term in place) ──────────

export async function removeLocationTerm(
  contractId: string,
  sellerLocationId: string,
  reason: string,
  note?: string,
): Promise<void> {
  const ctx = await getSessionContext();

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { affiliateId: true, sellerId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  // Cannot remove self-owned locations
  if (contract.sellerId === ctx.affiliateId) {
    throw new Error("Cannot remove your own locations from the network");
  }

  await prisma.networkContractTerm.update({
    where: { contractId_sellerLocationId: { contractId, sellerLocationId } },
    data: {
      status: "INACTIVE",
      inactiveReason: reason as never, // enum value
      inactiveNote: note || null,
      endDate: new Date(),
      updatedByUserId: ctx.userId,
    },
  });
}

// ─── Load Seller Pricing (for acceptance modal) ─────────────────────

export interface SellerPricingData {
  sellerName: string | null;
  locationCount: number;
  services: { serviceType: string; price: number | null }[];
}

export async function loadSellerPricing(contractId: string): Promise<SellerPricingData> {
  const ctx = await getSessionContext();

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { affiliateId: true, sellerId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  const [seller, offerings, locationCount] = await Promise.all([
    prisma.affiliate.findUnique({
      where: { id: contract.sellerId },
      select: { legalName: true },
    }),
    prisma.sellerServiceOffering.findMany({
      where: { affiliateId: contract.sellerId, selected: true, basePricePerVisit: { not: null } },
      select: { serviceType: true, basePricePerVisit: true },
      orderBy: { serviceType: "asc" },
    }),
    prisma.sellerLocation.count({ where: { affiliateId: contract.sellerId } }),
  ]);

  return {
    sellerName: seller?.legalName ?? null,
    locationCount,
    services: offerings.map((o) => ({
      serviceType: o.serviceType,
      price: o.basePricePerVisit ? Number(o.basePricePerVisit) : null,
    })),
  };
}
