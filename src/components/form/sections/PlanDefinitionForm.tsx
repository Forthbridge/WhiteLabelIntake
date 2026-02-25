"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { SubServiceModal } from "@/components/ui/SubServiceModal";
import { saveSection2 } from "@/lib/actions/section2";
import { saveSection3 } from "@/lib/actions/section3";
import { saveSection9 } from "@/lib/actions/section9";
import { saveSection11 } from "@/lib/actions/section11";
import { saveSection2ForAffiliate, saveSection3ForAffiliate, saveSection9ForAffiliate, saveSection11ForAffiliate } from "@/lib/actions/admin-sections";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { Section2Data } from "@/lib/validations/section2";
import type { Section3Data } from "@/lib/validations/section3";
import type { Section9Data } from "@/lib/validations/section9";
import type { Section11Data } from "@/lib/validations/section11";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { useAdminForm } from "@/lib/contexts/AdminFormContext";
import { SectionNavButtons } from "../SectionNavButtons";
import { useSyncSectionCache, useReportDirty, useSelectedProgram } from "../OnboardingClient";

const DEFAULT_SERVICES = [
  "Unlimited $0 virtual primary care and sick visits",
  "Unlimited $0 in-person clinic visits at network locations",
  "Emotional wellness counseling (12 sessions)",
  "Health coaching (12 sessions)",
  "Care Navigation",
  "Discounted weight loss program, including GLP-1 medications",
];

const CARE_NAV_SERVICES = [
  "Educate members on benefits and available services",
  "Schedule services and coordinate appointments",
  "Coordinate referrals to specialists and ancillary providers",
  "Provide ongoing care coordination and follow-up",
  "Track member engagement and outcomes",
];

interface PlanDefinitionFormProps {
  initialSection2Data: Section2Data;
  initialSection3Data: Section3Data;
  initialSection9Data: Section9Data;
  initialSubServiceData?: Section11Data;
  onNavigate?: (section: number) => void;
  disabled?: boolean;
}

export function PlanDefinitionForm({
  initialSection2Data,
  initialSection3Data,
  initialSection9Data,
  initialSubServiceData,
  onNavigate,
  disabled,
}: PlanDefinitionFormProps) {
  // ─── State for each sub-section ───────────────────────────────
  const [s2Data, setS2Data] = useState<Section2Data>(initialSection2Data);
  const [s3Data, setS3Data] = useState<Section3Data>(initialSection3Data);
  const [s9Data, setS9Data] = useState<Section9Data>(initialSection9Data);
  const [subServiceData, setSubServiceData] = useState<Section11Data>(
    initialSubServiceData ?? { categories: {} }
  );
  const [modalService, setModalService] = useState<string | null>(null);

  // Sync caches on unmount for all three sections
  useSyncSectionCache(2, s2Data);
  useSyncSectionCache(3, s3Data);
  useSyncSectionCache(9, s9Data);

  const { updateStatuses } = useCompletion();
  const adminCtx = useAdminForm();
  const selectedProgramId = useSelectedProgram();

  // ─── Dirty tracking (composite across all sub-sections) ───────
  const initialS2Ref = useRef(JSON.stringify(initialSection2Data));
  const initialS3Ref = useRef(JSON.stringify(initialSection3Data));
  const initialS9Ref = useRef(JSON.stringify(initialSection9Data));

  const isDirty =
    JSON.stringify(s2Data) !== initialS2Ref.current ||
    JSON.stringify(s3Data) !== initialS3Ref.current ||
    JSON.stringify(s9Data) !== initialS9Ref.current;

  useReportDirty(2, isDirty);

  // Warn before closing with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ─── Composite save ───────────────────────────────────────────
  const s2Ref = useRef(s2Data); s2Ref.current = s2Data;
  const s3Ref = useRef(s3Data); s3Ref.current = s3Data;
  const s9Ref = useRef(s9Data); s9Ref.current = s9Data;
  const subRef = useRef(subServiceData); subRef.current = subServiceData;

  const save = useCallback(async () => {
    const curr2 = s2Ref.current;
    const curr3 = s3Ref.current;
    const curr9 = s9Ref.current;
    const currSub = subRef.current;

    const isAdmin = adminCtx?.isAdminEditing;
    const aid = adminCtx?.affiliateId ?? "";
    let lastResult: Record<number, string> | undefined;

    // Save section 2 if dirty
    if (JSON.stringify(curr2) !== initialS2Ref.current) {
      lastResult = isAdmin
        ? await saveSection2ForAffiliate(aid, curr2)
        : await saveSection2(curr2, selectedProgramId ?? undefined);
      initialS2Ref.current = JSON.stringify(curr2);
    }

    // Save section 3 if dirty
    if (JSON.stringify(curr3) !== initialS3Ref.current) {
      lastResult = isAdmin
        ? await saveSection3ForAffiliate(aid, curr3)
        : await saveSection3(curr3, selectedProgramId ?? undefined);
      initialS3Ref.current = JSON.stringify(curr3);
    }

    // Save sub-services (section 11) if configured
    if (Object.keys(currSub.categories).length > 0) {
      lastResult = isAdmin
        ? await saveSection11ForAffiliate(aid, currSub)
        : await saveSection11(currSub, selectedProgramId ?? undefined);
    }

    // Save section 9 if dirty
    if (JSON.stringify(curr9) !== initialS9Ref.current) {
      lastResult = isAdmin
        ? await saveSection9ForAffiliate(aid, curr9)
        : await saveSection9(curr9, selectedProgramId ?? undefined);
      initialS9Ref.current = JSON.stringify(curr9);
    }

    // Update completion statuses from whichever save ran last
    // (each returns the full status map for all sections)
    if (lastResult) {
      updateStatuses(lastResult as Record<number, import("@/types").CompletionStatus>);
    }
  }, [adminCtx, updateStatuses, selectedProgramId]);

  // ─── Section 3 handlers ───────────────────────────────────────

  function toggleService(index: number) {
    const serviceType = s3Data.services[index].serviceType;
    const wasSelected = s3Data.services[index].selected;

    setS3Data((prev) => ({
      services: prev.services.map((s, i) =>
        i === index ? { ...s, selected: !s.selected } : s
      ),
    }));

    if (wasSelected) {
      setSubServiceData((prev) => {
        const { [serviceType]: _, ...rest } = prev.categories;
        return { categories: rest };
      });
    }
  }

  function updateOtherName(index: number, name: string) {
    setS3Data((prev) => ({
      services: prev.services.map((s, i) =>
        i === index ? { ...s, otherName: name } : s
      ),
    }));
  }

  function openModal(serviceType: string) {
    const defs = SUB_SERVICE_TYPES[serviceType];
    if (defs && !subServiceData.categories[serviceType]) {
      setSubServiceData((prev) => ({
        categories: {
          ...prev.categories,
          [serviceType]: defs.map((d) => ({ subType: d.value, selected: false })),
        },
      }));
    }
    setModalService(serviceType);
  }

  function handleToggle(subType: string) {
    if (!modalService) return;
    setSubServiceData((prev) => ({
      categories: {
        ...prev.categories,
        [modalService]: (prev.categories[modalService] ?? []).map((item) =>
          item.subType === subType ? { ...item, selected: !item.selected } : item
        ),
      },
    }));
  }

  function handleSelectAll() {
    if (!modalService) return;
    setSubServiceData((prev) => ({
      categories: {
        ...prev.categories,
        [modalService]: (prev.categories[modalService] ?? []).map((item) => ({
          ...item,
          selected: true,
        })),
      },
    }));
  }

  function handleDeselectAll() {
    if (!modalService) return;
    setSubServiceData((prev) => ({
      categories: {
        ...prev.categories,
        [modalService]: (prev.categories[modalService] ?? []).map((item) => ({
          ...item,
          selected: false,
        })),
      },
    }));
  }

  function handleSelectGroup(group: string) {
    if (!modalService) return;
    const groupValues = new Set(
      (SUB_SERVICE_TYPES[modalService] ?? []).filter((d) => d.group === group).map((d) => d.value)
    );
    setSubServiceData((prev) => ({
      categories: {
        ...prev.categories,
        [modalService]: (prev.categories[modalService] ?? []).map((item) =>
          groupValues.has(item.subType) ? { ...item, selected: true } : item
        ),
      },
    }));
  }

  function handleDeselectGroup(group: string) {
    if (!modalService) return;
    const groupValues = new Set(
      (SUB_SERVICE_TYPES[modalService] ?? []).filter((d) => d.group === group).map((d) => d.value)
    );
    setSubServiceData((prev) => ({
      categories: {
        ...prev.categories,
        [modalService]: (prev.categories[modalService] ?? []).map((item) =>
          groupValues.has(item.subType) ? { ...item, selected: false } : item
        ),
      },
    }));
  }

  const modalDefs = modalService ? SUB_SERVICE_TYPES[modalService] ?? [] : [];
  const modalLabel = modalService
    ? SERVICE_TYPES.find((st) => st.value === modalService)?.label ?? modalService
    : "";
  const modalState: Record<string, boolean> = {};
  if (modalService && subServiceData.categories[modalService]) {
    for (const item of subServiceData.categories[modalService]) {
      modalState[item.subType] = item.selected;
    }
  }

  // ─── Section 9 helpers ────────────────────────────────────────

  function updateS9(field: keyof Section9Data, value: unknown) {
    setS9Data((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Card 0 — Plan Name (Section 2) */}
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Plan Name</h3>
        <p className="text-xs text-muted mb-5">
          This is the name members will hear and reference when using your program.
        </p>
        <Input
          label="Program Name"
          name="programName"
          required
          value={s2Data.programName ?? ""}
          onChange={(e) => setS2Data((prev) => ({ ...prev, programName: e.target.value }))}
          placeholder='e.g., "PRIME"'
          helperText="Choose a name that's easy for members to remember"
          disabled={disabled}
        />
      </Card>

      {/* Card 1 — Core Services (Section 2) */}
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Core Services</h3>
        <p className="text-xs text-muted mb-5">
          These services come standard with your plan and are delivered by our virtual care and care navigation teams.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {DEFAULT_SERVICES.map((service) => (
            <div key={service} className="flex items-center gap-3 p-3 bg-gray-light rounded-[var(--radius-input)]">
              <svg className="h-5 w-5 text-success flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-foreground">{service}</span>
            </div>
          ))}
        </div>

      </Card>

      {/* Bridging text */}
      <p className="text-sm text-muted px-1">
        Select the services your plan fully covers. Your members can access these at no additional cost through your care network.
      </p>

      {/* Card 2 — Extended Services (Section 3) */}
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Extended Services</h3>
        <p className="text-xs text-muted mb-5">
          Select the services that are part of your program. For services with sub-categories, click &ldquo;Configure&rdquo; to choose which specific items are covered.
        </p>

        <div className="flex flex-col gap-3">
          {s3Data.services.map((service, index) => {
            const meta = SERVICE_TYPES.find((st) => st.value === service.serviceType);
            const isLocked = meta && "locked" in meta && meta.locked;
            const hasSubServices = !!SUB_SERVICE_TYPES[service.serviceType];
            const isSelected = isLocked ? true : service.selected;

            const subItems = subServiceData.categories[service.serviceType];
            const selectedCount = subItems?.filter((i) => i.selected).length ?? 0;
            const totalCount = SUB_SERVICE_TYPES[service.serviceType]?.length ?? 0;

            return (
              <div key={service.serviceType}>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Checkbox
                      label={meta?.label ?? service.serviceType}
                      name={`service-${service.serviceType}`}
                      checked={isSelected}
                      onChange={isLocked ? undefined : () => toggleService(index)}
                      disabled={!!isLocked || disabled}
                    />
                  </div>
                  {hasSubServices && isSelected && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {subItems && selectedCount > 0 && (
                        <span className="text-xs text-brand-teal font-medium">
                          {selectedCount} of {totalCount}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openModal(service.serviceType)}
                        className="text-xs text-brand-teal hover:underline whitespace-nowrap"
                        disabled={disabled}
                      >
                        Configure &rarr;
                      </button>
                    </div>
                  )}
                </div>
                {service.serviceType === "other" && service.selected && (
                  <div className="ml-8 mt-2">
                    <Input
                      label="Specify service"
                      name="otherServiceName"
                      value={service.otherName ?? ""}
                      onChange={(e) => updateOtherName(index, e.target.value)}
                      placeholder="Describe the service"
                      disabled={disabled}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted mt-4 italic">
          Selected services are covered under your program and utilization is reported back to you. Non-selected services are not covered — members needing these will be referred out and may use their traditional insurance or pay out of pocket.
        </p>
      </Card>

      {/* Card 3 — Care Navigation (Section 9) */}
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Care Navigation</h3>
        <p className="text-xs text-muted mb-5">
          Care navigation is included with every plan. Our team helps your members find the right care.
        </p>

        <ul className="space-y-2 mb-6">
          {CARE_NAV_SERVICES.map((service) => (
            <li key={service} className="flex items-start gap-2 text-sm text-foreground">
              <svg className="h-4 w-4 text-success flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {service}
            </li>
          ))}
        </ul>

        <h4 className="text-sm font-heading font-semibold mb-3">Escalation Contacts</h4>
        <p className="text-xs text-muted mb-4">
          When Care Navigation encounters situations that require your team&apos;s involvement, these contacts will be notified.
        </p>
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-muted mb-2">Primary Escalation Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" required value={s9Data.primaryEscalationName ?? ""} onChange={(e) => updateS9("primaryEscalationName", e.target.value)} disabled={disabled} />
              <Input label="Email" required type="email" value={s9Data.primaryEscalationEmail ?? ""} onChange={(e) => updateS9("primaryEscalationEmail", e.target.value)} disabled={disabled} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted mb-2">Secondary Escalation Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" required value={s9Data.secondaryEscalationName ?? ""} onChange={(e) => updateS9("secondaryEscalationName", e.target.value)} disabled={disabled} />
              <Input label="Email" required type="email" value={s9Data.secondaryEscalationEmail ?? ""} onChange={(e) => updateS9("secondaryEscalationEmail", e.target.value)} disabled={disabled} />
            </div>
          </div>
        </div>
      </Card>

      <SubServiceModal
        open={!!modalService}
        onClose={() => setModalService(null)}
        serviceType={modalService ?? ""}
        serviceLabel={modalLabel}
        subServiceDefs={modalDefs}
        subServiceState={modalState}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onSelectGroup={handleSelectGroup}
        onDeselectGroup={handleDeselectGroup}
      />

      <SectionNavButtons currentSection={2} onNavigate={onNavigate} onSave={save} />
    </div>
  );
}
