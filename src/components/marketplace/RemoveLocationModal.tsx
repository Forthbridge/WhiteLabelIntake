"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { removeLocationTerm } from "@/lib/actions/network";

const REASON_OPTIONS = [
  { value: "", label: "Select a reason..." },
  { value: "PRICING_CHANGE", label: "Pricing change" },
  { value: "SERVICE_QUALITY", label: "Service quality" },
  { value: "NO_LONGER_NEEDED", label: "No longer needed" },
  { value: "RELOCATED", label: "Relocated" },
  { value: "CONTRACT_EXPIRED", label: "Contract expired" },
  { value: "OTHER", label: "Other" },
];

interface Props {
  contractId: string;
  sellerLocationId: string;
  locationName: string;
  onClose: () => void;
  onRemoved: () => void;
}

export function RemoveLocationModal({ contractId, sellerLocationId, locationName, onClose, onRemoved }: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRemove() {
    if (!reason) return;
    setSubmitting(true);
    try {
      await removeLocationTerm(contractId, sellerLocationId, reason, note || undefined);
      onRemoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove location");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
          <h3 className="text-base font-heading font-semibold">Remove Location</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">
            &times;
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm text-muted">
            Remove <strong>{locationName || "this location"}</strong> from your network?
          </p>

          <Select
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            options={REASON_OPTIONS}
          />

          <div>
            <label className="block text-sm font-medium text-brand-black mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal/50"
              placeholder="Additional details..."
            />
          </div>
        </div>

        <div className="p-4 border-t border-border/50 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleRemove}
            loading={submitting}
            disabled={!reason}
            className="bg-error hover:bg-error/90"
          >
            Remove Location
          </Button>
        </div>
      </div>
    </div>
  );
}
