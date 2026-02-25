"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { getUnmetPrerequisites, getVisibleSections } from "@/types";
import type { CompletionStatus, SectionId } from "@/types";
import type { ProgramInfo, AllSectionData } from "./OnboardingClient";
import { duplicateProgram } from "@/lib/actions/program";
import { loadAllOnboardingData } from "@/lib/actions/onboarding";

interface SectionNavProps {
  activeSection: number;
  onSectionChange: (id: number) => void;
  completionStatuses?: Record<number, CompletionStatus>;
  unlockedPhases?: number[];
  phaseStatuses?: Record<number, string>; // phase -> "DRAFT" | "SUBMITTED"
  dirtySections?: Record<number, boolean>;
  programs?: ProgramInfo[];
  selectedProgramId?: string | null;
  onPlanChange?: (programId: string) => void;
  onProgramListUpdate?: (programs: ProgramInfo[]) => void;
  onProgramDataUpdate?: (programId: string, data: AllSectionData) => void;
}

function StatusDot({ status, locked, dirty }: { status: CompletionStatus; locked?: boolean; dirty?: boolean }) {
  // Show amber dot when section has unsaved changes (and isn't locked)
  if (dirty && !locked) {
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
  if (locked) {
    return (
      <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center opacity-30">
        <div className="h-3 w-3 rounded-full border-2 border-border" />
      </div>
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

function PlanSelector({
  programs,
  selectedProgramId,
  onPlanChange,
  onProgramListUpdate,
  onProgramDataUpdate,
}: {
  programs: ProgramInfo[];
  selectedProgramId: string | null;
  onPlanChange: (programId: string) => void;
  onProgramListUpdate: (programs: ProgramInfo[]) => void;
  onProgramDataUpdate: (programId: string, data: AllSectionData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNameInput(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (showNameInput && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showNameInput]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);
  const displayName = selectedProgram?.programName || "Unnamed Plan";

  // Don't render if only one program
  if (programs.length <= 1 && !open) {
    return (
      <div className="mb-4">
        <div
          ref={ref}
          className="relative"
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:bg-gray-light transition-colors"
          >
            <span className="truncate">{displayName}</span>
            <svg className="w-4 h-4 text-muted flex-shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-30 overflow-hidden">
              {programs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPlanChange(p.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-light transition-colors ${
                    p.id === selectedProgramId ? "bg-brand-teal/10 text-brand-teal font-medium" : "text-foreground"
                  }`}
                >
                  {p.programName || "Unnamed Plan"}
                </button>
              ))}
              <div className="border-t border-border">
                {!showNameInput ? (
                  <button
                    type="button"
                    onClick={() => setShowNameInput(true)}
                    className="w-full text-left px-3 py-2 text-sm text-brand-teal hover:bg-gray-light transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Duplicate Plan
                  </button>
                ) : (
                  <div className="p-2 flex gap-1.5">
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="New plan name"
                      value={newPlanName}
                      onChange={(e) => setNewPlanName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDuplicate();
                        if (e.key === "Escape") { setShowNameInput(false); setNewPlanName(""); }
                      }}
                      className="flex-1 min-w-0 text-sm border border-border rounded px-2 py-1 focus:border-focus focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={handleDuplicate}
                      disabled={!newPlanName.trim() || duplicating}
                      className="text-xs font-medium text-white bg-brand-teal rounded px-2 py-1 disabled:opacity-50"
                    >
                      {duplicating ? "..." : "Create"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  async function handleDuplicate() {
    if (!selectedProgramId || !newPlanName.trim()) return;
    setDuplicating(true);
    try {
      const newId = await duplicateProgram(selectedProgramId, newPlanName.trim());
      // Reload full data to get the new program's section data
      const freshData = await loadAllOnboardingData();
      onProgramListUpdate(freshData.programs);
      if (freshData.allProgramData?.[newId]) {
        onProgramDataUpdate(newId, freshData.allProgramData[newId]);
      }
      onPlanChange(newId);
      setNewPlanName("");
      setShowNameInput(false);
      setOpen(false);
      toast.success(`Plan "${newPlanName.trim()}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate plan");
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="mb-4">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:bg-gray-light transition-colors"
        >
          <span className="truncate">{displayName}</span>
          <svg className={`w-4 h-4 text-muted flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-30 overflow-hidden">
            {programs.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPlanChange(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-light transition-colors ${
                  p.id === selectedProgramId ? "bg-brand-teal/10 text-brand-teal font-medium" : "text-foreground"
                }`}
              >
                {p.programName || "Unnamed Plan"}
              </button>
            ))}
            <div className="border-t border-border">
              {!showNameInput ? (
                <button
                  type="button"
                  onClick={() => setShowNameInput(true)}
                  className="w-full text-left px-3 py-2 text-sm text-brand-teal hover:bg-gray-light transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  Duplicate Plan
                </button>
              ) : (
                <div className="p-2 flex gap-1.5">
                  <input
                    ref={nameInputRef}
                    type="text"
                    placeholder="New plan name"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDuplicate();
                      if (e.key === "Escape") { setShowNameInput(false); setNewPlanName(""); }
                    }}
                    className="flex-1 min-w-0 text-sm border border-border rounded px-2 py-1 focus:border-focus focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={!newPlanName.trim() || duplicating}
                    className="text-xs font-medium text-white bg-brand-teal rounded px-2 py-1 disabled:opacity-50"
                  >
                    {duplicating ? "..." : "Create"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionNav({
  activeSection,
  onSectionChange,
  completionStatuses = {},
  unlockedPhases = [1],
  phaseStatuses = {},
  dirtySections = {},
  programs = [],
  selectedProgramId = null,
  onPlanChange,
  onProgramListUpdate,
  onProgramDataUpdate,
}: SectionNavProps) {
  const visibleSections = getVisibleSections(unlockedPhases);

  return (
    <nav className="w-72 flex-shrink-0 bg-white border-r border-border p-6 overflow-y-auto flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-heading font-semibold text-brand-black">
          Onboarding
        </h2>
        <p className="text-xs text-muted mt-1">Complete all steps to submit</p>
      </div>

      {/* Plan Selector */}
      {programs.length > 0 && onPlanChange && onProgramListUpdate && onProgramDataUpdate && (
        <PlanSelector
          programs={programs}
          selectedProgramId={selectedProgramId}
          onPlanChange={onPlanChange}
          onProgramListUpdate={onProgramListUpdate}
          onProgramDataUpdate={onProgramDataUpdate}
        />
      )}

      <div className="flex flex-col gap-1">
        {visibleSections.map((section) => {
          const isActive = activeSection === section.id;
          const status = completionStatuses[section.id] || "not_started";
          const unmet = getUnmetPrerequisites(section.id as SectionId, completionStatuses);
          const phaseSubmitted = phaseStatuses[section.minPhase] === "SUBMITTED";
          const locked = unmet.length > 0 || phaseSubmitted;

          const tooltip = locked
            ? phaseSubmitted
              ? "This section has been submitted"
              : `Requires: ${unmet.map((s) => s.title).join(", ")}`
            : undefined;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              title={tooltip}
              className={`
                w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg
                text-sm transition-colors duration-150
                ${isActive
                  ? "bg-brand-teal/10 text-brand-teal font-medium"
                  : locked
                    ? "text-muted hover:bg-gray-light"
                    : "text-foreground hover:bg-gray-light"}
              `}
            >
              <StatusDot status={status} locked={locked} dirty={!!dirtySections[section.id]} />
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
