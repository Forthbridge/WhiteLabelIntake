export type SectionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type CompletionStatus = "not_started" | "in_progress" | "complete";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type FlowType = "AFFILIATE" | "SELLER";

export interface SectionMeta {
  id: SectionId;
  title: string;
  phase: "program" | "operations" | "review";
  description: string;
  minPhase: number;
  hidden?: boolean;
}

// ─── Seller (Care Delivery) Sections ────────────────────────────

export type SellerSectionId = "S-1" | "S-2" | "S-3" | "S-4" | "S-5" | "S-6" | "S-7" | "S-R";

export interface SellerSectionMeta {
  id: SellerSectionId;
  title: string;
  description: string;
}

export const SELLER_SECTIONS: SellerSectionMeta[] = [
  { id: "S-1", title: "Organization Info", description: "Legal name, contacts, and basic info" },
  { id: "S-4", title: "Default Services", description: "Select services and configure default sub-service availability" },
  { id: "S-7", title: "Visit Pricing", description: "Set cash prices for care visits" },
  { id: "S-2", title: "Physical Locations", description: "Register your practice locations" },
  { id: "S-3", title: "Providers & Credentials", description: "Add provider information" },
  { id: "S-5", title: "Lab Network", description: "Lab network configuration" },
  { id: "S-6", title: "Billing Setup", description: "Payout account and banking information" },
  { id: "S-R", title: "Review & Submit", description: "Review all sections and submit" },
];

export function getSellerSectionMeta(id: SellerSectionId): SellerSectionMeta | undefined {
  return SELLER_SECTIONS.find((s) => s.id === id);
}

export const SECTIONS: SectionMeta[] = [
  { id: 1, title: "Client & Program Overview", phase: "program", description: "Identify your organization and program details", minPhase: 1 },
  { id: 2, title: "Default Program Services", phase: "program", description: "Confirm included services", minPhase: 1 },
  { id: 3, title: "In-Person & Extended Services", phase: "program", description: "Select additional services", minPhase: 1 },
  { id: 4, title: "Payouts & Payments", phase: "program", description: "Payment and billing setup", minPhase: 1 },
  { id: 5, title: "Care Network", phase: "operations", description: "Build your network of care delivery locations", minPhase: 1 },
  { id: 9, title: "Care Navigation", phase: "operations", description: "Care Nav services and escalation", minPhase: 1 },
  { id: 10, title: "Review & Submit", phase: "review", description: "Review and submit your form", minPhase: 1 },
];

export function getSectionMeta(id: number): SectionMeta | undefined {
  return SECTIONS.find((s) => s.id === id);
}

/**
 * Prerequisites map: which sections must be complete before a section is unlocked.
 * Sections not listed here have no prerequisites.
 */
export const SECTION_PREREQUISITES: Partial<Record<SectionId, SectionId[]>> = {
  2: [1],
  3: [1],
  4: [1],
  10: [1, 2, 3, 4, 5, 9],
};

/**
 * Returns SectionMeta objects for prerequisites that are not yet "complete".
 */
export function getUnmetPrerequisites(
  sectionId: SectionId,
  statuses: Record<number, CompletionStatus>
): SectionMeta[] {
  const prereqs = SECTION_PREREQUISITES[sectionId];
  if (!prereqs) return [];
  return prereqs
    .filter((id) => statuses[id] !== "complete")
    .map((id) => getSectionMeta(id))
    .filter((meta): meta is SectionMeta => meta !== undefined);
}

/**
 * Get sections visible for a given set of unlocked phases.
 */
export function getVisibleSections(unlockedPhases: number[]): SectionMeta[] {
  return SECTIONS.filter((s) => !s.hidden && unlockedPhases.includes(s.minPhase));
}
