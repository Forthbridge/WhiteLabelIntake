"use client";

import { Button } from "@/components/ui/Button";
import { LocationCard } from "./LocationCard";
import type { NetworkLocationItem } from "@/lib/actions/network";

interface Props {
  locations: NetworkLocationItem[];
  contracts?: { contractId: string; sellerId: string; priceListId?: string | null }[];
  searchQuery: string;
  serviceFilter: string;
  stateFilter: string;
  sellerFilter: string[];
  showMarketplace?: boolean;
  onAddLocation?: (location: NetworkLocationItem) => void;
  onRemoveLocation?: (location: NetworkLocationItem) => void;
  onAddAllFromSeller?: (sellerOrgId: string) => void;
  onRemoveAllFromSeller?: (sellerOrgId: string) => void;
  onChangePriceList?: (sellerOrgId: string, contractId: string) => void;
}

function applyFilters(
  locs: NetworkLocationItem[],
  searchQuery: string,
  serviceFilter: string,
  stateFilter: string,
  sellerFilter: string[],
): NetworkLocationItem[] {
  return locs.filter((loc) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        loc.locationName.toLowerCase().includes(q) ||
        loc.sellerOrgName?.toLowerCase().includes(q) ||
        loc.city.toLowerCase().includes(q) ||
        loc.state.toLowerCase().includes(q) ||
        loc.streetAddress.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (serviceFilter && serviceFilter !== "all") {
      if (!loc.services.includes(serviceFilter)) return false;
    }
    if (stateFilter && stateFilter !== "all") {
      if (loc.state !== stateFilter) return false;
    }
    if (sellerFilter.length > 0) {
      if (!sellerFilter.includes(loc.sellerOrgId)) return false;
    }
    return true;
  });
}

/** Groups locations by seller org, sorted by seller name */
function groupBySeller(locs: NetworkLocationItem[]): { sellerOrgId: string; sellerName: string; locations: NetworkLocationItem[] }[] {
  const map = new Map<string, { sellerName: string; locations: NetworkLocationItem[] }>();
  for (const loc of locs) {
    if (!map.has(loc.sellerOrgId)) {
      map.set(loc.sellerOrgId, { sellerName: loc.sellerOrgName || "Unknown", locations: [] });
    }
    map.get(loc.sellerOrgId)!.locations.push(loc);
  }
  return Array.from(map.entries())
    .map(([sellerOrgId, data]) => ({ sellerOrgId, ...data }))
    .sort((a, b) => a.sellerName.localeCompare(b.sellerName));
}

export function NetworkListView({
  locations,
  contracts,
  searchQuery,
  serviceFilter,
  stateFilter,
  sellerFilter,
  showMarketplace,
  onAddLocation,
  onRemoveLocation,
  onAddAllFromSeller,
  onRemoveAllFromSeller,
  onChangePriceList,
}: Props) {
  // Network locations: included
  const networkLocs = applyFilters(
    locations.filter((loc) => loc.included),
    searchQuery,
    serviceFilter,
    stateFilter,
    sellerFilter,
  );

  // Available locations: not included, not self-owned (marketplace)
  const availableLocs = showMarketplace
    ? applyFilters(
        locations.filter((loc) => !loc.isSelfOwned && !loc.included),
        searchQuery,
        serviceFilter,
        stateFilter,
        sellerFilter,
      )
    : [];

  const sellerGroups = groupBySeller(availableLocs);
  const networkSellerGroups = groupBySeller(networkLocs);

  if (networkLocs.length === 0 && availableLocs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">
          {locations.length === 0
            ? "No locations in your network yet."
            : "No locations match your filters."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Network locations — grouped by seller */}
      {networkSellerGroups.map((group) => (
        <div key={group.sellerOrgId} className="flex flex-col gap-2">
          {/* Seller group header (only when multiple sellers or non-self-owned with >1 location) */}
          {(networkSellerGroups.length > 1 || (!group.locations[0]?.isSelfOwned && group.locations.length > 1)) && (
            <div className="flex justify-between items-center px-1">
              <p className="text-sm font-medium text-foreground">
                {group.sellerName}
                <span className="text-muted font-normal ml-1.5">
                  ({group.locations.length} location{group.locations.length !== 1 ? "s" : ""})
                </span>
              </p>
              <div className="flex items-center gap-2">
                {onChangePriceList && !group.locations[0]?.isSelfOwned && (() => {
                  const contract = contracts?.find(c => c.sellerId === group.sellerOrgId);
                  return contract?.priceListId ? (
                    <button
                      type="button"
                      onClick={() => onChangePriceList(group.sellerOrgId, contract.contractId)}
                      className="text-xs text-brand-teal hover:underline"
                    >
                      Change Price List
                    </button>
                  ) : null;
                })()}
                {onRemoveAllFromSeller && !group.locations[0]?.isSelfOwned && group.locations.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => onRemoveAllFromSeller(group.sellerOrgId)}
                    className="text-xs px-3 py-1 text-error border-error/30 hover:bg-error/5"
                  >
                    Remove All
                  </Button>
                )}
              </div>
            </div>
          )}
          {group.locations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              onRemove={
                onRemoveLocation && !loc.isSelfOwned
                  ? () => onRemoveLocation(loc)
                  : undefined
              }
            />
          ))}
        </div>
      ))}

      {/* Available to Add section — grouped by seller */}
      {sellerGroups.length > 0 && (
        <>
          <div className="border-t border-border/50 pt-3 mt-1">
            <p className="text-sm font-medium text-amber-700 mb-3">
              Available to Add ({availableLocs.length})
            </p>
          </div>
          {sellerGroups.map((group) => (
            <div key={group.sellerOrgId} className="flex flex-col gap-2">
              {/* Seller group header */}
              <div className="flex justify-between items-center px-1">
                <p className="text-sm font-medium text-foreground">
                  {group.sellerName}
                  <span className="text-muted font-normal ml-1.5">
                    ({group.locations.length} location{group.locations.length !== 1 ? "s" : ""})
                  </span>
                </p>
                {onAddAllFromSeller && group.locations.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => onAddAllFromSeller(group.sellerOrgId)}
                    className="text-xs px-3 py-1"
                  >
                    Add All
                  </Button>
                )}
              </div>
              {/* Individual location cards */}
              {group.locations.map((loc) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  onAdd={onAddLocation ? () => onAddLocation(loc) : undefined}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
