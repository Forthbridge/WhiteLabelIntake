"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { loadLocationPricingReview, loadBulkPricingReview, addLocationTermsBulk, getContractInfo } from "@/lib/actions/network";
import { loadEligiblePriceLists } from "@/lib/actions/price-list";
import type { LocationPricingReview, PricingReviewSubService, BulkPricingReviewData, ContractInfo, AppliedBundleReview } from "@/lib/actions/network";
import type { EligiblePriceList } from "@/lib/actions/price-list";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { getSubServiceLabel } from "@/lib/validations/section11";

function getServiceLabel(serviceType: string): string {
  return (
    SELLER_SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    serviceType
  );
}

function formatPriceRange(items: PricingReviewSubService[]): string {
  const prices = items.map((i) => i.unitPrice).filter((p): p is number => p != null);
  if (prices.length === 0) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)}\u2013$${max.toFixed(2)}`;
}

// ─── Chevron icon ──────────────────────────────────────────────────────
function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`w-4 h-4 text-muted transition-transform ${expanded ? "rotate-180" : ""} ${className ?? ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Shared sub-service category rendering ─────────────────────────────
function SubServiceCategories({
  label,
  colorScheme,
  groups,
  expandedCategories,
  toggleCategory,
  keyPrefix,
  countMode,
  totalsByType,
}: {
  label: string;
  colorScheme: "emerald" | "amber";
  groups: Record<string, PricingReviewSubService[]>;
  expandedCategories: Set<string>;
  toggleCategory: (key: string) => void;
  keyPrefix: string;
  countMode: "covered" | "items";
  totalsByType?: Record<string, number>;
}) {
  if (Object.keys(groups).length === 0) return null;

  const c = colorScheme === "emerald"
    ? { border: "border-emerald-200", bg: "bg-emerald-50/30", hoverBg: "hover:bg-emerald-50", divider: "border-emerald-100", innerDivider: "border-emerald-100/50", innerBg: "bg-emerald-50/50", text: "text-emerald-700", badge: "text-emerald-600", check: "text-emerald-500" }
    : { border: "border-amber-200", bg: "bg-amber-50/30", hoverBg: "hover:bg-amber-50", divider: "border-amber-100", innerDivider: "border-amber-100/50", innerBg: "bg-amber-50/50", text: "text-amber-700", badge: "text-amber-600", check: "" };

  return (
    <div>
      <p className={`text-xs font-semibold ${c.text} uppercase tracking-wide mb-1.5`}>
        {label}
      </p>
      <div className={`border ${c.border} rounded-lg ${c.bg} overflow-hidden`}>
        {Object.entries(groups).map(([serviceType, items], catIdx) => {
          const catKey = `${keyPrefix}:${serviceType}`;
          const isCatExpanded = expandedCategories.has(catKey);
          const priceRange = formatPriceRange(items);
          const countLabel = countMode === "covered" && totalsByType
            ? `${items.length} of ${totalsByType[serviceType] ?? items.length} covered`
            : `${items.length} item${items.length !== 1 ? "s" : ""}`;
          return (
            <div key={serviceType} className={catIdx > 0 ? `border-t ${c.divider}` : ""}>
              <button
                type="button"
                onClick={() => toggleCategory(catKey)}
                className={`w-full flex justify-between items-center px-3 py-2 text-sm ${c.hoverBg} transition-colors`}
              >
                <span className="text-foreground font-medium">
                  {getServiceLabel(serviceType)}
                  <span className={`${c.badge} text-xs ml-1.5`}>
                    ({countLabel})
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {!isCatExpanded && priceRange && (
                    <span className="text-xs text-muted">{priceRange}</span>
                  )}
                  <ChevronIcon expanded={isCatExpanded} className="w-3.5 h-3.5" />
                </div>
              </button>
              {isCatExpanded && (
                <div className={c.innerBg}>
                  {items.map((item, i) => (
                    <div
                      key={`${item.serviceType}:${item.subType}`}
                      className={`flex justify-between items-center px-4 py-1.5 text-xs ${
                        i > 0 ? `border-t ${c.innerDivider}` : `border-t ${c.divider}`
                      }`}
                    >
                      <span className="text-foreground">
                        {getSubServiceLabel(item.serviceType, item.subType)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">
                          {item.unitPrice != null ? `$${item.unitPrice.toFixed(2)}` : "\u2014"}
                        </span>
                        {colorScheme === "emerald" && (
                          <svg className={`w-3.5 h-3.5 ${c.check}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Visit Fees display ────────────────────────────────────────────────
function VisitFeesSection({ visitFees }: { visitFees: { serviceType: string; label: string; price: number | null }[] }) {
  if (visitFees.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">
        Visit Fees (plan pays)
      </p>
      <div className="border border-emerald-200 rounded-lg bg-emerald-50/30 overflow-hidden">
        {visitFees.map((vf, i) => (
          <div
            key={vf.serviceType}
            className={`flex justify-between items-center px-3 py-1.5 text-sm ${
              i > 0 ? "border-t border-emerald-100" : ""
            }`}
          >
            <span className="text-foreground">{getServiceLabel(vf.serviceType)}</span>
            <span className="font-medium text-foreground">
              {vf.price != null ? `$${vf.price.toFixed(2)}/visit` : "Not set"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bundle Pricing display ─────────────────────────────────────────────
function BundlePricingSection({
  bundles,
  visitFeeAbsorbed,
  expandedCategories,
  toggleCategory,
  keyPrefix,
}: {
  bundles: AppliedBundleReview[];
  visitFeeAbsorbed: boolean;
  expandedCategories: Set<string>;
  toggleCategory: (key: string) => void;
  keyPrefix: string;
}) {
  if (bundles.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
        Bundle Pricing
      </p>
      <div className="border border-blue-200 rounded-lg bg-blue-50/30 overflow-hidden">
        {bundles.map((bundle, i) => {
          const bundleKey = `${keyPrefix}:bundle:${i}`;
          const isExpanded = expandedCategories.has(bundleKey);
          return (
            <div
              key={i}
              className={i > 0 ? "border-t border-blue-100" : ""}
            >
              <button
                type="button"
                onClick={() => toggleCategory(bundleKey)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{bundle.name}</span>
                    <span className="text-xs text-blue-600 flex-shrink-0">flat rate</span>
                    {bundle.includesVisitFee && (
                      <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 flex-shrink-0">
                        incl. visit fee
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-sm text-foreground flex-shrink-0 ml-2">
                    ${bundle.price.toFixed(2)}
                  </span>
                </div>
                {bundle.coveredItems.length > 0 && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-blue-600">
                      {bundle.coveredItems.length} item{bundle.coveredItems.length !== 1 ? "s" : ""} included
                    </span>
                    <span className="text-xs text-muted">
                      {isExpanded ? "Hide items" : "Show items"}
                    </span>
                  </div>
                )}
              </button>
              {isExpanded && bundle.coveredItems.length > 0 && (
                <div className="px-3 pb-2 pt-0.5">
                  <div className="flex flex-wrap gap-1">
                    {bundle.coveredItems.map((item, j) => (
                      <span key={j} className="text-xs text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
                        {item.subType
                          ? getSubServiceLabel(item.serviceType, item.subType)
                          : getServiceLabel(item.serviceType)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {visitFeeAbsorbed && (
        <p className="text-xs text-blue-600 mt-1 italic">
          Visit fee is included in bundle pricing above.
        </p>
      )}
    </div>
  );
}

// ─── Single-location pricing detail ─────────────────────────────────────
function LocationPricingDetail({
  loc,
  expandedCategories,
  toggleCategory,
}: {
  loc: LocationPricingReview;
  expandedCategories: Set<string>;
  toggleCategory: (key: string) => void;
}) {
  // Build totals by type for "X of Y covered" display
  const totalsByType: Record<string, number> = {};
  for (const [st, items] of Object.entries(loc.planPays)) {
    totalsByType[st] = (totalsByType[st] ?? 0) + items.length;
  }
  for (const [st, items] of Object.entries(loc.patientPays)) {
    totalsByType[st] = (totalsByType[st] ?? 0) + items.length;
  }

  return (
    <div className="flex flex-col gap-3">
      <VisitFeesSection visitFees={loc.visitFeeAbsorbed ? [] : loc.visitFees} />
      <BundlePricingSection
        bundles={loc.bundlePricing}
        visitFeeAbsorbed={loc.visitFeeAbsorbed}
        expandedCategories={expandedCategories}
        toggleCategory={toggleCategory}
        keyPrefix={loc.sellerLocationId}
      />
      <SubServiceCategories
        label="Plan Pays"
        colorScheme="emerald"
        groups={loc.planPays}
        expandedCategories={expandedCategories}
        toggleCategory={toggleCategory}
        keyPrefix={`${loc.sellerLocationId}:plan`}
        countMode="covered"
        totalsByType={totalsByType}
      />
      <SubServiceCategories
        label="Patient Pays"
        colorScheme="amber"
        groups={loc.patientPays}
        expandedCategories={expandedCategories}
        toggleCategory={toggleCategory}
        keyPrefix={`${loc.sellerLocationId}:patient`}
        countMode="items"
      />
      {loc.visitFees.length === 0 && loc.bundlePricing.length === 0 && Object.keys(loc.planPays).length === 0 && Object.keys(loc.patientPays).length === 0 && (
        <p className="text-sm text-muted italic mt-2">Pricing not yet configured by seller.</p>
      )}
    </div>
  );
}

// ─── Price List Selection Step ──────────────────────────────────────────
function PriceListSelectionStep({
  priceLists,
  selectedId,
  onSelect,
}: {
  priceLists: EligiblePriceList[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground mb-1">Select Price List</p>
        <p className="text-xs text-muted">
          Choose the pricing schedule for this seller. This applies to all locations from this seller in this plan&apos;s network.
        </p>
      </div>
      {priceLists.map((pl) => (
        <label
          key={pl.id}
          className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
            selectedId === pl.id
              ? "border-brand-teal bg-brand-teal/5"
              : "border-border hover:border-brand-teal/40"
          }`}
        >
          <input
            type="radio"
            name="priceList"
            checked={selectedId === pl.id}
            onChange={() => onSelect(pl.id)}
            className="mt-0.5 text-brand-teal focus:ring-brand-teal/30"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{pl.name}</p>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {pl.clinicVisitPrice != null && `Clinic Visit: $${pl.clinicVisitPrice.toFixed(2)}`}
              {pl.clinicVisitPrice != null && pl.pricedSubServiceCount > 0 && " · "}
              {pl.pricedSubServiceCount > 0 && `${pl.pricedSubServiceCount} sub-services priced`}
              {pl.clinicVisitPrice == null && pl.pricedSubServiceCount === 0 && "No pricing configured"}
            </p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────
interface Props {
  contractId: string;
  sellerLocationIds: string[]; // 1 for single, N for bulk
  sellerName: string;
  sellerId: string;
  programId: string | null;
  onClose: () => void;
  onAccepted: () => void;
}

export function PricingReviewModal({ contractId, sellerLocationIds, sellerName, sellerId, programId, onClose, onAccepted }: Props) {
  // Price list selection state
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [eligiblePriceLists, setEligiblePriceLists] = useState<EligiblePriceList[]>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(null);
  const [showPriceListSelection, setShowPriceListSelection] = useState(false);
  const [priceListLoading, setPriceListLoading] = useState(true);

  // Single-location state
  const [locations, setLocations] = useState<LocationPricingReview[]>([]);
  // Bulk state
  const [bulkData, setBulkData] = useState<BulkPricingReviewData | null>(null);

  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);

  const count = sellerLocationIds.length;
  const isBulk = count > 1;

  // Stabilize the array prop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLocationIds = useMemo(() => sellerLocationIds, [sellerLocationIds.join(",")]);

  // Step 1: Check if contract already has a price list; if not, load eligible ones
  useEffect(() => {
    let cancelled = false;
    setPriceListLoading(true);

    getContractInfo(contractId)
      .then(async (info) => {
        if (cancelled) return;
        setContractInfo(info);

        if (info.priceListId) {
          // Contract already has a price list — skip selection
          setSelectedPriceListId(info.priceListId);
          setShowPriceListSelection(false);
          setPriceListLoading(false);
        } else {
          // Load eligible price lists
          try {
            const lists = await loadEligiblePriceLists(sellerId, programId);
            if (cancelled) return;
            setEligiblePriceLists(lists);

            if (lists.length === 0) {
              // No price lists — proceed without (legacy org pricing)
              setShowPriceListSelection(false);
            } else if (lists.length === 1) {
              // Auto-select the only list
              setSelectedPriceListId(lists[0].id);
              setShowPriceListSelection(false);
            } else {
              // Multiple lists — show selection step
              // Pre-select first list
              setSelectedPriceListId(lists[0].id);
              setShowPriceListSelection(true);
            }
          } catch {
            // If loading price lists fails, proceed without (legacy)
            setShowPriceListSelection(false);
          }
          if (!cancelled) setPriceListLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPriceListLoading(false);
          toast.error("Failed to load contract info");
        }
      });

    return () => { cancelled = true; };
  }, [contractId, sellerId, programId]);

  // Step 2: Load pricing review data once price list is resolved (or skipped)
  useEffect(() => {
    if (priceListLoading || showPriceListSelection) return;

    let cancelled = false;
    setLoading(true);

    // Pass selectedPriceListId as previewPriceListId so pricing is resolved from selected list
    const previewId = selectedPriceListId ?? undefined;

    if (isBulk) {
      loadBulkPricingReview(contractId, stableLocationIds, undefined, previewId)
        .then((data) => {
          if (cancelled) return;
          setBulkData(data);
          if (data.overrideLocations.length > 0) {
            setExpandedLocations(new Set([data.overrideLocations[0].sellerLocationId]));
          }
        })
        .catch(() => {
          if (!cancelled) toast.error("Failed to load pricing");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      loadLocationPricingReview(contractId, stableLocationIds, undefined, previewId)
        .then((data) => {
          if (cancelled) return;
          setLocations(data.locations);
          if (data.locations.length > 0) {
            setExpandedLocations(new Set([data.locations[0].sellerLocationId]));
          }
        })
        .catch(() => {
          if (!cancelled) toast.error("Failed to load pricing");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [contractId, stableLocationIds, isBulk, priceListLoading, showPriceListSelection, selectedPriceListId]);

  function toggleLocation(id: string) {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(key: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function locationServiceSummary(loc: LocationPricingReview): string {
    const serviceTypes = new Set<string>();
    for (const vf of loc.visitFees) serviceTypes.add(vf.serviceType);
    for (const key of Object.keys(loc.planPays)) serviceTypes.add(key);
    for (const key of Object.keys(loc.patientPays)) serviceTypes.add(key);
    return `${serviceTypes.size} service${serviceTypes.size !== 1 ? "s" : ""}`;
  }

  function handlePriceListConfirmed() {
    // User confirmed their price list selection — proceed to pricing review
    setShowPriceListSelection(false);
  }

  function handleBackToSelection() {
    setShowPriceListSelection(true);
    setAccepted(false);
    // Reset pricing data so it reloads for newly selected list
    setLocations([]);
    setBulkData(null);
  }

  async function handleAccept() {
    setSubmitting(true);
    try {
      let pricingSnapshot: unknown;

      if (isBulk && bulkData) {
        pricingSnapshot = {
          orgPricing: {
            visitFees: bulkData.visitFees,
            planPays: bulkData.planPays,
            patientPays: bulkData.patientPays,
            bundlePricing: bulkData.bundlePricing,
            visitFeeAbsorbed: bulkData.visitFeeAbsorbed,
          },
          defaultLocations: bulkData.defaultLocations.map((loc) => ({
            sellerLocationId: loc.sellerLocationId,
            locationName: loc.locationName,
            usesOrgDefaults: true,
          })),
          overrideLocations: bulkData.overrideLocations.map((loc) => ({
            sellerLocationId: loc.sellerLocationId,
            locationName: loc.locationName,
            visitFees: loc.visitFees,
            planPays: loc.planPays,
            patientPays: loc.patientPays,
            bundlePricing: loc.bundlePricing,
            visitFeeAbsorbed: loc.visitFeeAbsorbed,
          })),
          priceListId: selectedPriceListId ?? undefined,
          snapshotAt: new Date().toISOString(),
        };
      } else {
        pricingSnapshot = {
          locations: locations.map((loc) => ({
            sellerLocationId: loc.sellerLocationId,
            locationName: loc.locationName,
            visitFees: loc.visitFees,
            planPays: loc.planPays,
            patientPays: loc.patientPays,
            bundlePricing: loc.bundlePricing,
            visitFeeAbsorbed: loc.visitFeeAbsorbed,
          })),
          priceListId: selectedPriceListId ?? undefined,
          snapshotAt: new Date().toISOString(),
        };
      }

      await addLocationTermsBulk(
        contractId,
        sellerLocationIds,
        pricingSnapshot,
        undefined,
        selectedPriceListId ?? undefined,
      );
      onAccepted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept pricing");
    } finally {
      setSubmitting(false);
    }
  }

  const hasData = isBulk ? bulkData != null : locations.length > 0;

  // Detect no-pricing state (safety net — card-level guard is primary)
  const hasNoPricing = !isBulk && locations.length > 0 && locations.every(loc =>
    loc.visitFees.length === 0 &&
    loc.bundlePricing.length === 0 &&
    Object.keys(loc.planPays).length === 0 &&
    Object.keys(loc.patientPays).length === 0
  );
  const hasNoPricingBulk = isBulk && bulkData != null &&
    bulkData.visitFees.length === 0 &&
    bulkData.bundlePricing.length === 0 &&
    Object.keys(bulkData.planPays).length === 0 &&
    Object.keys(bulkData.patientPays).length === 0 &&
    bulkData.overrideLocations.every(loc =>
      loc.visitFees.length === 0 &&
      loc.bundlePricing.length === 0 &&
      Object.keys(loc.planPays).length === 0 &&
      Object.keys(loc.patientPays).length === 0
    );
  const noPricing = hasNoPricing || hasNoPricingBulk;

  // Build totals by type for org-level "X of Y covered" in bulk mode
  const bulkTotalsByType: Record<string, number> = {};
  if (bulkData) {
    for (const [st, items] of Object.entries(bulkData.planPays)) {
      bulkTotalsByType[st] = (bulkTotalsByType[st] ?? 0) + items.length;
    }
    for (const [st, items] of Object.entries(bulkData.patientPays)) {
      bulkTotalsByType[st] = (bulkTotalsByType[st] ?? 0) + items.length;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-base font-heading font-semibold">
                {showPriceListSelection ? `Add ${sellerName} to Network` : `Review Pricing: ${sellerName}`}
              </h3>
              <p className="text-sm text-muted mt-0.5">
                {showPriceListSelection
                  ? "Select a pricing schedule for this seller"
                  : isBulk ? `Adding all ${count} locations` : `Adding 1 location`
                }
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">
              &times;
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
          {priceListLoading ? (
            <p className="text-sm text-muted text-center py-4">Loading...</p>
          ) : showPriceListSelection ? (
            /* ─── Price List Selection Step ─────────────────── */
            <PriceListSelectionStep
              priceLists={eligiblePriceLists}
              selectedId={selectedPriceListId}
              onSelect={setSelectedPriceListId}
            />
          ) : loading ? (
            <p className="text-sm text-muted text-center py-4">Loading pricing...</p>
          ) : hasData ? (
            <>
              {isBulk && bulkData ? (
                /* ─── Bulk Mode ─────────────────────────────────── */
                <>
                  {/* Org-level pricing summary */}
                  <div className="flex flex-col gap-3">
                    <VisitFeesSection visitFees={bulkData.visitFeeAbsorbed ? [] : bulkData.visitFees} />
                    <BundlePricingSection
                      bundles={bulkData.bundlePricing}
                      visitFeeAbsorbed={bulkData.visitFeeAbsorbed}
                      expandedCategories={expandedCategories}
                      toggleCategory={toggleCategory}
                      keyPrefix="org"
                    />
                    <SubServiceCategories
                      label="Plan Pays"
                      colorScheme="emerald"
                      groups={bulkData.planPays}
                      expandedCategories={expandedCategories}
                      toggleCategory={toggleCategory}
                      keyPrefix="org:plan"
                      countMode="covered"
                      totalsByType={bulkTotalsByType}
                    />
                    <SubServiceCategories
                      label="Patient Pays"
                      colorScheme="amber"
                      groups={bulkData.patientPays}
                      expandedCategories={expandedCategories}
                      toggleCategory={toggleCategory}
                      keyPrefix="org:patient"
                      countMode="items"
                    />
                    {bulkData.visitFees.length === 0 && bulkData.bundlePricing.length === 0 && Object.keys(bulkData.planPays).length === 0 && Object.keys(bulkData.patientPays).length === 0 && (
                      <p className="text-sm text-muted italic mt-2">Pricing not yet configured by seller.</p>
                    )}
                  </div>

                  {/* Default locations (compact list) */}
                  {bulkData.defaultLocations.length > 0 && (
                    <div className="border border-border/50 rounded-lg overflow-hidden mt-1">
                      <button
                        type="button"
                        onClick={() => setDefaultsExpanded((v) => !v)}
                        className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {bulkData.defaultLocations.length} location{bulkData.defaultLocations.length !== 1 ? "s" : ""} at default pricing
                        </span>
                        <ChevronIcon expanded={defaultsExpanded} />
                      </button>
                      {defaultsExpanded && (
                        <div className="border-t border-border/30 max-h-48 overflow-y-auto">
                          {bulkData.defaultLocations.map((loc, i) => (
                            <div
                              key={loc.sellerLocationId}
                              className={`px-4 py-1.5 text-sm ${i > 0 ? "border-t border-border/20" : ""}`}
                            >
                              <p className="text-foreground text-sm">{loc.locationName || "Unnamed"}</p>
                              <p className="text-xs text-muted truncate">{loc.address}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Override locations (individual accordions) */}
                  {bulkData.overrideLocations.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        {bulkData.overrideLocations.length} location{bulkData.overrideLocations.length !== 1 ? "s" : ""} with custom pricing
                      </p>
                      {bulkData.overrideLocations.map((loc) => {
                        const isExpanded = expandedLocations.has(loc.sellerLocationId);
                        return (
                          <div key={loc.sellerLocationId} className="border border-border/50 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleLocation(loc.sellerLocationId)}
                              className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {loc.locationName || "Unnamed location"}
                                </p>
                                <p className="text-xs text-muted truncate">{loc.address}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {!isExpanded && (
                                  <span className="text-xs text-muted">{locationServiceSummary(loc)}</span>
                                )}
                                <ChevronIcon expanded={isExpanded} />
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-border/30">
                                <LocationPricingDetail
                                  loc={loc}
                                  expandedCategories={expandedCategories}
                                  toggleCategory={toggleCategory}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* ─── Single-Location Mode (unchanged behavior) ─── */
                <>
                  {locations.map((loc) => {
                    const isExpanded = expandedLocations.has(loc.sellerLocationId);
                    const summary = locationServiceSummary(loc);

                    return (
                      <div key={loc.sellerLocationId} className="border border-border/50 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleLocation(loc.sellerLocationId)}
                          className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {loc.locationName || "Unnamed location"}
                            </p>
                            <p className="text-xs text-muted truncate">{loc.address}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {!isExpanded && (
                              <span className="text-xs text-muted">{summary}</span>
                            )}
                            <ChevronIcon expanded={isExpanded} />
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-border/30">
                            <LocationPricingDetail
                              loc={loc}
                              expandedCategories={expandedCategories}
                              toggleCategory={toggleCategory}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Acceptance checkbox or no-pricing notice */}
              {noPricing ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This seller has not configured pricing yet. Contact them or wait for pricing before adding to your network.
                </p>
              ) : (
                <Checkbox
                  name="accept-pricing"
                  checked={accepted}
                  onChange={() => setAccepted((v) => !v)}
                  label={
                    isBulk
                      ? `I accept the pricing and agree to add these ${count} locations to my network.`
                      : "I accept the pricing above and agree to add this location to my network."
                  }
                />
              )}
            </>
          ) : (
            <p className="text-sm text-error text-center py-4">Failed to load pricing.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex justify-end gap-2 flex-shrink-0">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {showPriceListSelection ? (
            <Button
              variant="cta"
              onClick={handlePriceListConfirmed}
              disabled={!selectedPriceListId}
            >
              Review Pricing
            </Button>
          ) : (
            <>
              {/* Back button — only when multiple price lists were available and contract didn't already have one */}
              {eligiblePriceLists.length > 1 && !contractInfo?.priceListId && (
                <Button variant="secondary" onClick={handleBackToSelection}>
                  Back
                </Button>
              )}
              <Button
                variant="cta"
                onClick={handleAccept}
                loading={submitting}
                disabled={!accepted || loading || !hasData || noPricing}
              >
                {isBulk ? `Accept & Add All (${count})` : "Accept & Add Location"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
