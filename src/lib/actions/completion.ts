"use server";

import { prisma } from "@/lib/prisma";
import type { CompletionStatus } from "@/types";
import { getSessionContext } from "./helpers";


/**
 * Session-aware wrapper — resolves affiliateId from the current session
 * so client code never needs to know it.
 */
export async function getMyCompletionStatuses(): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext();
  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}

export async function getCompletionStatuses(affiliateId: string, programId?: string): Promise<Record<number, CompletionStatus>> {
  const statuses: Record<number, CompletionStatus> = {};

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { legalName: true, status: true },
  });

  const program = programId
    ? await prisma.program.findFirst({ where: { id: programId, affiliateId } })
    : await prisma.program.findFirst({ where: { affiliateId } });

  // Section 1: Client & Program Overview
  if (program) {
    const fields = [affiliate?.legalName, program.adminContactName, program.adminContactEmail, program.executiveSponsorName, program.executiveSponsorEmail, program.itContactName];
    const filled = fields.filter(Boolean).length;
    statuses[1] = filled === 0 ? "not_started" : filled === fields.length ? "complete" : "in_progress";
  } else {
    statuses[1] = "not_started";
  }

  // Section 2: Plan Name
  if (program?.programName) {
    statuses[2] = "complete";
  } else {
    statuses[2] = "not_started";
  }

  // Section 3: In-Person & Extended Services
  const services = await prisma.service.findMany({ where: { programId: program?.id ?? "" } });
  const selectedServices = services.filter((s) => s.selected);
  statuses[3] = selectedServices.length > 0 ? "complete" : services.length > 0 ? "in_progress" : "not_started";

  // Section 4: Payouts & Payments
  if (program) {
    const payoutFields = [program.w9FilePath, program.achRoutingNumber, program.achAccountNumber, program.achAccountType, program.achAccountHolderName, program.bankDocFilePath];
    const paymentFields = [program.paymentAchAccountHolderName, program.paymentAchAccountType, program.paymentAchRoutingNumber, program.paymentAchAccountNumber];
    const allFields = [...payoutFields, ...paymentFields];
    const filled = allFields.filter(Boolean).length;
    statuses[4] = filled === 0 ? "not_started" : filled === allFields.length ? "complete" : "in_progress";
  } else {
    statuses[4] = "not_started";
  }

  // Section 5: Care Network — complete when at least 1 active term in network
  const allTerms = await prisma.networkContractTerm.findMany({
    where: { contract: { affiliateId, programId: program?.id ?? null } },
    orderBy: { createdAt: "desc" },
    select: { contractId: true, sellerLocationId: true, status: true },
  });
  // Dedupe to latest per contract+location, count ACTIVE
  const seenTermKeys = new Set<string>();
  let activeTermCount = 0;
  for (const t of allTerms) {
    const key = `${t.contractId}:${t.sellerLocationId}`;
    if (!seenTermKeys.has(key)) {
      seenTermKeys.add(key);
      if (t.status === "ACTIVE") activeTermCount++;
    }
  }
  statuses[5] = activeTermCount > 0 ? "complete" : "not_started";

  // Section 9: Care Navigation
  const cn = await prisma.careNavConfig.findFirst({ where: { affiliateId } });
  statuses[9] = !cn ? "not_started" : cn.primaryEscalationName && cn.secondaryEscalationName ? "complete" : "in_progress";

  // Section 10: Review & Submit
  statuses[10] = affiliate?.status === "SUBMITTED" ? "complete" : "not_started";

  return statuses;
}
