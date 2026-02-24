"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { submitForm } from "@/lib/actions/submit";
import { toggleSectionReview } from "@/lib/actions/section-review";
import { SECTIONS } from "@/types";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { SectionNavButtons } from "@/components/form/SectionNavButtons";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { AllSectionData } from "@/components/form/OnboardingClient";
import type { SectionReviewRow } from "@/lib/actions/section-review";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground font-medium">{value || "\u2014"}</span>
    </div>
  );
}

function EditButton({ section, onNavigate }: { section: number; onNavigate?: (section: number) => void }) {
  if (onNavigate) {
    return (
      <button type="button" onClick={() => onNavigate(section)} className="text-xs text-brand-teal hover:underline">
        Edit
      </button>
    );
  }
  return null;
}

const REVIEW_SECTIONS = [
  { id: 1, title: "Company & Contacts" },
  { id: 2, title: "Your Plan" },
  { id: 5, title: "Care Network" },
  { id: 4, title: "Payouts & Payments" },
] as const;

interface ReviewFormProps {
  data: AllSectionData;
  networkLocationCount: number;
  initialSectionReviews: SectionReviewRow[];
  onNavigate?: (section: number) => void;
}

export function ReviewForm({ data, networkLocationCount, initialSectionReviews, onNavigate }: ReviewFormProps) {
  const { statuses, formStatus, refreshStatuses } = useCompletion();
  const sectionsToComplete = SECTIONS.filter((s) => s.id !== 10 && !s.hidden && s.minPhase === 1);
  const allComplete = sectionsToComplete.every((s) => statuses[s.id] === "complete");

  // Build initial reviewed state from DB rows
  const initialReviewed: Record<number, boolean> = {};
  for (const row of initialSectionReviews) {
    initialReviewed[row.sectionId] = true;
  }
  const [reviewedSections, setReviewedSections] = useState<Record<number, boolean>>(initialReviewed);
  const allReviewed = REVIEW_SECTIONS.every((s) => reviewedSections[s.id]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleToggleReview(sectionId: number, checked: boolean) {
    setReviewedSections((prev) => ({ ...prev, [sectionId]: checked }));
    try {
      await toggleSectionReview(sectionId, checked);
    } catch {
      // Revert on failure
      setReviewedSections((prev) => ({ ...prev, [sectionId]: !checked }));
      toast.error("Failed to save review confirmation.");
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitForm();
      await refreshStatuses();
      setSubmitted(true);
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
          Form Submitted
        </h2>
        <p className="text-muted max-w-md mx-auto">
          Your onboarding information has been submitted. Our Care Navigation and Virtual Care teams will use this information to support your members.
        </p>
      </Card>
    );
  }

  const s1 = data[1];
  const s2 = data[2];
  const s3 = data[3];
  const s4 = data[4];
  const s11 = data[11];

  // Build extended services summary from section 3 + 11
  const selectedServices = s3.services.filter((s) => s.selected);
  const serviceLabel = (value: string) =>
    SERVICE_TYPES.find((st) => st.value === value)?.label ?? value;

  return (
    <div className="flex flex-col gap-6">
      {/* Completion Checklist */}
      <Card>
        <h3 className="text-base font-heading font-semibold mb-3">Completion Checklist</h3>
        <div className="flex flex-col gap-1.5">
          {sectionsToComplete.map((section) => {
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

      {/* Section 1: Company & Contacts */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Company & Contacts</h3>
          <EditButton section={1} onNavigate={onNavigate} />
        </div>
        <Field label="Legal Name" value={s1.legalName} />
        <Field label="Admin Contact" value={s1.adminContactName ? `${s1.adminContactName} (${s1.adminContactEmail})` : undefined} />
        <Field label="Executive Sponsor" value={s1.executiveSponsorName ? `${s1.executiveSponsorName} (${s1.executiveSponsorEmail})` : undefined} />
        <Field label="IT Contact" value={s1.itContactName ? `${s1.itContactName} (${s1.itContactEmail})` : undefined} />
        <div className="border-t border-border/50 pt-3 mt-3">
          <Checkbox
            label="I've reviewed Company & Contacts"
            name="review-section-1"
            checked={!!reviewedSections[1]}
            onChange={(e) => handleToggleReview(1, e.target.checked)}
            disabled={formStatus === "SUBMITTED"}
          />
        </div>
      </Card>

      {/* Section 2: Your Plan */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Your Plan</h3>
          <EditButton section={2} onNavigate={onNavigate} />
        </div>
        <Field label="Plan Name" value={s2.programName} />

        {/* Extended Services */}
        {selectedServices.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Extended Services</p>
            <div className="flex flex-col gap-1">
              {selectedServices.map((svc) => {
                const totalSubs = SUB_SERVICE_TYPES[svc.serviceType]?.length ?? 0;
                const selectedSubs = s11?.categories[svc.serviceType]?.filter((sub) => sub.selected).length ?? 0;
                return (
                  <div key={svc.serviceType} className="flex justify-between py-1 text-sm">
                    <span className="text-foreground">{serviceLabel(svc.serviceType)}</span>
                    {totalSubs > 0 ? (
                      <span className="text-muted">{selectedSubs} of {totalSubs} configured</span>
                    ) : (
                      <span className="text-success text-xs">Selected</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="border-t border-border/50 pt-3 mt-3">
          <Checkbox
            label="I've reviewed Your Plan"
            name="review-section-2"
            checked={!!reviewedSections[2]}
            onChange={(e) => handleToggleReview(2, e.target.checked)}
            disabled={formStatus === "SUBMITTED"}
          />
        </div>
      </Card>

      {/* Section 5: Care Network */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Care Network</h3>
          <EditButton section={5} onNavigate={onNavigate} />
        </div>
        {networkLocationCount > 0 ? (
          <p className="text-sm text-foreground">
            {networkLocationCount} {networkLocationCount === 1 ? "location" : "locations"} in your network
          </p>
        ) : (
          <p className="text-sm text-muted">No care delivery locations in your network yet.</p>
        )}
        <div className="border-t border-border/50 pt-3 mt-3">
          <Checkbox
            label="I've reviewed Care Network"
            name="review-section-5"
            checked={!!reviewedSections[5]}
            onChange={(e) => handleToggleReview(5, e.target.checked)}
            disabled={formStatus === "SUBMITTED"}
          />
        </div>
      </Card>

      {/* Section 4: Payouts & Payments */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-heading font-semibold">Payouts & Payments</h3>
          <EditButton section={4} onNavigate={onNavigate} />
        </div>

        {/* Payout Account */}
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Payout Account</p>
          <Field label="Account Holder" value={s4.achAccountHolderName} />
          <Field label="Account Type" value={s4.achAccountType === "checking" ? "Checking" : s4.achAccountType === "savings" ? "Savings" : undefined} />
        </div>

        {/* Payment Account */}
        <div className="mb-3 pt-2 border-t border-border/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Payment Account</p>
          <Field label="Account Holder" value={s4.paymentAchAccountHolderName} />
          <Field label="Account Type" value={s4.paymentAchAccountType === "checking" ? "Checking" : s4.paymentAchAccountType === "savings" ? "Savings" : undefined} />
        </div>

        {/* Documents */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Documents</p>
          <Field label="W-9" value={s4.w9FilePath ? "Uploaded" : "Not uploaded"} />
          <Field label="Bank Letter" value={s4.bankDocFilePath ? "Uploaded" : "Not uploaded"} />
        </div>
        <div className="border-t border-border/50 pt-3 mt-3">
          <Checkbox
            label="I've reviewed Payouts & Payments"
            name="review-section-4"
            checked={!!reviewedSections[4]}
            onChange={(e) => handleToggleReview(4, e.target.checked)}
            disabled={formStatus === "SUBMITTED"}
          />
        </div>
      </Card>

      {/* Submit */}
      {formStatus === "SUBMITTED" ? (
        <Card className="mt-4 text-center py-8">
          <svg className="h-12 w-12 text-success mx-auto mb-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <h3 className="text-lg font-heading font-semibold text-brand-black mb-1">Form Submitted</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Your onboarding information has been submitted. If you need to make changes, please contact your account manager.
          </p>
        </Card>
      ) : (
        <Card className="mt-4">
          {!allComplete && (
            <p className="text-xs text-amber-600 mb-2">Complete all sections to submit.</p>
          )}
          {!allReviewed && allComplete && (
            <p className="text-xs text-amber-600 mb-2">Confirm you&apos;ve reviewed each section above to submit.</p>
          )}
          <p className="text-xs text-muted mt-1">
            Once submitted, our teams will use this information to complete your setup and kick off any scoped projects. This form will be locked after submission — any changes will need to go through your account manager.
          </p>
          <div className="mt-4">
            <Button variant="cta" onClick={handleSubmit} disabled={!allComplete || !allReviewed} loading={submitting}>
              Submit Onboarding Form
            </Button>
          </div>
        </Card>
      )}

      <SectionNavButtons currentSection={10} onNavigate={onNavigate} />
    </div>
  );
}
