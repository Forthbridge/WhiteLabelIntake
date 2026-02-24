"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { loadSellerPricing, addLocationTerm } from "@/lib/actions/network";
import type { SellerPricingData } from "@/lib/actions/network";
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

interface Props {
  contractId: string;
  sellerLocationId: string;
  locationName?: string;
  onClose: () => void;
  onAccepted: () => void;
}

export function PricingAcceptanceModal({ contractId, sellerLocationId, locationName, onClose, onAccepted }: Props) {
  const [pricing, setPricing] = useState<SellerPricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSellerPricing(contractId)
      .then(setPricing)
      .catch(() => toast.error("Failed to load pricing"))
      .finally(() => setLoading(false));
  }, [contractId]);

  function toggleCategory(serviceType: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(serviceType)) next.delete(serviceType);
      else next.add(serviceType);
      return next;
    });
  }

  // Group sub-service prices by serviceType
  const subServicesByCategory = new Map<string, typeof pricing extends null ? never : NonNullable<typeof pricing>["subServicePrices"]>();
  if (pricing?.subServicePrices) {
    for (const sp of pricing.subServicePrices) {
      if (!subServicesByCategory.has(sp.serviceType)) {
        subServicesByCategory.set(sp.serviceType, []);
      }
      subServicesByCategory.get(sp.serviceType)!.push(sp);
    }
  }

  async function handleAccept() {
    if (!pricing) return;
    setSubmitting(true);
    try {
      const pricingSnapshot = {
        services: pricing.services,
        subServicePrices: pricing.subServicePrices.map((sp) => ({
          serviceType: sp.serviceType,
          subType: sp.subType,
          label: getSubServiceLabel(sp.serviceType, sp.subType),
          unitPrice: sp.unitPrice,
        })),
        snapshotAt: new Date().toISOString(),
      };
      await addLocationTerm(contractId, sellerLocationId, pricingSnapshot);
      onAccepted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept pricing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex justify-between items-center flex-shrink-0">
          <h3 className="text-base font-heading font-semibold">
            Add to Network: &ldquo;{locationName || pricing?.sellerName || "Loading..."}&rdquo;
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">
            &times;
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-muted text-center py-4">Loading pricing...</p>
          ) : pricing ? (
            <>
              <p className="text-sm text-muted">
                {pricing.locationCount} location{pricing.locationCount !== 1 ? "s" : ""} available
              </p>

              {/* Per-Visit Pricing */}
              {pricing.services.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Per-Visit Pricing</p>
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    {pricing.services.map((svc, i) => (
                      <div
                        key={svc.serviceType}
                        className={`flex justify-between items-center px-3 py-2 text-sm ${
                          i > 0 ? "border-t border-border/30" : ""
                        }`}
                      >
                        <span className="text-foreground">{getServiceLabel(svc.serviceType)}</span>
                        <span className="font-medium text-foreground">
                          {svc.price != null ? `$${svc.price.toFixed(2)} / visit` : "Not set"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price List (sub-services) */}
              {subServicesByCategory.size > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Price List</p>
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    {Array.from(subServicesByCategory.entries()).map(([serviceType, items], catIdx) => {
                      const isExpanded = expandedCategories.has(serviceType);
                      const pricedCount = items.filter((i) => i.unitPrice != null).length;
                      return (
                        <div key={serviceType} className={catIdx > 0 ? "border-t border-border/30" : ""}>
                          <button
                            type="button"
                            onClick={() => toggleCategory(serviceType)}
                            className="w-full flex justify-between items-center px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-foreground font-medium">{getServiceLabel(serviceType)}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted">{pricedCount} of {items.length} priced</span>
                              <svg
                                className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="bg-gray-50/50">
                              {items.map((item, i) => (
                                <div
                                  key={`${item.serviceType}:${item.subType}`}
                                  className={`flex justify-between items-center px-4 py-1.5 text-xs ${
                                    i > 0 ? "border-t border-border/20" : "border-t border-border/30"
                                  }`}
                                >
                                  <span className="text-foreground">{getSubServiceLabel(item.serviceType, item.subType)}</span>
                                  <span className="font-medium text-foreground">
                                    {item.unitPrice != null ? `$${item.unitPrice.toFixed(2)}` : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pricing.services.length === 0 && subServicesByCategory.size === 0 && (
                <p className="text-sm text-muted italic">Pricing not yet configured by seller.</p>
              )}

              {/* Acceptance checkbox */}
              <Checkbox
                name="accept-pricing"
                checked={accepted}
                onChange={() => setAccepted((v) => !v)}
                label="I accept the pricing above and agree to include this seller in my network."
              />
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
          <Button
            variant="cta"
            onClick={handleAccept}
            loading={submitting}
            disabled={!accepted || loading || !pricing}
          >
            Accept &amp; Add Location
          </Button>
        </div>
      </div>
    </div>
  );
}
