"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useSaveOnNext } from "@/lib/hooks/useSaveOnNext";
import { saveSellerOrgInfo } from "@/lib/actions/seller-org";
import type { SellerOrgData } from "@/lib/validations/seller-org";
import { SellerSectionNavButtons } from "../SellerSectionNavButtons";
import { useReportDirty, useSellerCacheUpdater } from "../OnboardingClient";

interface Props {
  initialData: SellerOrgData;
  onNavigate?: (sectionId: string) => void;
  disabled?: boolean;
}

export function SellerOrgInfoForm({ initialData, onNavigate, disabled }: Props) {
  const [data, setData] = useState<SellerOrgData>(initialData);

  const updateSellerCache = useSellerCacheUpdater();

  const onSave = useCallback(async (d: SellerOrgData) => {
    await saveSellerOrgInfo(d);
    updateSellerCache("orgInfo", d);
    return {};
  }, [updateSellerCache]);

  const { save, isDirty } = useSaveOnNext({ data, onSave });
  useReportDirty("S-1", isDirty);

  function update(field: keyof SellerOrgData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Organization</h3>
        <p className="text-xs text-muted mb-5">
          Legal entity name and basic organization information.
        </p>
        <div className="grid gap-5">
          <Input
            label="Legal Entity Name"
            name="legalName"
            required
            value={data.legalName ?? ""}
            onChange={(e) => update("legalName", e.target.value)}
            placeholder="Full legal entity name"
            disabled={disabled}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Primary Admin Contact</h3>
        <p className="text-xs text-muted mb-5">
          Main point of contact for this organization.
        </p>
        <div className="grid gap-4">
          <Input
            label="Name"
            name="adminContactName"
            required
            value={data.adminContactName ?? ""}
            onChange={(e) => update("adminContactName", e.target.value)}
            disabled={disabled}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              name="adminContactEmail"
              type="email"
              required
              value={data.adminContactEmail ?? ""}
              onChange={(e) => update("adminContactEmail", e.target.value)}
              disabled={disabled}
            />
            <Input
              label="Phone"
              name="adminContactPhone"
              type="tel"
              value={data.adminContactPhone ?? ""}
              onChange={(e) => update("adminContactPhone", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Operations Contact</h3>
        <p className="text-xs text-muted mb-5">
          Day-to-day operations and coordination contact.
        </p>
        <div className="grid gap-4">
          <Input
            label="Name"
            name="operationsContactName"
            value={data.operationsContactName ?? ""}
            onChange={(e) => update("operationsContactName", e.target.value)}
            disabled={disabled}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              name="operationsContactEmail"
              type="email"
              value={data.operationsContactEmail ?? ""}
              onChange={(e) => update("operationsContactEmail", e.target.value)}
              disabled={disabled}
            />
            <Input
              label="Phone"
              name="operationsContactPhone"
              type="tel"
              value={data.operationsContactPhone ?? ""}
              onChange={(e) => update("operationsContactPhone", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </Card>

      <SellerSectionNavButtons
        currentSection="S-1"
        onNavigate={onNavigate}
        onSave={save}
        isDirty={isDirty}
        disabled={disabled}
      />
    </div>
  );
}
