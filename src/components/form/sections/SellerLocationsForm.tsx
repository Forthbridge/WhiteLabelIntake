"use client";

import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { saveSellerLocations, deleteSellerLocation } from "@/lib/actions/seller-locations";
import type { SellerLocationsData, SellerLocationData } from "@/lib/actions/seller-locations";
import { defaultWeeklySchedule } from "@/lib/validations/section5";
import type { DaySchedule } from "@/lib/validations/section5";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import { SELLER_SERVICE_TYPES } from "@/lib/validations/seller-services";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import { saveLocationServices, initLocationFromOrgDefaults, resetLocationToDefaults } from "@/lib/actions/location-services";
import type { LocationServiceState } from "@/lib/actions/location-services";
import { SubServiceModal } from "@/components/ui/SubServiceModal";
import { CSVUploadButton } from "@/components/ui/CSVUploadButton";
import { LOCATION_CSV_COLUMNS, locationCSVRowSchema } from "@/lib/csv/locationColumns";
import type { LocationCSVRow } from "@/lib/csv/locationColumns";
import type { Section11Data } from "@/lib/validations/section11";
import type { SellerPricingData } from "@/lib/validations/seller-pricing";
import type { CompletionStatus, SellerSectionId } from "@/types";
import { SellerSectionNavButtons } from "../SellerSectionNavButtons";
import { useReportDirty, useSellerCacheUpdater } from "../OnboardingClient";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
].map((s) => ({ value: s, label: s }));

const ACCESS_OPTIONS = [
  { value: "walk_in", label: "Walk-in accepted" },
  { value: "appointment_only", label: "Appointment only" },
  { value: "both", label: "Both" },
];

const SCHEDULING_OPTIONS = [
  { value: "office_365", label: "Office 365" },
  { value: "google_calendar", label: "Google Calendar" },
  { value: "other", label: "Other" },
];

function emptyLocation(): SellerLocationData {
  return {
    locationName: "", streetAddress: "", streetAddress2: "", city: "", state: "", zip: "",
    closeByDescription: "", locationNpi: "", phoneNumber: "",
    hoursOfOperation: "", accessType: null,
    hasOnSiteLabs: false, hasOnSiteRadiology: false, hasOnSitePharmacy: false,
    weeklySchedule: defaultWeeklySchedule(),
    schedulingSystemOverride: null,
    schedulingOverrideOtherName: null,
    schedulingOverrideAcknowledged: false,
    schedulingIntegrations: [],
  };
}

function essentialsFilled(loc: SellerLocationData): boolean {
  return !!(loc.locationName && loc.streetAddress && loc.city && loc.state && loc.zip && loc.phoneNumber && loc.locationNpi);
}

function locationHasData(loc: SellerLocationData): boolean {
  if (loc.id) return true;
  return !!(loc.locationName || loc.streetAddress || loc.city || loc.state || loc.zip || loc.phoneNumber || loc.locationNpi);
}

function locationComplete(loc: SellerLocationData): boolean {
  if (!essentialsFilled(loc)) return false;
  if (!loc.accessType) return false;
  const hasHours = (loc.weeklySchedule ?? []).some((d) => !d.closed && d.openTime && d.closeTime);
  return hasHours;
}

function formatAddress(loc: SellerLocationData): string {
  const parts = [loc.streetAddress];
  if (loc.streetAddress2) parts.push(loc.streetAddress2);
  if (loc.city) parts.push(loc.city);
  if (loc.state) parts[parts.length - 1] += ",";
  if (loc.state) parts.push(loc.state);
  if (loc.zip) parts.push(loc.zip);
  return parts.filter(Boolean).join(" ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AddressAutofill = dynamic(() => import("@mapbox/search-js-react").then((m) => m.AddressAutofill) as any, { ssr: false }) as React.ComponentType<{ accessToken: string; onRetrieve: (response: any) => void; options?: Record<string, unknown>; children: React.ReactNode }>;
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface SellerLocationsFormProps {
  initialData: SellerLocationsData;
  sellerServiceOfferings: Array<{ serviceType: string; selected: boolean }>;
  locationServices?: Record<string, LocationServiceState>;
  orgSubServices?: Section11Data;
  orgPricing?: SellerPricingData;
  onNavigate: (sectionId: string) => void;
  onStatusUpdate: (statuses: Record<string, string>) => void;
  disabled?: boolean;
}

export function SellerLocationsForm({ initialData, sellerServiceOfferings, locationServices: initialLocationServices, orgSubServices, orgPricing, onNavigate, onStatusUpdate, disabled }: SellerLocationsFormProps) {
  const [locServices, setLocServices] = useState<Record<string, LocationServiceState>>(initialLocationServices ?? {});
  const [modalTarget, setModalTarget] = useState<{ locId: string; serviceType: string } | null>(null);
  const [customizingLoc, setCustomizingLoc] = useState<string | null>(null);
  const [resettingLoc, setResettingLoc] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [_data, _setData] = useState<SellerLocationsData>(() => {
    if (initialData.locations.length === 0) {
      return { ...initialData, locations: [emptyLocation()] };
    }
    return {
      ...initialData,
      locations: initialData.locations.map((loc) => ({
        ...loc,
        weeklySchedule: loc.weeklySchedule?.length ? loc.weeklySchedule : defaultWeeklySchedule(),
      })),
    };
  });

  // Dirty tracking — simple flag, set on any edit, cleared on save
  const [isDirty, setIsDirty] = useState(false);
  useReportDirty("S-2", isDirty);

  // Wrap setData so every mutation automatically marks dirty
  const data = _data;
  const setData: typeof _setData = useCallback((action) => {
    setIsDirty(true);
    _setData(action);
  }, []);

  const updateSellerCache = useSellerCacheUpdater();

  // Ref so handleSave always reads latest locServices without re-creating
  const locServicesRef = useRef(locServices);
  locServicesRef.current = locServices;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveSellerLocations(data);
      // Assign server-generated IDs back (use raw setter — this isn't a user edit)
      _setData((prev) => {
        const updated = prev.locations.map((l, i) =>
          l.id !== result.locationIds[i] ? { ...l, id: result.locationIds[i] } : l
        );
        return updated.some((l, i) => l !== prev.locations[i])
          ? { ...prev, locations: updated }
          : prev;
      });

      // Batch-save all location service overrides
      const currentLocServices = locServicesRef.current;
      const savePromises = Object.entries(currentLocServices)
        .filter(([locId]) => locId) // skip empty keys
        .map(([locId, state]) =>
          saveLocationServices({ locationId: locId, overrides: state.overrides, subServices: state.subServices })
        );
      await Promise.all(savePromises);

      // Sync saved state to parent cache so navigating back shows correct data
      updateSellerCache("locations", data.locations.map((l, i) => ({ ...l, id: result.locationIds[i] ?? l.id })));
      updateSellerCache("defaultSchedulingSystem", data.defaultSchedulingSystem);
      updateSellerCache("defaultSchedulingOtherName", data.defaultSchedulingOtherName);
      updateSellerCache("defaultSchedulingAcknowledged", data.defaultSchedulingAcknowledged);
      updateSellerCache("locationServices", currentLocServices);

      onStatusUpdate(result.statuses);
      setIsDirty(false);
      toast.success("Locations saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save locations");
    } finally {
      setSaving(false);
    }
  }, [data, onStatusUpdate]);

  function updateLocation(index: number, field: keyof SellerLocationData, value: unknown) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, i) => i === index ? { ...loc, [field]: value } : loc),
    }));
  }

  function handleAddressRetrieve(locIndex: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response: any) => {
      const feature = response.features?.[0];
      if (!feature) return;
      const p = feature.properties;
      if (p.address_line1) updateLocation(locIndex, "streetAddress", p.address_line1);
      if (p.place) updateLocation(locIndex, "city", p.place);
      const state = (p.region_code || "").toUpperCase();
      if (state) updateLocation(locIndex, "state", state);
      if (p.postcode) updateLocation(locIndex, "zip", p.postcode);
      // Capture coordinates for map view
      const coords = feature.geometry?.coordinates;
      if (coords && coords.length >= 2) {
        updateLocation(locIndex, "longitude", coords[0]);
        updateLocation(locIndex, "latitude", coords[1]);
      }
    };
  }

  function updateDaySchedule(locIndex: number, dayIndex: number, field: keyof DaySchedule, value: unknown) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, li) =>
        li === locIndex
          ? { ...loc, weeklySchedule: (loc.weeklySchedule ?? defaultWeeklySchedule()).map((ds, di) => di === dayIndex ? { ...ds, [field]: value } : ds) }
          : loc
      ),
    }));
  }

  function addLocation() {
    setData((prev) => {
      setOpenIndex(prev.locations.length);
      return { ...prev, locations: [...prev.locations, emptyLocation()] };
    });
  }

  function removeLocation(index: number) {
    const loc = data.locations[index];
    if (!loc) return;
    const locId = loc.id;
    if (locationHasData(loc)) {
      const name = loc.locationName || `Location ${index + 1}`;
      if (!confirm(`Remove "${name}"? This location has data that will be lost.`)) return;
    }
    setOpenIndex((prev) => {
      if (index === prev) return Math.min(prev, data.locations.length - 2);
      if (index < prev) return prev - 1;
      return prev;
    });
    setData((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => locId ? l.id !== locId : l !== loc),
    }));
    if (locId) {
      deleteSellerLocation(locId).catch((err) => {
        console.error("Failed to delete location:", err);
        toast.error("Failed to remove location. It may reappear on refresh.");
      });
    }
  }

  function updateScheduling(locIndex: number, siIndex: number, field: string, value: string) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, li) =>
        li === locIndex
          ? { ...loc, schedulingIntegrations: (loc.schedulingIntegrations ?? []).map((si, si2) => si2 === siIndex ? { ...si, [field]: value } : si) }
          : loc
      ),
    }));
  }

  function addScheduling(locIndex: number) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, li) =>
        li === locIndex
          ? { ...loc, schedulingIntegrations: [...(loc.schedulingIntegrations ?? []), { serviceType: "office_365" as const, serviceName: "", accountIdentifier: "" }] }
          : loc
      ),
    }));
  }

  function removeScheduling(locIndex: number, siIndex: number) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, li) =>
        li === locIndex
          ? { ...loc, schedulingIntegrations: (loc.schedulingIntegrations ?? []).filter((_, i) => i !== siIndex) }
          : loc
      ),
    }));
  }

  function handleCSVImport(rows: LocationCSVRow[]) {
    const newLocations = rows.map((row) => ({
      ...emptyLocation(),
      ...row,
    } as SellerLocationData));
    setData((prev) => ({
      ...prev,
      locations: [...prev.locations, ...newLocations],
    }));
    toast.success(`Imported ${rows.length} location${rows.length === 1 ? "" : "s"}`);
  }

  // ─── Location services helpers ─────────────────────────────────

  const orgSelectedServices = (sellerServiceOfferings ?? []).filter((s) => s.selected);

  function getLocServiceOverride(locId: string, serviceType: string): boolean | null {
    const state = locServices[locId];
    if (!state) return null;
    const override = state.overrides.find((o) => o.serviceType === serviceType);
    return override ? override.available : null;
  }

  function toggleLocServiceOverride(locId: string, serviceType: string, currentlyAvailable: boolean) {
    setIsDirty(true);
    setLocServices((prev) => {
      const state = prev[locId] ?? { overrides: [], subServices: [], hasOverrides: true };
      const existing = state.overrides.find((o) => o.serviceType === serviceType);
      const newOverrides = existing
        ? state.overrides.map((o) => o.serviceType === serviceType ? { ...o, available: !currentlyAvailable } : o)
        : [...state.overrides, { serviceType, available: !currentlyAvailable, pricePerVisit: null }];
      return { ...prev, [locId]: { ...state, overrides: newOverrides } };
    });
  }

  function getSubServiceAvailable(locId: string, serviceType: string, subType: string): boolean {
    const state = locServices[locId];
    if (!state) return true;
    const sub = state.subServices.find((s) => s.serviceType === serviceType && s.subType === subType);
    return sub ? sub.available : true;
  }

  function toggleSubService(locId: string, serviceType: string, subType: string) {
    setIsDirty(true);
    setLocServices((prev) => {
      const state = prev[locId] ?? { overrides: [], subServices: [], hasOverrides: true };
      const existing = state.subServices.find((s) => s.serviceType === serviceType && s.subType === subType);
      const newSubs = existing
        ? state.subServices.map((s) => s.serviceType === serviceType && s.subType === subType ? { ...s, available: !s.available } : s)
        : [...state.subServices, { serviceType, subType, available: false, unitPrice: null }];
      return { ...prev, [locId]: { ...state, subServices: newSubs } };
    });
  }

  function selectAllSubServices(locId: string, serviceType: string) {
    setIsDirty(true);
    const subItems = SUB_SERVICE_TYPES[serviceType] ?? [];
    setLocServices((prev) => {
      const state = prev[locId] ?? { overrides: [], subServices: [], hasOverrides: true };
      const otherSubs = state.subServices.filter((s) => s.serviceType !== serviceType);
      // Preserve existing unitPrice values
      const existingPriceMap = new Map(
        state.subServices.filter((s) => s.serviceType === serviceType).map((s) => [s.subType, s.unitPrice])
      );
      const newSubs = [...otherSubs, ...subItems.map((sub) => ({ serviceType, subType: sub.value, available: true, unitPrice: existingPriceMap.get(sub.value) ?? null }))];
      return { ...prev, [locId]: { ...state, subServices: newSubs } };
    });
  }

  function deselectAllSubServices(locId: string, serviceType: string) {
    setIsDirty(true);
    const subItems = SUB_SERVICE_TYPES[serviceType] ?? [];
    setLocServices((prev) => {
      const state = prev[locId] ?? { overrides: [], subServices: [], hasOverrides: true };
      const otherSubs = state.subServices.filter((s) => s.serviceType !== serviceType);
      // Preserve existing unitPrice values
      const existingPriceMap = new Map(
        state.subServices.filter((s) => s.serviceType === serviceType).map((s) => [s.subType, s.unitPrice])
      );
      const newSubs = [...otherSubs, ...subItems.map((sub) => ({ serviceType, subType: sub.value, available: false, unitPrice: existingPriceMap.get(sub.value) ?? null }))];
      return { ...prev, [locId]: { ...state, subServices: newSubs } };
    });
  }

  async function handleCustomizeLocation(locId: string) {
    setCustomizingLoc(locId);
    try {
      const newState = await initLocationFromOrgDefaults(locId);
      setLocServices((prev) => ({ ...prev, [locId]: newState }));
      toast.success("Location customized with org defaults");
    } catch (err) {
      console.error(err);
      toast.error("Failed to customize location");
    } finally {
      setCustomizingLoc(null);
    }
  }

  async function handleResetLocation(locId: string) {
    if (!confirm("Reset this location to organization defaults? All custom service settings will be removed.")) return;
    setResettingLoc(locId);
    try {
      await resetLocationToDefaults(locId);
      setLocServices((prev) => ({
        ...prev,
        [locId]: { overrides: [], subServices: [], hasOverrides: false },
      }));
      toast.success("Location reset to org defaults");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reset location");
    } finally {
      setResettingLoc(null);
    }
  }

  // ─── Location visit price override helpers ──────────────────────

  function getLocVisitPriceOverride(locId: string, serviceType: string): number | null {
    const state = locServices[locId];
    if (!state) return null;
    const override = state.overrides.find((o) => o.serviceType === serviceType);
    return override?.pricePerVisit ?? null;
  }

  function setLocVisitPriceOverride(locId: string, serviceType: string, price: number | null) {
    setIsDirty(true);
    setLocServices((prev) => {
      const state = prev[locId] ?? { overrides: [], subServices: [], hasOverrides: true };
      const existing = state.overrides.find((o) => o.serviceType === serviceType);
      const newOverrides = existing
        ? state.overrides.map((o) => o.serviceType === serviceType ? { ...o, pricePerVisit: price } : o)
        : [...state.overrides, { serviceType, available: true, pricePerVisit: price }];
      return { ...prev, [locId]: { ...state, overrides: newOverrides, hasOverrides: true } };
    });
  }

  // ─── Location sub-service price helpers ─────────────────────────

  function getLocSubServicePrice(locId: string, serviceType: string, subType: string): number | null {
    const state = locServices[locId];
    if (!state) return null;
    const sub = state.subServices.find((s) => s.serviceType === serviceType && s.subType === subType);
    return sub?.unitPrice ?? null;
  }

  function setLocSubServicePrice(locId: string, serviceType: string, subType: string, price: number | null) {
    setIsDirty(true);
    setLocServices((prev) => {
      const state = prev[locId] ?? { overrides: [], subServices: [], hasOverrides: true };
      const existing = state.subServices.find((s) => s.serviceType === serviceType && s.subType === subType);
      const newSubs = existing
        ? state.subServices.map((s) =>
            s.serviceType === serviceType && s.subType === subType ? { ...s, unitPrice: price } : s
          )
        : [...state.subServices, { serviceType, subType, available: true, unitPrice: price }];
      return { ...prev, [locId]: { ...state, subServices: newSubs, hasOverrides: true } };
    });
  }

  // Build org-level sub-service summary for default state display
  function getOrgSubServiceSummary(): Array<{ label: string; count: number; total: number }> {
    const summary: Array<{ label: string; count: number; total: number }> = [];
    for (const svc of orgSelectedServices) {
      const subItems = SUB_SERVICE_TYPES[svc.serviceType];
      if (!subItems || subItems.length === 0) continue;
      const orgCategory = orgSubServices?.categories[svc.serviceType];
      const selectedCount = orgCategory?.filter((i) => i.selected).length ?? 0;
      if (selectedCount > 0) {
        const label = SERVICE_TYPES.find((st) => st.value === svc.serviceType)?.label ?? svc.serviceType;
        summary.push({ label, count: selectedCount, total: subItems.length });
      }
    }
    return summary;
  }

  function renderLocationServices(loc: SellerLocationData) {
    if (!loc.id || orgSelectedServices.length === 0) return null;
    const locId = loc.id;
    const locState = locServices[locId];
    const hasOverrides = locState?.hasOverrides ?? false;

    if (!hasOverrides) {
      // State A: Using org defaults
      const summary = getOrgSubServiceSummary();
      return (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-1">Service Details</h4>
          <div className="rounded-lg border border-border bg-gray-light/50 p-4">
            <p className="text-xs text-muted mb-2">
              <svg className="inline w-3.5 h-3.5 mr-1 text-brand-teal" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
              Using your organization&apos;s default price list.
            </p>
            {(() => {
              const visitPriceParts = orgPricing?.visitPrices
                ?.filter((vp) => vp.price != null && orgSelectedServices.some((s) => s.serviceType === vp.serviceType))
                .map((vp) => {
                  const label = vp.serviceType === "primary_care" ? "Primary Care" : "Urgent Care";
                  return `${label} $${Number(vp.price).toFixed(2)}/visit`;
                });
              return visitPriceParts && visitPriceParts.length > 0 ? (
                <p className="text-xs text-muted mb-1">{visitPriceParts.join(" · ")}</p>
              ) : null;
            })()}
            {summary.length > 0 && (
              <p className="text-xs text-muted">
                {summary.map((s, i) => (
                  <span key={s.label}>
                    {i > 0 && " · "}
                    {s.label} ({s.count} of {s.total})
                  </span>
                ))}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleCustomizeLocation(locId)}
              disabled={customizingLoc === locId || disabled}
              className="mt-3 text-xs font-medium text-brand-teal hover:underline disabled:opacity-50"
            >
              {customizingLoc === locId ? "Customizing..." : "Customize for this location"}
            </button>
          </div>
        </div>
      );
    }

    // State B: Custom overrides
    return (
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-foreground">Service Details</h4>
          <button
            type="button"
            onClick={() => handleResetLocation(locId)}
            disabled={disabled || resettingLoc === locId}
            className="text-xs text-muted hover:text-error hover:underline disabled:opacity-50"
          >
            {resettingLoc === locId ? "Resetting..." : "Reset to defaults"}
          </button>
        </div>
        <p className="text-xs text-muted mb-3">
          This location has custom service settings. Prices in <span className="text-muted/60 italic">muted text</span> use org defaults; enter a value to override.
        </p>
        <div className="flex flex-col gap-2">
          {orgSelectedServices.map((svc) => {
            const meta = SELLER_SERVICE_TYPES.find((st) => st.value === svc.serviceType) ?? SERVICE_TYPES.find((st) => st.value === svc.serviceType);
            const override = getLocServiceOverride(locId, svc.serviceType);
            const isAvailable = override !== null ? override : true;
            const subItems = SUB_SERVICE_TYPES[svc.serviceType];
            const hasSubItems = subItems && subItems.length > 0;
            let subAvailableCount = 0;
            let subTotalCount = 0;
            if (hasSubItems) {
              subTotalCount = subItems.length;
              subAvailableCount = subItems.filter((sub) => getSubServiceAvailable(locId, svc.serviceType, sub.value)).length;
            }

            // Visit-level services (PC/UC) show inline price override
            const isVisitService = svc.serviceType === "primary_care" || svc.serviceType === "urgent_care";

            return (
              <div key={svc.serviceType}>
                <div className="flex items-center justify-between gap-2">
                  <Checkbox
                    label={meta?.label ?? svc.serviceType}
                    name={`loc-svc-${locId}-${svc.serviceType}`}
                    checked={isAvailable}
                    onChange={() => toggleLocServiceOverride(locId, svc.serviceType, isAvailable)}
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isAvailable && (
                      <span className="text-xs text-muted italic">not offered at this location</span>
                    )}
                    {isVisitService && isAvailable && (() => {
                      const locPrice = getLocVisitPriceOverride(locId, svc.serviceType);
                      const hasOverridePrice = locPrice != null;
                      const orgVisitPrice = orgPricing?.visitPrices?.find((vp) => vp.serviceType === svc.serviceType)?.price;
                      return (
                        <div className="flex items-center gap-1.5">
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={orgVisitPrice != null ? orgVisitPrice.toFixed(2) : "\u2014"}
                              className={`w-full bg-transparent border border-border rounded pl-5 pr-2 py-1.5 text-xs focus:border-focus focus:ring-0 transition-colors ${hasOverridePrice ? "text-foreground" : "text-muted/50"}`}
                              value={locPrice != null ? String(locPrice) : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocVisitPriceOverride(locId, svc.serviceType, val === "" ? null : parseFloat(val) || null);
                              }}
                              disabled={disabled}
                            />
                          </div>
                          <span className="text-[10px] text-muted whitespace-nowrap">/ visit</span>
                        </div>
                      );
                    })()}
                    {hasSubItems && isAvailable && subTotalCount > 0 && (
                      <span className="text-xs text-muted">{subAvailableCount}/{subTotalCount}</span>
                    )}
                    {hasSubItems && isAvailable && (
                      <button type="button" onClick={() => setModalTarget({ locId, serviceType: svc.serviceType })} className="text-xs text-brand-teal hover:underline">Configure &rarr;</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {modalTarget?.locId === locId && (() => {
          const st = modalTarget.serviceType;
          const defs = SUB_SERVICE_TYPES[st] ?? [];
          const label = SERVICE_TYPES.find((s) => s.value === st)?.label ?? st;
          const stateMap: Record<string, boolean> = {};
          const priceMap: Record<string, number | null> = {};
          const orgPriceMap: Record<string, number | null> = {};
          for (const def of defs) {
            stateMap[def.value] = getSubServiceAvailable(locId, st, def.value);
            priceMap[def.value] = getLocSubServicePrice(locId, st, def.value);
            orgPriceMap[def.value] = orgPricing?.subServicePrices?.find((sp) => sp.serviceType === st && sp.subType === def.value)?.unitPrice ?? null;
          }
          return (
            <SubServiceModal
              open
              onClose={() => setModalTarget(null)}
              serviceType={st}
              serviceLabel={label}
              subServiceDefs={defs}
              subServiceState={stateMap}
              onToggle={(subType) => toggleSubService(locId, st, subType)}
              onSelectAll={() => selectAllSubServices(locId, st)}
              onDeselectAll={() => deselectAllSubServices(locId, st)}
              prices={priceMap}
              orgPrices={orgPriceMap}
              onPriceChange={(subType, price) => setLocSubServicePrice(locId, st, subType, price)}
            />
          );
        })()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="text-lg font-heading font-semibold mb-1">Default Scheduling System</h3>
        <p className="text-xs text-muted mb-5">This applies to all locations unless overridden per-location below.</p>
        <Select
          label="Scheduling System"
          name="defaultSchedulingSystem"
          value={data.defaultSchedulingSystem ?? ""}
          onChange={(e) => setData((prev) => ({
            ...prev,
            defaultSchedulingSystem: e.target.value || null,
            ...(e.target.value !== "other" ? { defaultSchedulingOtherName: null, defaultSchedulingAcknowledged: false } : {}),
          }))}
          options={SCHEDULING_OPTIONS}
          placeholder="Select default system"
        />
        {data.defaultSchedulingSystem === "other" && (
          <div className="mt-4 space-y-3">
            <Input label="Scheduling System Name" required value={data.defaultSchedulingOtherName ?? ""} onChange={(e) => setData((prev) => ({ ...prev, defaultSchedulingOtherName: e.target.value }))} placeholder="e.g., eClinicalWorks, Athenahealth" />
            <Checkbox label="I understand that integrating with a non-standard scheduling system requires a scoped project." checked={data.defaultSchedulingAcknowledged ?? false} onChange={(e) => setData((prev) => ({ ...prev, defaultSchedulingAcknowledged: e.target.checked }))} />
          </div>
        )}
      </Card>

      {data.locations.map((loc, locIndex) => {
        const isOpen = locIndex === openIndex;
        const isComplete = locationComplete(loc);

        if (!isOpen) {
          return (
            <Card key={locIndex}>
              <button type="button" className="w-full text-left" onClick={() => setOpenIndex(locIndex)}>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-heading font-semibold truncate">{loc.locationName || `Location ${locIndex + 1}`}</h3>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {isComplete ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z" clipRule="evenodd" /></svg>
                        Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <svg className="w-3 h-3" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4" /></svg>
                        Incomplete
                      </span>
                    )}
                    <svg className="w-4 h-4 text-muted" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                {(loc.streetAddress || loc.city) && <p className="text-xs text-muted mt-1 truncate">{formatAddress(loc)}</p>}
                {(loc.locationNpi || loc.phoneNumber) && <p className="text-xs text-muted mt-0.5">{[loc.locationNpi && `NPI: ${loc.locationNpi}`, loc.phoneNumber].filter(Boolean).join(" · ")}</p>}
              </button>
              {data.locations.length > 1 && (
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeLocation(locIndex); }} className="text-xs text-error hover:underline">Remove</button>
                </div>
              )}
            </Card>
          );
        }

        const showAdvanced = essentialsFilled(loc);

        return (
          <Card key={locIndex}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-heading font-semibold">{loc.locationName || `Location ${locIndex + 1}`}</h3>
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z" clipRule="evenodd" /></svg>
                    Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <svg className="w-3 h-3" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4" /></svg>
                    Incomplete
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {data.locations.length > 1 && (
                  <button type="button" onClick={() => setOpenIndex(-1)} className="text-xs text-muted hover:text-foreground flex items-center gap-1">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.78 11.78a.75.75 0 0 1-1.06 0L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" /></svg>
                    Collapse
                  </button>
                )}
                {data.locations.length > 1 && <button type="button" onClick={() => removeLocation(locIndex)} className="text-xs text-error hover:underline">Remove</button>}
              </div>
            </div>

            <div className="grid gap-4">
              <Input label="Location Name" required value={loc.locationName ?? ""} onChange={(e) => updateLocation(locIndex, "locationName", e.target.value)} placeholder="e.g., Main Street Clinic" />
              {mapboxToken ? (
                <AddressAutofill accessToken={mapboxToken} onRetrieve={handleAddressRetrieve(locIndex)} options={{ country: "US" }}>
                  <Input label="Street Address" required value={loc.streetAddress ?? ""} onChange={(e) => updateLocation(locIndex, "streetAddress", e.target.value)} autoComplete="address-line1" />
                </AddressAutofill>
              ) : (
                <Input label="Street Address" required value={loc.streetAddress ?? ""} onChange={(e) => updateLocation(locIndex, "streetAddress", e.target.value)} />
              )}
              <Input label="Street Address Line 2" value={loc.streetAddress2 ?? ""} onChange={(e) => updateLocation(locIndex, "streetAddress2", e.target.value)} placeholder="Suite, Unit, Apt, etc." autoComplete="address-line2" />
              <div className="grid grid-cols-3 gap-3">
                <Input label="City" required value={loc.city ?? ""} onChange={(e) => updateLocation(locIndex, "city", e.target.value)} autoComplete="address-level2" />
                <Select label="State" required value={loc.state ?? ""} onChange={(e) => updateLocation(locIndex, "state", e.target.value)} options={US_STATES} placeholder="State" />
                <Input label="ZIP" required value={loc.zip ?? ""} onChange={(e) => updateLocation(locIndex, "zip", e.target.value)} placeholder="5-digit" autoComplete="postal-code" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Location NPI" required value={loc.locationNpi ?? ""} onChange={(e) => updateLocation(locIndex, "locationNpi", e.target.value)} />
                <Input label="Phone Number" required value={loc.phoneNumber ?? ""} onChange={(e) => updateLocation(locIndex, "phoneNumber", e.target.value)} />
              </div>
            </div>

            {!showAdvanced && (
              <p className="text-xs text-muted mt-4 italic">Fill in the required fields above to reveal additional options.</p>
            )}

            {showAdvanced && (
              <div className="mt-6 space-y-6">
                <Input label="Close-by Description" value={loc.closeByDescription ?? ""} onChange={(e) => updateLocation(locIndex, "closeByDescription", e.target.value)} placeholder={`e.g., "Across from Denny's"`} helperText="Used by Care Nav when giving directions" />
                <Select label="Walk-in or Appointment" required value={loc.accessType ?? ""} onChange={(e) => updateLocation(locIndex, "accessType", e.target.value)} options={ACCESS_OPTIONS} placeholder="Select" />

                {renderLocationServices(loc)}

                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-1">Scheduling</h4>
                  <p className="text-xs text-muted mb-3">
                    {data.defaultSchedulingSystem
                      ? `Default: ${SCHEDULING_OPTIONS.find((o) => o.value === data.defaultSchedulingSystem)?.label ?? data.defaultSchedulingSystem}. Toggle to override.`
                      : "No default set. Select a system for this location or set a default above."}
                  </p>
                  <Checkbox
                    label="Does this location use a different scheduling system?"
                    checked={loc.schedulingSystemOverride != null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateLocation(locIndex, "schedulingSystemOverride", data.defaultSchedulingSystem ?? "office_365");
                      } else {
                        setData((prev) => ({
                          ...prev,
                          locations: prev.locations.map((l, i) =>
                            i === locIndex ? { ...l, schedulingSystemOverride: null, schedulingOverrideOtherName: null, schedulingOverrideAcknowledged: false } : l
                          ),
                        }));
                      }
                    }}
                  />
                  {loc.schedulingSystemOverride != null && (
                    <div className="mt-3 space-y-3">
                      <Select label="Location Scheduling System" value={loc.schedulingSystemOverride ?? ""} onChange={(e) => {
                        const val = e.target.value || null;
                        setData((prev) => ({
                          ...prev,
                          locations: prev.locations.map((l, i) =>
                            i === locIndex ? { ...l, schedulingSystemOverride: val, ...(val !== "other" ? { schedulingOverrideOtherName: null, schedulingOverrideAcknowledged: false } : {}) } : l
                          ),
                        }));
                      }} options={SCHEDULING_OPTIONS} placeholder="Select system" />
                      {loc.schedulingSystemOverride === "other" && (
                        <>
                          <Input label="Scheduling System Name" required value={loc.schedulingOverrideOtherName ?? ""} onChange={(e) => updateLocation(locIndex, "schedulingOverrideOtherName", e.target.value)} placeholder="e.g., eClinicalWorks" />
                          <Checkbox label="I understand that integrating with a non-standard scheduling system requires a scoped project." checked={loc.schedulingOverrideAcknowledged ?? false} onChange={(e) => updateLocation(locIndex, "schedulingOverrideAcknowledged", e.target.checked)} />
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <h5 className="text-xs font-medium text-muted mb-2">Connected Integrations</h5>
                    {(loc.schedulingIntegrations ?? []).map((si, siIndex) => (
                      <div key={siIndex} className="flex flex-col gap-3 mb-4 p-3 bg-gray-light rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-muted">Integration {siIndex + 1}</span>
                          {(loc.schedulingIntegrations?.length ?? 0) > 1 && (
                            <button type="button" onClick={() => removeScheduling(locIndex, siIndex)} className="text-xs text-error hover:underline">Remove</button>
                          )}
                        </div>
                        <Select label="Scheduling Service" required value={si.serviceType} onChange={(e) => updateScheduling(locIndex, siIndex, "serviceType", e.target.value)} options={SCHEDULING_OPTIONS} />
                        {si.serviceType === "other" && (
                          <>
                            <Input label="Service Name" required value={si.serviceName ?? ""} onChange={(e) => updateScheduling(locIndex, siIndex, "serviceName", e.target.value)} />
                            <p className="text-xs text-warm-orange italic">Integrating with a non-standard scheduling service requires a scoped project.</p>
                          </>
                        )}
                        <Input label="Account or Calendar Identifier" required value={si.accountIdentifier ?? ""} onChange={(e) => updateScheduling(locIndex, siIndex, "accountIdentifier", e.target.value)} placeholder="Calendar URL, account email, or identifier" />
                      </div>
                    ))}
                    <button type="button" onClick={() => addScheduling(locIndex)} className="text-sm text-brand-teal hover:underline">+ Add scheduling integration</button>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Weekly Schedule</h4>
                  <div className="space-y-2">
                    {(loc.weeklySchedule ?? defaultWeeklySchedule()).map((ds, dayIndex) => (
                      <div key={ds.day} className="flex items-center gap-3">
                        <span className="text-sm w-24 flex-shrink-0">{ds.day}</span>
                        <Checkbox label="Closed" checked={ds.closed} onChange={(e) => updateDaySchedule(locIndex, dayIndex, "closed", e.target.checked)} />
                        {!ds.closed && (
                          <>
                            <input type="time" value={ds.openTime ?? ""} onChange={(e) => updateDaySchedule(locIndex, dayIndex, "openTime", e.target.value)} className="border border-border rounded px-2 py-1 text-sm" />
                            <span className="text-sm text-muted">to</span>
                            <input type="time" value={ds.closeTime ?? ""} onChange={(e) => updateDaySchedule(locIndex, dayIndex, "closeTime", e.target.value)} className="border border-border rounded px-2 py-1 text-sm" />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <div className="flex items-center gap-3">
        <Button variant="secondary" type="button" onClick={addLocation}>+ Add Location</Button>
        <CSVUploadButton
          entityLabel="Locations"
          columns={LOCATION_CSV_COLUMNS}
          rowSchema={locationCSVRowSchema}
          onImport={handleCSVImport}
          templateFileName="locations-template.csv"
          dedupKey={(row) => row.locationNpi?.toLowerCase() ?? ""}
          existingKeys={new Set(data.locations.map((l) => (l.locationNpi ?? "").toLowerCase()).filter(Boolean))}
        />
      </div>

      <SellerSectionNavButtons
        currentSection="S-2"
        onNavigate={onNavigate}
        onSave={handleSave}
        isDirty={isDirty}
        disabled={disabled}
      />
    </div>
  );
}
