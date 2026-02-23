"use client";

import { Button } from "@/components/ui/Button";
import type { NetworkLocationItem } from "@/lib/actions/network";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";

function getServiceLabel(serviceType: string): string {
  return (
    SELLER_SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    SERVICE_TYPES.find((st) => st.value === serviceType)?.label ??
    serviceType
  );
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
      {/* Show pricing for available locations (always, even compact) */}
      {isAvailable && location.pricing && location.pricing.filter((p) => p.price).length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {location.pricing
            .filter((p) => p.price)
            .map((p) => (
              <div key={p.serviceType} className="flex justify-between text-xs">
                <span className="text-amber-700">{getServiceLabel(p.serviceType)}</span>
                <span className="font-medium text-amber-800">{p.price}/visit</span>
              </div>
            ))}
        </div>
      )}
      {isExcluded && (
        <p className="text-[10px] text-amber-600 mt-1">Excluded from network</p>
      )}
      {(onAdd || onRemove) && (
        <div className="mt-2 flex gap-2">
          {onAdd && (
            <Button variant="cta" onClick={onAdd} className="text-xs px-3 py-1">
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
