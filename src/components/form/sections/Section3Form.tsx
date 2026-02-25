"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { SubServiceModal } from "@/components/ui/SubServiceModal";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSection3 } from "@/lib/actions/section3";
import { saveSection3ForAffiliate } from "@/lib/actions/admin-sections";
import { saveSection11 } from "@/lib/actions/section11";
import { saveSection11ForAffiliate } from "@/lib/actions/admin-sections";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { Section3Data } from "@/lib/validations/section3";
import type { Section11Data } from "@/lib/validations/section11";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { useAdminForm } from "@/lib/contexts/AdminFormContext";
import { SectionNavButtons } from "../SectionNavButtons";
import { useSyncSectionCache, useReportDirty } from "../OnboardingClient";

interface Section3FormProps {
  initialData: Section3Data;
  initialSubServiceData?: Section11Data;
  onNavigate?: (section: number) => void;
  disabled?: boolean;
}

export function Section3Form({ initialData, initialSubServiceData, onNavigate, disabled }: Section3FormProps) {
  const [data, setData] = useState<Section3Data>(initialData);
  const [subServiceData, setSubServiceData] = useState<Section11Data>(
    initialSubServiceData ?? { categories: {} }
  );
  const [modalService, setModalService] = useState<string | null>(null);

  useSyncSectionCache(3, data);
  const { updateStatuses } = useCompletion();
  const adminCtx = useAdminForm();

  const onSave = useCallback(async (d: Section3Data) => {
    // Save section 3 (services)
    let result;
    if (adminCtx?.isAdminEditing) {
      result = await saveSection3ForAffiliate(adminCtx.affiliateId, d);
    } else {
      result = await saveSection3(d);
    }

    // Also save section 11 (sub-services) if there are any configured categories
    if (Object.keys(subServiceData.categories).length > 0) {
      if (adminCtx?.isAdminEditing) {
        result = await saveSection11ForAffiliate(adminCtx.affiliateId, subServiceData);
      } else {
        result = await saveSection11(subServiceData);
      }
    }

    return result;
  }, [adminCtx, subServiceData]);

  const { save, isDirty } = useSaveOnNext({ data, onSave, onAfterSave: updateStatuses });
  useReportDirty(3, isDirty);

  function toggleService(index: number) {
    const serviceType = data.services[index].serviceType;
    const wasSelected = data.services[index].selected;

    setData((prev) => ({
      services: prev.services.map((s, i) =>
        i === index ? { ...s, selected: !s.selected } : s
      ),
    }));

    // If deselecting, remove sub-service data for this category
    if (wasSelected) {
      setSubServiceData((prev) => {
        const { [serviceType]: _, ...rest } = prev.categories;
        return { categories: rest };
      });
    }
  }

  function updateOtherName(index: number, name: string) {
    setData((prev) => ({
      services: prev.services.map((s, i) =>
        i === index ? { ...s, otherName: name } : s
      ),
    }));
  }

  // Sub-service modal handlers
  function openModal(serviceType: string) {
    // Initialize sub-service state for this category if not present
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

  // Build modal state map for the current service
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">
          Which services are part of your program?
        </h3>
        <p className="text-xs text-muted mb-5">
          Select the services that are part of your program. For services with sub-categories, click &ldquo;Configure&rdquo; to choose which specific items are covered.
        </p>

        <div className="flex flex-col gap-3">
          {data.services.map((service, index) => {
            const meta = SERVICE_TYPES.find((st) => st.value === service.serviceType);
            const isLocked = meta && "locked" in meta && meta.locked;
            const hasSubServices = !!SUB_SERVICE_TYPES[service.serviceType];
            const isSelected = isLocked ? true : service.selected;

            // Sub-service counts
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
                      disabled={!!isLocked}
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

      <SectionNavButtons currentSection={3} onNavigate={onNavigate} onSave={save} />
    </div>
  );
}
