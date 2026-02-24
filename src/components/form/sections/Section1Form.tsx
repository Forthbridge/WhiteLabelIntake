"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSection1 } from "@/lib/actions/section1";
import { saveSection1ForAffiliate } from "@/lib/actions/admin-sections";
import type { Section1Data } from "@/lib/validations/section1";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { useAdminForm } from "@/lib/contexts/AdminFormContext";
import { SectionNavButtons } from "../SectionNavButtons";
import { useSyncSectionCache, useReportDirty } from "../OnboardingClient";

export function Section1Form({ initialData, onNavigate, disabled }: { initialData: Section1Data; onNavigate?: (section: number) => void; disabled?: boolean }) {
  const [data, setData] = useState<Section1Data>(initialData);
  useSyncSectionCache(1, data);
  const { updateStatuses } = useCompletion();
  const adminCtx = useAdminForm();

  const onSave = useCallback(async (d: Section1Data) => {
    if (adminCtx?.isAdminEditing) return saveSection1ForAffiliate(adminCtx.affiliateId, d);
    return saveSection1(d);
  }, [adminCtx]);

  const { save, isDirty } = useSaveOnNext({ data, onSave, onAfterSave: updateStatuses });
  useReportDirty(1, isDirty);

  function update(field: keyof Section1Data, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Organization</h3>
        <p className="text-xs text-muted mb-5">
          This information helps us align your program and establish clear points of contact.
        </p>
        <div className="grid gap-5">
          <Input
            label="Provider Group Legal Name"
            name="legalName"
            required
            value={data.legalName ?? ""}
            onChange={(e) => update("legalName", e.target.value)}
            placeholder="Full legal entity name"
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Primary Admin Contact</h3>
        <p className="text-xs text-muted mb-5">
          This person owns the form and sees the completion dashboard.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            name="adminContactName"
            required
            value={data.adminContactName ?? ""}
            onChange={(e) => update("adminContactName", e.target.value)}
          />
          <Input
            label="Email"
            name="adminContactEmail"
            type="email"
            required
            value={data.adminContactEmail ?? ""}
            onChange={(e) => update("adminContactEmail", e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Executive Sponsor</h3>
        <p className="text-xs text-muted mb-5">
          Escalation path for program-level issues.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            name="executiveSponsorName"
            required
            value={data.executiveSponsorName ?? ""}
            onChange={(e) => update("executiveSponsorName", e.target.value)}
          />
          <Input
            label="Email"
            name="executiveSponsorEmail"
            type="email"
            required
            value={data.executiveSponsorEmail ?? ""}
            onChange={(e) => update("executiveSponsorEmail", e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">IT Contact</h3>
        <p className="text-xs text-muted mb-5">
          Technical point of contact for integration and system access.
        </p>
        <div className="grid gap-4">
          <Input
            label="Name"
            name="itContactName"
            required
            value={data.itContactName ?? ""}
            onChange={(e) => update("itContactName", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              name="itContactEmail"
              type="email"
              required
              value={data.itContactEmail ?? ""}
              onChange={(e) => update("itContactEmail", e.target.value)}
            />
            <Input
              label="Phone"
              name="itContactPhone"
              type="tel"
              value={data.itContactPhone ?? ""}
              onChange={(e) => update("itContactPhone", e.target.value)}
            />
          </div>
        </div>
      </Card>

      <SectionNavButtons currentSection={1} onNavigate={onNavigate} onSave={save} />
    </div>
  );
}
