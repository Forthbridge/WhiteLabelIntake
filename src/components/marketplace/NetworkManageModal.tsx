"use client";

import { Button } from "@/components/ui/Button";
import type { NetworkLocationItem, NetworkContractSummary } from "@/lib/actions/network";

interface Props {
  locations: NetworkLocationItem[];
  contracts: NetworkContractSummary[];
  onClose: () => void;
  onRemoveLocation?: (location: NetworkLocationItem) => void;
}

export function NetworkManageModal({ locations, contracts, onClose, onRemoveLocation }: Props) {
  // Group included locations by seller org
  const grouped = new Map<string, { orgName: string; contract: NetworkContractSummary; locations: NetworkLocationItem[] }>();
  for (const loc of locations) {
    if (!loc.included) continue;
    if (!grouped.has(loc.sellerOrgId)) {
      const contract = contracts.find((c) => c.sellerId === loc.sellerOrgId);
      if (!contract) continue;
      grouped.set(loc.sellerOrgId, {
        orgName: loc.sellerOrgName ?? "Unknown",
        contract,
        locations: [],
      });
    }
    grouped.get(loc.sellerOrgId)!.locations.push(loc);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
          <h3 className="text-base font-heading font-semibold">Network Locations</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-4">
          {Array.from(grouped.entries()).map(([orgId, group]) => (
            <div key={orgId}>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-foreground">
                  {group.orgName}
                  {group.locations[0]?.isSelfOwned && (
                    <span className="text-[10px] font-medium bg-brand-teal/10 text-brand-teal px-1.5 py-0.5 rounded ml-2">
                      Your Org
                    </span>
                  )}
                </p>
                <span className="text-xs text-muted">
                  {group.contract.activeTermCount} of {group.contract.locationCount} active
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {group.locations.map((loc) => {
                  const address = [loc.streetAddress, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
                  return (
                    <div
                      key={loc.id}
                      className="flex items-start gap-3 p-2 rounded border border-border/30"
                    >
                      <div className="w-2 h-2 rounded-full bg-success mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {loc.locationName || "Unnamed"}
                        </p>
                        <p className="text-xs text-muted truncate">{address}</p>
                      </div>
                      {onRemoveLocation && !loc.isSelfOwned && (
                        <button
                          type="button"
                          onClick={() => onRemoveLocation(loc)}
                          className="text-xs text-error hover:underline flex-shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {grouped.size === 0 && (
            <p className="text-sm text-muted text-center py-4">
              No locations in your network.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border/50">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
