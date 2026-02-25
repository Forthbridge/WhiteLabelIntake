"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FileUpload } from "@/components/ui/FileUpload";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSection4 } from "@/lib/actions/section4";
import { saveSection4ForAffiliate } from "@/lib/actions/admin-sections";
import type { Section4Data } from "@/lib/validations/section4";
import { useCompletion } from "@/lib/contexts/CompletionContext";
import { useAdminForm } from "@/lib/contexts/AdminFormContext";
import { SectionNavButtons } from "../SectionNavButtons";
import { useSyncSectionCache, useReportDirty, useSelectedProgram } from "../OnboardingClient";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
];

export function Section4Form({ initialData, onNavigate, disabled }: { initialData: Section4Data; onNavigate?: (section: number) => void; disabled?: boolean }) {
  const [data, setData] = useState<Section4Data>(initialData);
  useSyncSectionCache(4, data);
  const { updateStatuses } = useCompletion();
  const adminCtx = useAdminForm();
  const selectedProgramId = useSelectedProgram();

  const onSave = useCallback(async (d: Section4Data) => {
    if (adminCtx?.isAdminEditing) return saveSection4ForAffiliate(adminCtx.affiliateId, d);
    return saveSection4(d, selectedProgramId ?? undefined);
  }, [adminCtx, selectedProgramId]);

  const { save, isDirty } = useSaveOnNext({ data, onSave, onAfterSave: updateStatuses });
  useReportDirty(4, isDirty);

  function update(field: keyof Section4Data, value: string | null) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">W-9</h3>
        <p className="text-xs text-muted mb-5">
          Upload your W-9 form. Accepted formats: PDF, PNG, JPEG (max 10MB).
        </p>
        <FileUpload
          label="W-9"
          documentType="w9"
          value={data.w9FilePath ?? null}
          onChange={(path) => update("w9FilePath", path)}
          disabled={disabled}
        />
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Payout Account</h3>
        <p className="text-xs text-muted mb-5">
          This is where we deposit payouts to you. This information is encrypted at the application level for security.
        </p>
        <div className="grid gap-5">
          <Input label="Account Holder Name" name="achAccountHolderName" required value={data.achAccountHolderName ?? ""} onChange={(e) => update("achAccountHolderName", e.target.value)} />
          <Select label="Account Type" name="achAccountType" required value={data.achAccountType ?? ""} onChange={(e) => update("achAccountType", e.target.value || null)} options={ACCOUNT_TYPE_OPTIONS} placeholder="Select account type" />
          <Input label="Routing Number" name="achRoutingNumber" required value={data.achRoutingNumber ?? ""} onChange={(e) => update("achRoutingNumber", e.target.value)} placeholder="9-digit routing number" />
          <Input label="Account Number" name="achAccountNumber" required value={data.achAccountNumber ?? ""} onChange={(e) => update("achAccountNumber", e.target.value)} placeholder="Account number" />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Bank Letter</h3>
        <p className="text-xs text-muted mb-5">
          Upload a letter from your bank confirming account details. Accepted formats: PDF, PNG, JPEG (max 10MB).
        </p>
        <FileUpload
          label="Bank letter"
          documentType="bank-doc"
          value={data.bankDocFilePath ?? null}
          onChange={(path) => update("bankDocFilePath", path)}
          disabled={disabled}
        />
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Payment Account (Invoice Autocollect)</h3>
        <p className="text-xs text-muted mb-5">
          This is the account we&apos;ll use to automatically collect invoices. This information is encrypted at the application level for security.
        </p>
        <div className="grid gap-5">
          <Input label="Account Holder Name" name="paymentAchAccountHolderName" required value={data.paymentAchAccountHolderName ?? ""} onChange={(e) => update("paymentAchAccountHolderName", e.target.value)} />
          <Select label="Account Type" name="paymentAchAccountType" required value={data.paymentAchAccountType ?? ""} onChange={(e) => update("paymentAchAccountType", e.target.value || null)} options={ACCOUNT_TYPE_OPTIONS} placeholder="Select account type" />
          <Input label="Routing Number" name="paymentAchRoutingNumber" required value={data.paymentAchRoutingNumber ?? ""} onChange={(e) => update("paymentAchRoutingNumber", e.target.value)} placeholder="9-digit routing number" />
          <Input label="Account Number" name="paymentAchAccountNumber" required value={data.paymentAchAccountNumber ?? ""} onChange={(e) => update("paymentAchAccountNumber", e.target.value)} placeholder="Account number" />
        </div>
      </Card>

      <SectionNavButtons currentSection={4} onNavigate={onNavigate} onSave={save} />
    </div>
  );
}
