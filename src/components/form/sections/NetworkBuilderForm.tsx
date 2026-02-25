"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { NetworkListView } from "@/components/marketplace/NetworkListView";
import { PricingReviewModal } from "@/components/marketplace/PricingReviewModal";
import { RemoveLocationModal } from "@/components/marketplace/RemoveLocationModal";
import { RemoveAllModal } from "@/components/marketplace/RemoveAllModal";
import { ChangePriceListModal } from "@/components/marketplace/ChangePriceListModal";
import { loadNetworkData } from "@/lib/actions/network";
import type { NetworkLocationItem, NetworkContractSummary } from "@/lib/actions/network";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SectionNavButtons } from "../SectionNavButtons";

// Lazy-load the map to avoid SSR issues with mapbox-gl
const NetworkMapView = dynamic(
  () => import("@/components/marketplace/NetworkMapView").then((m) => m.NetworkMapView),
  { ssr: false, loading: () => <div className="h-[480px] bg-surface rounded-lg flex items-center justify-center text-sm text-muted">Loading map...</div> },
);

type ViewMode = "list" | "map";

/* ---------- Seller multi-select dropdown ---------- */
function SellerMultiSelect({
  sellers,
  selected,
  onChange,
}: {
  sellers: [string, string][]; // [id, name]
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const label =
    selected.length === 0
      ? "All Sellers"
      : selected.length === 1
        ? sellers.find(([id]) => id === selected[0])?.[1] ?? "1 seller"
        : `${selected.length} sellers`;

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  return (
    <div className="w-full sm:w-52 relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm transition-colors hover:border-brand-teal/40 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
      >
        <span className={selected.length === 0 ? "text-muted" : "text-foreground truncate"}>
          {label}
        </span>
        <svg className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && sellers.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-brand-teal hover:bg-surface"
            >
              Clear filter
            </button>
          )}
          {sellers.map(([id, name]) => (
            <label
              key={id}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => toggle(id)}
                className="rounded border-border text-brand-teal focus:ring-brand-teal/30"
              />
              <span className="truncate">{name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  onNavigate: (sectionId: number) => void;
  disabled?: boolean;
  programId?: string | null;
}

export function NetworkBuilderForm({ onNavigate, disabled, programId }: Props) {
  const [locations, setLocations] = useState<NetworkLocationItem[]>([]);
  const [contracts, setContracts] = useState<NetworkContractSummary[]>([]);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false);
  const [affiliateOrgId, setAffiliateOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [showMarketplace, setShowMarketplace] = useState(false);

  // Pricing review modal state (single or bulk)
  const [pricingModal, setPricingModal] = useState<{
    contractId: string;
    sellerLocationIds: string[];
    sellerName: string;
    sellerId: string;
  } | null>(null);

  // Remove location modal state
  const [removeModal, setRemoveModal] = useState<{
    contractId: string;
    sellerLocationId: string;
    locationName: string;
  } | null>(null);

  // Change price list modal state
  const [changePriceListModal, setChangePriceListModal] = useState<{
    contractId: string;
    sellerName: string;
    locationCount: number;
    locationNames: string[];
  } | null>(null);

  // Remove all modal state
  const [removeAllModal, setRemoveAllModal] = useState<{
    contractId: string;
    sellerLocationIds: string[];
    sellerName: string;
    locationNames: string[];
  } | null>(null);

  const refresh = useCallback(async () => {
    const data = await loadNetworkData(programId ?? undefined);
    setLocations(data.locations);
    setContracts(data.contracts);
    setMarketplaceEnabled(data.marketplaceEnabled);
    setAffiliateOrgId(data.affiliateOrgId);
  }, [programId]);

  useEffect(() => {
    setLoading(true);
    refresh().then(() => setLoading(false)).catch((err) => {
      console.error("Failed to load network data:", err);
      setLoading(false);
    });
  }, [refresh]);

  const includedCount = locations.filter((l) => l.included).length;
  const availableCount = showMarketplace
    ? locations.filter((l) => !l.isSelfOwned && !l.included).length
    : 0;

  // Visible locations — exclude marketplace sellers when toggled off
  const visibleLocations = showMarketplace
    ? locations
    : locations.filter((l) => l.included);

  // Unique states from visible locations for filter
  const uniqueStates = Array.from(new Set(visibleLocations.map((l) => l.state).filter(Boolean))).sort();

  // Unique sellers from visible locations for filter
  const uniqueSellers = Array.from(
    new Map(visibleLocations.map((l) => [l.sellerOrgId, l.sellerOrgName || "Unknown"])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Combined service type options
  const allServiceTypes = [
    ...SELLER_SERVICE_TYPES.map((st) => ({ value: st.value, label: st.label })),
    ...SERVICE_TYPES
      .filter((st) => !SELLER_SERVICE_TYPES.find((sst) => sst.value === st.value))
      .map((st) => ({ value: st.value, label: st.label })),
  ];

  // Handle "Add to Network" click (single location)
  function handleAddLocation(location: NetworkLocationItem) {
    setPricingModal({
      contractId: location.contractId,
      sellerLocationIds: [location.sellerLocationId],
      sellerName: location.sellerOrgName || "Unknown",
      sellerId: location.sellerOrgId,
    });
  }

  // Handle "Add All" for a seller (bulk)
  function handleAddAllFromSeller(sellerOrgId: string) {
    const sellerLocs = locations.filter(
      (l) => l.sellerOrgId === sellerOrgId && !l.included && !l.isSelfOwned,
    );
    if (sellerLocs.length === 0) return;
    const contract = contracts.find((c) => c.sellerId === sellerOrgId);
    if (!contract) return;
    setPricingModal({
      contractId: contract.contractId,
      sellerLocationIds: sellerLocs.map((l) => l.sellerLocationId),
      sellerName: contract.sellerName || "Unknown",
      sellerId: sellerOrgId,
    });
  }

  // Handle "Remove" click
  function handleRemoveLocation(location: NetworkLocationItem) {
    setRemoveModal({
      contractId: location.contractId,
      sellerLocationId: location.sellerLocationId,
      locationName: location.locationName,
    });
  }

  // Handle "Remove All" for a seller (bulk)
  function handleRemoveAllFromSeller(sellerOrgId: string) {
    const sellerLocs = locations.filter(
      (l) => l.sellerOrgId === sellerOrgId && l.included && !l.isSelfOwned,
    );
    if (sellerLocs.length === 0) return;
    const contract = contracts.find((c) => c.sellerId === sellerOrgId);
    if (!contract) return;
    setRemoveAllModal({
      contractId: contract.contractId,
      sellerLocationIds: sellerLocs.map((l) => l.sellerLocationId),
      sellerName: contract.sellerName || "Unknown",
      locationNames: sellerLocs.map((l) => l.locationName),
    });
  }

  // Handle "Change Price List" for a seller
  function handleChangePriceList(sellerOrgId: string, contractId: string) {
    const sellerLocs = locations.filter(
      (l) => l.sellerOrgId === sellerOrgId && l.included && !l.isSelfOwned,
    );
    if (sellerLocs.length === 0) return;
    setChangePriceListModal({
      contractId,
      sellerName: sellerLocs[0]?.sellerOrgName || "Unknown",
      locationCount: sellerLocs.length,
      locationNames: sellerLocs.map((l) => l.locationName),
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
            Your members get care at these locations. Add your own locations or browse the marketplace to partner with sellers.
            {marketplaceEnabled
              ? " Toggle the marketplace to browse and add available seller locations."
              : ""}
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
            <SellerMultiSelect
              sellers={uniqueSellers}
              selected={sellerFilter}
              onChange={setSellerFilter}
            />
          </div>

          {/* View toggle + Marketplace toggle */}
          <div className="flex justify-between items-center">
            {/* Marketplace toggle */}
            {marketplaceEnabled && !disabled ? (
              <Checkbox
                name="show-marketplace"
                checked={showMarketplace}
                onChange={() => {
                  setShowMarketplace((v) => {
                    // Reset filters when hiding marketplace (filtered values may not exist in contracted set)
                    if (v) { setSellerFilter([]); setStateFilter("all"); }
                    return !v;
                  });
                }}
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
            contracts={contracts}
            searchQuery={searchQuery}
            serviceFilter={serviceFilter}
            stateFilter={stateFilter}
            sellerFilter={sellerFilter}
            showMarketplace={showMarketplace}
            onAddLocation={!disabled ? handleAddLocation : undefined}
            onRemoveLocation={!disabled ? handleRemoveLocation : undefined}
            onAddAllFromSeller={!disabled ? handleAddAllFromSeller : undefined}
            onRemoveAllFromSeller={!disabled ? handleRemoveAllFromSeller : undefined}
            onChangePriceList={!disabled ? handleChangePriceList : undefined}
          />
        ) : (
          <NetworkMapView
            locations={locations}
            contracts={contracts}
            searchQuery={searchQuery}
            serviceFilter={serviceFilter}
            stateFilter={stateFilter}
            sellerFilter={sellerFilter}
            showMarketplace={showMarketplace}
            onToggleMarketplace={marketplaceEnabled && !disabled ? () => {
              setShowMarketplace((v) => {
                if (v) setSellerFilter([]);
                return !v;
              });
            } : undefined}
            onSellerFilterChange={setSellerFilter}
            sellers={uniqueSellers.map(([id, name]) => ({ id, name }))}
            affiliateOrgId={affiliateOrgId}
            onAddLocation={!disabled ? handleAddLocation : undefined}
            onRemoveLocation={!disabled ? handleRemoveLocation : undefined}
            onAddAllFromSeller={!disabled ? handleAddAllFromSeller : undefined}
            onRemoveAllFromSeller={!disabled ? handleRemoveAllFromSeller : undefined}
            onChangePriceList={!disabled ? handleChangePriceList : undefined}
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

      <SectionNavButtons currentSection={5} onNavigate={onNavigate} />

      {pricingModal && (
        <PricingReviewModal
          contractId={pricingModal.contractId}
          sellerLocationIds={pricingModal.sellerLocationIds}
          sellerName={pricingModal.sellerName}
          sellerId={pricingModal.sellerId}
          programId={programId ?? null}
          onClose={() => setPricingModal(null)}
          onAccepted={() => {
            setPricingModal(null);
            refresh();
            const count = pricingModal.sellerLocationIds.length;
            toast.success(
              count > 1
                ? `${count} locations added to network`
                : "Location added to network",
            );
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

      {changePriceListModal && (
        <ChangePriceListModal
          contractId={changePriceListModal.contractId}
          sellerName={changePriceListModal.sellerName}
          locationCount={changePriceListModal.locationCount}
          locationNames={changePriceListModal.locationNames}
          programId={programId ?? undefined}
          onClose={() => setChangePriceListModal(null)}
          onChanged={() => {
            const name = changePriceListModal.sellerName;
            setChangePriceListModal(null);
            refresh();
            toast.success(`Price list cleared for ${name}. Re-add locations to select new pricing.`);
          }}
        />
      )}

      {removeAllModal && (
        <RemoveAllModal
          contractId={removeAllModal.contractId}
          sellerLocationIds={removeAllModal.sellerLocationIds}
          sellerName={removeAllModal.sellerName}
          locationNames={removeAllModal.locationNames}
          onClose={() => setRemoveAllModal(null)}
          onRemoved={() => {
            const count = removeAllModal.sellerLocationIds.length;
            setRemoveAllModal(null);
            refresh();
            toast.success(`${count} location${count !== 1 ? "s" : ""} removed from network`);
          }}
        />
      )}
    </div>
  );
}
