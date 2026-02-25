"use client";

import { Button } from "@/components/ui/Button";
import type { NetworkLocationItem, PricingItem } from "@/lib/actions/network";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";

function getServiceLabel(serviceType: string): string {
  return (
    SELLER_SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    serviceType
  );
}

/** Groups flat pricing items by service type into a compact summary with payer indicators */
function PricingSummary({ pricing }: { pricing: PricingItem[] }) {
  const priced = pricing.filter((p) => p.price);
  if (priced.length === 0) return null;

  // Group by serviceType
  const groups = new Map<string, {
    visitPrice: string | null;
    visitPayer: "plan" | "patient" | undefined;
    subItems: number;
    prices: number[];
    hasPlanItems: boolean;
    hasPatientItems: boolean;
  }>();
  for (const p of priced) {
    if (!groups.has(p.serviceType)) {
      groups.set(p.serviceType, { visitPrice: null, visitPayer: undefined, subItems: 0, prices: [], hasPlanItems: false, hasPatientItems: false });
    }
    const g = groups.get(p.serviceType)!;
    if (!p.subType) {
      g.visitPrice = p.price;
      g.visitPayer = p.payer;
    } else {
      g.subItems++;
      const num = parseFloat(p.price!.replace(/[^0-9.]/g, ""));
      if (!isNaN(num)) g.prices.push(num);
      if (p.payer === "plan") g.hasPlanItems = true;
      else if (p.payer === "patient") g.hasPatientItems = true;
    }
  }

  return (
    <div className="mt-1.5 flex flex-col gap-0.5">
      {Array.from(groups.entries()).map(([serviceType, g]) => (
        <div key={serviceType} className="flex justify-between text-xs gap-2">
          <span className="text-amber-700 truncate flex items-center gap-1">
            {getServiceLabel(serviceType)}
            {g.subItems > 0 && (
              <span className="text-amber-500">({g.subItems} items)</span>
            )}
            {/* Payer indicator tags */}
            {(g.visitPayer === "plan" || g.hasPlanItems) && (
              <span className="inline-flex items-center text-[9px] font-medium bg-emerald-100 text-emerald-700 px-1 py-0 rounded">
                Plan
              </span>
            )}
            {g.hasPatientItems && (
              <span className="inline-flex items-center text-[9px] font-medium bg-amber-100 text-amber-700 px-1 py-0 rounded">
                Patient
              </span>
            )}
          </span>
          <span className="font-medium text-amber-800 whitespace-nowrap">
            {g.visitPrice
              ? `${g.visitPrice}/visit`
              : g.prices.length > 0
                ? formatPriceRange(g.prices)
                : "\u2014"}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatPriceRange(prices: number[]): string {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)}\u2013$${max.toFixed(2)}`;
}

interface Props {
  location: NetworkLocationItem;
  compact?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
}

export function LocationCard({ location, compact, onAdd, onRemove }: Props) {
  const address = [location.streetAddress, location.city, location.state, location.zip]
    .filter(Boolean)
    .join(", ");

  const serviceLabels = location.services.map(getServiceLabel);
  const isAvailable = !location.included && !location.isSelfOwned;
  const isExcluded = false; // Managed via marketplace layer now

  return (
    <div
      className={`border rounded-lg p-4 bg-white ${
        isAvailable
          ? "border-amber-300 border-dashed"
          : isExcluded
          ? "border-border/50 opacity-50"
          : "border-border/50"
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{location.locationName || "Unnamed location"}</p>
          <p className="text-xs text-muted">{location.sellerOrgName || "Unknown org"}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {location.isSelfOwned && (
            <span className="text-[10px] font-medium bg-brand-teal/10 text-brand-teal px-1.5 py-0.5 rounded">
              Your Org
            </span>
          )}
          {location.included && !location.isSelfOwned && (
            <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              Affiliate
            </span>
          )}
          {isAvailable && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              Available
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted mt-1">{address || "No address"}</p>
      {!compact && serviceLabels.length > 0 && (
        <p className="text-xs text-muted mt-1.5">
          {serviceLabels.join(" \u00B7 ")}
        </p>
      )}
      {!compact && location.hoursOfOperation && (
        <p className="text-xs text-muted mt-0.5">{location.hoursOfOperation}</p>
      )}
      {/* State 1: resolved pricing */}
      {isAvailable && location.pricing && location.pricing.filter((p) => p.price).length > 0 && (
        <PricingSummary pricing={location.pricing} />
      )}
      {/* State 2: multiple price lists, none selected yet */}
      {isAvailable && location.hasPriceLists && !location.hasPricing && (
        <p className="text-xs text-amber-600 italic mt-1.5">
          Multiple pricing schedules available — select when adding
        </p>
      )}
      {/* State 3: no pricing at all */}
      {isAvailable && !location.hasPriceLists && !location.hasPricing && (
        <p className="text-xs text-muted italic mt-1.5">
          Pricing not yet configured by seller
        </p>
      )}
      {isExcluded && (
        <p className="text-[10px] text-amber-600 mt-1">Excluded from network</p>
      )}
      {(onAdd || onRemove) && (
        <div className="mt-2 flex gap-2">
          {onAdd && (
            <Button
              variant="cta"
              onClick={onAdd}
              disabled={!location.hasPricing && !location.hasPriceLists}
              className="text-xs px-3 py-1"
            >
              Add to Network
            </Button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-error hover:underline px-1 py-1"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
