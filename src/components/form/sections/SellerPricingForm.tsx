"use client";

import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSellerPricing } from "@/lib/actions/seller-pricing";
import type { SellerPricingData } from "@/lib/validations/seller-pricing";
import type { Section11Data } from "@/lib/validations/section11";
import { SUB_SERVICE_TYPES, getSubServiceLabel } from "@/lib/validations/section11";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SellerSectionNavButtons } from "../SellerSectionNavButtons";
import { useReportDirty, useSellerCacheUpdater } from "../OnboardingClient";
import Papa from "papaparse";
import { toast } from "sonner";

interface ServiceSelection {
  serviceType: string;
  selected: boolean;
}

interface Props {
  initialData: SellerPricingData;
  serviceSelections: ServiceSelection[];
  orgSubServices?: Section11Data;
  onNavigate?: (sectionId: string) => void;
  onStatusUpdate?: (statuses: Record<string, string>) => void;
  disabled?: boolean;
}

function getServiceLabel(serviceType: string): string {
  return (
    SELLER_SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    serviceType
  );
}

export function SellerPricingForm({ initialData, serviceSelections, orgSubServices, onNavigate, onStatusUpdate, disabled }: Props) {
  const [data, setData] = useState<SellerPricingData>(initialData);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [bulkPrices, setBulkPrices] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPrimaryCare = serviceSelections.some((s) => s.serviceType === "primary_care" && s.selected);
  const hasUrgentCare = serviceSelections.some((s) => s.serviceType === "urgent_care" && s.selected);
  const hasVisitServices = hasPrimaryCare || hasUrgentCare;

  // Build list of service categories that have sub-services selected
  const subServiceCategories: Array<{ serviceType: string; label: string; items: Array<{ subType: string; label: string }> }> = [];
  if (orgSubServices?.categories) {
    for (const [serviceType, items] of Object.entries(orgSubServices.categories)) {
      const selectedItems = items.filter((i) => i.selected);
      if (selectedItems.length === 0) continue;
      subServiceCategories.push({
        serviceType,
        label: getServiceLabel(serviceType),
        items: selectedItems.map((i) => ({
          subType: i.subType,
          label: getSubServiceLabel(serviceType, i.subType),
        })),
      });
    }
  }

  const hasSubServices = subServiceCategories.length > 0;

  const updateSellerCache = useSellerCacheUpdater();

  const onSave = useCallback(async (d: SellerPricingData) => {
    const statuses = await saveSellerPricing(d);
    updateSellerCache("pricing", d);
    onStatusUpdate?.(statuses);
    return {};
  }, [onStatusUpdate, updateSellerCache]);

  const { save, isDirty } = useSaveOnNext({ data, onSave });
  useReportDirty("S-7", isDirty);

  // ─── Visit price helpers ────────────────────────────────────────

  function getVisitPrice(serviceType: string): number | null {
    return data.visitPrices?.find((v) => v.serviceType === serviceType)?.price ?? null;
  }

  function updateVisitPrice(serviceType: string, value: string) {
    const num = value === "" ? null : parseFloat(value);
    setData((prev) => {
      const existing = prev.visitPrices ?? [];
      const found = existing.find((v) => v.serviceType === serviceType);
      const newVisitPrices = found
        ? existing.map((v) => v.serviceType === serviceType ? { ...v, price: isNaN(num as number) ? v.price : num } : v)
        : [...existing, { serviceType, price: isNaN(num as number) ? null : num }];
      return { ...prev, visitPrices: newVisitPrices };
    });
  }

  // ─── Sub-service price helpers ──────────────────────────────────

  function getSubServicePrice(serviceType: string, subType: string): number | null {
    return data.subServicePrices?.find((s) => s.serviceType === serviceType && s.subType === subType)?.unitPrice ?? null;
  }

  function updateSubServicePrice(serviceType: string, subType: string, value: string) {
    const num = value === "" ? null : parseFloat(value);
    setData((prev) => {
      const existing = prev.subServicePrices ?? [];
      const found = existing.find((s) => s.serviceType === serviceType && s.subType === subType);
      const price = isNaN(num as number) ? null : num;
      const newPrices = found
        ? existing.map((s) => s.serviceType === serviceType && s.subType === subType ? { ...s, unitPrice: price } : s)
        : [...existing, { serviceType, subType, unitPrice: price }];
      return { ...prev, subServicePrices: newPrices };
    });
  }

  function applyBulkPrice(serviceType: string) {
    const val = bulkPrices[serviceType];
    if (!val) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    const category = subServiceCategories.find((c) => c.serviceType === serviceType);
    if (!category) return;

    setData((prev) => {
      const existing = prev.subServicePrices ?? [];
      const otherPrices = existing.filter((s) => s.serviceType !== serviceType);
      const categoryPrices = category.items.map((item) => ({
        serviceType,
        subType: item.subType,
        unitPrice: num,
      }));
      return { ...prev, subServicePrices: [...otherPrices, ...categoryPrices] };
    });
    setBulkPrices((prev) => ({ ...prev, [serviceType]: "" }));
    toast.success(`Set all ${category.label} prices to $${num.toFixed(2)}`);
  }

  // ─── Category progress ─────────────────────────────────────────

  function getCategoryProgress(serviceType: string): { priced: number; total: number } {
    const category = subServiceCategories.find((c) => c.serviceType === serviceType);
    if (!category) return { priced: 0, total: 0 };
    const priced = category.items.filter((item) =>
      getSubServicePrice(serviceType, item.subType) != null
    ).length;
    return { priced, total: category.items.length };
  }

  // ─── Overall progress ──────────────────────────────────────────

  function getOverallProgress(): { priced: number; total: number } {
    let priced = 0;
    let total = 0;
    // Visit prices
    if (hasPrimaryCare) { total++; if (getVisitPrice("primary_care") != null) priced++; }
    if (hasUrgentCare) { total++; if (getVisitPrice("urgent_care") != null) priced++; }
    // Sub-service prices
    for (const cat of subServiceCategories) {
      const progress = getCategoryProgress(cat.serviceType);
      priced += progress.priced;
      total += progress.total;
    }
    return { priced, total };
  }

  const overall = getOverallProgress();

  // ─── CSV Upload ─────────────────────────────────────────────────

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete(results) {
        if (results.data.length === 0) {
          toast.error("CSV has no data rows");
          return;
        }

        let importCount = 0;
        setData((prev) => {
          const existingPrices = [...(prev.subServicePrices ?? [])];
          const existingVisitPrices = [...(prev.visitPrices ?? [])];

          for (const row of results.data) {
            const serviceType = row.service_type?.trim();
            const subType = row.sub_type?.trim();
            const unitPriceStr = row.unit_price?.trim();

            if (!serviceType || !unitPriceStr) continue;
            const price = parseFloat(unitPriceStr);
            if (isNaN(price) || price <= 0) continue;

            if (!subType) {
              // Visit-level price
              const existing = existingVisitPrices.find((v) => v.serviceType === serviceType);
              if (existing) {
                existing.price = price;
              } else {
                existingVisitPrices.push({ serviceType, price });
              }
              importCount++;
            } else {
              // Sub-service price
              const existing = existingPrices.find((s) => s.serviceType === serviceType && s.subType === subType);
              if (existing) {
                existing.unitPrice = price;
              } else {
                existingPrices.push({ serviceType, subType, unitPrice: price });
              }
              importCount++;
            }
          }

          return { ...prev, visitPrices: existingVisitPrices, subServicePrices: existingPrices };
        });

        toast.success(`Imported ${importCount} price${importCount !== 1 ? "s" : ""} from CSV`);
      },
      error() {
        toast.error("Failed to parse CSV file");
      },
    });

    // Reset file input
    e.target.value = "";
  }

  function downloadTemplate() {
    const rows: string[][] = [["service_type", "sub_type", "unit_price"]];

    // Visit prices (include current values)
    if (hasPrimaryCare) {
      const price = getVisitPrice("primary_care");
      rows.push(["primary_care", "", price != null ? String(price) : ""]);
    }
    if (hasUrgentCare) {
      const price = getVisitPrice("urgent_care");
      rows.push(["urgent_care", "", price != null ? String(price) : ""]);
    }

    // Sub-service prices (include current values)
    for (const cat of subServiceCategories) {
      for (const item of cat.items) {
        const price = getSubServicePrice(cat.serviceType, item.subType);
        rows.push([cat.serviceType, item.subType, price != null ? String(price) : ""]);
      }
    }

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "price-list-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Toggle category ───────────────────────────────────────────

  function toggleCategory(serviceType: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(serviceType)) next.delete(serviceType);
      else next.add(serviceType);
      return next;
    });
  }

  // ─── Render ────────────────────────────────────────────────────

  if (!hasVisitServices && !hasSubServices) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <p className="text-sm text-muted">
            No pricing-eligible services selected. Go back to Services Offered and select at least one service.
          </p>
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

  return (
    <div className="flex flex-col gap-6">
      {/* Progress + CSV Upload */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {overall.priced} of {overall.total} items priced
            </p>
            <div className="mt-1 h-1.5 w-48 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-teal rounded-full transition-all duration-300"
                style={{ width: overall.total > 0 ? `${(overall.priced / overall.total) * 100}%` : "0%" }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs text-brand-teal hover:underline"
            >
              Download CSV template
            </button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </div>
        </div>
      </Card>

      {/* Visit Pricing */}
      {hasVisitServices && (
        <Card>
          <h3 className="text-base font-heading font-semibold mb-4">Visit Pricing</h3>
          <div className="grid gap-4">
            {hasPrimaryCare && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="primaryCarePrice" className="text-sm font-medium text-muted">Primary Care — Price per Visit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
                  <input
                    id="primaryCarePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 125.00"
                    className="w-full bg-transparent border-[1.5px] border-border rounded-[var(--radius-input)] pl-7 pr-4 py-3.5 text-foreground text-base placeholder:text-gray-medium/50 focus:border-focus focus:ring-0 transition-colors duration-150"
                    value={getVisitPrice("primary_care") != null ? String(getVisitPrice("primary_care")) : ""}
                    onChange={(e) => updateVisitPrice("primary_care", e.target.value)}
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
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 175.00"
                    className="w-full bg-transparent border-[1.5px] border-border rounded-[var(--radius-input)] pl-7 pr-4 py-3.5 text-foreground text-base placeholder:text-gray-medium/50 focus:border-focus focus:ring-0 transition-colors duration-150"
                    value={getVisitPrice("urgent_care") != null ? String(getVisitPrice("urgent_care")) : ""}
                    onChange={(e) => updateVisitPrice("urgent_care", e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Sub-Service Pricing by Category */}
      {subServiceCategories.map((cat) => {
        const isExpanded = expandedCategories.has(cat.serviceType);
        const progress = getCategoryProgress(cat.serviceType);
        const allPriced = progress.priced === progress.total;

        return (
          <Card key={cat.serviceType}>
            <button
              type="button"
              className="w-full text-left flex items-center justify-between"
              onClick={() => toggleCategory(cat.serviceType)}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-base font-heading font-semibold">{cat.label}</h3>
                <span className={`text-xs font-medium ${allPriced ? "text-green-700" : "text-amber-600"}`}>
                  {progress.priced} of {progress.total} priced
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-4">
                {/* Bulk set */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                  <span className="text-xs text-muted">Set all to</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full bg-transparent border border-border rounded pl-5 pr-1 py-1.5 text-xs focus:border-focus focus:ring-0"
                      value={bulkPrices[cat.serviceType] ?? ""}
                      onChange={(e) => setBulkPrices((prev) => ({ ...prev, [cat.serviceType]: e.target.value }))}
                      disabled={disabled}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => applyBulkPrice(cat.serviceType)}
                    disabled={disabled || !bulkPrices[cat.serviceType]}
                    className="!text-xs !py-1 !px-3"
                  >
                    Apply
                  </Button>
                </div>

                {/* Individual items */}
                <div className="space-y-2">
                  {cat.items.map((item) => {
                    const price = getSubServicePrice(cat.serviceType, item.subType);
                    return (
                      <div key={item.subType} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-foreground truncate">{item.label}</span>
                        <div className="relative flex-shrink-0 w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full bg-transparent border border-border rounded-[var(--radius-input)] pl-6 pr-2 py-2 text-sm text-right focus:border-focus focus:ring-0 transition-colors duration-150"
                            value={price != null ? String(price) : ""}
                            onChange={(e) => updateSubServicePrice(cat.serviceType, item.subType, e.target.value)}
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        );
      })}

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
