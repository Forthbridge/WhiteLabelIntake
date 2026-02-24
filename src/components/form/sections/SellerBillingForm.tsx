"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FileUpload } from "@/components/ui/FileUpload";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSellerBilling } from "@/lib/actions/seller-billing";
import type { SellerBillingData } from "@/lib/validations/seller-billing";
import { SellerSectionNavButtons } from "../SellerSectionNavButtons";
import { useReportDirty, useSellerCacheUpdater } from "../OnboardingClient";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
];

interface Props {
  initialData: SellerBillingData;
  onNavigate?: (sectionId: string) => void;
  onStatusUpdate?: (statuses: Record<string, string>) => void;
  disabled?: boolean;
}

export function SellerBillingForm({ initialData, onNavigate, onStatusUpdate, disabled }: Props) {
  const [data, setData] = useState<SellerBillingData>(initialData);

  const updateSellerCache = useSellerCacheUpdater();

  const onSave = useCallback(async (d: SellerBillingData) => {
    const statuses = await saveSellerBilling(d);
    updateSellerCache("billing", d);
    onStatusUpdate?.(statuses);
    return {};
  }, [onStatusUpdate, updateSellerCache]);

  const { save, isDirty } = useSaveOnNext({ data, onSave });
  useReportDirty("S-6", isDirty);

  function update(field: keyof SellerBillingData, value: string | null) {
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
        <h3 className="text-lg font-heading font-semibold mb-1">Payment Account</h3>
        <p className="text-xs text-muted mb-5">
          Bank account where patient payments collected on your behalf will be deposited. This information is encrypted at the application level for security.
        </p>
        <div className="grid gap-5">
          <Input
            label="Account Holder Name"
            name="sellerAchAccountHolderName"
            required
            value={data.achAccountHolderName ?? ""}
            onChange={(e) => update("achAccountHolderName", e.target.value)}
            disabled={disabled}
          />
          <Select
            label="Account Type"
            name="sellerAchAccountType"
            required
            value={data.achAccountType ?? ""}
            onChange={(e) => update("achAccountType", e.target.value || null)}
            options={ACCOUNT_TYPE_OPTIONS}
            placeholder="Select account type"
          />
          <Input
            label="Routing Number"
            name="sellerAchRoutingNumber"
            required
            value={data.achRoutingNumber ?? ""}
            onChange={(e) => update("achRoutingNumber", e.target.value)}
            placeholder="9-digit routing number"
            disabled={disabled}
          />
          <Input
            label="Account Number"
            name="sellerAchAccountNumber"
            required
            value={data.achAccountNumber ?? ""}
            onChange={(e) => update("achAccountNumber", e.target.value)}
            placeholder="Account number"
            disabled={disabled}
          />
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

      <SellerSectionNavButtons
        currentSection="S-6"
        onNavigate={onNavigate}
        onSave={save}
        isDirty={isDirty}
        disabled={disabled}
      />
    </div>
  );
}
