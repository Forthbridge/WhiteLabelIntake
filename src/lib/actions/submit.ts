"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, assertNotSubmitted, assertPhaseNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import { getSectionMeta } from "@/types";

export async function submitForm() {
  const ctx = await getSessionContext();
  await assertNotSubmitted(ctx.affiliateId);

  // Server-side gate: all sections 1-9 must be complete
  const statuses = await getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
  const incomplete = [1, 2, 3, 4, 5, 6, 7, 9]
    .filter((id) => statuses[id] !== "complete");

  if (incomplete.length > 0) {
    const names = incomplete
      .map((id) => getSectionMeta(id)?.title ?? `Section ${id}`)
      .join(", ");
    throw new Error(`Cannot submit: incomplete sections — ${names}`);
  }

  await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: ctx.affiliateId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    }),
    prisma.affiliatePhase.upsert({
      where: { affiliateId_phase: { affiliateId: ctx.affiliateId, phase: 1 } },
      update: { status: "SUBMITTED", submittedAt: new Date() },
      create: { affiliateId: ctx.affiliateId, phase: 1, status: "SUBMITTED", submittedAt: new Date(), unlockedAt: new Date() },
    }),
  ]);
}

export async function submitPhase(phaseNumber: number) {
  const ctx = await getSessionContext();
  await assertPhaseNotSubmitted(ctx.affiliateId, phaseNumber);

  if (phaseNumber === 1) {
    return submitForm();
  }

  throw new Error(`Unknown phase: ${phaseNumber}`);
}
