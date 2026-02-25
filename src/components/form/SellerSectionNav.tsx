"use client";

import { signOut } from "next-auth/react";
import { SELLER_SECTIONS } from "@/types";
import type { CompletionStatus, SellerSectionId } from "@/types";

interface SellerSectionNavProps {
  activeSection: SellerSectionId;
  onSectionChange: (id: string) => void;
  completionStatuses: Record<SellerSectionId, CompletionStatus>;
  dirtySections?: Record<string | number, boolean>;
}

function StatusDot({ status, dirty }: { status: CompletionStatus; dirty?: boolean }) {
  if (dirty) {
    return (
      <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-amber-400" />
      </div>
    );
  }
  if (status === "complete") {
    return (
      <svg className="h-5 w-5 text-success flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full border-2 border-brand-teal bg-brand-teal/20" />
      </div>
    );
  }
  return (
    <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
      <div className="h-3 w-3 rounded-full border-2 border-border" />
    </div>
  );
}

export function SellerSectionNav({
  activeSection,
  onSectionChange,
  completionStatuses,
  dirtySections,
}: SellerSectionNavProps) {
  return (
    <nav className="w-72 flex-shrink-0 bg-white border-r border-border p-6 overflow-y-auto flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-heading font-semibold text-brand-black">
          Care Delivery
        </h2>
        <p className="text-xs text-muted mt-1">Complete all sections to submit</p>
      </div>

      <div className="flex flex-col gap-1">
        {SELLER_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          const status = completionStatuses[section.id] || "not_started";
          const dirty = !!dirtySections?.[section.id];

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`
                w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg
                text-sm transition-colors duration-150
                ${isActive
                  ? "bg-brand-teal/10 text-brand-teal font-medium"
                  : "text-foreground hover:bg-gray-light"}
              `}
            >
              <StatusDot status={status} dirty={dirty} />
              <span className="truncate">{section.title}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-auto text-sm text-muted hover:text-brand-black transition-colors text-left"
      >
        Sign Out
      </button>
    </nav>
  );
}
