"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSellerPricing } from "@/lib/actions/seller-pricing";
import type { SellerPricingData } from "@/lib/validations/seller-pricing";
import { SellerSectionNavButtons } from "../SellerSectionNavButtons";
import { useReportDirty, useSellerCacheUpdater } from "../OnboardingClient";

interface ServiceSelection {
  serviceType: string;
  selected: boolean;
}

interface Props {
  initialData: SellerPricingData;
  serviceSelections: ServiceSelection[];
  onNavigate?: (sectionId: string) => void;
  onStatusUpdate?: (statuses: Record<string, string>) => void;
  disabled?: boolean;
}

export function SellerPricingForm({ initialData, serviceSelections, onNavigate, onStatusUpdate, disabled }: Props) {
  const [data, setData] = useState<SellerPricingData>(initialData);

  const hasPrimaryCare = serviceSelections.some((s) => s.serviceType === "primary_care" && s.selected);
  const hasUrgentCare = serviceSelections.some((s) => s.serviceType === "urgent_care" && s.selected);

  const updateSellerCache = useSellerCacheUpdater();

  const onSave = useCallback(async (d: SellerPricingData) => {
    const statuses = await saveSellerPricing(d);
    updateSellerCache("pricing", d);
    onStatusUpdate?.(statuses);
    return {};
  }, [onStatusUpdate, updateSellerCache]);

  const { save, isDirty } = useSaveOnNext({ data, onSave });
  useReportDirty("S-7", isDirty);

  function updatePrice(field: keyof SellerPricingData, value: string) {
    const num = value === "" ? null : parseFloat(value);
    setData((prev) => ({ ...prev, [field]: isNaN(num as number) ? prev[field] : num }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        {!hasPrimaryCare && !hasUrgentCare && (
          <p className="text-sm text-muted">
            No pricing-eligible services selected. Go back to Default Services and select Primary Care or Urgent Care.
          </p>
        )}

        <div className="grid gap-5">
          {hasPrimaryCare && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="primaryCarePrice" className="text-sm font-medium text-muted">Primary Care — Price per Visit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
                <input
                  id="primaryCarePrice"
                  name="primaryCarePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 125.00"
                  className="w-full bg-transparent border-[1.5px] border-border rounded-[var(--radius-input)] pl-7 pr-4 py-3.5 text-foreground text-base placeholder:text-gray-medium/50 focus:border-focus focus:ring-0 transition-colors duration-150"
                  value={data.primaryCarePrice != null ? String(data.primaryCarePrice) : ""}
                  onChange={(e) => updatePrice("primaryCarePrice", e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
          {hasUrgentCare && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="urgentCarePrice" className="text-sm font-medium text-muted">Urgent Care — Price per Visit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
                <input
                  id="urgentCarePrice"
                  name="urgentCarePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 175.00"
                  className="w-full bg-transparent border-[1.5px] border-border rounded-[var(--radius-input)] pl-7 pr-4 py-3.5 text-foreground text-base placeholder:text-gray-medium/50 focus:border-focus focus:ring-0 transition-colors duration-150"
                  value={data.urgentCarePrice != null ? String(data.urgentCarePrice) : ""}
                  onChange={(e) => updatePrice("urgentCarePrice", e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <SellerSectionNavButtons
        currentSection="S-7"
        onNavigate={onNavigate}
        onSave={save}
        isDirty={isDirty}
        disabled={disabled}
      />
    </div>
  );
}
