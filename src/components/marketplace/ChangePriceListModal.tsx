"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { clearContractPriceList } from "@/lib/actions/network";

interface Props {
  contractId: string;
  sellerName: string;
  locationCount: number;
  locationNames: string[];
  programId?: string;
  onClose: () => void;
  onChanged: () => void;
}

export function ChangePriceListModal({ contractId, sellerName, locationCount, locationNames, programId, onClose, onChanged }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [showLocations, setShowLocations] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await clearContractPriceList(contractId, programId);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change price list");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
          <h3 className="text-base font-heading font-semibold">Change Price List</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">
            &times;
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm text-muted">
            Changing the price list will remove all <strong>{locationCount} location{locationCount !== 1 ? "s" : ""}</strong> from <strong>{sellerName}</strong> from your network. You&apos;ll re-add them with new pricing.
          </p>

          {/* Collapsible location list */}
          {locationNames.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowLocations((v) => !v)}
                className="text-xs text-brand-teal hover:text-brand-teal/80 flex items-center gap-1"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showLocations ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {showLocations ? "Hide" : "Show"} locations
              </button>
              {showLocations && (
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-muted space-y-1 pl-4">
                  {locationNames.map((name, i) => (
                    <li key={i} className="list-disc">{name || "Unnamed"}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/50 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleConfirm}
            loading={submitting}
          >
            Change Price List
          </Button>
        </div>
      </div>
    </div>
  );
}
