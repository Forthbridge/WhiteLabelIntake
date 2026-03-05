"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot } from "./helpers";
import { sellerOrgSchema, type SellerOrgData } from "@/lib/validations/seller-org";
import type { Prisma } from "@prisma/client";
import type { CompletionStatus, SellerSectionId } from "@/types";

// ─── Load ────────────────────────────────────────────────────────

export async function loadSellerOrgInfo(): Promise<SellerOrgData> {
  const ctx = await getSessionContext();

  const profile = await prisma.sellerProfile.findUnique({
    where: { affiliateId: ctx.affiliateId },
  });

  return {
    legalName: profile?.legalName ?? "",
    adminContactName: profile?.adminContactName ?? "",
    adminContactEmail: profile?.adminContactEmail ?? "",
    adminContactPhone: profile?.adminContactPhone ?? "",
    operationsContactName: profile?.operationsContactName ?? "",
    operationsContactEmail: profile?.operationsContactEmail ?? "",
    operationsContactPhone: profile?.operationsContactPhone ?? "",
  };
}

// ─── Save ────────────────────────────────────────────────────────

export async function saveSellerOrgInfo(
  data: SellerOrgData
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const ctx = await getSessionContext();
  const parsed = sellerOrgSchema.parse(data);

  await prisma.sellerProfile.upsert({
    where: { affiliateId: ctx.affiliateId },
    update: {
      legalName: parsed.legalName || null,
      adminContactName: parsed.adminContactName || null,
      adminContactEmail: parsed.adminContactEmail || null,
      adminContactPhone: parsed.adminContactPhone || null,
      operationsContactName: parsed.operationsContactName || null,
      operationsContactEmail: parsed.operationsContactEmail || null,
      operationsContactPhone: parsed.operationsContactPhone || null,
    },
    create: {
      affiliateId: ctx.affiliateId,
      legalName: parsed.legalName || null,
      adminContactName: parsed.adminContactName || null,
      adminContactEmail: parsed.adminContactEmail || null,
      adminContactPhone: parsed.adminContactPhone || null,
      operationsContactName: parsed.operationsContactName || null,
      operationsContactEmail: parsed.operationsContactEmail || null,
      operationsContactPhone: parsed.operationsContactPhone || null,
    },
  });

  await writeSectionSnapshot(
    100,
    parsed as unknown as Prisma.InputJsonValue,
    ctx.userId,
    ctx.affiliateId
  );

  return computeSellerStatuses(ctx.affiliateId);
}

// ─── Seller completion statuses (reads from seller-owned tables) ─

export async function computeSellerStatuses(
  affiliateId: string
): Promise<Record<SellerSectionId, CompletionStatus>> {
  const [profile, sellerLocations, sellerProviders, offerings, sellerLab, flows, orgSubServices, sellerPriceLists] = await Promise.all([
    prisma.sellerProfile.findUnique({ where: { affiliateId } }),
    prisma.sellerLocation.findMany({
      where: { affiliateId },
      select: { id: true, locationName: true, streetAddress: true, city: true, state: true, zip: true, locationNpi: true, phoneNumber: true },
    }),
    prisma.sellerProvider.findMany({
      where: { affiliateId },
      select: { id: true, firstName: true, lastName: true, npi: true, licenseNumber: true },
    }),
    prisma.sellerServiceOffering.findMany({ where: { affiliateId } }),
    prisma.sellerLabNetwork.findFirst({ where: { affiliateId } }),
    prisma.onboardingFlow.findFirst({ where: { affiliateId, flowType: "SELLER" } }),
    prisma.sellerOrgSubService.findMany({
      where: { affiliateId, selected: true },
      select: { unitPrice: true },
    }),
    prisma.sellerPriceList.findMany({
      where: { affiliateId },
      include: {
        _count: { select: { visitPrices: true, subPrices: true } },
      },
    }),
  ]);

  const empty: Record<SellerSectionId, CompletionStatus> = { "S-1": "not_started", "S-2": "not_started", "S-3": "not_started", "S-4": "not_started", "S-5": "not_started", "S-6": "not_started", "S-7": "not_started", "S-R": "not_started" };

  // S-1: Org Info (from SellerProfile)
  const orgFields = [profile?.legalName, profile?.adminContactName, profile?.adminContactEmail];
  const orgFilled = orgFields.filter(Boolean).length;
  const s1: CompletionStatus = orgFilled === 0 ? "not_started" : orgFilled === orgFields.length ? "complete" : "in_progress";

  // S-2: Locations (from SellerLocation)
  const completeLocs = sellerLocations.filter((l) => l.locationName && l.streetAddress && l.city && l.state && l.zip && l.locationNpi && l.phoneNumber);
  const s2: CompletionStatus = sellerLocations.length === 0 ? "not_started" : completeLocs.length === sellerLocations.length ? "complete" : "in_progress";

  // S-3: Providers (from SellerProvider)
  const completeProvs = sellerProviders.filter((p) => p.firstName && p.lastName && p.npi && p.licenseNumber);
  const s3: CompletionStatus = sellerProviders.length === 0 ? "not_started" : completeProvs.length === sellerProviders.length ? "complete" : "in_progress";

  // S-4: Services Offered — requires clinic_visit
  const selectedOfferings = offerings.filter((o) => o.selected);
  const hasCareService = selectedOfferings.some((o) => o.serviceType === "clinic_visit");
  const s4: CompletionStatus = offerings.length === 0 ? "not_started" : (selectedOfferings.length > 0 && hasCareService) ? "complete" : "in_progress";

  // S-7: Price List — check price lists first, fall back to legacy tables
  let s7: CompletionStatus = "not_started";
  if (sellerPriceLists.length > 0) {
    // Price-list mode: at least one list with pricing data → complete
    const hasPricingData = sellerPriceLists.some(
      (pl) => pl._count.visitPrices > 0 || pl._count.subPrices > 0
    );
    s7 = hasPricingData ? "complete" : "in_progress";
  } else {
    // Legacy mode: check SellerServiceOffering.basePricePerVisit + SellerOrgSubService.unitPrice
    const careOfferings = offerings.filter(
      (o) => o.selected && o.serviceType === "clinic_visit"
    );
    const visitsPriced = careOfferings.filter((o) => o.basePricePerVisit != null).length;
    const visitsTotal = careOfferings.length;
    const subsPriced = orgSubServices.filter((s) => s.unitPrice != null).length;
    const subsTotal = orgSubServices.length;
    const totalPriced = visitsPriced + subsPriced;
    const totalItems = visitsTotal + subsTotal;
    if (totalItems > 0) {
      if (totalPriced === totalItems) {
        s7 = "complete";
      } else if (totalPriced > 0) {
        s7 = "in_progress";
      }
    }
  }

  // S-5: Lab Network (from SellerLabNetwork)
  const s5: CompletionStatus = !sellerLab
    ? "not_started"
    : sellerLab.networkType && sellerLab.coordinationContactName && (sellerLab.networkType !== "other" || sellerLab.integrationAcknowledged)
      ? "complete"
      : "in_progress";

  // S-6: Billing Setup (from SellerProfile)
  const s6: CompletionStatus = !profile
    ? "not_started"
    : profile.achAccountHolderName && profile.achRoutingNumber && profile.achAccountNumber && profile.achAccountType
      ? "complete"
      : (profile.achAccountHolderName || profile.achRoutingNumber || profile.achAccountNumber)
        ? "in_progress"
        : "not_started";

  // S-R: Review
  const allComplete = [s1, s2, s3, s4, s5, s6, s7].every((s) => s === "complete");
  const sR: CompletionStatus = flows?.status === "SUBMITTED" ? "complete" : allComplete ? "in_progress" : "not_started";

  return { "S-1": s1, "S-2": s2, "S-3": s3, "S-4": s4, "S-5": s5, "S-6": s6, "S-7": s7, "S-R": sR };
}
