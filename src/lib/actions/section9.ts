"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import type { Section9Data } from "@/lib/validations/section9";
import type { CompletionStatus } from "@/types";

export async function loadSection9(): Promise<Section9Data> {
  const ctx = await getSessionContext();

  const config = await prisma.careNavConfig.findFirst({
    where: { affiliateId: ctx.affiliateId },
  });

  return {
    primaryEscalationName: config?.primaryEscalationName ?? "",
    primaryEscalationEmail: config?.primaryEscalationEmail ?? "",
    secondaryEscalationName: config?.secondaryEscalationName ?? "",
    secondaryEscalationEmail: config?.secondaryEscalationEmail ?? "",
  };
}

export async function saveSection9(data: Section9Data, selectedProgramId?: string): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext(selectedProgramId);
  await assertNotSubmitted(ctx.affiliateId);

  const existing = await prisma.careNavConfig.findFirst({
    where: { affiliateId: ctx.affiliateId },
  });

  const configData = {
    primaryEscalationName: data.primaryEscalationName || null,
    primaryEscalationEmail: data.primaryEscalationEmail || null,
    secondaryEscalationName: data.secondaryEscalationName || null,
    secondaryEscalationEmail: data.secondaryEscalationEmail || null,
  };

  if (existing) {
    await prisma.careNavConfig.update({ where: { id: existing.id }, data: configData });
  } else {
    await prisma.careNavConfig.create({
      data: { affiliateId: ctx.affiliateId, ...configData },
    });
  }

  await writeSectionSnapshot(9, data, ctx.userId, ctx.affiliateId);

  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}
