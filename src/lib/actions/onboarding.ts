"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, getContextForAffiliate } from "./helpers";
import { decryptField } from "@/lib/encryption";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { AllSectionData, SellerFlowData } from "@/components/form/OnboardingClient";
import type { CompletionStatus } from "@/types";
import type { SectionReviewRow } from "./section-review";
import type { Section1Data } from "@/lib/validations/section1";
import type { Section2Data } from "@/lib/validations/section2";
import type { Section3Data } from "@/lib/validations/section3";
import type { Section4Data } from "@/lib/validations/section4";
import type { Section9Data } from "@/lib/validations/section9";
import type { Section11Data } from "@/lib/validations/section11";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import type { SellerServicesData } from "@/lib/validations/seller-services";
import type { SellerLabData } from "@/lib/validations/seller-lab";
import type { SellerBillingData } from "@/lib/validations/seller-billing";
import type { SellerPricingData } from "@/lib/validations/seller-pricing";
import { computeSellerStatuses } from "./seller-org";
import { loadAllLocationServices, type LocationServiceState } from "./location-services";
import { loadSellerOrgSubServices } from "./seller-org-sub-services";

interface PhaseInfo {
  phase: number;
  status: string;
}

interface RoleFlags {
  isAffiliate: boolean;
  isSeller: boolean;
}

interface ProgramInfo {
  id: string;
  programName: string | null;
}

interface OnboardingData {
  sections: AllSectionData;
  statuses: Record<number, CompletionStatus>;
  formStatus: string;
  phases: PhaseInfo[];
  roles: RoleFlags;
  networkLocationCount: number;
  sectionReviews: SectionReviewRow[];
  sellerData?: SellerFlowData;
  programs: ProgramInfo[];
  allProgramData?: Record<string, AllSectionData>;
}

/**
 * Load onboarding data for a specific affiliate (admin use).
 * Auth-gated via getContextForAffiliate.
 */
export async function loadAllOnboardingDataForAffiliate(
  affiliateId: string
): Promise<OnboardingData> {
  await getContextForAffiliate(affiliateId);
  return loadOnboardingDataByAffiliateId(affiliateId);
}

export async function loadAllOnboardingData(): Promise<OnboardingData> {
  const ctx = await getSessionContext();
  return loadOnboardingDataByAffiliateId(ctx.affiliateId);
}

/**
 * Lightweight fetch of just the affiliate's form status (DRAFT / SUBMITTED).
 */
export async function getMyFormStatus(): Promise<string> {
  const ctx = await getSessionContext();
  const aff = await prisma.affiliate.findUnique({
    where: { id: ctx.affiliateId },
    select: { status: true },
  });
  return aff?.status ?? "DRAFT";
}

export async function getFormStatus(affiliateId: string): Promise<string> {
  await getContextForAffiliate(affiliateId);
  const aff = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { status: true },
  });
  return aff?.status ?? "DRAFT";
}

/**
 * Fetch fresh phase info for the current user's affiliate.
 */
export async function getMyPhases(): Promise<PhaseInfo[]> {
  const ctx = await getSessionContext();
  return getPhasesByAffiliateId(ctx.affiliateId);
}

/**
 * Fetch fresh phase info for a specific affiliate (admin use).
 */
export async function getPhases(affiliateId: string): Promise<PhaseInfo[]> {
  await getContextForAffiliate(affiliateId);
  return getPhasesByAffiliateId(affiliateId);
}

async function getPhasesByAffiliateId(affiliateId: string): Promise<PhaseInfo[]> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { status: true, phases: { orderBy: { phase: "asc" as const } } },
  });
  if (!affiliate) return [{ phase: 1, status: "DRAFT" }];
  const phases: PhaseInfo[] = affiliate.phases.map((p) => ({
    phase: p.phase,
    status: p.status,
  }));
  if (!phases.find((p) => p.phase === 1)) {
    phases.unshift({ phase: 1, status: affiliate.status });
  }
  return phases;
}

async function loadOnboardingDataByAffiliateId(affiliateId: string): Promise<OnboardingData> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: {
      programs: {
        include: { services: true, subServices: true },
        orderBy: { createdAt: "asc" },
      },
      careNavConfigs: { take: 1 },
      phases: { orderBy: { phase: "asc" } },
      sectionReviews: {
        select: { sectionId: true, userId: true, confirmedAt: true },
      },
    },
  });

  if (!affiliate) throw new Error("Affiliate not found");

  const program = affiliate.programs[0] ?? null;
  const cn = affiliate.careNavConfigs[0] ?? null;

  // Build program list for plan selector
  const programs: ProgramInfo[] = affiliate.programs.map((p) => ({
    id: p.id,
    programName: p.programName,
  }));

  // --- Phase data ---
  const phases: PhaseInfo[] = affiliate.phases.map((p) => ({
    phase: p.phase,
    status: p.status,
  }));
  // Ensure Phase 1 exists
  if (!phases.find((p) => p.phase === 1)) {
    phases.unshift({ phase: 1, status: affiliate.status });
  }
  const unlockedPhaseNumbers = phases.map((p) => p.phase);

  // --- Transform into section data shapes ---

  const s1: Section1Data = {
    legalName: affiliate.legalName ?? "",
    adminContactName: program?.adminContactName ?? "",
    adminContactEmail: program?.adminContactEmail ?? "",
    executiveSponsorName: program?.executiveSponsorName ?? "",
    executiveSponsorEmail: program?.executiveSponsorEmail ?? "",
    itContactName: program?.itContactName ?? "",
    itContactEmail: program?.itContactEmail ?? "",
    itContactPhone: program?.itContactPhone ?? "",
  };

  const s2: Section2Data = {
    programName: program?.programName ?? "",
  };

  const serviceMap = new Map(
    (program?.services ?? []).map((s) => [s.serviceType, s])
  );
  const s3: Section3Data = {
    services: SERVICE_TYPES.map((st) => ({
      serviceType: st.value,
      selected: serviceMap.get(st.value)?.selected ?? false,
      otherName: serviceMap.get(st.value)?.otherName ?? "",
    })),
  };

  const s4: Section4Data = {
    w9FilePath: program?.w9FilePath ?? null,
    achRoutingNumber: program?.achRoutingNumber ? decryptField(program.achRoutingNumber) : "",
    achAccountNumber: program?.achAccountNumber ? decryptField(program.achAccountNumber) : "",
    achAccountType: (program?.achAccountType as Section4Data["achAccountType"]) ?? null,
    achAccountHolderName: program?.achAccountHolderName ?? "",
    bankDocFilePath: program?.bankDocFilePath ?? null,
    paymentAchAccountHolderName: program?.paymentAchAccountHolderName ?? "",
    paymentAchAccountType: (program?.paymentAchAccountType as Section4Data["paymentAchAccountType"]) ?? null,
    paymentAchRoutingNumber: program?.paymentAchRoutingNumber ? decryptField(program.paymentAchRoutingNumber) : "",
    paymentAchAccountNumber: program?.paymentAchAccountNumber ? decryptField(program.paymentAchAccountNumber) : "",
  };

  const s9: Section9Data = {
    primaryEscalationName: cn?.primaryEscalationName ?? "",
    primaryEscalationEmail: cn?.primaryEscalationEmail ?? "",
    secondaryEscalationName: cn?.secondaryEscalationName ?? "",
    secondaryEscalationEmail: cn?.secondaryEscalationEmail ?? "",
  };

  // --- Section 11: Sub-Services (always loaded, used inline in Section 3) ---
  const subServiceMap = new Map(
    (program?.subServices ?? []).map((ss) => [`${ss.serviceType}:${ss.subType}`, ss.selected])
  );
  const selectedServiceTypes = s3.services.filter((s) => s.selected).map((s) => s.serviceType);
  const categories: Section11Data["categories"] = {};
  for (const serviceType of selectedServiceTypes) {
    const subItems = SUB_SERVICE_TYPES[serviceType];
    if (!subItems) continue;
    categories[serviceType] = subItems.map((item) => ({
      subType: item.value,
      selected: subServiceMap.get(`${serviceType}:${item.value}`) ?? false,
    }));
  }
  const s11: Section11Data = { categories };

  // --- Count active network terms for section 5 (Care Network) status ---
  let networkLocationCount = 0;
  if (affiliate.isAffiliate) {
    const terms = await prisma.networkContractTerm.findMany({
      where: { contract: { affiliateId } },
      orderBy: { createdAt: "desc" },
      select: { contractId: true, sellerLocationId: true, status: true },
    });
    const seen = new Set<string>();
    for (const t of terms) {
      const key = `${t.contractId}:${t.sellerLocationId}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (t.status === "ACTIVE") networkLocationCount++;
      }
    }
  }

  // --- Compute completion statuses in-memory ---
  const statuses = computeStatuses(affiliate, program, s3, cn, networkLocationCount);

  // --- Load seller data if org has seller role ---
  let sellerData: SellerFlowData | undefined;
  if (affiliate.isSeller) {
    const [sellerProfile, sellerOfferings, sellerStatuses, locationServiceMap, sellerLocations, sellerProviders, sellerLabNetwork, sellerFlowRecord, orgSubServices] = await Promise.all([
      prisma.sellerProfile.findUnique({ where: { affiliateId } }),
      prisma.sellerServiceOffering.findMany({ where: { affiliateId } }),
      computeSellerStatuses(affiliateId),
      loadAllLocationServices(affiliateId),
      prisma.sellerLocation.findMany({
        where: { affiliateId },
        include: { schedulingIntegrations: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sellerProvider.findMany({
        where: { affiliateId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sellerLabNetwork.findFirst({ where: { affiliateId } }),
      prisma.onboardingFlow.findUnique({
        where: { affiliateId_flowType: { affiliateId, flowType: "SELLER" } },
        select: { status: true },
      }),
      loadSellerOrgSubServices(affiliateId),
    ]);

    const offeringMap = new Map(sellerOfferings.map((o) => [o.serviceType, o.selected]));
    const sellerServices: SellerServicesData = {
      services: SELLER_SERVICE_TYPES.map((st) => ({
        serviceType: st.value,
        selected: offeringMap.get(st.value) ?? false,
      })),
    };

    const sellerLab: SellerLabData = {
      networkType: (sellerLabNetwork?.networkType as SellerLabData["networkType"]) ?? null,
      otherNetworkName: sellerLabNetwork?.otherNetworkName ?? "",
      coordinationContactName: sellerLabNetwork?.coordinationContactName ?? "",
      coordinationContactEmail: sellerLabNetwork?.coordinationContactEmail ?? "",
      coordinationContactPhone: sellerLabNetwork?.coordinationContactPhone ?? "",
      integrationAcknowledged: sellerLabNetwork?.integrationAcknowledged ?? false,
    };

    // Build pricing data from offerings + org sub-services
    const visitPriceOfferings = sellerOfferings.filter(
      (o) => o.selected && o.serviceType === "clinic_visit"
    );

    // orgSubServices already loaded — extract selected items with prices
    const allOrgSubs = await prisma.sellerOrgSubService.findMany({
      where: { affiliateId, selected: true },
      select: { serviceType: true, subType: true, unitPrice: true },
    });

    const sellerPricing: SellerPricingData = {
      visitPrices: visitPriceOfferings.map((o) => ({
        serviceType: o.serviceType,
        price: o.basePricePerVisit ? Number(o.basePricePerVisit) : null,
      })),
      subServicePrices: allOrgSubs.map((s) => ({
        serviceType: s.serviceType,
        subType: s.subType,
        unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
      })),
    };

    const sellerBilling: SellerBillingData = {
      w9FilePath: sellerProfile?.w9FilePath ?? null,
      achAccountHolderName: sellerProfile?.achAccountHolderName ?? "",
      achAccountType: (sellerProfile?.achAccountType as SellerBillingData["achAccountType"]) ?? null,
      achRoutingNumber: sellerProfile?.achRoutingNumber ? decryptField(sellerProfile.achRoutingNumber) : "",
      achAccountNumber: sellerProfile?.achAccountNumber ? decryptField(sellerProfile.achAccountNumber) : "",
      bankDocFilePath: sellerProfile?.bankDocFilePath ?? null,
    };

    sellerData = {
      defaultSchedulingSystem: affiliate.defaultSchedulingSystem ?? null,
      defaultSchedulingOtherName: affiliate.defaultSchedulingOtherName ?? null,
      defaultSchedulingAcknowledged: affiliate.defaultSchedulingAcknowledged ?? false,
      orgSubServices,
      orgInfo: {
        legalName: sellerProfile?.legalName ?? affiliate.legalName ?? "",
        adminContactName: sellerProfile?.adminContactName ?? "",
        adminContactEmail: sellerProfile?.adminContactEmail ?? "",
        adminContactPhone: sellerProfile?.adminContactPhone ?? "",
        operationsContactName: sellerProfile?.operationsContactName ?? "",
        operationsContactEmail: sellerProfile?.operationsContactEmail ?? "",
        operationsContactPhone: sellerProfile?.operationsContactPhone ?? "",
      },
      services: sellerServices,
      pricing: sellerPricing,
      lab: sellerLab,
      billing: sellerBilling,
      locationServices: locationServiceMap,
      locations: sellerLocations.map((loc) => ({
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
        accessType: loc.accessType as "walk_in" | "appointment_only" | "both" | null,
        hasOnSiteLabs: loc.hasOnSiteLabs,
        hasOnSiteRadiology: loc.hasOnSiteRadiology,
        hasOnSitePharmacy: loc.hasOnSitePharmacy,
        weeklySchedule: loc.weeklySchedule as Array<{ day: string; openTime?: string; closeTime?: string; closed: boolean }> | undefined,
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
      providers: sellerProviders.map((p) => ({
        id: p.id,
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        providerType: p.providerType as "physician" | "np" | "pa" | "other" | null,
        licenseNumber: p.licenseNumber ?? "",
        licenseState: p.licenseState ?? "",
        npi: p.npi ?? "",
        deaNumber: p.deaNumber ?? "",
      })),
      statuses: sellerStatuses,
      flowStatus: sellerFlowRecord?.status ?? "DRAFT",
    };
  }

  // Build per-program section data for all programs (enables plan switching)
  const allProgramData: Record<string, AllSectionData> = {};
  for (const prog of affiliate.programs) {
    const progServiceMap = new Map(prog.services.map((s) => [s.serviceType, s]));
    const progS2: Section2Data = { programName: prog.programName ?? "" };
    const progS3: Section3Data = {
      services: SERVICE_TYPES.map((st) => ({
        serviceType: st.value,
        selected: progServiceMap.get(st.value)?.selected ?? false,
        otherName: progServiceMap.get(st.value)?.otherName ?? "",
      })),
    };

    const progS4: Section4Data = {
      w9FilePath: prog.w9FilePath ?? null,
      achRoutingNumber: prog.achRoutingNumber ? decryptField(prog.achRoutingNumber) : "",
      achAccountNumber: prog.achAccountNumber ? decryptField(prog.achAccountNumber) : "",
      achAccountType: (prog.achAccountType as Section4Data["achAccountType"]) ?? null,
      achAccountHolderName: prog.achAccountHolderName ?? "",
      bankDocFilePath: prog.bankDocFilePath ?? null,
      paymentAchAccountHolderName: prog.paymentAchAccountHolderName ?? "",
      paymentAchAccountType: (prog.paymentAchAccountType as Section4Data["paymentAchAccountType"]) ?? null,
      paymentAchRoutingNumber: prog.paymentAchRoutingNumber ? decryptField(prog.paymentAchRoutingNumber) : "",
      paymentAchAccountNumber: prog.paymentAchAccountNumber ? decryptField(prog.paymentAchAccountNumber) : "",
    };

    // S1 contacts are per-program
    const progS1: Section1Data = {
      legalName: affiliate.legalName ?? "",
      adminContactName: prog.adminContactName ?? "",
      adminContactEmail: prog.adminContactEmail ?? "",
      executiveSponsorName: prog.executiveSponsorName ?? "",
      executiveSponsorEmail: prog.executiveSponsorEmail ?? "",
      itContactName: prog.itContactName ?? "",
      itContactEmail: prog.itContactEmail ?? "",
      itContactPhone: prog.itContactPhone ?? "",
    };

    // Sub-services per program
    const progSubServiceMap = new Map(
      prog.subServices.map((ss) => [`${ss.serviceType}:${ss.subType}`, ss.selected])
    );
    const progSelectedServiceTypes = progS3.services.filter((s) => s.selected).map((s) => s.serviceType);
    const progCategories: Section11Data["categories"] = {};
    for (const serviceType of progSelectedServiceTypes) {
      const subItems = SUB_SERVICE_TYPES[serviceType];
      if (!subItems) continue;
      progCategories[serviceType] = subItems.map((item) => ({
        subType: item.value,
        selected: progSubServiceMap.get(`${serviceType}:${item.value}`) ?? false,
      }));
    }
    const progS11: Section11Data = { categories: progCategories };

    allProgramData[prog.id] = { 1: progS1, 2: progS2, 3: progS3, 4: progS4, 9: s9, 11: progS11 };
  }

  return {
    sections: { 1: s1, 2: s2, 3: s3, 4: s4, 9: s9, 11: s11 },
    statuses,
    formStatus: affiliate.status,
    phases,
    roles: {
      isAffiliate: affiliate.isAffiliate,
      isSeller: affiliate.isSeller,
    },
    networkLocationCount,
    sectionReviews: affiliate.sectionReviews,
    sellerData,
    programs,
    allProgramData,
  };
}

// Same logic as completion.ts but computed from already-fetched data
function computeStatuses(
  affiliate: { legalName: string | null; status: string },
  program: {
    programName: string | null;
    adminContactName: string | null;
    adminContactEmail: string | null;
    executiveSponsorName: string | null;
    executiveSponsorEmail: string | null;
    itContactName: string | null;
    w9FilePath: string | null;
    achRoutingNumber: string | null;
    achAccountNumber: string | null;
    achAccountType: string | null;
    achAccountHolderName: string | null;
    bankDocFilePath: string | null;
    paymentAchAccountHolderName: string | null;
    paymentAchAccountType: string | null;
    paymentAchRoutingNumber: string | null;
    paymentAchAccountNumber: string | null;
    services: { selected: boolean }[];
  } | null,
  s3: Section3Data,
  cn: { primaryEscalationName: string | null; secondaryEscalationName: string | null } | null,
  networkLocationCount: number,
): Record<number, CompletionStatus> {
  const statuses: Record<number, CompletionStatus> = {};

  // Section 1
  if (program) {
    const fields = [affiliate.legalName, program.adminContactName, program.adminContactEmail, program.executiveSponsorName, program.executiveSponsorEmail, program.itContactName];
    const filled = fields.filter(Boolean).length;
    statuses[1] = filled === 0 ? "not_started" : filled === fields.length ? "complete" : "in_progress";
  } else {
    statuses[1] = "not_started";
  }

  // Section 2: Plan Name
  if (program?.programName) {
    statuses[2] = "complete";
  } else {
    statuses[2] = "not_started";
  }

  // Section 3
  const selectedServices = s3.services.filter((s) => s.selected);
  statuses[3] = selectedServices.length > 0 ? "complete" : (program?.services?.length ?? 0) > 0 ? "in_progress" : "not_started";

  // Section 4
  if (program) {
    const payoutFields = [program.w9FilePath, program.achRoutingNumber, program.achAccountNumber, program.achAccountType, program.achAccountHolderName, program.bankDocFilePath];
    const paymentFields = [program.paymentAchAccountHolderName, program.paymentAchAccountType, program.paymentAchRoutingNumber, program.paymentAchAccountNumber];
    const allFields = [...payoutFields, ...paymentFields];
    const filled = allFields.filter(Boolean).length;
    statuses[4] = filled === 0 ? "not_started" : filled === allFields.length ? "complete" : "in_progress";
  } else {
    statuses[4] = "not_started";
  }

  // Section 5 (Care Network) — complete when at least 1 location in network
  statuses[5] = networkLocationCount > 0 ? "complete" : "not_started";

  // Section 9
  statuses[9] = !cn ? "not_started" : cn.primaryEscalationName && cn.secondaryEscalationName ? "complete" : "in_progress";

  // Section 10
  statuses[10] = affiliate.status === "SUBMITTED" ? "complete" : "not_started";

  return statuses;
}
