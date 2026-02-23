"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { loadSellerPricing, addLocationTerm } from "@/lib/actions/network";
import type { SellerPricingData } from "@/lib/actions/network";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SERVICE_TYPES } from "@/lib/validations/section3";

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
  onClose: () => void;
  onAccepted: () => void;
}

export function PricingAcceptanceModal({ contractId, sellerLocationId, onClose, onAccepted }: Props) {
  const [pricing, setPricing] = useState<SellerPricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSellerPricing(contractId)
      .then(setPricing)
      .catch(() => toast.error("Failed to load pricing"))
      .finally(() => setLoading(false));
  }, [contractId]);

  async function handleAccept() {
    if (!pricing) return;
    setSubmitting(true);
    try {
      const pricingSnapshot = {
        services: pricing.services,
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
          <h3 className="text-base font-heading font-semibold">
            Add to Network: &ldquo;{pricing?.sellerName || "Loading..."}&rdquo;
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted text-center py-4">Loading pricing...</p>
          ) : pricing ? (
            <>
              <p className="text-sm text-muted">
                {pricing.locationCount} location{pricing.locationCount !== 1 ? "s" : ""} available
              </p>

              {/* Pricing table */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Per-Visit Pricing</p>
                {pricing.services.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-muted italic">Pricing not yet configured by seller.</p>
                )}
              </div>

              {/* Acceptance checkbox */}
              <Checkbox
                name="accept-pricing"
                checked={accepted}
                onChange={() => setAccepted((v) => !v)}
                label="I accept the per-visit pricing above and agree to include this seller in my network."
              />
            </>
          ) : (
            <p className="text-sm text-error text-center py-4">Failed to load pricing.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex justify-end gap-2">
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
