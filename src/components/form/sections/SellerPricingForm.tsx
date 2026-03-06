"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { listPriceLists, loadPriceList, savePriceList, deletePriceList, duplicatePriceList, loadBuyerOrgs } from "@/lib/actions/price-list";
import type { PriceListSummary, PriceListDetail, BuyerOrgOption } from "@/lib/actions/price-list";
import type { PriceListData, BundleRuleData } from "@/lib/validations/price-list";
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

interface SellerLocationOption {
  id: string;
  locationName: string;
}

interface Props {
  serviceSelections: ServiceSelection[];
  orgSubServices?: Section11Data;
  sellerLocations?: SellerLocationOption[];
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

// ─── Bundle Rules Editor ─────────────────────────────────────────────

function BundleRulesEditor({
  bundleRules,
  onChange,
  serviceSelections,
  disabled,
}: {
  bundleRules: BundleRuleData[];
  onChange: (rules: BundleRuleData[]) => void;
  serviceSelections: ServiceSelection[];
  disabled?: boolean;
}) {
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());
  const [openSubMenus, setOpenSubMenus] = useState<Set<string>>(new Set());
  const [emptyServiceRows, setEmptyServiceRows] = useState<Set<string>>(new Set());

  const selectedServices = serviceSelections.filter((s) => s.selected);

  function toggleRule(idx: number) {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function addRule() {
    const newIdx = bundleRules.length;
    onChange([
      ...bundleRules,
      {
        name: "",
        ruleType: "flat_rate",
        price: 0,
        includesVisitFee: false,
        targets: [],
      },
    ]);
    setExpandedRules((prev) => new Set([...prev, newIdx]));
  }

  function removeRule(idx: number) {
    onChange(bundleRules.filter((_, i) => i !== idx));
    setExpandedRules((prev) => {
      const next = new Set<number>();
      for (const v of prev) {
        if (v < idx) next.add(v);
        else if (v > idx) next.add(v - 1);
      }
      return next;
    });
    // Clean up emptyServiceRows for this rule and re-index
    setEmptyServiceRows((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        const [ri, st] = key.split(":");
        const riNum = Number(ri);
        if (riNum < idx) next.add(key);
        else if (riNum > idx) next.add(`${riNum - 1}:${st}`);
      }
      return next;
    });
  }

  function updateRule(idx: number, patch: Partial<BundleRuleData>) {
    onChange(bundleRules.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function addServiceCategory(ruleIdx: number) {
    const rule = bundleRules[ruleIdx];
    // Find first service type not already targeted
    const usedTypes = new Set(rule.targets.map((t) => t.serviceType));
    const available = selectedServices.find((s) => !usedTypes.has(s.serviceType));
    const serviceType = available?.serviceType ?? selectedServices[0]?.serviceType ?? "";
    updateRule(ruleIdx, {
      targets: [...rule.targets, { serviceType, subType: null }],
    });
  }

  function removeServiceCategory(ruleIdx: number, serviceType: string) {
    const rule = bundleRules[ruleIdx];
    updateRule(ruleIdx, {
      targets: rule.targets.filter((t) => t.serviceType !== serviceType),
    });
    setEmptyServiceRows((prev) => {
      const next = new Set(prev);
      next.delete(`${ruleIdx}:${serviceType}`);
      return next;
    });
  }

  function toggleSubService(ruleIdx: number, serviceType: string, subValue: string | null) {
    const rule = bundleRules[ruleIdx];
    const subOptions = SUB_SERVICE_TYPES[serviceType] ?? [];

    if (subValue === null) {
      // Toggle "Entire category" — replace all targets for this service type with one category target
      const hasCategory = rule.targets.some((t) => t.serviceType === serviceType && t.subType == null);
      let newTargets: typeof rule.targets;
      if (hasCategory) {
        // Uncheck "Entire category" → expand to all individual subs checked
        const allSubs = subOptions.map((s) => s.value);
        newTargets = [
          ...rule.targets.filter((t) => t.serviceType !== serviceType),
          ...allSubs.map((v) => ({ serviceType, subType: v })),
        ];
      } else {
        // Set to entire category — remove individual sub-service targets, add category
        newTargets = [
          ...rule.targets.filter((t) => t.serviceType !== serviceType),
          { serviceType, subType: null },
        ];
      }
      // Clear empty row tracking since we have targets now
      setEmptyServiceRows((prev) => {
        const next = new Set(prev);
        next.delete(`${ruleIdx}:${serviceType}`);
        return next;
      });
      updateRule(ruleIdx, { targets: newTargets });
    } else {
      // Toggle individual sub-service
      const hasCategory = rule.targets.some((t) => t.serviceType === serviceType && t.subType == null);
      const existing = rule.targets.find((t) => t.serviceType === serviceType && t.subType === subValue);

      let newTargets: typeof rule.targets;
      if (hasCategory) {
        // Was "entire category" — switch to all-except-this-one selected individually
        const allSubs = subOptions.map((s) => s.value);
        newTargets = [
          ...rule.targets.filter((t) => t.serviceType !== serviceType),
          ...allSubs.filter((v) => v !== subValue).map((v) => ({ serviceType, subType: v })),
        ];
      } else if (existing) {
        // Deselect this sub-service
        newTargets = rule.targets.filter((t) => !(t.serviceType === serviceType && t.subType === subValue));
        // If nothing left for this service type, keep row visible via emptyServiceRows
        if (!newTargets.some((t) => t.serviceType === serviceType)) {
          setEmptyServiceRows((prev) => new Set([...prev, `${ruleIdx}:${serviceType}`]));
        }
      } else {
        // Select this sub-service
        const updated = [...rule.targets, { serviceType, subType: subValue }];
        // Check if all sub-services are now selected → upgrade to "entire category"
        const selectedForType = updated.filter((t) => t.serviceType === serviceType && t.subType != null);
        if (selectedForType.length === subOptions.length) {
          newTargets = [
            ...updated.filter((t) => t.serviceType !== serviceType),
            { serviceType, subType: null },
          ];
        } else {
          newTargets = updated;
        }
        // Clear empty row tracking since we're adding a target
        setEmptyServiceRows((prev) => {
          const next = new Set(prev);
          next.delete(`${ruleIdx}:${serviceType}`);
          return next;
        });
      }
      updateRule(ruleIdx, { targets: newTargets });
    }
  }

  function deselectAllSubs(ruleIdx: number, serviceType: string) {
    const rule = bundleRules[ruleIdx];
    updateRule(ruleIdx, {
      targets: rule.targets.filter((t) => t.serviceType !== serviceType),
    });
    // Keep the row visible via local state
    setEmptyServiceRows((prev) => new Set([...prev, `${ruleIdx}:${serviceType}`]));
  }

  function changeServiceType(ruleIdx: number, oldServiceType: string, newServiceType: string) {
    const rule = bundleRules[ruleIdx];
    updateRule(ruleIdx, {
      targets: rule.targets.map((t) =>
        t.serviceType === oldServiceType ? { serviceType: newServiceType, subType: null } : t
      ),
    });
    setEmptyServiceRows((prev) => {
      const oldKey = `${ruleIdx}:${oldServiceType}`;
      if (!prev.has(oldKey)) return prev;
      const next = new Set(prev);
      next.delete(oldKey);
      next.add(`${ruleIdx}:${newServiceType}`);
      return next;
    });
  }

  if (bundleRules.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-heading font-semibold">Bundle Pricing Rules</h3>
            <p className="text-xs text-muted mt-1">
              No bundle rules defined. Add a rule to create flat-rate pricing packages.
            </p>
          </div>
          <Button variant="secondary" type="button" onClick={addRule} disabled={disabled} className="!text-xs !py-1.5 !px-3 flex-shrink-0">
            + Add Rule
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-heading font-semibold">Bundle Pricing Rules</h3>
        <Button variant="secondary" type="button" onClick={addRule} disabled={disabled} className="!text-xs !py-1.5 !px-3">
          + Add Rule
        </Button>
      </div>
      <div className="space-y-3">
        {bundleRules.map((rule, idx) => {
          const isExpanded = expandedRules.has(idx);
          return (
            <div key={idx} className="border border-border rounded-lg">
              <button
                type="button"
                className="w-full text-left flex items-center justify-between p-3"
                onClick={() => toggleRule(idx)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {rule.name || "Untitled Rule"}
                  </span>
                  <span className="text-xs text-muted flex-shrink-0">
                    Flat Rate · ${rule.price.toFixed(2)}
                    {rule.targets.length > 0 && ` · ${rule.targets.length} service${rule.targets.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); if (!disabled) removeRule(idx); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (!disabled) removeRule(idx); } }}
                    className={`text-xs text-muted hover:text-error cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Remove
                  </span>
                  <svg className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                  {/* Name */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Bundle Name</label>
                    <Input
                      value={rule.name}
                      onChange={(e) => updateRule(idx, { name: e.target.value })}
                      placeholder='e.g. "Visit + Laceration", "All DME Flat"'
                      disabled={disabled}
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Bundle Price</label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        className="w-full bg-transparent border border-border rounded-[var(--radius-input)] pl-6 pr-2 py-2 text-sm text-right focus:border-focus focus:ring-0"
                        value={rule.price || ""}
                        onChange={(e) => {
                          const num = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          updateRule(idx, { price: isNaN(num) ? 0 : num });
                        }}
                        disabled={disabled}
                      />
                    </div>
                  </div>

                  {/* Includes visit fee toggle */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-foreground">Includes visit fee</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.includesVisitFee}
                      onClick={() => { if (!disabled) updateRule(idx, { includesVisitFee: !rule.includesVisitFee }); }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        rule.includesVisitFee ? "bg-brand-teal" : "bg-gray-300"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        rule.includesVisitFee ? "translate-x-[18px]" : "translate-x-[3px]"
                      }`} />
                    </button>
                    <span className="text-xs text-muted">{rule.includesVisitFee ? "On" : "Off"}</span>
                  </div>

                  {/* Services Included */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-foreground">Services Included</label>
                      <button
                        type="button"
                        onClick={() => addServiceCategory(idx)}
                        disabled={disabled}
                        className="text-xs text-brand-teal hover:text-brand-teal/80 font-medium disabled:opacity-50"
                      >
                        + Add Service
                      </button>
                    </div>
                    {rule.targets.length === 0 && !Array.from(emptyServiceRows).some((k) => k.startsWith(`${idx}:`)) && (
                      <p className="text-xs text-muted italic">No services included. Add at least one service category or sub-service.</p>
                    )}
                    <div className="space-y-2">
                      {/* Group targets by serviceType for display */}
                      {(() => {
                        const grouped = new Map<string, Array<{ serviceType: string; subType: string | null }>>();
                        for (const t of rule.targets) {
                          if (!grouped.has(t.serviceType)) grouped.set(t.serviceType, []);
                          grouped.get(t.serviceType)!.push({ serviceType: t.serviceType, subType: t.subType ?? null });
                        }
                        // Also include service rows with no selections (from Deselect All)
                        for (const key of emptyServiceRows) {
                          const [ri, st] = key.split(":");
                          if (Number(ri) === idx && !grouped.has(st)) {
                            grouped.set(st, []);
                          }
                        }
                        return Array.from(grouped.entries()).map(([serviceType, targets]) => {
                          const subOptions = SUB_SERVICE_TYPES[serviceType] ?? [];
                          const hasCategory = targets.some((t) => t.subType == null);
                          const selectedSubs = new Set(targets.filter((t) => t.subType != null).map((t) => t.subType!));
                          const menuKey = `${idx}:${serviceType}`;
                          const isMenuOpen = openSubMenus.has(menuKey);

                          // Summary label for the multi-select button
                          let selectionLabel: string;
                          if (hasCategory) {
                            selectionLabel = "Entire category";
                          } else if (selectedSubs.size === 0) {
                            selectionLabel = "Select sub-services...";
                          } else if (selectedSubs.size <= 2) {
                            selectionLabel = Array.from(selectedSubs)
                              .map((v) => subOptions.find((s) => s.value === v)?.label ?? v)
                              .join(", ");
                          } else {
                            selectionLabel = `${selectedSubs.size} sub-services selected`;
                          }

                          return (
                            <div key={serviceType} className="flex items-start gap-2">
                              <select
                                value={serviceType}
                                onChange={(e) => changeServiceType(idx, serviceType, e.target.value)}
                                className="flex-1 bg-transparent border border-border rounded px-2 py-1.5 text-xs focus:border-focus focus:ring-0"
                                disabled={disabled}
                              >
                                <option value="">Select service...</option>
                                {selectedServices.map((s) => (
                                  <option key={s.serviceType} value={s.serviceType}>
                                    {getServiceLabel(s.serviceType)}
                                  </option>
                                ))}
                              </select>
                              {/* Multi-select sub-service dropdown */}
                              <div className="flex-1 relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenSubMenus((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(menuKey)) next.delete(menuKey);
                                      else { next.clear(); next.add(menuKey); }
                                      return next;
                                    });
                                  }}
                                  disabled={disabled}
                                  className="w-full bg-transparent border border-border rounded px-2 py-1.5 text-xs text-left focus:border-focus focus:ring-0 flex items-center justify-between gap-1 disabled:opacity-50"
                                >
                                  <span className={`truncate ${hasCategory || selectedSubs.size > 0 ? "text-foreground" : "text-muted"}`}>
                                    {selectionLabel}
                                  </span>
                                  <svg className={`w-3 h-3 text-muted flex-shrink-0 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                {isMenuOpen && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenSubMenus(new Set())} />
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                      {/* Entire category option */}
                                      <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 cursor-pointer border-b border-border/30">
                                        <input
                                          type="checkbox"
                                          checked={hasCategory}
                                          onChange={() => toggleSubService(idx, serviceType, null)}
                                          className="rounded border-border text-brand-teal focus:ring-brand-teal/30"
                                        />
                                        <span className="font-medium">Entire category</span>
                                      </label>
                                      {!hasCategory && subOptions.length > 0 && (
                                        <div className="flex items-center justify-between px-2.5 py-1 border-b border-border/30">
                                          <button type="button" onClick={() => toggleSubService(idx, serviceType, null)}
                                            className="text-[10px] text-brand-teal hover:underline">
                                            Select All
                                          </button>
                                          <button type="button" onClick={() => deselectAllSubs(idx, serviceType)}
                                            className="text-[10px] text-muted hover:text-error hover:underline">
                                            Deselect All
                                          </button>
                                        </div>
                                      )}
                                      {subOptions.map((sub) => (
                                        <label
                                          key={sub.value}
                                          className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={hasCategory || selectedSubs.has(sub.value)}
                                            disabled={hasCategory}
                                            onChange={() => toggleSubService(idx, serviceType, sub.value)}
                                            className="rounded border-border text-brand-teal focus:ring-brand-teal/30 disabled:opacity-40"
                                          />
                                          <span className={hasCategory ? "text-muted" : ""}>{sub.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeServiceCategory(idx, serviceType)}
                                disabled={disabled}
                                className="text-muted hover:text-error text-xs disabled:opacity-50 flex-shrink-0 mt-1"
                              >
                                &times;
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Price List Editor (shared UI for editing prices) ────────────────

function PriceListEditor({
  data,
  setData,
  serviceSelections,
  orgSubServices,
  sellerLocations,
  disabled,
}: {
  data: PriceListData;
  setData: (fn: (prev: PriceListData) => PriceListData) => void;
  serviceSelections: ServiceSelection[];
  orgSubServices?: Section11Data;
  sellerLocations?: SellerLocationOption[];
  disabled?: boolean;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [bulkPrices, setBulkPrices] = useState<Record<string, string>>({});
  const [expandedLocOverrides, setExpandedLocOverrides] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasClinicVisit = serviceSelections.some((s) => s.serviceType === "clinic_visit" && s.selected);

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
    if (isNaN(num) || num < 0) return;
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

  function getCategoryProgress(serviceType: string): { priced: number; total: number } {
    const category = subServiceCategories.find((c) => c.serviceType === serviceType);
    if (!category) return { priced: 0, total: 0 };
    const priced = category.items.filter((item) =>
      getSubServicePrice(serviceType, item.subType) != null
    ).length;
    return { priced, total: category.items.length };
  }

  function getOverallProgress(): { priced: number; total: number } {
    let priced = 0;
    let total = 0;
    if (hasClinicVisit) { total++; if (getVisitPrice("clinic_visit") != null) priced++; }
    for (const cat of subServiceCategories) {
      const progress = getCategoryProgress(cat.serviceType);
      priced += progress.priced;
      total += progress.total;
    }
    return { priced, total };
  }

  const overall = getOverallProgress();

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete(results) {
        if (results.data.length === 0) { toast.error("CSV has no data rows"); return; }
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
              const existing = existingVisitPrices.find((v) => v.serviceType === serviceType);
              if (existing) { existing.price = price; } else { existingVisitPrices.push({ serviceType, price }); }
              importCount++;
            } else {
              const existing = existingPrices.find((s) => s.serviceType === serviceType && s.subType === subType);
              if (existing) { existing.unitPrice = price; } else { existingPrices.push({ serviceType, subType, unitPrice: price }); }
              importCount++;
            }
          }
          return { ...prev, visitPrices: existingVisitPrices, subServicePrices: existingPrices };
        });
        toast.success(`Imported ${importCount} price${importCount !== 1 ? "s" : ""} from CSV`);
      },
      error() { toast.error("Failed to parse CSV file"); },
    });
    e.target.value = "";
  }

  function downloadTemplate() {
    const rows: string[][] = [["service_type", "sub_type", "unit_price"]];
    if (hasClinicVisit) {
      const price = getVisitPrice("clinic_visit");
      rows.push(["clinic_visit", "", price != null ? String(price) : ""]);
    }
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
    a.download = `${data.name || "price-list"}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleCategory(serviceType: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(serviceType)) next.delete(serviceType); else next.add(serviceType);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress + CSV */}
      <Card>
        <div className="flex items-center justify-between">
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
            <button type="button" onClick={downloadTemplate} className="text-xs text-brand-teal hover:underline">
              Download CSV
            </button>
            <Button variant="secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
              Upload CSV
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </div>
        </div>
      </Card>

      {/* Visit Pricing */}
      {hasClinicVisit && (
        <Card>
          <h3 className="text-base font-heading font-semibold mb-4">Visit Pricing</h3>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clinicVisitPrice" className="text-sm font-medium text-muted">Clinic Visit — Price per Visit</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
              <input
                id="clinicVisitPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 125.00"
                className="w-full bg-transparent border-[1.5px] border-border rounded-[var(--radius-input)] pl-7 pr-4 py-3.5 text-foreground text-base placeholder:text-gray-medium/50 focus:border-focus focus:ring-0 transition-colors duration-150"
                value={getVisitPrice("clinic_visit") != null ? String(getVisitPrice("clinic_visit")) : ""}
                onChange={(e) => updateVisitPrice("clinic_visit", e.target.value)}
                disabled={disabled}
              />
            </div>
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
              <svg className={`w-5 h-5 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
            {isExpanded && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                  <span className="text-xs text-muted">Set all to</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      className="w-full bg-transparent border border-border rounded pl-5 pr-1 py-1.5 text-xs focus:border-focus focus:ring-0"
                      value={bulkPrices[cat.serviceType] ?? ""}
                      onChange={(e) => setBulkPrices((prev) => ({ ...prev, [cat.serviceType]: e.target.value }))}
                      disabled={disabled}
                    />
                  </div>
                  <Button variant="secondary" type="button" onClick={() => applyBulkPrice(cat.serviceType)} disabled={disabled || !bulkPrices[cat.serviceType]} className="!text-xs !py-1 !px-3">
                    Apply
                  </Button>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item) => {
                    const price = getSubServicePrice(cat.serviceType, item.subType);
                    return (
                      <div key={item.subType} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-foreground truncate">{item.label}</span>
                        <div className="relative flex-shrink-0 w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                          <input
                            type="number" min="0" step="0.01" placeholder="0.00"
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

      {/* Bundle Pricing Rules */}
      <BundleRulesEditor
        bundleRules={data.bundleRules ?? []}
        onChange={(rules) => setData((prev) => ({ ...prev, bundleRules: rules }))}
        serviceSelections={serviceSelections}
        disabled={disabled}
      />

      {/* Location-Specific Pricing Overrides */}
      {sellerLocations && sellerLocations.length > 0 && (
        <Card>
          <button
            type="button"
            className="w-full text-left flex items-center justify-between"
            onClick={() => setExpandedLocOverrides((prev) => {
              const next = new Set(prev);
              if (next.has("__section__")) next.delete("__section__"); else next.add("__section__");
              return next;
            })}
          >
            <div className="flex items-center gap-3">
              <h3 className="text-base font-heading font-semibold">Location-Specific Pricing</h3>
              {(data.locationOverrides ?? []).length > 0 && (
                <span className="text-xs font-medium text-brand-teal">
                  {(data.locationOverrides ?? []).length} location{(data.locationOverrides ?? []).length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <svg className={`w-5 h-5 text-muted transition-transform ${expandedLocOverrides.has("__section__") ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
          {expandedLocOverrides.has("__section__") && (
            <div className="mt-4">
              <p className="text-xs text-muted mb-4">
                Override prices for specific locations. Blank fields use the org-wide default above.
              </p>

              {/* Existing overrides */}
              {(data.locationOverrides ?? []).map((locOverride) => {
                const isExpanded = expandedLocOverrides.has(locOverride.sellerLocationId);
                const loc = sellerLocations.find((l) => l.id === locOverride.sellerLocationId);
                const locName = locOverride.locationName || loc?.locationName || "Unknown";
                const overrideCount = (locOverride.visitPrices ?? []).filter((v) => v.price != null).length
                  + (locOverride.subServicePrices ?? []).filter((s) => s.unitPrice != null).length;

                return (
                  <div key={locOverride.sellerLocationId} className="border border-border rounded-lg mb-3">
                    <button
                      type="button"
                      className="w-full text-left flex items-center justify-between p-3"
                      onClick={() => setExpandedLocOverrides((prev) => {
                        const next = new Set(prev);
                        if (next.has(locOverride.sellerLocationId)) next.delete(locOverride.sellerLocationId);
                        else next.add(locOverride.sellerLocationId);
                        return next;
                      })}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{locName}</span>
                        {overrideCount > 0 && (
                          <span className="text-xs text-muted">{overrideCount} priced</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (disabled) return;
                            setData((prev) => ({
                              ...prev,
                              locationOverrides: (prev.locationOverrides ?? []).filter(
                                (lo) => lo.sellerLocationId !== locOverride.sellerLocationId
                              ),
                            }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              if (disabled) return;
                              setData((prev) => ({
                                ...prev,
                                locationOverrides: (prev.locationOverrides ?? []).filter(
                                  (lo) => lo.sellerLocationId !== locOverride.sellerLocationId
                                ),
                              }));
                            }
                          }}
                          className={`text-xs text-muted hover:text-error cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}
                        >
                          Remove
                        </span>
                        <svg className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {/* Location visit price override */}
                        {hasClinicVisit && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="flex-1 text-sm text-foreground">Clinic Visit</span>
                            <div className="relative flex-shrink-0 w-28">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                              <input
                                type="number" min="0" step="0.01"
                                placeholder={getVisitPrice("clinic_visit") != null ? String(getVisitPrice("clinic_visit")) : "org default"}
                                className="w-full bg-transparent border border-border rounded-[var(--radius-input)] pl-6 pr-2 py-2 text-sm text-right focus:border-focus focus:ring-0 transition-colors duration-150"
                                value={(() => {
                                  const vp = (locOverride.visitPrices ?? []).find((v) => v.serviceType === "clinic_visit");
                                  return vp?.price != null ? String(vp.price) : "";
                                })()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const num = val === "" ? null : parseFloat(val);
                                  const price = num != null && !isNaN(num) ? num : null;
                                  setData((prev) => ({
                                    ...prev,
                                    locationOverrides: (prev.locationOverrides ?? []).map((lo) =>
                                      lo.sellerLocationId === locOverride.sellerLocationId
                                        ? {
                                            ...lo,
                                            visitPrices: [{ serviceType: "clinic_visit", price }],
                                          }
                                        : lo
                                    ),
                                  }));
                                }}
                                disabled={disabled}
                              />
                            </div>
                          </div>
                        )}
                        {/* Location sub-service price overrides */}
                        {subServiceCategories.map((cat) => {
                          const catKey = `${locOverride.sellerLocationId}:${cat.serviceType}`;
                          const isCatExpanded = expandedLocOverrides.has(catKey);
                          const pricedCount = cat.items.filter((item) =>
                            (locOverride.subServicePrices ?? []).find(
                              (s) => s.serviceType === cat.serviceType && s.subType === item.subType && s.unitPrice != null
                            )
                          ).length;
                          return (
                            <div key={cat.serviceType}>
                              <button
                                type="button"
                                className="w-full text-left flex items-center justify-between py-2"
                                onClick={() => setExpandedLocOverrides((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(catKey)) next.delete(catKey); else next.add(catKey);
                                  return next;
                                })}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{cat.label}</span>
                                  <span className="text-xs text-muted">{pricedCount} priced</span>
                                </div>
                                <svg className={`w-4 h-4 text-muted transition-transform ${isCatExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                </svg>
                              </button>
                              {isCatExpanded && (
                                <div className="space-y-2 mt-2 ml-1">
                                  {cat.items.map((item) => {
                                    const locSp = (locOverride.subServicePrices ?? []).find(
                                      (s) => s.serviceType === cat.serviceType && s.subType === item.subType
                                    );
                                    const orgPrice = getSubServicePrice(cat.serviceType, item.subType);
                                    return (
                                      <div key={item.subType} className="flex items-center gap-3">
                                        <span className="flex-1 text-sm text-foreground truncate">{item.label}</span>
                                        <div className="relative flex-shrink-0 w-28">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                                          <input
                                            type="number" min="0" step="0.01"
                                            placeholder={orgPrice != null ? String(orgPrice) : "org default"}
                                            className="w-full bg-transparent border border-border rounded-[var(--radius-input)] pl-6 pr-2 py-2 text-sm text-right focus:border-focus focus:ring-0 transition-colors duration-150"
                                            value={locSp?.unitPrice != null ? String(locSp.unitPrice) : ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const num = val === "" ? null : parseFloat(val);
                                              const price = num != null && !isNaN(num) ? num : null;
                                              setData((prev) => ({
                                                ...prev,
                                                locationOverrides: (prev.locationOverrides ?? []).map((lo) => {
                                                  if (lo.sellerLocationId !== locOverride.sellerLocationId) return lo;
                                                  const existing = lo.subServicePrices ?? [];
                                                  const found = existing.find(
                                                    (s) => s.serviceType === cat.serviceType && s.subType === item.subType
                                                  );
                                                  const newPrices = found
                                                    ? existing.map((s) =>
                                                        s.serviceType === cat.serviceType && s.subType === item.subType
                                                          ? { ...s, unitPrice: price }
                                                          : s
                                                      )
                                                    : [...existing, { serviceType: cat.serviceType, subType: item.subType, unitPrice: price }];
                                                  return { ...lo, subServicePrices: newPrices };
                                                }),
                                              }));
                                            }}
                                            disabled={disabled}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* Location-specific bundle rules */}
                        <div className="mt-3">
                          <BundleRulesEditor
                            bundleRules={locOverride.bundleRules ?? []}
                            onChange={(rules) => {
                              setData((prev) => ({
                                ...prev,
                                locationOverrides: (prev.locationOverrides ?? []).map((lo) =>
                                  lo.sellerLocationId === locOverride.sellerLocationId
                                    ? { ...lo, bundleRules: rules }
                                    : lo
                                ),
                              }));
                            }}
                            serviceSelections={serviceSelections}
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add location override dropdown */}
              {(() => {
                const overriddenIds = new Set((data.locationOverrides ?? []).map((lo) => lo.sellerLocationId));
                const available = sellerLocations.filter((l) => !overriddenIds.has(l.id));
                if (available.length === 0) return null;
                return (
                  <select
                    value=""
                    onChange={(e) => {
                      const locId = e.target.value;
                      if (!locId) return;
                      const loc = sellerLocations.find((l) => l.id === locId);
                      setData((prev) => ({
                        ...prev,
                        locationOverrides: [
                          ...(prev.locationOverrides ?? []),
                          {
                            sellerLocationId: locId,
                            locationName: loc?.locationName ?? "",
                            visitPrices: [],
                            subServicePrices: [],
                            bundleRules: [],
                          },
                        ],
                      }));
                      setExpandedLocOverrides((prev) => new Set([...prev, locId]));
                    }}
                    className="text-sm border border-border rounded px-3 py-2 bg-white focus:border-focus focus:ring-0 text-muted"
                    disabled={disabled}
                  >
                    <option value="">+ Add location override...</option>
                    {available.map((l) => (
                      <option key={l.id} value={l.id}>{l.locationName || "Unnamed"}</option>
                    ))}
                  </select>
                );
              })()}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Main Component: Price List Manager ──────────────────────────────

export function SellerPricingForm({ serviceSelections, orgSubServices, sellerLocations, onNavigate, onStatusUpdate, disabled }: Props) {
  const updateSellerCache = useSellerCacheUpdater();

  // Price list state
  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingList, setEditingList] = useState<PriceListData | null>(null);
  const [saving, setSaving] = useState(false);
  const [buyerOrgs, setBuyerOrgs] = useState<BuyerOrgOption[]>([]);

  // Load price lists on mount
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const lists = await listPriceLists();
      setPriceLists(lists);
    } catch (err) {
      console.error("Failed to load price lists:", err);
    } finally {
      setLoading(false);
    }
  }

  // Price lists save via their own "Save Price List" button; useSaveOnNext is a no-op passthrough
  const noOpSave = useCallback(async () => ({}), []);
  const { save } = useSaveOnNext({ data: {}, onSave: noOpSave });
  // Track dirty state based on whether the user has an unsaved editor open
  useReportDirty("S-7", editingList !== null);

  // ─── Price List CRUD handlers ───────────────────────────────────

  async function handleEditList(listId: string) {
    try {
      const detail = await loadPriceList(listId);
      const orgs = await loadBuyerOrgs();
      setBuyerOrgs(orgs);
      setEditingList({
        id: detail.id,
        name: detail.name,
        isPublic: detail.isPublic,
        rules: detail.rules.map((r) => ({
          buyerId: r.buyerId,
          buyerName: r.buyerName,
          programId: r.programId,
          programName: r.programName,
        })),
        visitPrices: detail.visitPrices,
        subServicePrices: detail.subServicePrices,
        bundleRules: detail.bundleRules.map((b) => ({
          ...b,
          targets: b.targets.map((t) => ({ serviceType: t.serviceType, subType: t.subType })),
        })),
        locationOverrides: detail.locationOverrides.map((lo) => ({
          ...lo,
          bundleRules: lo.bundleRules.map((b) => ({
            ...b,
            targets: b.targets.map((t) => ({ serviceType: t.serviceType, subType: t.subType })),
          })),
        })),
      });
    } catch {
      toast.error("Failed to load price list");
    }
  }

  async function handleNewList() {
    const orgs = await loadBuyerOrgs();
    setBuyerOrgs(orgs);
    setEditingList({
      name: "",
      isPublic: true,
      rules: [],
      visitPrices: [],
      subServicePrices: [],
      bundleRules: [],
      locationOverrides: [],
    });
  }

  async function handleDuplicateList(sourceId: string, sourceName: string) {
    try {
      const { statuses } = await duplicatePriceList(sourceId, `${sourceName} (Copy)`);
      onStatusUpdate?.(statuses);
      toast.success("Price list duplicated");
      await loadData();
    } catch {
      toast.error("Failed to duplicate price list");
    }
  }

  async function handleDeleteList(listId: string) {
    if (!confirm("Delete this price list?")) return;
    try {
      const statuses = await deletePriceList(listId);
      onStatusUpdate?.(statuses);
      toast.success("Price list deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete price list");
    }
  }

  async function handleSaveList() {
    if (!editingList) return;
    setSaving(true);
    try {
      const statuses = await savePriceList(editingList);
      onStatusUpdate?.(statuses);
      toast.success("Price list saved");
      setEditingList(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save price list");
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    if (!editingList) return;
    setEditingList({
      ...editingList,
      rules: [...(editingList.rules ?? []), { buyerId: "", programId: null }],
    });
  }

  function updateRule(index: number, field: string, value: string | null) {
    if (!editingList) return;
    const rules = [...(editingList.rules ?? [])];
    rules[index] = { ...rules[index], [field]: value };
    // If buyerId changed, also update the buyerName
    if (field === "buyerId") {
      const org = buyerOrgs.find((o) => o.id === value);
      rules[index].buyerName = org?.name ?? "";
      rules[index].programId = null;
      rules[index].programName = null;
    }
    if (field === "programId") {
      const org = buyerOrgs.find((o) => o.id === rules[index].buyerId);
      const prog = org?.programs.find((p) => p.id === value);
      rules[index].programName = prog?.name ?? null;
    }
    setEditingList({ ...editingList, rules });
  }

  function removeRule(index: number) {
    if (!editingList) return;
    const rules = [...(editingList.rules ?? [])];
    rules.splice(index, 1);
    setEditingList({ ...editingList, rules });
  }

  // ─── Render: Editor View ────────────────────────────────────────

  if (editingList) {
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => setEditingList(null)}
          className="text-sm text-brand-teal hover:underline flex items-center gap-1 self-start"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to Price Lists
        </button>

        {/* Name + Visibility */}
        <Card>
          <h3 className="text-base font-heading font-semibold mb-4">Price List Details</h3>
          <div className="flex flex-col gap-4">
            <Input
              label="Name"
              name="priceListName"
              required
              value={editingList.name}
              onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
              placeholder="e.g. Standard, Next Level Special"
              disabled={disabled}
            />

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Visibility</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={editingList.isPublic}
                    onChange={() => setEditingList({ ...editingList, isPublic: true, rules: [] })}
                    className="text-brand-teal focus:ring-brand-teal/30"
                    disabled={disabled}
                  />
                  <span className="text-sm">Public — available to all buyers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!editingList.isPublic}
                    onChange={() => setEditingList({ ...editingList, isPublic: false })}
                    className="text-brand-teal focus:ring-brand-teal/30"
                    disabled={disabled}
                  />
                  <span className="text-sm">Restricted — only visible to specific buyers/plans</span>
                </label>
              </div>
            </div>

            {!editingList.isPublic && (
              <div className="mt-2 border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-muted mb-2">Buyer Rules</p>
                {(editingList.rules ?? []).map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <select
                      value={rule.buyerId}
                      onChange={(e) => updateRule(idx, "buyerId", e.target.value)}
                      className="flex-1 text-sm border border-border rounded px-2 py-1.5 bg-white focus:border-focus focus:ring-0"
                      disabled={disabled}
                    >
                      <option value="">Select buyer...</option>
                      {buyerOrgs.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                    <select
                      value={rule.programId ?? ""}
                      onChange={(e) => updateRule(idx, "programId", e.target.value || null)}
                      className="flex-1 text-sm border border-border rounded px-2 py-1.5 bg-white focus:border-focus focus:ring-0"
                      disabled={disabled || !rule.buyerId}
                    >
                      <option value="">All Plans</option>
                      {buyerOrgs.find((o) => o.id === rule.buyerId)?.programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeRule(idx)} className="text-muted hover:text-error text-lg leading-none px-1" disabled={disabled}>
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRule}
                  className="text-xs text-brand-teal hover:underline"
                  disabled={disabled}
                >
                  + Add buyer rule
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Pricing Editor */}
        <PriceListEditor
          data={editingList}
          setData={(fn) => setEditingList((prev) => prev ? fn(prev) : prev)}
          serviceSelections={serviceSelections}
          orgSubServices={orgSubServices}
          sellerLocations={sellerLocations}
          disabled={disabled}
        />

        {/* Save / Cancel */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditingList(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="cta" onClick={handleSaveList} loading={saving} disabled={!editingList.name.trim() || disabled}>
            Save Price List
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: List View (or legacy if no price lists) ─────────────

  const hasVisitServices = serviceSelections.some((s) => s.serviceType === "clinic_visit" && s.selected);
  const hasSubServices = orgSubServices?.categories && Object.values(orgSubServices.categories).some(
    (items) => items.some((i) => i.selected)
  );

  if (!hasVisitServices && !hasSubServices) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <p className="text-sm text-muted">
            No pricing-eligible services selected. Go back to Services Offered and select at least one service.
          </p>
        </Card>
        <SellerSectionNavButtons currentSection="S-7" onNavigate={onNavigate} onSave={save} isDirty={editingList !== null} disabled={disabled} />
      </div>
    );
  }

  // Show loading state while checking for price lists
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted">Loading price lists...</p>
          </div>
        </Card>
        <SellerSectionNavButtons currentSection="S-7" onNavigate={onNavigate} onSave={save} isDirty={editingList !== null} disabled={disabled} />
      </div>
    );
  }

  // Price list manager — always shown (empty state when no lists exist)
  return (
    <div className="flex flex-col gap-6">
      <Card>
        {priceLists.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-heading font-semibold">Your Price Lists</h3>
              <Button variant="secondary" type="button" onClick={handleNewList} disabled={disabled}>
                + New List
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {priceLists.map((pl) => (
                <div key={pl.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{pl.name}</p>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {pl.isPublic ? "Public" : pl.rules.length > 0 ? pl.rules.map((r) => r.programName ? `${r.buyerName} / ${r.programName}` : r.buyerName).join(", ") : "Restricted"}
                      {" "}· {pl.pricedCount} of {pl.totalCount} priced
                      {pl.bundleRuleCount > 0 && ` · ${pl.bundleRuleCount} bundle${pl.bundleRuleCount !== 1 ? "s" : ""}`}
                      {pl.overrideLocationCount > 0 && ` · ${pl.overrideLocationCount} location override${pl.overrideLocationCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" type="button" onClick={() => handleEditList(pl.id)} disabled={disabled} className="!text-xs">
                      Edit
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateList(pl.id, pl.name)}
                      className="text-xs text-muted hover:text-foreground"
                      title="Duplicate"
                      aria-label={`Duplicate ${pl.name}`}
                      disabled={disabled}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                        <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.44A1.5 1.5 0 008.378 6H4.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteList(pl.id)}
                      className="text-xs text-muted hover:text-error disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted"
                      title={priceLists.length <= 1 ? "Cannot delete your only price list" : "Delete"}
                      aria-label={`Delete ${pl.name}`}
                      disabled={disabled || priceLists.length <= 1}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <p className="text-sm text-muted text-center">
              You haven&apos;t created any price lists yet. Create one to set your pricing for buyers.
            </p>
            <Button variant="cta" type="button" onClick={handleNewList} disabled={disabled}>
              Create Your First Price List
            </Button>
          </div>
        )}
      </Card>

      <SellerSectionNavButtons currentSection="S-7" onNavigate={onNavigate} onSave={save} isDirty={editingList !== null} disabled={disabled} />
    </div>
  );
}
