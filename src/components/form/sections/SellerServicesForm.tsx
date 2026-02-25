"use client";

import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { SubServiceModal } from "@/components/ui/SubServiceModal";
import { SellerSectionNavButtons } from "../SellerSectionNavButtons";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSellerServices } from "@/lib/actions/seller-services";
import { saveSellerOrgSubServices, deleteOrgSubServicesForType } from "@/lib/actions/seller-org-sub-services";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { SellerServicesData } from "@/lib/validations/seller-services";
import type { Section11Data } from "@/lib/validations/section11";
import { useReportDirty, useSellerCacheUpdater } from "../OnboardingClient";

interface Props {
  initialData: SellerServicesData;
  initialSubServiceData?: Section11Data;
  onNavigate?: (sectionId: string) => void;
  onStatusUpdate?: (statuses: Record<string, string>) => void;
  onServicesChange?: (data: SellerServicesData) => void;
  disabled?: boolean;
}

export function SellerServicesForm({ initialData, initialSubServiceData, onNavigate, onStatusUpdate, onServicesChange, disabled }: Props) {
  const [data, setData] = useState<SellerServicesData>(initialData);
  const [subServiceData, setSubServiceData] = useState<Section11Data>(
    initialSubServiceData ?? { categories: {} }
  );
  const [subServiceDirty, setSubServiceDirty] = useState(false);
  const [modalService, setModalService] = useState<string | null>(null);

  const subServiceRef = useRef(subServiceData);
  subServiceRef.current = subServiceData;

  const updateSellerCache = useSellerCacheUpdater();

  const onSave = useCallback(async (d: SellerServicesData) => {
    const statuses = await saveSellerServices(d);

    // Also save org sub-services if any configured
    const subData = subServiceRef.current;
    if (Object.keys(subData.categories).length > 0) {
      await saveSellerOrgSubServices(subData);
    }

    // Sync saved state to parent cache
    updateSellerCache("services", d);
    updateSellerCache("orgSubServices", subData);

    setSubServiceDirty(false);
    onStatusUpdate?.(statuses);
    onServicesChange?.(d);
    return {};
  }, [onStatusUpdate, onServicesChange, updateSellerCache]);

  const { save, isDirty } = useSaveOnNext({ data, onSave });
  useReportDirty("S-4", isDirty || subServiceDirty);

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
      // Also delete from DB
      deleteOrgSubServicesForType(serviceType).catch(() => {});
    }
  }

  // Sub-service modal handlers
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
    setSubServiceDirty(true);
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
    setSubServiceDirty(true);
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
    setSubServiceDirty(true);
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
    setSubServiceDirty(true);
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
    setSubServiceDirty(true);
  }

  // Build modal state
  const modalDefs = modalService ? SUB_SERVICE_TYPES[modalService] ?? [] : [];
  const modalLabel = modalService
    ? SELLER_SERVICE_TYPES.find((st) => st.value === modalService)?.label ?? modalService
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
        <div className="flex flex-col gap-3">
          {data.services.map((service, index) => {
            const meta = SELLER_SERVICE_TYPES.find((st) => st.value === service.serviceType);
            const hasSubServices = !!SUB_SERVICE_TYPES[service.serviceType];
            const isSelected = service.selected;

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
                      name={`seller-service-${service.serviceType}`}
                      checked={isSelected}
                      onChange={() => toggleService(index)}
                      disabled={disabled}
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
              </div>
            );
          })}
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

      <SellerSectionNavButtons
        currentSection="S-4"
        onNavigate={onNavigate}
        onSave={async () => {
          if (isDirty) {
            await save();
          } else if (subServiceDirty) {
            await onSave(data);
          }
        }}
        isDirty={isDirty || subServiceDirty}
        disabled={disabled}
      />
    </div>
  );
}
