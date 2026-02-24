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
  { id: "S-1", title: "Organization Info", description: "Tell us about your legal entity and key contacts. This information is used for contracting and day-to-day coordination." },
  { id: "S-4", title: "Default Services Offered", description: "Select the services your organization provides. These become the default service catalog for all your locations. Individual locations can customize their offerings if needed." },
  { id: "S-7", title: "Default Price List", description: "This is your organization's default price list. Prices can be customized per location on the Physical Locations page." },
  { id: "S-2", title: "Physical Locations", description: "Register the physical locations where your organization delivers care. Each location can customize its services, scheduling, and provider availability." },
  { id: "S-3", title: "Providers & Credentials", description: "Add the credentialed providers who deliver care at your locations. Each provider's information is used for credentialing and network directory listings." },
  { id: "S-5", title: "Lab Network", description: "Choose how your organization handles lab work. If you use a preferred lab partner, we'll coordinate setup." },
  { id: "S-6", title: "Payment Account", description: "Set up the bank account where patient payments collected on your behalf will be deposited. This information is encrypted for security." },
  { id: "S-R", title: "Review & Submit", description: "Review all sections and submit" },
];

export function getSellerSectionMeta(id: SellerSectionId): SellerSectionMeta | undefined {
  return SELLER_SECTIONS.find((s) => s.id === id);
}

export const SECTIONS: SectionMeta[] = [
  { id: 1, title: "Company & Contacts", phase: "program", description: "Tell us about your organization and who we should work with", minPhase: 1 },
  { id: 2, title: "Your Plan", phase: "program", description: "Review your defaults, choose extended services, and set up escalation contacts", minPhase: 1 },
  { id: 3, title: "In-Person & Extended Services", phase: "program", description: "Select additional services", minPhase: 1, hidden: true },
  { id: 5, title: "Care Network", phase: "program", description: "Choose where your members access their benefits", minPhase: 1 },
  { id: 4, title: "Payouts & Payments", phase: "program", description: "Set up how you receive payouts and how we collect invoices", minPhase: 1 },
  { id: 9, title: "Care Navigation", phase: "program", description: "Care Nav services and escalation", minPhase: 1, hidden: true },
  { id: 10, title: "Review & Submit", phase: "review", description: "Review everything and submit — our team uses this to complete your setup", minPhase: 1 },
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
  5: [1, 2],
  4: [1],
  10: [1, 2, 4, 5],
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
