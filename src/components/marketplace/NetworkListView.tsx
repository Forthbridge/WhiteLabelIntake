"use client";

import { LocationCard } from "./LocationCard";
import type { NetworkLocationItem } from "@/lib/actions/network";

interface Props {
  locations: NetworkLocationItem[];
  searchQuery: string;
  serviceFilter: string;
  stateFilter: string;
  showMarketplace?: boolean;
  onAddLocation?: (location: NetworkLocationItem) => void;
  onRemoveLocation?: (location: NetworkLocationItem) => void;
}

function applyFilters(
  locs: NetworkLocationItem[],
  searchQuery: string,
  serviceFilter: string,
  stateFilter: string,
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
    return true;
  });
}

export function NetworkListView({
  locations,
  searchQuery,
  serviceFilter,
  stateFilter,
  showMarketplace,
  onAddLocation,
  onRemoveLocation,
}: Props) {
  // Network locations: included
  const networkLocs = applyFilters(
    locations.filter((loc) => loc.included),
    searchQuery,
    serviceFilter,
    stateFilter,
  );

  // Available locations: not included, not self-owned (marketplace)
  const availableLocs = showMarketplace
    ? applyFilters(
        locations.filter((loc) => !loc.isSelfOwned && !loc.included),
        searchQuery,
        serviceFilter,
        stateFilter,
      )
    : [];

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
      {/* Network locations */}
      {networkLocs.map((loc) => (
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

      {/* Available to Add section */}
      {availableLocs.length > 0 && (
        <>
          <div className="border-t border-border/50 pt-3 mt-1">
            <p className="text-sm font-medium text-amber-700 mb-3">
              Available to Add ({availableLocs.length})
            </p>
          </div>
          {availableLocs.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              onAdd={onAddLocation ? () => onAddLocation(loc) : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}
