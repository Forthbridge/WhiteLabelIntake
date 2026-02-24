"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { SELLER_SECTIONS } from "@/types";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import { ServiceReviewAccordion } from "@/components/ui/ServiceToggles";
import { submitSellerFlow } from "@/lib/actions/seller-submit";
import type { CompletionStatus, SellerSectionId } from "@/types";
import type { SellerFlowData } from "@/components/form/OnboardingClient";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground font-medium">{value || "\u2014"}</span>
    </div>
  );
}

interface Props {
  sellerData: SellerFlowData;
  statuses: Record<SellerSectionId, CompletionStatus>;
  onNavigate?: (sectionId: string) => void;
  onSubmitted?: () => void;
}

export function SellerReviewForm({ sellerData, statuses, onNavigate, onSubmitted }: Props) {
  const sectionsToCheck = SELLER_SECTIONS.filter((s) => s.id !== "S-R");
  const allComplete = sectionsToCheck.every((s) => statuses[s.id] === "complete");
  const isSubmitted = sellerData.flowStatus === "SUBMITTED";

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(isSubmitted);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitSellerFlow();
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="text-center py-12">
        <svg className="h-16 w-16 text-success mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <h2 className="text-2xl font-heading font-semibold text-brand-black mb-2">
          Care Delivery Onboarding Submitted
        </h2>
        <p className="text-muted max-w-md mx-auto">
          Your care delivery information has been submitted. Our team will review it and reach out if anything else is needed.
        </p>
      </Card>
    );
  }

  const selectedServices = sellerData.services.services.filter((s) => s.selected);

  return (
    <div className="flex flex-col gap-6">
      {/* Completion Checklist */}
      <Card>
        <h3 className="text-base font-heading font-semibold mb-3">Completion Checklist</h3>
        <div className="flex flex-col gap-1.5">
          {sectionsToCheck.map((section) => {
            const st = statuses[section.id] || "not_started";
            return (
              <div key={section.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  {st === "complete" ? (
                    <svg className="h-4 w-4 text-success flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
                      <div className="h-2.5 w-2.5 rounded-full border-2 border-border" />
                    </div>
                  )}
                  <span className={`text-sm ${st === "complete" ? "text-foreground" : "text-muted"}`}>
                    {section.title}
                  </span>
                </div>
                {st !== "complete" && onNavigate && (
                  <button type="button" onClick={() => onNavigate(section.id)} className="text-xs text-brand-teal hover:underline">
                    Go to section
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!allComplete && (
          <p className="text-xs text-amber-600 mt-3">Complete all sections above before submitting.</p>
        )}
      </Card>

      {/* Summary Cards */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Organization Info</h3>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate("S-1")} className="text-xs text-brand-teal hover:underline">Edit</button>
          )}
        </div>
        <Field label="Legal Name" value={sellerData.orgInfo.legalName} />
        <Field label="Admin Contact" value={sellerData.orgInfo.adminContactName ? `${sellerData.orgInfo.adminContactName} (${sellerData.orgInfo.adminContactEmail})` : undefined} />
        <Field label="Operations Contact" value={sellerData.orgInfo.operationsContactName || undefined} />
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Default Services</h3>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate("S-4")} className="text-xs text-brand-teal hover:underline">Edit</button>
          )}
        </div>
        {selectedServices.length > 0 ? (
          <div className="flex flex-col gap-2">
            {selectedServices.map((s) => {
              const label = SELLER_SERVICE_TYPES.find((st) => st.value === s.serviceType)?.label
                ?? SERVICE_TYPES.find((st) => st.value === s.serviceType)?.label
                ?? s.serviceType;
              const orgCategory = sellerData.orgSubServices?.categories[s.serviceType];
              const selectedSubTypes = orgCategory?.filter((i) => i.selected).map((i) => i.subType) ?? [];
              const totalSubs = SUB_SERVICE_TYPES[s.serviceType]?.length ?? 0;

              if (totalSubs > 0 && selectedSubTypes.length > 0) {
                return (
                  <ServiceReviewAccordion
                    key={s.serviceType}
                    serviceType={s.serviceType}
                    label={label}
                    selectedSubTypes={selectedSubTypes}
                  />
                );
              }

              return (
                <div key={s.serviceType} className="flex items-baseline justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm">{label}</span>
                  {totalSubs > 0 && (
                    <span className="text-xs text-muted">No sub-services configured</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No services selected</p>
        )}
      </Card>

      {/* Price List */}
      {((sellerData.pricing?.visitPrices?.length ?? 0) > 0 || (sellerData.pricing?.subServicePrices?.length ?? 0) > 0) && (
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-heading font-semibold">Default Price List</h3>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate("S-7")} className="text-xs text-brand-teal hover:underline">Edit</button>
            )}
          </div>
          {sellerData.pricing?.visitPrices?.filter((v) => v.price != null).map((vp) => (
            <Field key={vp.serviceType} label={vp.serviceType === "primary_care" ? "Primary Care" : "Urgent Care"} value={`$${Number(vp.price).toFixed(2)} per visit`} />
          ))}
          {(sellerData.pricing?.subServicePrices?.filter((s) => s.unitPrice != null).length ?? 0) > 0 && (
            <p className="text-xs text-muted mt-2">
              {sellerData.pricing!.subServicePrices!.filter((s) => s.unitPrice != null).length} sub-service{sellerData.pricing!.subServicePrices!.filter((s) => s.unitPrice != null).length !== 1 ? "s" : ""} priced
            </p>
          )}
        </Card>
      )}

      {/* Per-Location Overrides */}
      {sellerData.locations.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-heading font-semibold">Per-Location Service Details</h3>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate("S-2")} className="text-xs text-brand-teal hover:underline">Edit</button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {sellerData.locations.map((loc, idx) => {
              const locId = loc.id;
              const locState = locId ? sellerData.locationServices[locId] : undefined;
              const hasOverrides = locState?.hasOverrides ?? false;

              if (!hasOverrides) {
                return (
                  <div key={locId ?? idx} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
                    <p className="text-sm font-medium text-foreground">{loc.locationName || "Unnamed location"}</p>
                    <p className="text-xs text-muted mt-0.5">Using organization defaults</p>
                  </div>
                );
              }

              const disabledServices = locState!.overrides.filter((o) => !o.available);

              // Build per-service accordion data for this location
              const locationAccordions: Array<{ serviceType: string; label: string; selectedSubTypes: string[] }> = [];
              for (const svc of selectedServices) {
                // Check if service is disabled at this location
                if (disabledServices.some((ds) => ds.serviceType === svc.serviceType)) continue;
                const subs = SUB_SERVICE_TYPES[svc.serviceType];
                if (!subs || subs.length === 0) continue;
                const locSubs = locState!.subServices.filter((s) => s.serviceType === svc.serviceType);
                if (locSubs.length === 0) continue;
                const availableSubTypes = subs
                  .filter((sub) => {
                    const override = locSubs.find((ls) => ls.subType === sub.value);
                    return override ? override.available : true;
                  })
                  .map((sub) => sub.value);
                const label = SELLER_SERVICE_TYPES.find((st) => st.value === svc.serviceType)?.label
                  ?? SERVICE_TYPES.find((st) => st.value === svc.serviceType)?.label
                  ?? svc.serviceType;
                locationAccordions.push({ serviceType: svc.serviceType, label, selectedSubTypes: availableSubTypes });
              }

              return (
                <div key={locId ?? idx} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
                  <p className="text-sm font-medium text-foreground mb-2">{loc.locationName || "Unnamed location"}</p>
                  {disabledServices.length > 0 && (
                    <ul className="text-xs text-muted mb-2 space-y-0.5">
                      {disabledServices.map((ds) => {
                        const label = SELLER_SERVICE_TYPES.find((st) => st.value === ds.serviceType)?.label
                          ?? SERVICE_TYPES.find((st) => st.value === ds.serviceType)?.label
                          ?? ds.serviceType;
                        return <li key={ds.serviceType}>{label} &middot; Disabled</li>;
                      })}
                    </ul>
                  )}
                  {locationAccordions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {locationAccordions.map((acc) => (
                        <ServiceReviewAccordion
                          key={acc.serviceType}
                          serviceType={acc.serviceType}
                          label={acc.label}
                          selectedSubTypes={acc.selectedSubTypes}
                          defaultExpanded={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Lab Network</h3>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate("S-5")} className="text-xs text-brand-teal hover:underline">Edit</button>
          )}
        </div>
        <Field
          label="Network"
          value={sellerData.lab.networkType === "other" ? sellerData.lab.otherNetworkName : sellerData.lab.networkType}
        />
        <Field label="Contact" value={sellerData.lab.coordinationContactName} />
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Payment Account</h3>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate("S-6")} className="text-xs text-brand-teal hover:underline">Edit</button>
          )}
        </div>
        <p className="text-sm text-muted">Payment information submitted (details hidden for security).</p>
      </Card>

      {/* Submit */}
      <Card className="mt-4">
        <Checkbox
          label="I confirm that all information is accurate and complete."
          name="sellerConfirm"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={!allComplete}
        />
        {!allComplete && (
          <p className="text-xs text-amber-600 mt-2">Complete all sections to submit.</p>
        )}
        <p className="text-xs text-muted mt-3">
          Once submitted, our team will review your care delivery information. This form will be locked after submission.
        </p>
        <div className="mt-4">
          <Button variant="cta" onClick={handleSubmit} disabled={!confirmed || !allComplete} loading={submitting}>
            Submit Care Delivery Onboarding
          </Button>
        </div>
      </Card>

      <div className="pb-4">
        <Button variant="secondary" type="button" onClick={() => onNavigate?.("S-6")}>
          &larr; Previous
        </Button>
      </div>
    </div>
  );
}
