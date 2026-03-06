"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";
import { priceListSchema, type PriceListData } from "@/lib/validations/price-list";
import type { LocationOverrideData, BundleRuleData } from "@/lib/validations/price-list";
import { computeSellerStatuses } from "./seller-org";
import type { Prisma } from "@prisma/client";
import type { CompletionStatus, SellerSectionId } from "@/types";

// Only clinic_visit uses visit-level pricing; other service types are sub-service-only
const VISIT_PRICE_SERVICE_TYPES = ["clinic_visit"];

// ─── Types ──────────────────────────────────────────────────────────

export interface PriceListSummary {
  id: string;
  name: string;
  isPublic: boolean;
  pricedCount: number;
  totalCount: number;
  overrideLocationCount: number;
  bundleRuleCount: number;
  rules: Array<{
    buyerId: string;
    buyerName: string;
    programId: string | null;
    programName: string | null;
  }>;
}

export interface BundleRuleDetail {
  name: string;
  ruleType: "flat_rate";
  price: number;
  includesVisitFee: boolean;
  targets: Array<{ serviceType: string; subType: string | null }>;
}

export interface PriceListDetail {
  id: string;
  name: string;
  isPublic: boolean;
  rules: Array<{
    id: string;
    buyerId: string;
    buyerName: string;
    programId: string | null;
    programName: string | null;
  }>;
  visitPrices: Array<{
    serviceType: string;
    price: number | null;
  }>;
  subServicePrices: Array<{
    serviceType: string;
    subType: string;
    unitPrice: number | null;
  }>;
  bundleRules: BundleRuleDetail[];
  locationOverrides: Array<{
    sellerLocationId: string;
    locationName: string;
    visitPrices: Array<{ serviceType: string; price: number | null }>;
    subServicePrices: Array<{ serviceType: string; subType: string; unitPrice: number | null }>;
    bundleRules: BundleRuleDetail[];
  }>;
  sellerLocations: Array<{ id: string; locationName: string }>;
}

export interface EligiblePriceList {
  id: string;
  name: string;
  clinicVisitPrice: number | null;
  pricedSubServiceCount: number;
}

// ─── List ──────────────────────────────────────────────────────────

export async function listPriceLists(): Promise<PriceListSummary[]> {
  const ctx = await getSessionContext();

  const priceLists = await prisma.sellerPriceList.findMany({
    where: { affiliateId: ctx.affiliateId },
    include: {
      visitPrices: {
        where: { serviceType: { in: VISIT_PRICE_SERVICE_TYPES }, sellerLocationId: null },
        select: { pricePerVisit: true },
      },
      subPrices: {
        where: { sellerLocationId: null },
        select: { unitPrice: true },
      },
      _count: {
        select: { bundles: true },
      },
      rules: {
        include: {
          buyer: { select: { legalName: true } },
          program: { select: { programName: true } },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  // Count distinct location overrides per price list
  const overrideCounts = await Promise.all(
    priceLists.map(async (pl) => {
      const visitLocs = await prisma.sellerPriceListVisit.findMany({
        where: { priceListId: pl.id, sellerLocationId: { not: null } },
        select: { sellerLocationId: true },
        distinct: ["sellerLocationId"],
      });
      const subLocs = await prisma.sellerPriceListSubService.findMany({
        where: { priceListId: pl.id, sellerLocationId: { not: null } },
        select: { sellerLocationId: true },
        distinct: ["sellerLocationId"],
      });
      const allLocIds = new Set([
        ...visitLocs.map((v) => v.sellerLocationId!),
        ...subLocs.map((s) => s.sellerLocationId!),
      ]);
      return allLocIds.size;
    })
  );

  return priceLists.map((pl, idx) => {
    const visitTotal = pl.visitPrices.length;
    const visitPriced = pl.visitPrices.filter((v) => v.pricePerVisit != null).length;
    const subTotal = pl.subPrices.length;
    const subPriced = pl.subPrices.filter((s) => s.unitPrice != null).length;

    return {
      id: pl.id,
      name: pl.name,
      isPublic: pl.isPublic,
      pricedCount: visitPriced + subPriced,
      totalCount: visitTotal + subTotal,
      overrideLocationCount: overrideCounts[idx],
      bundleRuleCount: pl._count.bundles,
      rules: pl.rules.map((r) => ({
        buyerId: r.buyerId,
        buyerName: r.buyer.legalName ?? "",
        programId: r.programId,
        programName: r.program?.programName ?? null,
      })),
    };
  });
}

// ─── Load ──────────────────────────────────────────────────────────

export async function loadPriceList(priceListId: string): Promise<PriceListDetail> {
  const ctx = await getSessionContext();

  const pl = await prisma.sellerPriceList.findFirst({
    where: { id: priceListId, affiliateId: ctx.affiliateId },
    include: {
      visitPrices: true,
      subPrices: true,
      bundles: {
        include: { targets: true },
        orderBy: { createdAt: "asc" },
      },
      rules: {
        include: {
          buyer: { select: { legalName: true } },
          program: { select: { programName: true } },
        },
      },
    },
  });

  if (!pl) throw new Error("Price list not found");

  // Load seller's locations for the override UI picker
  const sellerLocations = await prisma.sellerLocation.findMany({
    where: { affiliateId: ctx.affiliateId },
    select: { id: true, locationName: true },
    orderBy: { locationName: "asc" },
  });

  // Separate org-wide rows (sellerLocationId = null) from location overrides
  const orgVisitPrices = pl.visitPrices.filter((v) => v.sellerLocationId == null);
  const orgSubPrices = pl.subPrices.filter((s) => s.sellerLocationId == null);
  const locVisitPrices = pl.visitPrices.filter((v) => v.sellerLocationId != null);
  const locSubPrices = pl.subPrices.filter((s) => s.sellerLocationId != null);

  // Separate org-wide bundles from location-specific bundles
  const orgBundles = pl.bundles.filter((b) => b.sellerLocationId == null);
  const locBundles = pl.bundles.filter((b) => b.sellerLocationId != null);

  // Group location overrides by sellerLocationId
  const overrideMap = new Map<string, {
    visitPrices: Array<{ serviceType: string; price: number | null }>;
    subServicePrices: Array<{ serviceType: string; subType: string; unitPrice: number | null }>;
    bundleRules: BundleRuleDetail[];
  }>();

  for (const v of locVisitPrices) {
    const locId = v.sellerLocationId!;
    if (!overrideMap.has(locId)) overrideMap.set(locId, { visitPrices: [], subServicePrices: [], bundleRules: [] });
    overrideMap.get(locId)!.visitPrices.push({
      serviceType: v.serviceType,
      price: v.pricePerVisit ? Number(v.pricePerVisit) : null,
    });
  }
  for (const s of locSubPrices) {
    const locId = s.sellerLocationId!;
    if (!overrideMap.has(locId)) overrideMap.set(locId, { visitPrices: [], subServicePrices: [], bundleRules: [] });
    overrideMap.get(locId)!.subServicePrices.push({
      serviceType: s.serviceType,
      subType: s.subType,
      unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
    });
  }
  for (const b of locBundles) {
    const locId = b.sellerLocationId!;
    if (!overrideMap.has(locId)) overrideMap.set(locId, { visitPrices: [], subServicePrices: [], bundleRules: [] });
    overrideMap.get(locId)!.bundleRules.push({
      name: b.name,
      ruleType: b.ruleType as "flat_rate",
      price: Number(b.price),
      includesVisitFee: b.includesVisitFee,
      targets: b.targets.map((t) => ({ serviceType: t.serviceType, subType: t.subType })),
    });
  }

  const locationOverrides = Array.from(overrideMap.entries()).map(([locId, data]) => {
    const loc = sellerLocations.find((l) => l.id === locId);
    return {
      sellerLocationId: locId,
      locationName: loc?.locationName ?? "Unknown",
      visitPrices: data.visitPrices,
      subServicePrices: data.subServicePrices,
      bundleRules: data.bundleRules,
    };
  });

  return {
    id: pl.id,
    name: pl.name,
    isPublic: pl.isPublic,
    rules: pl.rules.map((r) => ({
      id: r.id,
      buyerId: r.buyerId,
      buyerName: r.buyer.legalName ?? "",
      programId: r.programId,
      programName: r.program?.programName ?? null,
    })),
    visitPrices: orgVisitPrices
      .filter((v) => VISIT_PRICE_SERVICE_TYPES.includes(v.serviceType))
      .map((v) => ({
        serviceType: v.serviceType,
        price: v.pricePerVisit ? Number(v.pricePerVisit) : null,
      })),
    subServicePrices: orgSubPrices.map((s) => ({
      serviceType: s.serviceType,
      subType: s.subType,
      unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
    })),
    bundleRules: orgBundles.map((b) => ({
      name: b.name,
      ruleType: b.ruleType as "flat_rate",
      price: Number(b.price),
      includesVisitFee: b.includesVisitFee,
      targets: b.targets.map((t) => ({ serviceType: t.serviceType, subType: t.subType })),
    })),
    locationOverrides,
    sellerLocations: sellerLocations.map((l) => ({
      id: l.id,
      locationName: l.locationName ?? "",
    })),
  };
}

// ─── Save (create or update) ────────────────────────────────────────

/** Flatten location overrides into visit/sub rows with sellerLocationId set */
function buildLocationOverrideRows(
  priceListId: string,
  overrides: LocationOverrideData[]
): {
  visitRows: Array<{ priceListId: string; serviceType: string; pricePerVisit: number | null; sellerLocationId: string }>;
  subRows: Array<{ priceListId: string; serviceType: string; subType: string; unitPrice: number | null; sellerLocationId: string }>;
} {
  const visitRows: Array<{ priceListId: string; serviceType: string; pricePerVisit: number | null; sellerLocationId: string }> = [];
  const subRows: Array<{ priceListId: string; serviceType: string; subType: string; unitPrice: number | null; sellerLocationId: string }> = [];

  for (const loc of overrides) {
    for (const vp of loc.visitPrices ?? []) {
      if (!VISIT_PRICE_SERVICE_TYPES.includes(vp.serviceType)) continue;
      visitRows.push({
        priceListId,
        serviceType: vp.serviceType,
        pricePerVisit: vp.price ?? null,
        sellerLocationId: loc.sellerLocationId,
      });
    }
    for (const sp of loc.subServicePrices ?? []) {
      subRows.push({
        priceListId,
        serviceType: sp.serviceType,
        subType: sp.subType,
        unitPrice: sp.unitPrice ?? null,
        sellerLocationId: loc.sellerLocationId,
      });
    }
  }

  return { visitRows, subRows };
}

/** Build bundle + target rows for createMany, using pre-generated IDs */
function buildBundleRows(
  priceListId: string,
  bundleRules: BundleRuleData[],
  sellerLocationId: string | null,
): {
  bundleRows: Array<{ id: string; priceListId: string; name: string; ruleType: string; price: number; capQuantity: number | null; includesVisitFee: boolean; sellerLocationId: string | null }>;
  targetRows: Array<{ bundleId: string; serviceType: string; subType: string | null }>;
} {
  const bundleRows: Array<{ id: string; priceListId: string; name: string; ruleType: string; price: number; capQuantity: number | null; includesVisitFee: boolean; sellerLocationId: string | null }> = [];
  const targetRows: Array<{ bundleId: string; serviceType: string; subType: string | null }> = [];

  for (const rule of bundleRules) {
    const bundleId = crypto.randomUUID();
    bundleRows.push({
      id: bundleId,
      priceListId,
      name: rule.name,
      ruleType: rule.ruleType,
      price: rule.price,
      capQuantity: null,
      includesVisitFee: rule.includesVisitFee,
      sellerLocationId,
    });
    for (const target of rule.targets) {
      targetRows.push({
        bundleId,
        serviceType: target.serviceType,
        subType: target.subType ?? null,
      });
    }
  }

  return { bundleRows, targetRows };
}

export async function savePriceList(
  data: PriceListData
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();
  const parsed = priceListSchema.parse(data);

  // Only persist visit prices for visit-level service types
  const filteredVisitPrices = (parsed.visitPrices ?? []).filter(
    (vp) => VISIT_PRICE_SERVICE_TYPES.includes(vp.serviceType)
  );

  // Flatten location overrides
  const locOverrides = parsed.locationOverrides ?? [];

  if (parsed.id) {
    // Update existing
    const existing = await prisma.sellerPriceList.findFirst({
      where: { id: parsed.id, affiliateId: ctx.affiliateId },
      select: { id: true },
    });
    if (!existing) throw new Error("Price list not found");

    const { visitRows, subRows } = buildLocationOverrideRows(parsed.id, locOverrides);

    // Combine org-wide + location-specific visit rows
    const allVisitRows = [
      ...filteredVisitPrices.map((vp) => ({
        priceListId: parsed.id!,
        serviceType: vp.serviceType,
        pricePerVisit: vp.price ?? null,
        sellerLocationId: null as string | null,
      })),
      ...visitRows.map((r) => ({ ...r, sellerLocationId: r.sellerLocationId as string | null })),
    ];

    // Combine org-wide + location-specific sub rows
    const allSubRows = [
      ...(parsed.subServicePrices ?? []).map((sp) => ({
        priceListId: parsed.id!,
        serviceType: sp.serviceType,
        subType: sp.subType,
        unitPrice: sp.unitPrice ?? null,
        sellerLocationId: null as string | null,
      })),
      ...subRows.map((r) => ({ ...r, sellerLocationId: r.sellerLocationId as string | null })),
    ];

    // Build bundle rows (org-wide + location override bundles)
    const orgBundleData = buildBundleRows(parsed.id, parsed.bundleRules ?? [], null);
    const locBundleData = locOverrides.flatMap((loc) =>
      buildBundleRows(parsed.id!, loc.bundleRules ?? [], loc.sellerLocationId).bundleRows.length > 0
        ? [buildBundleRows(parsed.id!, loc.bundleRules ?? [], loc.sellerLocationId)]
        : []
    );
    const allBundleRows = [
      ...orgBundleData.bundleRows,
      ...locBundleData.flatMap((d) => d.bundleRows),
    ];
    const allTargetRows = [
      ...orgBundleData.targetRows,
      ...locBundleData.flatMap((d) => d.targetRows),
    ];

    // Atomic update: name, visibility, prices, bundles, and rules in one transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txOps: Prisma.PrismaPromise<any>[] = [
      prisma.sellerPriceList.update({
        where: { id: parsed.id },
        data: { name: parsed.name, isPublic: parsed.isPublic },
      }),
      // Replace all visit prices (org-wide + location overrides)
      prisma.sellerPriceListVisit.deleteMany({ where: { priceListId: parsed.id } }),
      ...(allVisitRows.length > 0
        ? [prisma.sellerPriceListVisit.createMany({ data: allVisitRows })]
        : []),
      // Replace all sub-service prices (org-wide + location overrides)
      prisma.sellerPriceListSubService.deleteMany({ where: { priceListId: parsed.id } }),
      ...(allSubRows.length > 0
        ? [prisma.sellerPriceListSubService.createMany({ data: allSubRows })]
        : []),
      // Replace all bundles (cascade deletes targets)
      prisma.sellerPriceListBundle.deleteMany({ where: { priceListId: parsed.id } }),
      ...(allBundleRows.length > 0
        ? [prisma.sellerPriceListBundle.createMany({ data: allBundleRows })]
        : []),
      ...(allTargetRows.length > 0
        ? [prisma.sellerPriceListBundleTarget.createMany({ data: allTargetRows })]
        : []),
      // Replace rules
      prisma.sellerPriceListRule.deleteMany({ where: { priceListId: parsed.id } }),
      ...(!parsed.isPublic && (parsed.rules ?? []).length > 0
        ? [prisma.sellerPriceListRule.createMany({
            data: (parsed.rules ?? []).map((r) => ({
              priceListId: parsed.id!,
              buyerId: r.buyerId,
              programId: r.programId ?? null,
            })),
          })]
        : []),
    ];
    await prisma.$transaction(txOps);
  } else {
    // Create new
    const newPl = await prisma.sellerPriceList.create({
      data: {
        affiliateId: ctx.affiliateId,
        name: parsed.name,
        isPublic: parsed.isPublic,
        isDefault: false,
      },
    });

    const { visitRows, subRows } = buildLocationOverrideRows(newPl.id, locOverrides);

    // Org-wide + location visit prices
    const allVisitRows = [
      ...filteredVisitPrices.map((vp) => ({
        priceListId: newPl.id,
        serviceType: vp.serviceType,
        pricePerVisit: vp.price ?? null,
        sellerLocationId: null as string | null,
      })),
      ...visitRows.map((r) => ({ ...r, sellerLocationId: r.sellerLocationId as string | null })),
    ];
    if (allVisitRows.length > 0) {
      await prisma.sellerPriceListVisit.createMany({ data: allVisitRows });
    }

    // Org-wide + location sub-service prices
    const allSubRows = [
      ...(parsed.subServicePrices ?? []).map((sp) => ({
        priceListId: newPl.id,
        serviceType: sp.serviceType,
        subType: sp.subType,
        unitPrice: sp.unitPrice ?? null,
        sellerLocationId: null as string | null,
      })),
      ...subRows.map((r) => ({ ...r, sellerLocationId: r.sellerLocationId as string | null })),
    ];
    if (allSubRows.length > 0) {
      await prisma.sellerPriceListSubService.createMany({ data: allSubRows });
    }

    // Bundle rules (org-wide + location override)
    const newOrgBundleData = buildBundleRows(newPl.id, parsed.bundleRules ?? [], null);
    const newLocBundleData = locOverrides.flatMap((loc) =>
      buildBundleRows(newPl.id, loc.bundleRules ?? [], loc.sellerLocationId).bundleRows.length > 0
        ? [buildBundleRows(newPl.id, loc.bundleRules ?? [], loc.sellerLocationId)]
        : []
    );
    const newAllBundleRows = [
      ...newOrgBundleData.bundleRows,
      ...newLocBundleData.flatMap((d) => d.bundleRows),
    ];
    const newAllTargetRows = [
      ...newOrgBundleData.targetRows,
      ...newLocBundleData.flatMap((d) => d.targetRows),
    ];
    if (newAllBundleRows.length > 0) {
      await prisma.sellerPriceListBundle.createMany({ data: newAllBundleRows });
    }
    if (newAllTargetRows.length > 0) {
      await prisma.sellerPriceListBundleTarget.createMany({ data: newAllTargetRows });
    }

    if (!parsed.isPublic && parsed.rules && parsed.rules.length > 0) {
      await prisma.sellerPriceListRule.createMany({
        data: parsed.rules.map((r) => ({
          priceListId: newPl.id,
          buyerId: r.buyerId,
          programId: r.programId ?? null,
        })),
      });
    }
  }

  return computeSellerStatuses(ctx.affiliateId);
}

// ─── Delete ─────────────────────────────────────────────────────────

export async function deletePriceList(priceListId: string): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();

  const pl = await prisma.sellerPriceList.findFirst({
    where: { id: priceListId, affiliateId: ctx.affiliateId },
    select: { id: true },
  });
  if (!pl) throw new Error("Price list not found");

  const count = await prisma.sellerPriceList.count({ where: { affiliateId: ctx.affiliateId } });
  if (count <= 1) throw new Error("Cannot delete your only price list");

  await prisma.sellerPriceList.delete({ where: { id: priceListId } });

  return computeSellerStatuses(ctx.affiliateId);
}

// ─── Duplicate ──────────────────────────────────────────────────────

export async function duplicatePriceList(
  sourceId: string,
  newName: string
): Promise<{ id: string; statuses: Record<SellerSectionId, CompletionStatus> }> {
  const ctx = await getSessionContext();

  const source = await prisma.sellerPriceList.findFirst({
    where: { id: sourceId, affiliateId: ctx.affiliateId },
    include: {
      visitPrices: true,
      subPrices: true,
      bundles: { include: { targets: true } },
      rules: true,
    },
  });
  if (!source) throw new Error("Source price list not found");

  const newPl = await prisma.sellerPriceList.create({
    data: {
      affiliateId: ctx.affiliateId,
      name: newName,
      isPublic: source.isPublic,
      isDefault: false,
    },
  });

  const sourceVisitPrices = source.visitPrices.filter(
    (v) => VISIT_PRICE_SERVICE_TYPES.includes(v.serviceType) || v.sellerLocationId != null
  );
  if (sourceVisitPrices.length > 0) {
    await prisma.sellerPriceListVisit.createMany({
      data: sourceVisitPrices.map((v) => ({
        priceListId: newPl.id,
        serviceType: v.serviceType,
        pricePerVisit: v.pricePerVisit,
        sellerLocationId: v.sellerLocationId,
      })),
    });
  }

  if (source.subPrices.length > 0) {
    await prisma.sellerPriceListSubService.createMany({
      data: source.subPrices.map((s) => ({
        priceListId: newPl.id,
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice,
        sellerLocationId: s.sellerLocationId,
      })),
    });
  }

  // Clone bundles + targets
  if (source.bundles.length > 0) {
    const clonedBundleRows: Array<{ id: string; priceListId: string; name: string; ruleType: string; price: typeof source.bundles[0]["price"]; capQuantity: number | null; includesVisitFee: boolean; sellerLocationId: string | null }> = [];
    const clonedTargetRows: Array<{ bundleId: string; serviceType: string; subType: string | null }> = [];
    for (const b of source.bundles) {
      const newBundleId = crypto.randomUUID();
      clonedBundleRows.push({
        id: newBundleId,
        priceListId: newPl.id,
        name: b.name,
        ruleType: b.ruleType,
        price: b.price,
        capQuantity: b.capQuantity,
        includesVisitFee: b.includesVisitFee,
  
        sellerLocationId: b.sellerLocationId,
      });
      for (const t of b.targets) {
        clonedTargetRows.push({
          bundleId: newBundleId,
          serviceType: t.serviceType,
          subType: t.subType,
        });
      }
    }
    await prisma.sellerPriceListBundle.createMany({ data: clonedBundleRows });
    if (clonedTargetRows.length > 0) {
      await prisma.sellerPriceListBundleTarget.createMany({ data: clonedTargetRows });
    }
  }

  // Clone visibility rules
  if (!source.isPublic && source.rules.length > 0) {
    await prisma.sellerPriceListRule.createMany({
      data: source.rules.map((r) => ({
        priceListId: newPl.id,
        buyerId: r.buyerId,
        programId: r.programId,
      })),
    });
  }

  const statuses = await computeSellerStatuses(ctx.affiliateId);
  return { id: newPl.id, statuses };
}

// ─── Load Eligible Price Lists (buyer-facing) ───────────────────────

export async function loadEligiblePriceLists(
  sellerId: string,
  programId: string | null
): Promise<EligiblePriceList[]> {
  const ctx = await getSessionContext();
  const buyerId = ctx.affiliateId;

  // Load all price lists for this seller (org-wide rows only for summary)
  const allLists = await prisma.sellerPriceList.findMany({
    where: { affiliateId: sellerId },
    include: {
      visitPrices: {
        where: { serviceType: { in: VISIT_PRICE_SERVICE_TYPES }, sellerLocationId: null },
        select: { serviceType: true, pricePerVisit: true },
      },
      subPrices: {
        where: { sellerLocationId: null },
        select: { unitPrice: true },
      },
      rules: {
        select: { buyerId: true, programId: true },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  // Filter to eligible lists
  const eligible: EligiblePriceList[] = [];

  for (const pl of allLists) {
    let visible = false;

    if (pl.isPublic) {
      visible = true;
    } else {
      // Check rules: buyer match + (programId match OR null program = all plans)
      for (const rule of pl.rules) {
        if (rule.buyerId !== buyerId) continue;
        if (rule.programId === null || rule.programId === programId) {
          visible = true;
          break;
        }
      }
    }

    if (!visible) continue;

    const clinicVisit = pl.visitPrices.find((v) => v.serviceType === "clinic_visit");
    eligible.push({
      id: pl.id,
      name: pl.name,
      clinicVisitPrice: clinicVisit?.pricePerVisit ? Number(clinicVisit.pricePerVisit) : null,
      pricedSubServiceCount: pl.subPrices.filter((s) => s.unitPrice != null).length,
    });
  }

  return eligible;
}

// ─── Load Buyer Orgs (for rule selection in seller UI) ──────────────

export interface BuyerOrgOption {
  id: string;
  name: string;
  programs: Array<{ id: string; name: string }>;
}

export async function loadBuyerOrgs(): Promise<BuyerOrgOption[]> {
  const ctx = await getSessionContext();

  // Find buyers connected to this seller via NetworkContract
  const contracts = await prisma.networkContract.findMany({
    where: { sellerId: ctx.affiliateId },
    select: { affiliateId: true },
  });
  const buyerIds = [...new Set(contracts.map((c) => c.affiliateId))];

  // Also include self if dual-role (isAffiliate + isSeller)
  const self = await prisma.affiliate.findUnique({
    where: { id: ctx.affiliateId },
    select: { isAffiliate: true },
  });
  if (self?.isAffiliate && !buyerIds.includes(ctx.affiliateId)) {
    buyerIds.push(ctx.affiliateId);
  }

  if (buyerIds.length === 0) return [];

  const buyers = await prisma.affiliate.findMany({
    where: { id: { in: buyerIds }, deletedAt: null },
    select: {
      id: true,
      legalName: true,
      programs: {
        select: { id: true, programName: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { legalName: "asc" },
  });

  return buyers.map((a) => ({
    id: a.id,
    name: a.legalName ?? "Unnamed",
    programs: a.programs.map((p) => ({
      id: p.id,
      name: p.programName ?? "Unnamed Plan",
    })),
  }));
}
