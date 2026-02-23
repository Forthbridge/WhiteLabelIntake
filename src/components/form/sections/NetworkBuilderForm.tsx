"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { NetworkListView } from "@/components/marketplace/NetworkListView";
import { PricingAcceptanceModal } from "@/components/marketplace/PricingAcceptanceModal";
import { RemoveLocationModal } from "@/components/marketplace/RemoveLocationModal";
import { loadNetworkData, addLocationTerm, loadSellerPricing } from "@/lib/actions/network";
import type { NetworkLocationItem, NetworkContractSummary } from "@/lib/actions/network";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";

// Lazy-load the map to avoid SSR issues with mapbox-gl
const NetworkMapView = dynamic(
  () => import("@/components/marketplace/NetworkMapView").then((m) => m.NetworkMapView),
  { ssr: false, loading: () => <div className="h-[480px] bg-surface rounded-lg flex items-center justify-center text-sm text-muted">Loading map...</div> },
);

type ViewMode = "list" | "map";

interface Props {
  onNavigate: (sectionId: number) => void;
  disabled?: boolean;
}

export function NetworkBuilderForm({ onNavigate, disabled }: Props) {
  const [locations, setLocations] = useState<NetworkLocationItem[]>([]);
  const [contracts, setContracts] = useState<NetworkContractSummary[]>([]);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false);
  const [affiliateOrgId, setAffiliateOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [showMarketplace, setShowMarketplace] = useState(false);

  // Pricing acceptance modal state
  const [pricingModal, setPricingModal] = useState<{
    contractId: string;
    sellerLocationId: string;
  } | null>(null);

  // Remove location modal state
  const [removeModal, setRemoveModal] = useState<{
    contractId: string;
    sellerLocationId: string;
    locationName: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const data = await loadNetworkData();
    setLocations(data.locations);
    setContracts(data.contracts);
    setMarketplaceEnabled(data.marketplaceEnabled);
    setAffiliateOrgId(data.affiliateOrgId);
  }, []);

  useEffect(() => {
    refresh().then(() => setLoading(false));
  }, [refresh]);

  const includedCount = locations.filter((l) => l.included).length;
  const availableCount = showMarketplace
    ? locations.filter((l) => !l.isSelfOwned && !l.included).length
    : 0;

  // Unique states from all locations for filter
  const uniqueStates = Array.from(new Set(locations.map((l) => l.state).filter(Boolean))).sort();

  // Combined service type options
  const allServiceTypes = [
    ...SELLER_SERVICE_TYPES.map((st) => ({ value: st.value, label: st.label })),
    ...SERVICE_TYPES
      .filter((st) => !SELLER_SERVICE_TYPES.find((sst) => sst.value === st.value))
      .map((st) => ({ value: st.value, label: st.label })),
  ];

  // Check if a seller already has any active terms (pricing already accepted)
  function sellerHasActiveTerms(sellerOrgId: string): boolean {
    const contract = contracts.find((c) => c.sellerId === sellerOrgId);
    return (contract?.activeTermCount ?? 0) > 0;
  }

  // Handle "Add to Network" click
  async function handleAddLocation(location: NetworkLocationItem) {
    if (sellerHasActiveTerms(location.sellerOrgId)) {
      // Already have terms for this seller — add directly with pricing snapshot
      try {
        const pricingData = await loadSellerPricing(location.contractId);
        const pricingSnapshot = {
          services: pricingData.services,
          snapshotAt: new Date().toISOString(),
        };
        await addLocationTerm(location.contractId, location.sellerLocationId, pricingSnapshot);
        await refresh();
        toast.success("Location added to network");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add location");
      }
    } else {
      // First location from this seller — show pricing acceptance modal
      setPricingModal({
        contractId: location.contractId,
        sellerLocationId: location.sellerLocationId,
      });
    }
  }

  // Handle "Remove" click
  function handleRemoveLocation(location: NetworkLocationItem) {
    setRemoveModal({
      contractId: location.contractId,
      sellerLocationId: location.sellerLocationId,
      locationName: location.locationName,
    });
  }

  if (loading) {
    return <div className="text-muted text-sm py-8 text-center">Loading network...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4">
          <h3 className="text-base font-heading font-semibold mb-1">Care Network</h3>
          <p className="text-sm text-muted">
            Your network of care delivery locations.
            {marketplaceEnabled
              ? " Toggle the marketplace to browse and add available seller locations."
              : " Sellers contracted to your organization appear here automatically."}
          </p>
        </div>

        {/* Search, Filters & View Toggle */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                label=""
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search locations or sellers..."
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                label=""
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Services" },
                  ...allServiceTypes,
                ]}
              />
            </div>
            <div className="w-full sm:w-32">
              <Select
                label=""
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                options={[
                  { value: "all", label: "All States" },
                  ...uniqueStates.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>
          </div>

          {/* View toggle + Marketplace toggle */}
          <div className="flex justify-between items-center">
            {/* Marketplace toggle */}
            {marketplaceEnabled && !disabled ? (
              <Checkbox
                name="show-marketplace"
                checked={showMarketplace}
                onChange={() => setShowMarketplace((v) => !v)}
                label="Show Marketplace"
              />
            ) : (
              <div />
            )}

            {/* View toggle */}
            <div className="inline-flex rounded-lg border border-border/50 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === "list"
                    ? "bg-brand-teal text-white"
                    : "bg-white text-muted hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  List
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === "map"
                    ? "bg-brand-teal text-white"
                    : "bg-white text-muted hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Map
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* View content */}
        {viewMode === "list" ? (
          <NetworkListView
            locations={locations}
            searchQuery={searchQuery}
            serviceFilter={serviceFilter}
            stateFilter={stateFilter}
            showMarketplace={showMarketplace}
            onAddLocation={!disabled ? handleAddLocation : undefined}
            onRemoveLocation={!disabled ? handleRemoveLocation : undefined}
          />
        ) : (
          <NetworkMapView
            locations={locations}
            searchQuery={searchQuery}
            serviceFilter={serviceFilter}
            stateFilter={stateFilter}
            showMarketplace={showMarketplace}
            onToggleMarketplace={() => setShowMarketplace((v) => !v)}
            affiliateOrgId={affiliateOrgId}
            onAddLocation={!disabled ? handleAddLocation : undefined}
            onRemoveLocation={!disabled ? handleRemoveLocation : undefined}
          />
        )}

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/50">
          <p className="text-sm text-muted">
            {includedCount} location{includedCount !== 1 ? "s" : ""} in your network
            {showMarketplace && availableCount > 0 && (
              <span className="text-amber-600"> &middot; {availableCount} available to add</span>
            )}
          </p>
        </div>
      </Card>

      <div className="flex justify-between pb-4">
        <Button variant="secondary" type="button" onClick={() => onNavigate(4)}>
          &larr; Previous
        </Button>
        <Button variant="cta" type="button" onClick={() => onNavigate(9)}>
          Save &amp; Next &rarr;
        </Button>
      </div>

      {pricingModal && (
        <PricingAcceptanceModal
          contractId={pricingModal.contractId}
          sellerLocationId={pricingModal.sellerLocationId}
          onClose={() => setPricingModal(null)}
          onAccepted={() => {
            setPricingModal(null);
            refresh();
            toast.success("Pricing accepted — location added to network");
          }}
        />
      )}

      {removeModal && (
        <RemoveLocationModal
          contractId={removeModal.contractId}
          sellerLocationId={removeModal.sellerLocationId}
          locationName={removeModal.locationName}
          onClose={() => setRemoveModal(null)}
          onRemoved={() => {
            setRemoveModal(null);
            refresh();
            toast.success("Location removed from network");
          }}
        />
      )}
    </div>
  );
}
