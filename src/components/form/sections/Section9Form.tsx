"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSection9 } from "@/lib/actions/section9";
import { saveSection9ForAffiliate } from "@/lib/actions/admin-sections";
import type { Section9Data } from "@/lib/validations/section9";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { useAdminForm } from "@/lib/contexts/AdminFormContext";
import { SectionNavButtons } from "../SectionNavButtons";
import { useSyncSectionCache, useReportDirty } from "../OnboardingClient";

const STANDARD_SERVICES = [
  "Educate members on benefits and available services",
  "Schedule services and coordinate appointments",
  "Coordinate referrals to specialists and ancillary providers",
  "Provide ongoing care coordination and follow-up",
  "Track member engagement and outcomes",
];

export function Section9Form({ initialData, onNavigate, disabled }: { initialData: Section9Data; onNavigate?: (section: number) => void; disabled?: boolean }) {
  const [data, setData] = useState<Section9Data>(initialData);
  useSyncSectionCache(9, data);

  const { updateStatuses } = useCompletion();
  const adminCtx = useAdminForm();
  const onSave = useCallback(async (d: Section9Data) => {
    if (adminCtx?.isAdminEditing) return saveSection9ForAffiliate(adminCtx.affiliateId, d);
    return saveSection9(d);
  }, [adminCtx]);
  const { save, isDirty } = useSaveOnNext({ data, onSave, onAfterSave: updateStatuses });
  useReportDirty(9, isDirty);

  function update(field: keyof Section9Data, value: unknown) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Standard Care Navigation Services</h3>
        <p className="text-xs text-muted mb-5">
          The following services are included as part of your Care Navigation program. These are standard across all affiliates.
        </p>
        <ul className="space-y-2">
          {STANDARD_SERVICES.map((service) => (
            <li key={service} className="flex items-start gap-2 text-sm text-foreground">
              <svg className="h-4 w-4 text-success flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {service}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-4">Escalation Contacts</h3>
        <p className="text-xs text-muted mb-5">
          When Care Navigation encounters situations that require your team&apos;s involvement, these contacts will be notified.
        </p>
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-muted mb-2">Primary Escalation Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" required value={data.primaryEscalationName ?? ""} onChange={(e) => update("primaryEscalationName", e.target.value)} />
              <Input label="Email" required type="email" value={data.primaryEscalationEmail ?? ""} onChange={(e) => update("primaryEscalationEmail", e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted mb-2">Secondary Escalation Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" required value={data.secondaryEscalationName ?? ""} onChange={(e) => update("secondaryEscalationName", e.target.value)} />
              <Input label="Email" required type="email" value={data.secondaryEscalationEmail ?? ""} onChange={(e) => update("secondaryEscalationEmail", e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      <SectionNavButtons currentSection={9} onNavigate={onNavigate} onSave={save} />
    </div>
  );
}
