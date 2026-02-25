"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useSaving } from "./OnboardingClient";
import { SELLER_SECTIONS } from "@/types";
import type { SellerSectionId } from "@/types";

interface SellerSectionNavButtonsProps {
  currentSection: SellerSectionId;
  onNavigate?: (sectionId: string) => void;
  /** Called before navigating forward. Navigation proceeds even if this rejects. */
  onSave?: () => Promise<void>;
  isDirty?: boolean;
  disabled?: boolean;
}

export function SellerSectionNavButtons({
  currentSection,
  onNavigate,
  onSave,
  isDirty,
  disabled,
}: SellerSectionNavButtonsProps) {
  const [navigating, setNavigating] = useState(false);
  const setSaving = useSaving();

  const sectionIds = SELLER_SECTIONS.map((s) => s.id);
  const currentIndex = sectionIds.indexOf(currentSection);
  const prevSection = currentIndex > 0 ? sectionIds[currentIndex - 1] : null;
  const nextSection = currentIndex < sectionIds.length - 1 ? sectionIds[currentIndex + 1] : null;

  async function handleNext() {
    if (navigating || !nextSection) return;
    setNavigating(true);
    setSaving(true);
    try {
      await onSave?.();
    } catch (err) {
      console.error("Section save failed:", err);
      toast.error("Your changes could not be saved. Please try again.");
    }
    flushSync(() => {
      setSaving(false);
      setNavigating(false);
    });
    onNavigate?.(nextSection);
  }

  if (disabled) return null;

  return (
    <div className="flex justify-between items-center pt-4">
      {prevSection ? (
        <Button
          variant="secondary"
          type="button"
          disabled={navigating}
          onClick={() => onNavigate?.(prevSection)}
        >
          &larr; Previous
        </Button>
      ) : (
        <div />
      )}
      {nextSection != null && (
        <Button
          variant="cta"
          type="button"
          disabled={navigating}
          onClick={handleNext}
        >
          {navigating ? "Saving\u2026" : isDirty ? "Save & Next \u2192" : "Next \u2192"}
        </Button>
      )}
    </div>
  );
}
