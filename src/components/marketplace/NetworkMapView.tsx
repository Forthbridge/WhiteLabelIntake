"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Map, { Marker, Popup, Source, Layer, type MapRef } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/Button";
import { LocationCard } from "./LocationCard";
import type { NetworkLocationItem } from "@/lib/actions/network";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

function milesToMeters(miles: number) {
  return miles * 1609.34;
}

const SELF_OWNED_COLOR = "#DC2626"; // Red — reserved for current user's locations

// Simple hash to generate consistent colors per seller org (red excluded)
function orgColor(orgId: string): string {
  const colors = ["#0D9488", "#2563EB", "#0369A1", "#7C3AED", "#059669", "#DB2777", "#0891B2"];
  let hash = 0;
  for (let i = 0; i < orgId.length; i++) {
    hash = orgId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const AMBER_COLOR = "#D97706";

/* ---------- Compact seller multi-select for map overlay ---------- */
function MapSellerMultiSelect({
  sellers,
  selected,
  onChange,
}: {
  sellers: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        ? sellers.find((s) => s.id === selected[0])?.name ?? "1 seller"
        : `${selected.length} sellers`;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium px-2.5 py-1 rounded-md border border-border/50 bg-white text-foreground transition-colors cursor-pointer flex items-center gap-1"
      >
        <span className="truncate max-w-[120px]">{label}</span>
        <svg className={`w-3 h-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 max-h-48 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-brand-teal hover:bg-surface"
            >
              Clear filter
            </button>
          )}
          {sellers.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="rounded border-border text-brand-teal focus:ring-brand-teal/30"
              />
              <span className="truncate">{s.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  locations: NetworkLocationItem[];
  contracts?: { contractId: string; sellerId: string; priceListId?: string | null }[];
  searchQuery: string;
  serviceFilter: string;
  stateFilter: string;
  sellerFilter: string[];
  showMarketplace?: boolean;
  onToggleMarketplace?: () => void;
  onSellerFilterChange?: (value: string[]) => void;
  sellers: { id: string; name: string }[];
  affiliateOrgId?: string;
  onAddLocation?: (location: NetworkLocationItem) => void;
  onRemoveLocation?: (location: NetworkLocationItem) => void;
  onAddAllFromSeller?: (sellerOrgId: string) => void;
  onRemoveAllFromSeller?: (sellerOrgId: string) => void;
  onChangePriceList?: (sellerOrgId: string, contractId: string) => void;
}

export function NetworkMapView({
  locations,
  contracts,
  searchQuery,
  serviceFilter,
  stateFilter,
  sellerFilter,
  showMarketplace,
  onToggleMarketplace,
  onSellerFilterChange,
  sellers,
  affiliateOrgId,
  onAddLocation,
  onRemoveLocation,
  onAddAllFromSeller,
  onRemoveAllFromSeller,
  onChangePriceList,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [fullscreen, setFullscreen] = useState(false);

  // Escape key to exit fullscreen + scroll lock
  useEffect(() => {
    if (!fullscreen) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [fullscreen]);

  function matchesFilters(loc: NetworkLocationItem): boolean {
    if (!loc.latitude || !loc.longitude) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        loc.locationName.toLowerCase().includes(q) ||
        loc.sellerOrgName?.toLowerCase().includes(q) ||
        loc.city.toLowerCase().includes(q) ||
        loc.state.toLowerCase().includes(q);
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
  }

  // Network locations (included in network, with coords)
  const networkPins = locations.filter(
    (loc) => loc.included && matchesFilters(loc),
  );

  // Marketplace locations (not yet included, with coords)
  const marketplacePins = showMarketplace
    ? locations.filter(
        (loc) => !loc.isSelfOwned && !loc.included && matchesFilters(loc),
      )
    : [];

  const allPins = [...networkPins, ...marketplacePins];

  // Also show locations without coords in the list (but not on map)
  const listOnly = locations.filter((loc) => {
    if (loc.latitude && loc.longitude) return false;
    const isNetwork = loc.included;
    const isMarketplace = showMarketplace && !loc.isSelfOwned && !loc.included;
    if (!isNetwork && !isMarketplace) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        loc.locationName.toLowerCase().includes(q) ||
        loc.sellerOrgName?.toLowerCase().includes(q);
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

  const allListItems = [...allPins, ...listOnly];
  const selectedLoc = allPins.find((l) => l.id === selectedId);

  // Compute map bounds from all visible locations
  const defaultCenter = { latitude: 39.8283, longitude: -98.5795 };
  const defaultZoom = 3.5;

  const hasCoords = allPins.length > 0;
  const center = hasCoords
    ? {
        latitude: allPins.reduce((sum, l) => sum + l.latitude!, 0) / allPins.length,
        longitude: allPins.reduce((sum, l) => sum + l.longitude!, 0) / allPins.length,
      }
    : defaultCenter;
  const zoom = hasCoords ? (allPins.length === 1 ? 12 : 6) : defaultZoom;

  // Scroll list item into view when pin is clicked
  useEffect(() => {
    if (selectedId && listRef.current) {
      const el = listRef.current.querySelector(`[data-loc-id="${selectedId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const handleListHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  const handleListClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    const loc = allPins.find((l) => l.id === id);
    if (loc?.latitude && loc?.longitude && mapRef.current) {
      mapRef.current.flyTo({
        center: [loc.longitude, loc.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 8),
        duration: 1000,
      });
    }
  }, [allPins]);

  // GeoJSON for coverage circles (network + marketplace locations)
  const coverageGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      ...networkPins.map((loc) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [loc.longitude!, loc.latitude!],
        },
        properties: {
          color: loc.isSelfOwned ? SELF_OWNED_COLOR : orgColor(loc.sellerOrgId),
          locId: loc.id,
        },
      })),
      ...(showMarketplace
        ? marketplacePins.map((loc) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [loc.longitude!, loc.latitude!],
            },
            properties: {
              color: AMBER_COLOR,
              locId: loc.id,
            },
          }))
        : []),
    ],
  };

  const metersAtMaxZoom = milesToMeters(radiusMiles) / 0.019;

  const coverageLayer: LayerProps = {
    id: "coverage-circles",
    type: "circle",
    paint: {
      "circle-radius": [
        "interpolate",
        ["exponential", 2],
        ["zoom"],
        0, 0,
        22, metersAtMaxZoom,
      ],
      "circle-color": ["get", "color"],
      "circle-opacity": selectedId
        ? ["case", ["==", ["get", "locId"], selectedId], 0.12, 0.03]
        : 0.12,
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": 1,
      "circle-stroke-opacity": selectedId
        ? ["case", ["==", ["get", "locId"], selectedId], 0.3, 0.08]
        : 0.3,
    },
  };

  if (allListItems.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">No locations to display on map.</p>
      </div>
    );
  }

  // Group network items by seller for "Remove All" headers
  const networkItems = allListItems.filter((l) => l.included);
  const networkBySellerMap: Record<string, { name: string; isSelfOwned: boolean; locs: NetworkLocationItem[] }> = {};
  for (const loc of networkItems) {
    if (!networkBySellerMap[loc.sellerOrgId]) {
      networkBySellerMap[loc.sellerOrgId] = { name: loc.sellerOrgName || "Unknown", isSelfOwned: loc.isSelfOwned, locs: [] };
    }
    networkBySellerMap[loc.sellerOrgId].locs.push(loc);
  }
  const networkSellers = Object.entries(networkBySellerMap).sort((a, b) => a[1].name.localeCompare(b[1].name));

  // Group marketplace items by seller for "Add All" headers
  const marketplaceItems = allListItems.filter((l) => !l.included && !l.isSelfOwned);
  const marketplaceBySellerMap: Record<string, { name: string; locs: NetworkLocationItem[] }> = {};
  for (const loc of marketplaceItems) {
    if (!marketplaceBySellerMap[loc.sellerOrgId]) {
      marketplaceBySellerMap[loc.sellerOrgId] = { name: loc.sellerOrgName || "Unknown", locs: [] };
    }
    marketplaceBySellerMap[loc.sellerOrgId].locs.push(loc);
  }
  const marketplaceSellers = Object.entries(marketplaceBySellerMap).sort((a, b) => a[1].name.localeCompare(b[1].name));

  const renderListItem = (loc: NetworkLocationItem) => {
    const isAvailable = !loc.included && !loc.isSelfOwned;
    return (
      <div
        key={loc.id}
        data-loc-id={loc.id}
        className={`p-3 border-b cursor-pointer transition-colors ${
          isAvailable ? "border-amber-200 bg-amber-50/30" : "border-border/30"
        } ${
          hoveredId === loc.id || selectedId === loc.id
            ? "bg-brand-teal/5"
            : "hover:bg-surface-hover"
        }`}
        onMouseEnter={() => handleListHover(loc.id)}
        onMouseLeave={() => handleListHover(null)}
        onClick={() => handleListClick(loc.id)}
      >
        <div className="flex justify-between items-start">
          <p className="text-sm font-medium text-foreground truncate">{loc.locationName || "Unnamed"}</p>
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            {loc.isSelfOwned && (
              <span className="text-[9px] font-medium bg-brand-teal/10 text-brand-teal px-1 py-0.5 rounded">
                Yours
              </span>
            )}
            {loc.included && !loc.isSelfOwned && (
              <span className="text-[9px] font-medium bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                Affiliate
              </span>
            )}
            {isAvailable && (
              <span className="text-[9px] font-medium bg-amber-100 text-amber-700 px-1 py-0.5 rounded">
                Available
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted truncate">{loc.sellerOrgName}</p>
        <p className="text-xs text-muted truncate">
          {[loc.streetAddress, loc.city, loc.state].filter(Boolean).join(", ")}
        </p>
        {loc.services.length > 0 && (
          <p className="text-[10px] text-muted mt-0.5 truncate">
            {loc.services.slice(0, 3).join(" \u00B7 ")}
            {loc.services.length > 3 ? ` +${loc.services.length - 3}` : ""}
          </p>
        )}
        {!loc.latitude && (
          <p className="text-[10px] text-amber-500 mt-0.5">No coordinates</p>
        )}
      </div>
    );
  };

  const renderListPanel = () => (
    <div ref={listRef} className="w-72 flex-shrink-0 overflow-y-auto border-r border-border/50 bg-surface">
      {/* Network locations — grouped by seller */}
      {networkSellers.map(([sellerOrgId, { name, isSelfOwned, locs }]) => (
        <div key={sellerOrgId}>
          {/* Seller group header (show when multiple sellers or non-self-owned with >1 loc) */}
          {(networkSellers.length > 1 || (!isSelfOwned && locs.length > 1)) && (
            <div className="px-3 py-1.5 bg-surface border-b border-border/30 flex justify-between items-center">
              <p className="text-[10px] font-medium text-foreground truncate">
                {name} ({locs.length})
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onChangePriceList && !isSelfOwned && (() => {
                  const contract = contracts?.find(c => c.sellerId === sellerOrgId);
                  return contract?.priceListId ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onChangePriceList(sellerOrgId, contract.contractId); }}
                      className="text-[9px] font-medium text-brand-teal hover:underline flex-shrink-0"
                    >
                      Change Price List
                    </button>
                  ) : null;
                })()}
                {onRemoveAllFromSeller && !isSelfOwned && locs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveAllFromSeller(sellerOrgId); }}
                    className="text-[9px] font-medium text-error hover:text-error/80 underline underline-offset-2 flex-shrink-0"
                  >
                    Remove All
                  </button>
                )}
              </div>
            </div>
          )}
          {locs.map(renderListItem)}
        </div>
      ))}

      {/* Marketplace locations grouped by seller */}
      {marketplaceSellers.length > 0 && (
        <>
          {networkItems.length > 0 && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                Available to Add ({marketplaceItems.length})
              </p>
            </div>
          )}
          {marketplaceSellers.map(([sellerOrgId, { name, locs }]) => (
            <div key={sellerOrgId}>
              {/* Seller group header */}
              <div className="px-3 py-1.5 bg-amber-50/60 border-b border-amber-200/50 flex justify-between items-center">
                <p className="text-[10px] font-medium text-amber-800 truncate">
                  {name} ({locs.length})
                </p>
                {onAddAllFromSeller && locs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAddAllFromSeller(sellerOrgId); }}
                    className="text-[9px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 flex-shrink-0"
                  >
                    Add All
                  </button>
                )}
              </div>
              {locs.map(renderListItem)}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderMapPanel = () => (
    <div className="flex-1 relative">
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: center.latitude,
          longitude: center.longitude,
          zoom,
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        {showCoverage && (
          <Source id="coverage-source" type="geojson" data={coverageGeoJSON}>
            <Layer {...coverageLayer} />
          </Source>
        )}

        {/* Network pins — single-color for self-owned, two-tone for affiliate */}
        {networkPins.map((loc) => {
          const isActive = hoveredId === loc.id || selectedId === loc.id;
          const sellerColor = orgColor(loc.sellerOrgId);

          return (
            <Marker
              key={loc.id}
              latitude={loc.latitude!}
              longitude={loc.longitude!}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedId((prev) => (prev === loc.id ? null : loc.id));
              }}
            >
              <div
                className="transition-transform"
                style={{ transform: isActive ? "scale(1.3)" : "scale(1)" }}
                onMouseEnter={() => setHoveredId(loc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {loc.isSelfOwned ? (
                  <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                    <path
                      d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
                      fill={SELF_OWNED_COLOR}
                      opacity={isActive ? 1 : 0.85}
                    />
                    <circle cx="12" cy="11" r="4" fill="white" />
                  </svg>
                ) : (
                  <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                    <defs>
                      <clipPath id={`top-${loc.id}`}><rect x="0" y="0" width="24" height="16" /></clipPath>
                      <clipPath id={`bot-${loc.id}`}><rect x="0" y="16" width="24" height="16" /></clipPath>
                    </defs>
                    <path
                      d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
                      fill={SELF_OWNED_COLOR}
                      opacity={isActive ? 1 : 0.85}
                      clipPath={`url(#top-${loc.id})`}
                    />
                    <path
                      d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
                      fill={sellerColor}
                      opacity={isActive ? 1 : 0.85}
                      clipPath={`url(#bot-${loc.id})`}
                    />
                    <circle cx="12" cy="11" r="4" fill="white" />
                  </svg>
                )}
              </div>
            </Marker>
          );
        })}

        {/* Marketplace pins (amber) */}
        {marketplacePins.map((loc) => {
          const isActive = hoveredId === loc.id || selectedId === loc.id;

          return (
            <Marker
              key={loc.id}
              latitude={loc.latitude!}
              longitude={loc.longitude!}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedId((prev) => (prev === loc.id ? null : loc.id));
              }}
            >
              <div
                className="transition-transform"
                style={{ transform: isActive ? "scale(1.3)" : "scale(1)" }}
                onMouseEnter={() => setHoveredId(loc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                  <path
                    d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
                    fill={AMBER_COLOR}
                    opacity={isActive ? 1 : 0.7}
                    strokeDasharray="4 2"
                  />
                  <circle cx="12" cy="11" r="4" fill="white" />
                </svg>
              </div>
            </Marker>
          );
        })}

        {selectedLoc && (
          <Popup
            latitude={selectedLoc.latitude!}
            longitude={selectedLoc.longitude!}
            anchor="bottom"
            offset={[0, -32]}
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            className="network-map-popup"
          >
            <LocationCard
              location={selectedLoc}
              compact
              onAdd={
                !selectedLoc.included && !selectedLoc.isSelfOwned && onAddLocation
                  ? () => onAddLocation(selectedLoc)
                  : undefined
              }
              onRemove={
                selectedLoc.included && !selectedLoc.isSelfOwned && onRemoveLocation
                  ? () => onRemoveLocation(selectedLoc)
                  : undefined
              }
            />
          </Popup>
        )}
      </Map>

      {/* Expand/collapse button — top-right of map */}
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-lg p-1.5 shadow-sm border border-border/40 text-muted hover:text-foreground transition-colors z-10"
        title={fullscreen ? "Exit fullscreen" : "Expand map"}
      >
        {fullscreen ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 1 6 6 1 6" />
            <polyline points="10 15 10 10 15 10" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 6 1 1 6 1" />
            <polyline points="15 10 15 15 10 15" />
          </svg>
        )}
      </button>

      {/* Coverage controls */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-sm border border-border/40">
        <button
          type="button"
          onClick={() => setShowCoverage((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            showCoverage ? "text-brand-teal" : "text-muted hover:text-foreground"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          Coverage
        </button>
        {showCoverage && (
          <>
            <div className="w-px h-4 bg-border/60" />
            <input
              type="range"
              min={1}
              max={25}
              step={1}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              className="w-20 h-1 accent-brand-teal"
            />
            <span className="text-xs text-muted tabular-nums w-8">{radiusMiles} mi</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Inline container — invisible when fullscreen to preserve layout space */}
      <div
        className={`flex rounded-lg border border-border/50 overflow-hidden ${fullscreen ? "invisible" : ""}`}
        style={{ height: "480px" }}
      >
        {!fullscreen && (
          <>
            {renderListPanel()}
            {renderMapPanel()}
          </>
        )}
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Status bar */}
          <div className="flex-shrink-0 border-b border-border/50 px-4 py-2 text-sm flex items-center justify-between">
            <div>
              <span className="text-muted">{networkPins.length} location{networkPins.length !== 1 ? "s" : ""} in your network</span>
              {showMarketplace && (
                <>
                  <span className="text-muted"> · </span>
                  <span className="text-amber-600 font-medium">{marketplacePins.length} available to add</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onSellerFilterChange && sellers.length > 1 && (
                <MapSellerMultiSelect
                  sellers={sellers}
                  selected={sellerFilter}
                  onChange={onSellerFilterChange}
                />
              )}
              {onToggleMarketplace && (
                <button
                  type="button"
                  onClick={onToggleMarketplace}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                    showMarketplace
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-white border-border/50 text-muted hover:text-foreground"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h18v18H3z" />
                    <path d="M12 3v18" />
                    <path d="M3 12h18" />
                  </svg>
                  Marketplace
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            {renderListPanel()}
            {renderMapPanel()}
          </div>
        </div>
      )}
    </>
  );
}
