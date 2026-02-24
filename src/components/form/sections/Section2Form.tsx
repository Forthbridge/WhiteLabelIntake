"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSection2 } from "@/lib/actions/section2";
import { saveSection2ForAffiliate } from "@/lib/actions/admin-sections";
import type { Section2Data } from "@/lib/validations/section2";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { useAdminForm } from "@/lib/contexts/AdminFormContext";
import { SectionNavButtons } from "../SectionNavButtons";
import { useSyncSectionCache, useReportDirty } from "../OnboardingClient";

const DEFAULT_SERVICES = [
  "Unlimited 24/7 $0 virtual primary care and sick visits",
  "Emotional wellness counseling (12 sessions)",
  "Health coaching (12 sessions)",
  "Care Navigation",
  "Discounted weight loss program, including GLP-1 medications",
];

export function Section2Form({ initialData, onNavigate, disabled }: { initialData: Section2Data; onNavigate?: (section: number) => void; disabled?: boolean }) {
  const [data, setData] = useState<Section2Data>(initialData);
  useSyncSectionCache(2, data);
  const { updateStatuses } = useCompletion();
  const adminCtx = useAdminForm();

  const onSave = useCallback(async (d: Section2Data) => {
    if (adminCtx?.isAdminEditing) return saveSection2ForAffiliate(adminCtx.affiliateId, d);
    return saveSection2(d);
  }, []);

  const { save, isDirty } = useSaveOnNext({ data, onSave, onAfterSave: updateStatuses });
  useReportDirty(2, isDirty);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Standard Service Package</h3>
        <p className="text-xs text-muted mb-5">
          These services are included by default and will be supported by our virtual care and care navigation teams.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {DEFAULT_SERVICES.map((service) => (
            <div key={service} className="flex items-center gap-3 p-3 bg-gray-light rounded-[var(--radius-input)]">
              <svg className="h-5 w-5 text-success flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-foreground">{service}</span>
            </div>
          ))}
        </div>

      </Card>

      <SectionNavButtons currentSection={2} onNavigate={onNavigate} onSave={save} />
    </div>
  );
}
