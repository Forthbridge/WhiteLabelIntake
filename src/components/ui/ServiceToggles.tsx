"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { getGroupsForServiceType, SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { SubServiceItem } from "@/lib/validations/section11";

// ─── Toggle Item ────────────────────────────────────────────────────

export function ToggleItem({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onChange}
      onKeyDown={disabled ? undefined : (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(); } }}
      className={`
        flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer text-sm
        transition-colors select-none
        ${checked ? "bg-brand-teal/5 text-brand-black" : "text-muted hover:bg-gray-light"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <div
        className={`
          w-8 h-4.5 rounded-full transition-colors flex-shrink-0 relative
          ${checked ? "bg-brand-teal" : "bg-gray-300"}
        `}
        style={{ width: "2rem", height: "1.125rem" }}
      >
        <div
          className={`
            absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform
            ${checked ? "translate-x-[0.875rem]" : "translate-x-0.5"}
          `}
          style={{ width: "0.875rem", height: "0.875rem" }}
        />
      </div>
      <span className="truncate">{label}</span>
    </div>
  );
}

// ─── Grouped Toggle Grid ────────────────────────────────────────────
// Renders the group headers + 2-column toggle layout used by both
// ServiceAccordion and SubServiceModal.

export function GroupedToggleGrid({
  serviceType,
  subServiceDefs,
  items,
  onToggle,
  onSelectGroup,
  onDeselectGroup,
  disabled,
}: {
  serviceType: string;
  subServiceDefs: SubServiceItem[];
  items: { subType: string; selected: boolean }[];
  onToggle: (subType: string) => void;
  onSelectGroup?: (group: string) => void;
  onDeselectGroup?: (group: string) => void;
  disabled?: boolean;
}) {
  const groups = getGroupsForServiceType(serviceType);
  const hasGroups = groups.length > 1;

  if (hasGroups) {
    return (
      <>
        {groups.map((group) => {
          const groupItems = subServiceDefs.filter((d) => d.group === group);
          return (
            <div key={group} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">{group}</h4>
                {(onSelectGroup || onDeselectGroup) && !disabled && (
                  <div className="flex gap-2">
                    {onSelectGroup && (
                      <button type="button" onClick={() => onSelectGroup(group)} className="text-[11px] text-brand-teal hover:underline">All</button>
                    )}
                    {onDeselectGroup && (
                      <button type="button" onClick={() => onDeselectGroup(group)} className="text-[11px] text-muted hover:underline">None</button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {groupItems.map((def) => {
                  const item = items.find((i) => i.subType === def.value);
                  const checked = item?.selected ?? false;
                  return (
                    <ToggleItem
                      key={def.value}
                      label={def.label}
                      checked={checked}
                      onChange={() => onToggle(def.value)}
                      disabled={disabled}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
      {subServiceDefs.map((def) => {
        const item = items.find((i) => i.subType === def.value);
        const checked = item?.selected ?? false;
        return (
          <ToggleItem
            key={def.value}
            label={def.label}
            checked={checked}
            onChange={() => onToggle(def.value)}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}

// ─── Service Accordion ──────────────────────────────────────────────

export interface ServiceAccordionProps {
  serviceType: string;
  label: string;
  items: { subType: string; selected: boolean }[];
  subServiceDefs: SubServiceItem[];
  selectedCount: number;
  totalCount: number;
  onToggle: (subType: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  disabled?: boolean;
}

export function ServiceAccordion({
  serviceType,
  label,
  items,
  subServiceDefs,
  selectedCount,
  totalCount,
  onToggle,
  onSelectAll,
  onDeselectAll,
  disabled,
}: ServiceAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-1 text-left"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-base font-heading font-semibold text-brand-black">{label}</span>
        </div>
        <span className={`text-sm font-medium ${selectedCount > 0 ? "text-brand-teal" : "text-muted"}`}>
          {selectedCount} of {totalCount} selected
        </span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          {/* Select/Deselect All */}
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={disabled}
              className="text-xs text-brand-teal hover:underline disabled:opacity-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={onDeselectAll}
              disabled={disabled}
              className="text-xs text-muted hover:underline disabled:opacity-50"
            >
              Deselect All
            </button>
          </div>

          <GroupedToggleGrid
            serviceType={serviceType}
            subServiceDefs={subServiceDefs}
            items={items}
            onToggle={onToggle}
            disabled={disabled}
          />
        </div>
      )}
    </Card>
  );
}

// ─── Service Review Accordion (Read-Only) ────────────────────────────

export interface ServiceReviewAccordionProps {
  serviceType: string;
  label: string;
  selectedSubTypes: string[];
  defaultExpanded?: boolean;
}

export function ServiceReviewAccordion({
  serviceType,
  label,
  selectedSubTypes,
  defaultExpanded = true,
}: ServiceReviewAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const allDefs = SUB_SERVICE_TYPES[serviceType] ?? [];
  const totalCount = allDefs.length;
  const selectedCount = selectedSubTypes.length;
  const groups = getGroupsForServiceType(serviceType);
  const hasGroups = groups.length > 1;

  // Build a set for quick lookup
  const selectedSet = new Set(selectedSubTypes);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-light/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={`text-xs font-medium ${selectedCount > 0 ? "text-brand-teal" : "text-muted"}`}>
          {selectedCount} of {totalCount} selected
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          {hasGroups ? (
            groups.map((group) => {
              const groupDefs = allDefs.filter((d) => d.group === group);
              const groupSelected = groupDefs.filter((d) => selectedSet.has(d.value));
              if (groupSelected.length === 0) return null;
              return (
                <div key={group} className="mb-3 last:mb-0">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">{group}</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                    {groupSelected.map((def) => (
                      <span key={def.value} className="text-sm text-foreground py-0.5">{def.label}</span>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
              {allDefs.filter((d) => selectedSet.has(d.value)).map((def) => (
                <span key={def.value} className="text-sm text-foreground py-0.5">{def.label}</span>
              ))}
            </div>
          )}
          {selectedCount === 0 && (
            <p className="text-sm text-muted italic">No sub-services selected</p>
          )}
        </div>
      )}
    </div>
  );
}
