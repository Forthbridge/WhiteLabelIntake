"use client";

import { useEffect, useRef } from "react";
import { GroupedToggleGrid } from "@/components/ui/ServiceToggles";
import type { SubServiceItem } from "@/lib/validations/section11";

interface SubServiceModalProps {
  open: boolean;
  onClose: () => void;
  serviceType: string;
  serviceLabel: string;
  subServiceDefs: SubServiceItem[];
  /** Current availability map: subType → available */
  subServiceState: Record<string, boolean>;
  onToggle: (subType: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  /** Group-level select/deselect */
  onSelectGroup?: (group: string) => void;
  onDeselectGroup?: (group: string) => void;
  /** Optional price map: subType → unitPrice (null = not set) */
  prices?: Record<string, number | null>;
  /** Optional org-level price map for placeholders: subType → orgPrice */
  orgPrices?: Record<string, number | null>;
  /** Optional callback for price changes */
  onPriceChange?: (subType: string, price: number | null) => void;
}

export function SubServiceModal({
  open,
  onClose,
  serviceType,
  serviceLabel,
  subServiceDefs,
  subServiceState,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onSelectGroup,
  onDeselectGroup,
  prices,
  orgPrices,
  onPriceChange,
}: SubServiceModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  // Build items array matching the shape GroupedToggleGrid expects
  const items = subServiceDefs.map((def) => ({
    subType: def.value,
    selected: subServiceState[def.value] ?? true, // default available
  }));

  const selectedCount = items.filter((i) => i.selected).length;
  const totalCount = items.length;
  const showPrices = !!prices && !!onPriceChange;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4"
        role="dialog"
        aria-modal="true"
        aria-label={`${serviceLabel} sub-services`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-heading font-semibold text-brand-black">{serviceLabel}</h3>
            <span className={`text-sm font-medium ${selectedCount > 0 ? "text-brand-teal" : "text-muted"}`}>
              {selectedCount} of {totalCount} selected
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-light text-muted hover:text-brand-black transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Select All / Deselect All */}
        <div className="px-5 pt-4">
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs text-brand-teal hover:underline"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={onDeselectAll}
              className="text-xs text-muted hover:underline"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Grouped toggles (with optional price inputs) */}
        <div className="px-5 pb-5">
          {showPrices ? (
            <SubServiceGridWithPrices
              serviceType={serviceType}
              subServiceDefs={subServiceDefs}
              items={items}
              onToggle={onToggle}
              onSelectGroup={onSelectGroup}
              onDeselectGroup={onDeselectGroup}
              prices={prices!}
              orgPrices={orgPrices}
              onPriceChange={onPriceChange!}
            />
          ) : (
            <GroupedToggleGrid
              serviceType={serviceType}
              subServiceDefs={subServiceDefs}
              items={items}
              onToggle={onToggle}
              onSelectGroup={onSelectGroup}
              onDeselectGroup={onDeselectGroup}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Grid that shows toggles + price inputs for each sub-service */
function SubServiceGridWithPrices({
  subServiceDefs,
  items,
  onToggle,
  onSelectGroup,
  onDeselectGroup,
  prices,
  orgPrices,
  onPriceChange,
}: {
  serviceType: string;
  subServiceDefs: SubServiceItem[];
  items: Array<{ subType: string; selected: boolean }>;
  onToggle: (subType: string) => void;
  onSelectGroup?: (group: string) => void;
  onDeselectGroup?: (group: string) => void;
  prices: Record<string, number | null>;
  orgPrices?: Record<string, number | null>;
  onPriceChange: (subType: string, price: number | null) => void;
}) {
  // Group by group name
  const groups = new Map<string, SubServiceItem[]>();
  for (const def of subServiceDefs) {
    const group = def.group || "General";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(def);
  }

  const itemMap = new Map(items.map((i) => [i.subType, i.selected]));

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([groupName, defs]) => (
        <div key={groupName}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">{groupName}</h4>
            {(onSelectGroup || onDeselectGroup) && (
              <div className="flex gap-2">
                {onSelectGroup && (
                  <button type="button" onClick={() => onSelectGroup(groupName)} className="text-[11px] text-brand-teal hover:underline">All</button>
                )}
                {onDeselectGroup && (
                  <button type="button" onClick={() => onDeselectGroup(groupName)} className="text-[11px] text-muted hover:underline">None</button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {defs.map((def) => {
              const selected = itemMap.get(def.value) ?? true;
              const price = prices[def.value];
              const orgPrice = orgPrices?.[def.value];
              return (
                <div key={def.value} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(def.value)}
                    className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                      selected
                        ? "bg-brand-teal border-brand-teal"
                        : "border-border bg-white"
                    }`}
                  >
                    {selected && (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm truncate ${selected ? "text-foreground" : "text-muted line-through"}`}>
                    {def.label}
                  </span>
                  {selected && (
                    <div className="relative flex-shrink-0 w-24">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={orgPrice != null ? orgPrice.toFixed(2) : "0.00"}
                        className="w-full bg-transparent border border-border rounded pl-5 pr-1 py-1 text-xs text-right focus:border-focus focus:ring-0"
                        value={price != null ? String(price) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const parsed = parseFloat(val); onPriceChange(def.value, val === "" ? null : isNaN(parsed) ? null : parsed);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
