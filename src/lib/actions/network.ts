"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";
import type { Prisma } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────

export interface PricingItem {
  serviceType: string;
  label: string;
  price: string | null; // formatted price or null if not set
  subType?: string; // present for sub-service pricing items
  payer?: "plan" | "patient"; // plan-covered or patient-responsibility
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
  hasPriceLists: boolean;  // seller has price lists; pricing may vary by selection
  hasPricing: boolean;     // false = seller has no pricing configured at all
}

export interface NetworkContractSummary {
  contractId: string;
  sellerId: string;
  sellerName: string | null;
  locationCount: number;
  activeTermCount: number;
  priceListId: string | null;
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
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Multiple rows may exist per contract+location pair — keep only the latest
  const termMap = new Map<string, { status: string; contractId: string; sellerLocationId: string }>();
  for (const term of terms) {
    const key = `${term.contractId}:${term.sellerLocationId}`;
    if (termMap.has(key)) continue; // already have the latest (ordered DESC)
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

export async function loadNetworkData(selectedProgramId?: string): Promise<NetworkDataPayload> {
  const ctx = await getSessionContext(selectedProgramId);
  const affiliateId = ctx.affiliateId;
  const programId = ctx.programId;

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
    // Use findFirst + create pattern since compound unique with nullable programId needs special handling
    let selfContract = await prisma.networkContract.findFirst({
      where: { affiliateId, sellerId: affiliateId, programId: programId ?? null },
    });
    if (!selfContract) {
      selfContract = await prisma.networkContract.create({
        data: { affiliateId, sellerId: affiliateId, programId: programId ?? null },
      });
    }

    // Ensure ACTIVE terms exist for all self-locations (create if none active)
    for (const loc of selfLocations) {
      const existing = await prisma.networkContractTerm.findFirst({
        where: { contractId: selfContract.id, sellerLocationId: loc.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (!existing) {
        await prisma.networkContractTerm.create({
          data: {
            contractId: selfContract.id,
            sellerLocationId: loc.id,
            status: "ACTIVE",
            acceptedByUserId: ctx.userId,
            updatedByUserId: ctx.userId,
          },
        });
      }
    }
  }

  const contracts = await prisma.networkContract.findMany({
    where: { affiliateId, programId: programId ?? null },
    include: {
      seller: { select: { id: true, legalName: true } },
      priceList: {
        include: {
          visitPrices: true,
          subPrices: true,
        },
      },
    },
  });

  if (contracts.length === 0) {
    return { locations: [], contracts: [], marketplaceEnabled, affiliateOrgId: affiliateId };
  }

  // Check which sellers have price lists (for contracts without one assigned)
  const sellersWithoutPL = contracts.filter(c => !c.priceListId).map(c => c.sellerId);
  const sellerPLCounts = sellersWithoutPL.length > 0
    ? await prisma.sellerPriceList.groupBy({
        by: ["affiliateId"],
        where: { affiliateId: { in: [...new Set(sellersWithoutPL)] } },
        _count: true,
      })
    : [];
  const sellersWithPriceLists = new Set(
    sellerPLCounts.filter(s => s._count > 0).map(s => s.affiliateId)
  );

  const contractIds = contracts.map((c) => c.id);
  const sellerIds = contracts.map((c) => c.sellerId);

  // Load plan's covered sub-services for payer tagging
  let coveredSubSet = new Set<string>(); // "serviceType:subType"
  if (programId) {
    const coveredSubs = await prisma.subService.findMany({
      where: { programId, selected: true },
      select: { serviceType: true, subType: true },
    });
    coveredSubSet = new Set(coveredSubs.map((s) => `${s.serviceType}:${s.subType}`));
  }

  // Get latest terms to determine inclusion
  const latestTerms = await getTermsByContract(contractIds);

  // Load all seller locations for contracted sellers
  const allLocations = await prisma.sellerLocation.findMany({
    where: { affiliateId: { in: sellerIds } },
    include: {
      serviceConfigs: {
        select: { serviceType: true, available: true },
      },
      subServices: {
        select: { serviceType: true, subType: true, available: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Load org-level service offerings for pricing resolution
  const [orgOfferings, orgSubServices] = await Promise.all([
    prisma.sellerServiceOffering.findMany({
      where: { affiliateId: { in: sellerIds }, selected: true },
      select: { affiliateId: true, serviceType: true, basePricePerVisit: true },
    }),
    prisma.sellerOrgSubService.findMany({
      where: { affiliateId: { in: sellerIds }, selected: true, unitPrice: { not: null } },
      select: { affiliateId: true, serviceType: true, subType: true, unitPrice: true },
    }),
  ]);

  // Build a map: sellerId -> serviceType -> orgPrice
  const orgPriceMap = new Map<string, Map<string, Prisma.Decimal | null>>();
  // Build a map: sellerId -> Set of org-level selected service types (for fallback)
  const orgServiceTypesMap = new Map<string, Set<string>>();
  for (const o of orgOfferings) {
    if (!orgPriceMap.has(o.affiliateId)) {
      orgPriceMap.set(o.affiliateId, new Map());
    }
    orgPriceMap.get(o.affiliateId)!.set(o.serviceType, o.basePricePerVisit);
    if (!orgServiceTypesMap.has(o.affiliateId)) {
      orgServiceTypesMap.set(o.affiliateId, new Set());
    }
    orgServiceTypesMap.get(o.affiliateId)!.add(o.serviceType);
  }

  // Build a map: sellerId -> "serviceType:subType" -> orgUnitPrice
  const orgSubPriceMap = new Map<string, Map<string, Prisma.Decimal>>();
  for (const s of orgSubServices) {
    if (!s.unitPrice) continue;
    if (!orgSubPriceMap.has(s.affiliateId)) {
      orgSubPriceMap.set(s.affiliateId, new Map());
    }
    orgSubPriceMap.get(s.affiliateId)!.set(`${s.serviceType}:${s.subType}`, s.unitPrice);
  }

  const locations: NetworkLocationItem[] = [];

  for (const contract of contracts) {
    const sellerLocations = allLocations.filter((l) => l.affiliateId === contract.sellerId);

    for (const loc of sellerLocations) {
      const termKey = `${contract.id}:${loc.id}`;
      const latestTerm = latestTerms.get(termKey);
      const included = latestTerm?.status === "ACTIVE";

      // Per-location service configs override org defaults; if none exist, fall back to org-level
      const hasLocConfigs = loc.serviceConfigs.length > 0;
      const enabledServices = hasLocConfigs
        ? loc.serviceConfigs.filter((sc) => sc.available).map((sc) => sc.serviceType)
        : Array.from(orgServiceTypesMap.get(contract.sellerId) ?? []);

      // Resolve pricing — prefer contract price list, fall back to org-level
      let pricing: PricingItem[] | null = null;
      const pricingItems: PricingItem[] = [];
      const contractHasPriceList = !!contract.priceList;
      const sellerHasPriceLists = !contractHasPriceList && sellersWithPriceLists.has(contract.sellerId);

      if (contract.priceList) {
        // Build org-wide and location-specific price maps from the price list
        const plOrgVisitMap = new Map<string, Prisma.Decimal | null>();
        const plLocVisitMap = new Map<string, Prisma.Decimal | null>();
        for (const v of contract.priceList.visitPrices) {
          if (v.sellerLocationId === loc.id) {
            plLocVisitMap.set(v.serviceType, v.pricePerVisit);
          } else if (v.sellerLocationId == null) {
            plOrgVisitMap.set(v.serviceType, v.pricePerVisit);
          }
        }

        for (const svc of enabledServices) {
          // Location-specific row > org-wide row (within same price list)
          const resolvedPrice = plLocVisitMap.get(svc) ?? plOrgVisitMap.get(svc);
          if (resolvedPrice) {
            pricingItems.push({
              serviceType: svc,
              label: svc,
              price: `$${Number(resolvedPrice).toFixed(2)}`,
              payer: "plan",
            });
          }
        }

        // Build org-wide and location-specific sub-service maps
        const plOrgSubMap = new Map<string, Prisma.Decimal | null>();
        const plLocSubMap = new Map<string, Prisma.Decimal | null>();
        for (const sp of contract.priceList.subPrices) {
          const key = `${sp.serviceType}:${sp.subType}`;
          if (sp.sellerLocationId === loc.id) {
            plLocSubMap.set(key, sp.unitPrice);
          } else if (sp.sellerLocationId == null) {
            plOrgSubMap.set(key, sp.unitPrice);
          }
        }

        // Use contract's price list for sub-service prices
        // Iterate org-wide sub-services as the base set
        for (const sp of contract.priceList.subPrices.filter((s) => s.sellerLocationId == null)) {
          const key = `${sp.serviceType}:${sp.subType}`;
          // Skip if location explicitly marks this sub-service as unavailable
          const locSub = loc.subServices?.find(
            (ls: { serviceType: string; subType: string; available?: boolean }) =>
              ls.serviceType === sp.serviceType && ls.subType === sp.subType
          );
          if (locSub && locSub.available === false) continue;
          const resolvedPrice = plLocSubMap.get(key) ?? plOrgSubMap.get(key);
          if (resolvedPrice == null) continue;
          pricingItems.push({
            serviceType: sp.serviceType,
            subType: sp.subType,
            label: sp.subType,
            price: `$${Number(resolvedPrice).toFixed(2)}`,
            payer: coveredSubSet.has(`${sp.serviceType}:${sp.subType}`) ? "plan" : "patient",
          });
        }
      } else if (!sellerHasPriceLists) {
        // Fall back to org-level pricing only when seller has no price lists
        // (if seller has price lists, org-level pricing is misleading)
        const sellerPrices = orgPriceMap.get(contract.sellerId);
        if (sellerPrices) {
          const pricedServiceTypes = new Set<string>();

          for (const svc of enabledServices) {
            const orgPrice = sellerPrices.get(svc);
            if (orgPrice) {
              pricingItems.push({
                serviceType: svc,
                label: svc,
                price: `$${Number(orgPrice).toFixed(2)}`,
                payer: "plan",
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
                payer: "plan",
              });
            }
          }

          const sellerSubPrices = orgSubPriceMap.get(contract.sellerId);
          if (sellerSubPrices) {
            for (const [key, unitPrice] of sellerSubPrices) {
              const [svcType, subType] = key.split(":");
              // Skip if location explicitly marks this sub-service as unavailable
              const locSub = loc.subServices?.find(
                (ls: { serviceType: string; subType: string }) =>
                  ls.serviceType === svcType && ls.subType === subType
              );
              if (locSub && !(locSub as { available?: boolean }).available) continue;
              pricingItems.push({
                serviceType: svcType,
                subType,
                label: subType,
                price: `$${Number(unitPrice).toFixed(2)}`,
                payer: coveredSubSet.has(`${svcType}:${subType}`) ? "plan" : "patient",
              });
            }
          }
        }
      }

      if (pricingItems.length > 0) {
        pricing = pricingItems;
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
        hasPriceLists: sellerHasPriceLists,
        hasPricing: pricingItems.length > 0,
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
      priceListId: contract.priceListId,
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

// ─── Get Contract Info (for price list selection) ───────────────────

export interface ContractInfo {
  contractId: string;
  sellerId: string;
  priceListId: string | null;
}

export async function getContractInfo(contractId: string): Promise<ContractInfo> {
  const ctx = await getSessionContext();

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { id: true, affiliateId: true, sellerId: true, priceListId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  return {
    contractId: contract.id,
    sellerId: contract.sellerId,
    priceListId: contract.priceListId,
  };
}

// ─── Add Location Term (creates ACTIVE term) ───────────────────────

export async function addLocationTerm(
  contractId: string,
  sellerLocationId: string,
  acceptedPricing: unknown,
  endDate?: Date,
  selectedProgramId?: string,
): Promise<void> {
  const ctx = await getSessionContext(selectedProgramId);

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

  await prisma.networkContractTerm.create({
    data: {
      contractId,
      sellerLocationId,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: endDate ?? null,
      acceptedPricing: acceptedPricing as Prisma.InputJsonValue,
      acceptedByUserId: ctx.userId,
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
  selectedProgramId?: string,
): Promise<void> {
  const ctx = await getSessionContext(selectedProgramId);

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

  // Find the latest ACTIVE term for this contract+location pair
  const activeTerm = await prisma.networkContractTerm.findFirst({
    where: { contractId, sellerLocationId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!activeTerm) {
    throw new Error("No active term found for this location");
  }

  await prisma.networkContractTerm.update({
    where: { id: activeTerm.id },
    data: {
      status: "INACTIVE",
      inactiveReason: reason as never, // enum value
      inactiveNote: note || null,
      endDate: new Date(),
      updatedByUserId: ctx.userId,
    },
  });
}

// ─── Remove Location Terms in Bulk ───────────────────────────────────

export async function removeLocationTermsBulk(
  contractId: string,
  sellerLocationIds: string[],
  reason: string,
  note?: string,
  selectedProgramId?: string,
): Promise<void> {
  const ctx = await getSessionContext(selectedProgramId);

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

  // Find all ACTIVE terms for the given contract+location pairs
  const activeTerms = await prisma.networkContractTerm.findMany({
    where: {
      contractId,
      sellerLocationId: { in: sellerLocationIds },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (activeTerms.length === 0) {
    return; // No active terms to remove (may have been cleared already)
  }

  await prisma.$transaction(
    activeTerms.map((term) =>
      prisma.networkContractTerm.update({
        where: { id: term.id },
        data: {
          status: "INACTIVE",
          inactiveReason: reason as never,
          inactiveNote: note || null,
          endDate: new Date(),
          updatedByUserId: ctx.userId,
        },
      }),
    ),
  );

  // If all terms are now inactive, clear the price list so user can re-select
  const remainingActive = await prisma.networkContractTerm.count({
    where: { contractId, status: "ACTIVE" },
  });
  if (remainingActive === 0) {
    await prisma.networkContract.update({
      where: { id: contractId },
      data: { priceListId: null },
    });
  }
}

// ─── Clear Contract Price List (for price list change) ───────────────

export async function clearContractPriceList(
  contractId: string,
  selectedProgramId?: string,
): Promise<void> {
  const ctx = await getSessionContext(selectedProgramId);
  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { affiliateId: true, sellerId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }
  if (contract.sellerId === ctx.affiliateId) {
    throw new Error("Cannot change pricing for your own locations");
  }

  // Set all active terms to INACTIVE and clear priceListId
  const activeTerms = await prisma.networkContractTerm.findMany({
    where: { contractId, status: "ACTIVE" },
    select: { id: true },
  });

  await prisma.$transaction([
    ...activeTerms.map(t =>
      prisma.networkContractTerm.update({
        where: { id: t.id },
        data: {
          status: "INACTIVE",
          inactiveReason: "PRICING_CHANGE" as never,
          endDate: new Date(),
          updatedByUserId: ctx.userId,
        },
      }),
    ),
    prisma.networkContract.update({
      where: { id: contractId },
      data: { priceListId: null },
    }),
  ]);
}

// ─── Load Seller Pricing (for acceptance modal) ─────────────────────

export interface SellerPricingData {
  sellerName: string | null;
  locationCount: number;
  services: { serviceType: string; price: number | null }[];
  subServicePrices: { serviceType: string; subType: string; label: string; unitPrice: number | null }[];
}

export async function loadSellerPricing(contractId: string, selectedProgramId?: string): Promise<SellerPricingData> {
  const ctx = await getSessionContext(selectedProgramId);

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { affiliateId: true, sellerId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  const [seller, offerings, locationCount, orgSubs] = await Promise.all([
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
    prisma.sellerOrgSubService.findMany({
      where: { affiliateId: contract.sellerId, selected: true },
      select: { serviceType: true, subType: true, unitPrice: true },
      orderBy: [{ serviceType: "asc" }, { subType: "asc" }],
    }),
  ]);

  return {
    sellerName: seller?.legalName ?? null,
    locationCount,
    services: offerings.map((o) => ({
      serviceType: o.serviceType,
      price: o.basePricePerVisit ? Number(o.basePricePerVisit) : null,
    })),
    subServicePrices: orgSubs.map((s) => ({
      serviceType: s.serviceType,
      subType: s.subType,
      label: s.subType, // label resolved client-side via SUB_SERVICE_TYPES
      unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
    })),
  };
}

// ─── Location Pricing Review (plan/patient split, location-level) ────

export interface PricingReviewSubService {
  serviceType: string;
  subType: string;
  label: string;
  unitPrice: number | null;
  payer: "plan" | "patient";
}

export interface LocationPricingReview {
  sellerLocationId: string;
  locationName: string;
  address: string;
  visitFees: { serviceType: string; label: string; price: number | null }[];
  planPays: Record<string, PricingReviewSubService[]>;   // grouped by serviceType
  patientPays: Record<string, PricingReviewSubService[]>; // grouped by serviceType
}

export async function loadLocationPricingReview(
  contractId: string,
  sellerLocationIds: string[],
  selectedProgramId?: string,
  previewPriceListId?: string,
): Promise<{
  sellerName: string;
  locations: LocationPricingReview[];
}> {
  const ctx = await getSessionContext(selectedProgramId);

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: {
      affiliateId: true,
      sellerId: true,
      priceListId: true,
      priceList: {
        include: {
          visitPrices: true,
          subPrices: true,
        },
      },
    },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  // 1. Load affiliate's plan sub-services → covered set
  const programId = ctx.programId;
  let coveredSubSet = new Set<string>(); // "serviceType:subType"
  if (programId) {
    const coveredSubs = await prisma.subService.findMany({
      where: { programId, selected: true },
      select: { serviceType: true, subType: true },
    });
    coveredSubSet = new Set(coveredSubs.map((s) => `${s.serviceType}:${s.subType}`));
  }

  // 2. Load seller org name
  const seller = await prisma.affiliate.findUnique({
    where: { id: contract.sellerId },
    select: { legalName: true },
  });

  // 3. Build visit price + sub-service price sources (price list or org-level fallback)
  const visitPriceMap = new Map<string, number | null>();
  interface SubServiceSource { serviceType: string; subType: string; unitPrice: number | null }
  const subServiceSources: SubServiceSource[] = [];

  // Load preview price list if specified, otherwise use contract's price list
  const effectivePriceListId = previewPriceListId ?? contract.priceListId;
  let priceListData = contract.priceList;
  if (previewPriceListId && previewPriceListId !== contract.priceListId) {
    // Verify the preview price list belongs to this seller
    priceListData = await prisma.sellerPriceList.findFirst({
      where: { id: previewPriceListId, affiliateId: contract.sellerId },
      include: { visitPrices: true, subPrices: true },
    });
    if (!priceListData) {
      throw new Error("Price list not found or not accessible");
    }
  }

  if (priceListData && effectivePriceListId) {
    for (const v of priceListData.visitPrices) {
      visitPriceMap.set(v.serviceType, v.pricePerVisit ? Number(v.pricePerVisit) : null);
    }
    for (const s of priceListData.subPrices) {
      subServiceSources.push({
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
      });
    }
  } else {
    // Org-level fallback
    const orgOfferings = await prisma.sellerServiceOffering.findMany({
      where: { affiliateId: contract.sellerId, selected: true },
      select: { serviceType: true, basePricePerVisit: true },
    });
    for (const o of orgOfferings) {
      visitPriceMap.set(o.serviceType, o.basePricePerVisit ? Number(o.basePricePerVisit) : null);
    }
    const orgSubServices = await prisma.sellerOrgSubService.findMany({
      where: { affiliateId: contract.sellerId, selected: true },
      select: { serviceType: true, subType: true, unitPrice: true },
      orderBy: [{ serviceType: "asc" }, { subType: "asc" }],
    });
    for (const s of orgSubServices) {
      subServiceSources.push({
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
      });
    }
  }

  // 4. Load requested seller locations with availability overrides
  const sellerLocations = await prisma.sellerLocation.findMany({
    where: { id: { in: sellerLocationIds }, affiliateId: contract.sellerId },
    include: {
      serviceConfigs: {
        select: { serviceType: true, available: true },
      },
      subServices: {
        select: { serviceType: true, subType: true, available: true },
      },
    },
    orderBy: { locationName: "asc" },
  });

  // 4b. If using a price list, load location-specific price overrides
  const locVisitOverrides = new Map<string, Map<string, number | null>>(); // locId -> serviceType -> price
  const locSubOverrides = new Map<string, Map<string, number | null>>(); // locId -> "serviceType:subType" -> price
  if (priceListData && effectivePriceListId) {
    for (const v of priceListData.visitPrices) {
      if (v.sellerLocationId == null) continue;
      if (!locVisitOverrides.has(v.sellerLocationId)) locVisitOverrides.set(v.sellerLocationId, new Map());
      locVisitOverrides.get(v.sellerLocationId)!.set(v.serviceType, v.pricePerVisit ? Number(v.pricePerVisit) : null);
    }
    for (const s of priceListData.subPrices) {
      if (s.sellerLocationId == null) continue;
      if (!locSubOverrides.has(s.sellerLocationId)) locSubOverrides.set(s.sellerLocationId, new Map());
      locSubOverrides.get(s.sellerLocationId)!.set(`${s.serviceType}:${s.subType}`, s.unitPrice ? Number(s.unitPrice) : null);
    }
  }

  // 5. Build location-level pricing reviews
  const locations: LocationPricingReview[] = sellerLocations.map((loc) => {
    const visitFees: LocationPricingReview["visitFees"] = [];
    const locVisitMap = locVisitOverrides.get(loc.id);
    for (const [serviceType, basePrice] of visitPriceMap) {
      const locConfig = loc.serviceConfigs.find((sc) => sc.serviceType === serviceType);
      if (locConfig && !locConfig.available) continue;
      // Location-specific price list row > org-wide price list/org-level row
      const resolvedPrice = locVisitMap?.get(serviceType) ?? basePrice;
      if (resolvedPrice == null) continue;
      visitFees.push({ serviceType, label: serviceType, price: resolvedPrice });
    }

    const planPays: Record<string, PricingReviewSubService[]> = {};
    const patientPays: Record<string, PricingReviewSubService[]> = {};
    const locSubMap = locSubOverrides.get(loc.id);

    for (const src of subServiceSources) {
      const locSub = loc.subServices?.find(
        (ls) => ls.serviceType === src.serviceType && ls.subType === src.subType,
      );
      if (locSub && !locSub.available) continue;

      // Location-specific price list row > org-wide source
      const key = `${src.serviceType}:${src.subType}`;
      const resolvedPrice = locSubMap?.get(key) ?? src.unitPrice;
      const payer = coveredSubSet.has(key) ? "plan" : "patient";

      const item: PricingReviewSubService = {
        serviceType: src.serviceType,
        subType: src.subType,
        label: src.subType,
        unitPrice: resolvedPrice,
        payer,
      };

      const target = payer === "plan" ? planPays : patientPays;
      if (!target[src.serviceType]) target[src.serviceType] = [];
      target[src.serviceType].push(item);
    }

    const address = [loc.streetAddress, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");

    return {
      sellerLocationId: loc.id,
      locationName: loc.locationName ?? "",
      address,
      visitFees,
      planPays,
      patientPays,
    };
  });

  return {
    sellerName: seller?.legalName ?? "Unknown",
    locations,
  };
}

// ─── Bulk Pricing Review (smart grouping by override status) ─────────

export interface BulkPricingReviewData {
  sellerName: string;
  // Org-level pricing (shared by default locations)
  visitFees: { serviceType: string; label: string; price: number | null }[];
  planPays: Record<string, PricingReviewSubService[]>;
  patientPays: Record<string, PricingReviewSubService[]>;
  // Locations using org defaults (just display info)
  defaultLocations: { sellerLocationId: string; locationName: string; address: string }[];
  // Locations with overrides (full pricing detail)
  overrideLocations: LocationPricingReview[];
}

export async function loadBulkPricingReview(
  contractId: string,
  sellerLocationIds: string[],
  selectedProgramId?: string,
  previewPriceListId?: string,
): Promise<BulkPricingReviewData> {
  const ctx = await getSessionContext(selectedProgramId);

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: {
      affiliateId: true,
      sellerId: true,
      priceListId: true,
      priceList: {
        include: {
          visitPrices: true,
          subPrices: true,
        },
      },
    },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  // 1. Load affiliate's plan sub-services → covered set
  const programId = ctx.programId;
  let coveredSubSet = new Set<string>();
  if (programId) {
    const coveredSubs = await prisma.subService.findMany({
      where: { programId, selected: true },
      select: { serviceType: true, subType: true },
    });
    coveredSubSet = new Set(coveredSubs.map((s) => `${s.serviceType}:${s.subType}`));
  }

  // 2. Load seller org name
  const seller = await prisma.affiliate.findUnique({
    where: { id: contract.sellerId },
    select: { legalName: true },
  });

  // 3. Build visit price + sub-service sources (price list or org-level fallback)
  const visitPriceMap = new Map<string, number | null>();
  interface BulkSubSource { serviceType: string; subType: string; unitPrice: number | null }
  const subServiceSources: BulkSubSource[] = [];

  // Load preview price list if specified, otherwise use contract's price list
  const effectivePriceListId = previewPriceListId ?? contract.priceListId;
  let priceListData = contract.priceList;
  if (previewPriceListId && previewPriceListId !== contract.priceListId) {
    // Verify the preview price list belongs to this seller
    priceListData = await prisma.sellerPriceList.findFirst({
      where: { id: previewPriceListId, affiliateId: contract.sellerId },
      include: { visitPrices: true, subPrices: true },
    });
    if (!priceListData) {
      throw new Error("Price list not found or not accessible");
    }
  }

  if (priceListData && effectivePriceListId) {
    for (const v of priceListData.visitPrices) {
      visitPriceMap.set(v.serviceType, v.pricePerVisit ? Number(v.pricePerVisit) : null);
    }
    for (const s of priceListData.subPrices) {
      subServiceSources.push({
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
      });
    }
  } else {
    const orgOfferings = await prisma.sellerServiceOffering.findMany({
      where: { affiliateId: contract.sellerId, selected: true },
      select: { serviceType: true, basePricePerVisit: true },
    });
    for (const o of orgOfferings) {
      visitPriceMap.set(o.serviceType, o.basePricePerVisit ? Number(o.basePricePerVisit) : null);
    }
    const orgSubServices = await prisma.sellerOrgSubService.findMany({
      where: { affiliateId: contract.sellerId, selected: true },
      select: { serviceType: true, subType: true, unitPrice: true },
      orderBy: [{ serviceType: "asc" }, { subType: "asc" }],
    });
    for (const s of orgSubServices) {
      subServiceSources.push({
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
      });
    }
  }

  // Build base visit fees
  const orgVisitFees: BulkPricingReviewData["visitFees"] = [];
  for (const [serviceType, price] of visitPriceMap) {
    if (price == null) continue;
    orgVisitFees.push({ serviceType, label: serviceType, price });
  }

  // Build base sub-service pricing split by payer
  const orgPlanPays: Record<string, PricingReviewSubService[]> = {};
  const orgPatientPays: Record<string, PricingReviewSubService[]> = {};
  for (const src of subServiceSources) {
    const payer = coveredSubSet.has(`${src.serviceType}:${src.subType}`) ? "plan" : "patient";
    const item: PricingReviewSubService = {
      serviceType: src.serviceType,
      subType: src.subType,
      label: src.subType,
      unitPrice: src.unitPrice,
      payer,
    };
    const target = payer === "plan" ? orgPlanPays : orgPatientPays;
    if (!target[src.serviceType]) target[src.serviceType] = [];
    target[src.serviceType].push(item);
  }

  // 4. Load all requested locations with their availability overrides
  const sellerLocations = await prisma.sellerLocation.findMany({
    where: { id: { in: sellerLocationIds }, affiliateId: contract.sellerId },
    include: {
      serviceConfigs: {
        select: { serviceType: true, available: true },
      },
      subServices: {
        select: { serviceType: true, subType: true, available: true },
      },
    },
    orderBy: { locationName: "asc" },
  });

  // 4b. If using a price list, load location-specific price overrides
  const locVisitOverrides = new Map<string, Map<string, number | null>>();
  const locSubOverrides = new Map<string, Map<string, number | null>>();
  if (priceListData && effectivePriceListId) {
    for (const v of priceListData.visitPrices) {
      if (v.sellerLocationId == null) continue;
      if (!locVisitOverrides.has(v.sellerLocationId)) locVisitOverrides.set(v.sellerLocationId, new Map());
      locVisitOverrides.get(v.sellerLocationId)!.set(v.serviceType, v.pricePerVisit ? Number(v.pricePerVisit) : null);
    }
    for (const s of priceListData.subPrices) {
      if (s.sellerLocationId == null) continue;
      if (!locSubOverrides.has(s.sellerLocationId)) locSubOverrides.set(s.sellerLocationId, new Map());
      locSubOverrides.get(s.sellerLocationId)!.set(`${s.serviceType}:${s.subType}`, s.unitPrice ? Number(s.unitPrice) : null);
    }
  }

  // 5. Classify locations: override vs default
  const defaultLocations: BulkPricingReviewData["defaultLocations"] = [];
  const overrideLocations: LocationPricingReview[] = [];

  for (const loc of sellerLocations) {
    const address = [loc.streetAddress, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");

    // Check if location has any overrides: availability toggles OR location-specific price list rows
    const hasAvailabilityOverride = loc.serviceConfigs.some((sc) => !sc.available) ||
      loc.subServices.some((ls) => !ls.available);
    const hasPriceListOverride = locVisitOverrides.has(loc.id) || locSubOverrides.has(loc.id);
    const hasOverrides = hasAvailabilityOverride || hasPriceListOverride;

    if (!hasOverrides) {
      defaultLocations.push({
        sellerLocationId: loc.id,
        locationName: loc.locationName ?? "",
        address,
      });
    } else {
      // Resolve per-location pricing using same sources + location overrides
      const visitFees: LocationPricingReview["visitFees"] = [];
      const locVisitMap = locVisitOverrides.get(loc.id);
      for (const [serviceType, basePrice] of visitPriceMap) {
        const locConfig = loc.serviceConfigs.find((sc) => sc.serviceType === serviceType);
        if (locConfig && !locConfig.available) continue;
        const resolvedPrice = locVisitMap?.get(serviceType) ?? basePrice;
        if (resolvedPrice == null) continue;
        visitFees.push({ serviceType, label: serviceType, price: resolvedPrice });
      }

      const planPays: Record<string, PricingReviewSubService[]> = {};
      const patientPays: Record<string, PricingReviewSubService[]> = {};
      const locSubMap = locSubOverrides.get(loc.id);
      for (const src of subServiceSources) {
        const locSub = loc.subServices?.find(
          (ls) => ls.serviceType === src.serviceType && ls.subType === src.subType,
        );
        if (locSub && !locSub.available) continue;
        const key = `${src.serviceType}:${src.subType}`;
        const resolvedPrice = locSubMap?.get(key) ?? src.unitPrice;
        const payer = coveredSubSet.has(key) ? "plan" : "patient";
        const item: PricingReviewSubService = {
          serviceType: src.serviceType,
          subType: src.subType,
          label: src.subType,
          unitPrice: resolvedPrice,
          payer,
        };
        const target = payer === "plan" ? planPays : patientPays;
        if (!target[src.serviceType]) target[src.serviceType] = [];
        target[src.serviceType].push(item);
      }

      overrideLocations.push({
        sellerLocationId: loc.id,
        locationName: loc.locationName ?? "",
        address,
        visitFees,
        planPays,
        patientPays,
      });
    }
  }

  return {
    sellerName: seller?.legalName ?? "Unknown",
    visitFees: orgVisitFees,
    planPays: orgPlanPays,
    patientPays: orgPatientPays,
    defaultLocations,
    overrideLocations,
  };
}

// ─── Add Location Terms in Bulk ──────────────────────────────────────

export async function addLocationTermsBulk(
  contractId: string,
  sellerLocationIds: string[],
  acceptedPricing: unknown,
  selectedProgramId?: string,
  priceListId?: string,
): Promise<void> {
  const ctx = await getSessionContext(selectedProgramId);

  const contract = await prisma.networkContract.findUnique({
    where: { id: contractId },
    select: { affiliateId: true, sellerId: true, priceListId: true },
  });
  if (!contract || contract.affiliateId !== ctx.affiliateId) {
    throw new Error("Contract not found");
  }

  // Verify all locations belong to this seller
  const locs = await prisma.sellerLocation.findMany({
    where: { id: { in: sellerLocationIds }, affiliateId: contract.sellerId },
    select: { id: true },
  });
  const validIds = new Set(locs.map((l) => l.id));
  const invalidIds = sellerLocationIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error(`Locations not found for this seller: ${invalidIds.join(", ")}`);
  }

  // Set price list on contract if provided and not already set (atomic to prevent race)
  if (priceListId && !contract.priceListId) {
    await prisma.networkContract.updateMany({
      where: { id: contractId, priceListId: null },
      data: { priceListId },
    });
  }

  // Filter out locations that already have an active term to prevent duplicates
  const existingActive = await prisma.networkContractTerm.findMany({
    where: { contractId, sellerLocationId: { in: sellerLocationIds }, status: "ACTIVE" },
    select: { sellerLocationId: true },
  });
  const alreadyActive = new Set(existingActive.map((t) => t.sellerLocationId));
  const newLocationIds = sellerLocationIds.filter((id) => !alreadyActive.has(id));

  if (newLocationIds.length > 0) {
    await prisma.$transaction(
      newLocationIds.map((sellerLocationId) =>
        prisma.networkContractTerm.create({
          data: {
            contractId,
            sellerLocationId,
            status: "ACTIVE",
            startDate: new Date(),
            acceptedPricing: acceptedPricing as Prisma.InputJsonValue,
            acceptedByUserId: ctx.userId,
            updatedByUserId: ctx.userId,
          },
        }),
      ),
    );
  }
}
