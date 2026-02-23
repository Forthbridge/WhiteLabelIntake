"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { SectionNav } from "./SectionNav";
import { SellerSectionNav } from "./SellerSectionNav";
import { PrerequisiteBanner } from "./PrerequisiteBanner";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { getSectionMeta, getVisibleSections, getSellerSectionMeta, SELLER_SECTIONS } from "@/types";
import type { SectionId, CompletionStatus, FlowType, SellerSectionId } from "@/types";
import { CompletionProvider, useCompletion } from "@/lib/contexts/CompletionContext";
import { Section1Form } from "./sections/Section1Form";
import { Section2Form } from "./sections/Section2Form";
import { Section3Form } from "./sections/Section3Form";
import { Section4Form } from "./sections/Section4Form";
import { Section9Form } from "./sections/Section9Form";
import { ReviewForm } from "./sections/ReviewForm";
import { NetworkBuilderForm } from "./sections/NetworkBuilderForm";
import { SellerOrgInfoForm } from "./sections/SellerOrgInfoForm";
import { SellerServicesForm } from "./sections/SellerServicesForm";
import { SellerLabForm } from "./sections/SellerLabForm";
import { SellerBillingForm } from "./sections/SellerBillingForm";
import { SellerReviewForm } from "./sections/SellerReviewForm";
import { SellerLocationsForm } from "./sections/SellerLocationsForm";
import { SellerProvidersForm } from "./sections/SellerProvidersForm";
import { SellerPricingForm } from "./sections/SellerPricingForm";

import type { Section1Data } from "@/lib/validations/section1";
import type { Section2Data } from "@/lib/validations/section2";
import type { Section3Data } from "@/lib/validations/section3";
import type { Section4Data } from "@/lib/validations/section4";
import type { Section9Data } from "@/lib/validations/section9";
import type { Section11Data } from "@/lib/validations/section11";
import type { SellerOrgData } from "@/lib/validations/seller-org";
import type { SellerServicesData } from "@/lib/validations/seller-services";
import type { SellerLabData } from "@/lib/validations/seller-lab";
import type { SellerBillingData } from "@/lib/validations/seller-billing";
import type { SellerPricingData } from "@/lib/validations/seller-pricing";
import type { LocationServiceState } from "@/lib/actions/location-services";
import type { SellerLocationsData, SellerLocationData } from "@/lib/actions/seller-locations";
import type { SellerProvidersData, SellerProviderData } from "@/lib/actions/seller-providers";

export interface AllSectionData {
  1: Section1Data;
  2: Section2Data;
  3: Section3Data;
  4: Section4Data;
  9: Section9Data;
  11?: Section11Data;
}

export interface RoleFlags {
  isAffiliate: boolean;
  isSeller: boolean;
}

interface PhaseInfo {
  phase: number;
  status: string;
}

/* ── Section data cache ──
   Keeps the latest version of each section's data client-side so that
   navigating away and back doesn't reset to the stale server snapshot. */
const SectionCacheCtx = createContext<(section: number, data: unknown) => void>(() => {});

/* ── Dirty (unsaved) tracking context ──
   Lets section forms report whether they have unsaved changes.
   Key is string | number so both affiliate (1,2,3…) and seller ("S-1","S-2"…) flows share one context. */
const DirtyCtx = createContext<(section: string | number, dirty: boolean) => void>(() => {});

/** Call in every section form to report dirty state to the nav.
 *  Always syncs current state — handles mount, transitions, and remount after stale dirty. */
export function useReportDirty(section: string | number, isDirty: boolean) {
  const report = useContext(DirtyCtx);
  useEffect(() => {
    report(section, isDirty);
  }, [section, isDirty, report]);
}

/* ── Saving overlay context ──
   Lets SectionNavButtons toggle a full-screen loading overlay. */
const SavingCtx = createContext<(v: boolean) => void>(() => {});

/** Call from nav buttons to show/hide the full-screen saving overlay. */
export function useSaving() {
  return useContext(SavingCtx);
}

/** Call in every section form to sync its data to the client cache on unmount. */
export function useSyncSectionCache(section: number, data: unknown) {
  const update = useContext(SectionCacheCtx);
  const ref = useRef(data);
  ref.current = data;
  useEffect(() => () => update(section, ref.current), [section, update]);
}

/* ── Seller data cache ──
   Keyed by seller section ID. Updated on SAVE only (not unmount)
   so unsaved edits don't corrupt the cache. */
const SellerCacheCtx = createContext<(key: string, data: unknown) => void>(() => {});

/** Returns updater to sync seller data to cache. Call from save handlers only. */
export function useSellerCacheUpdater() {
  return useContext(SellerCacheCtx);
}

export interface SellerFlowData {
  orgInfo: SellerOrgData;
  services: SellerServicesData;
  orgSubServices: Section11Data;
  pricing: SellerPricingData;
  lab: SellerLabData;
  billing: SellerBillingData;
  locationServices: Record<string, LocationServiceState>;
  locations: SellerLocationData[];
  providers: SellerProviderData[];
  defaultSchedulingSystem: string | null;
  defaultSchedulingOtherName: string | null;
  defaultSchedulingAcknowledged: boolean;
  statuses: Record<SellerSectionId, CompletionStatus>;
  flowStatus: string;
}

interface OnboardingClientProps {
  sectionData: AllSectionData;
  initialStatuses: Record<number, CompletionStatus>;
  affiliateId?: string;
  formStatus?: string;
  phases?: PhaseInfo[];
  roles?: RoleFlags;
  sellerData?: SellerFlowData;
}

export function OnboardingClient({ sectionData, initialStatuses, affiliateId, formStatus, phases, roles, sellerData }: OnboardingClientProps) {
  return (
    <CompletionProvider
      initialStatuses={initialStatuses}
      affiliateId={affiliateId}
      initialFormStatus={formStatus ?? "DRAFT"}
      initialPhases={phases}
    >
      <OnboardingClientInner
        sectionData={sectionData}
        roles={roles ?? { isAffiliate: true, isSeller: false }}
        sellerData={sellerData}
      />
    </CompletionProvider>
  );
}

function OnboardingClientInner({
  sectionData,
  roles,
  sellerData,
}: {
  sectionData: AllSectionData;
  roles: RoleFlags;
  sellerData?: SellerFlowData;
}) {
  const isDualRole = roles.isAffiliate && roles.isSeller;
  const defaultFlow: FlowType = roles.isAffiliate ? "AFFILIATE" : "SELLER";

  const [activeFlow, setActiveFlow] = useState<FlowType>(defaultFlow);
  const [activeSection, setActiveSection] = useState(1);
  const [activeSellerSection, setActiveSellerSection] = useState<SellerSectionId>("S-1");
  const [cache, setCache] = useState<AllSectionData>(sectionData);
  const [isSaving, setIsSaving] = useState(false);
  const [dirtySections, setDirtySections] = useState<Record<string | number, boolean>>({});
  const [sellerStatuses, setSellerStatuses] = useState<Record<SellerSectionId, CompletionStatus>>(
    sellerData?.statuses ?? { "S-1": "not_started", "S-2": "not_started", "S-3": "not_started", "S-4": "not_started", "S-5": "not_started", "S-6": "not_started", "S-7": "not_started", "S-R": "not_started" }
  );
  const [sellerServices, setSellerServices] = useState<SellerServicesData>(
    sellerData?.services ?? { services: [] }
  );
  const [sellerFlowStatus, setSellerFlowStatus] = useState(
    sellerData?.flowStatus ?? "DRAFT"
  );
  const [sellerCache, setSellerCache] = useState<SellerFlowData | undefined>(sellerData);
  const updateSellerCache = useCallback((key: string, data: unknown) => {
    setSellerCache((prev) => prev ? { ...prev, [key]: data } : prev);
  }, []);

  const handleSellerStatusUpdate = useCallback((newStatuses: Record<string, string>) => {
    setSellerStatuses(newStatuses as Record<SellerSectionId, CompletionStatus>);
  }, []);
  const { statuses, isLocked, unmetFor, unlockedPhases, phaseStatuses } = useCompletion();

  const reportDirty = useCallback((section: string | number, dirty: boolean) => {
    setDirtySections(prev => {
      if (prev[section] === dirty) return prev;
      return { ...prev, [section]: dirty };
    });
  }, []);

  const updateCache = useCallback((section: number, data: unknown) => {
    setCache((prev) => ({ ...prev, [section]: data }));
  }, []);

  const handleNavigate = useCallback((section: number) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleSellerNavigate = useCallback((sectionId: string) => {
    setActiveSellerSection(sectionId as SellerSectionId);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleFlowChange = useCallback((flow: FlowType) => {
    setActiveFlow(flow);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // ─── Affiliate flow rendering ─────────────────────────────────

  const meta = getSectionMeta(activeSection);
  const locked = isLocked(activeSection as SectionId);
  const unmet = unmetFor(activeSection as SectionId);
  const visibleSections = getVisibleSections(unlockedPhases);

  function renderAffiliateSection() {
    switch (activeSection) {
      case 1:
        return <Section1Form initialData={cache[1]} onNavigate={handleNavigate} disabled={locked} />;
      case 2:
        return <Section2Form initialData={cache[2]} onNavigate={handleNavigate} disabled={locked} />;
      case 3:
        return <Section3Form initialData={cache[3]} initialSubServiceData={cache[11]} onNavigate={handleNavigate} disabled={locked} />;
      case 4:
        return <Section4Form initialData={cache[4]} onNavigate={handleNavigate} disabled={locked} />;
      case 5:
        return <NetworkBuilderForm onNavigate={handleNavigate} disabled={locked} />;
      case 9:
        return <Section9Form initialData={cache[9]} onNavigate={handleNavigate} disabled={locked} />;
      case 10:
        return <ReviewForm onNavigate={handleNavigate} />;
      default:
        return null;
    }
  }

  // ─── Seller flow rendering ────────────────────────────────────

  const sellerMeta = getSellerSectionMeta(activeSellerSection);

  const sellerLocked = sellerFlowStatus === "SUBMITTED";

  function renderSellerSection() {
    const defaultOrgInfo: SellerOrgData = { legalName: "", adminContactName: "", adminContactEmail: "", adminContactPhone: "", operationsContactName: "", operationsContactEmail: "", operationsContactPhone: "" };
    const defaultServices: SellerServicesData = { services: [] };
    const defaultLab: SellerLabData = { networkType: null, otherNetworkName: "", coordinationContactName: "", coordinationContactEmail: "", coordinationContactPhone: "", integrationAcknowledged: false };
    const defaultBilling: SellerBillingData = { w9FilePath: null, achAccountHolderName: "", achAccountType: null, achRoutingNumber: "", achAccountNumber: "", bankDocFilePath: null };

    switch (activeSellerSection) {
      case "S-1":
        return (
          <SellerOrgInfoForm
            initialData={sellerCache?.orgInfo ?? defaultOrgInfo}
            onNavigate={handleSellerNavigate}
            disabled={sellerLocked}
          />
        );
      case "S-2":
        return (
          <SellerLocationsForm
            initialData={{
              defaultSchedulingSystem: sellerCache?.defaultSchedulingSystem ?? null,
              defaultSchedulingOtherName: sellerCache?.defaultSchedulingOtherName ?? null,
              defaultSchedulingAcknowledged: sellerCache?.defaultSchedulingAcknowledged ?? false,
              locations: sellerCache?.locations ?? [],
            }}
            sellerServiceOfferings={sellerServices.services}
            locationServices={sellerCache?.locationServices}
            orgSubServices={sellerCache?.orgSubServices}
            onNavigate={handleSellerNavigate}
            onStatusUpdate={handleSellerStatusUpdate}
            disabled={sellerLocked}
          />
        );
      case "S-3":
        return (
          <SellerProvidersForm
            initialData={{ providers: sellerCache?.providers ?? [] }}
            onNavigate={handleSellerNavigate}
            onStatusUpdate={handleSellerStatusUpdate}
            disabled={sellerLocked}
          />
        );
      case "S-4":
        return (
          <SellerServicesForm
            initialData={sellerCache?.services ?? defaultServices}
            initialSubServiceData={sellerCache?.orgSubServices}
            onNavigate={handleSellerNavigate}
            onStatusUpdate={handleSellerStatusUpdate}
            onServicesChange={setSellerServices}
            disabled={sellerLocked}
          />
        );
      case "S-7": {
        const defaultPricing: SellerPricingData = { primaryCarePrice: null, urgentCarePrice: null };
        return (
          <SellerPricingForm
            initialData={sellerCache?.pricing ?? defaultPricing}
            serviceSelections={sellerServices.services}
            onNavigate={handleSellerNavigate}
            onStatusUpdate={handleSellerStatusUpdate}
            disabled={sellerLocked}
          />
        );
      }
      case "S-5":
        return (
          <SellerLabForm
            initialData={sellerCache?.lab ?? defaultLab}
            onNavigate={handleSellerNavigate}
            onStatusUpdate={handleSellerStatusUpdate}
            disabled={sellerLocked}
          />
        );
      case "S-6":
        return (
          <SellerBillingForm
            initialData={sellerCache?.billing ?? defaultBilling}
            onNavigate={handleSellerNavigate}
            onStatusUpdate={handleSellerStatusUpdate}
            disabled={sellerLocked}
          />
        );
      case "S-R":
        return sellerCache ? (
          <SellerReviewForm
            sellerData={sellerCache}
            statuses={sellerStatuses}
            onNavigate={handleSellerNavigate}
            onSubmitted={() => setSellerFlowStatus("SUBMITTED")}
          />
        ) : null;
      default:
        return null;
    }
  }

  // Determine phase label for header
  const phaseLabel = meta?.phase === "program" ? "Program" : meta?.phase === "operations" ? "Operations" : "Review";

  return (
    <SavingCtx.Provider value={setIsSaving}>
    <DirtyCtx.Provider value={reportDirty}>
    <SectionCacheCtx.Provider value={updateCache}>
    <SellerCacheCtx.Provider value={updateSellerCache}>
    <div className="flex flex-col h-screen bg-off-white">
      <LoadingOverlay visible={isSaving} />

      {/* ── Tab Bar (only for dual-role orgs) ── */}
      {isDualRole && (
        <div className="flex-shrink-0 bg-white border-b border-border">
          <div className="flex">
            <button
              type="button"
              onClick={() => handleFlowChange("AFFILIATE")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeFlow === "AFFILIATE"
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-muted hover:text-brand-black"
              }`}
            >
              Plan Onboarding
            </button>
            <button
              type="button"
              onClick={() => handleFlowChange("SELLER")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeFlow === "SELLER"
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-muted hover:text-brand-black"
              }`}
            >
              Care Delivery Onboarding
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">
        {activeFlow === "AFFILIATE" ? (
          <>
            <SectionNav
              activeSection={activeSection}
              onSectionChange={handleNavigate}
              completionStatuses={statuses}
              unlockedPhases={unlockedPhases}
              phaseStatuses={phaseStatuses}
              dirtySections={dirtySections}
            />
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-10">
                {meta && (
                  <div className="mb-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                      Section {activeSection} of {visibleSections.length} &middot; {phaseLabel}
                    </p>
                    <h1 className="text-2xl font-heading font-semibold text-brand-black">
                      {meta.title}
                    </h1>
                    <p className="text-sm text-muted mt-1">{meta.description}</p>
                  </div>
                )}
                {locked && (
                  <PrerequisiteBanner unmetSections={unmet} onNavigate={handleNavigate} />
                )}
                {locked ? (
                  <div className="opacity-50 pointer-events-none" aria-disabled="true">
                    {renderAffiliateSection()}
                  </div>
                ) : (
                  renderAffiliateSection()
                )}
              </div>
            </main>
          </>
        ) : (
          <>
            <SellerSectionNav
              activeSection={activeSellerSection}
              onSectionChange={handleSellerNavigate}
              completionStatuses={sellerStatuses}
              dirtySections={dirtySections}
            />
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-10">
                {sellerMeta && (
                  <div className="mb-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                      Section {SELLER_SECTIONS.findIndex((s) => s.id === activeSellerSection) + 1} of {SELLER_SECTIONS.length} &middot; Care Delivery
                    </p>
                    <h1 className="text-2xl font-heading font-semibold text-brand-black">
                      {sellerMeta.title}
                    </h1>
                    <p className="text-sm text-muted mt-1">{sellerMeta.description}</p>
                  </div>
                )}
                {sellerLocked && activeSellerSection !== "S-R" && (
                  <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      This form has been submitted and is now locked. Contact your account manager to make changes.
                    </p>
                  </div>
                )}
                {sellerLocked && activeSellerSection !== "S-R" ? (
                  <div className="opacity-50 pointer-events-none" aria-disabled="true">
                    {renderSellerSection()}
                  </div>
                ) : (
                  renderSellerSection()
                )}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
    </SellerCacheCtx.Provider>
    </SectionCacheCtx.Provider>
    </DirtyCtx.Provider>
    </SavingCtx.Provider>
  );
}
