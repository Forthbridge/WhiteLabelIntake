"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import type { Section8Data } from "@/lib/validations/section8";
import type { CompletionStatus } from "@/types";

export async function loadSection8(): Promise<Section8Data> {
  const ctx = await getSessionContext();

  const network = await prisma.radiologyNetwork.findFirst({
    where: { affiliateId: ctx.affiliateId },
  });

  return {
    networkName: network?.networkName ?? "",
    coordinationContactName: network?.coordinationContactName ?? "",
    coordinationContactEmail: network?.coordinationContactEmail ?? "",
    coordinationContactPhone: network?.coordinationContactPhone ?? "",
    integrationAcknowledged: network?.integrationAcknowledged ?? false,
  };
}

export async function saveSection8(data: Section8Data): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext();
  await assertNotSubmitted(ctx.affiliateId);

  const existing = await prisma.radiologyNetwork.findFirst({
    where: { affiliateId: ctx.affiliateId },
  });

  const netData = {
    networkName: data.networkName || null,
    coordinationContactName: data.coordinationContactName || null,
    coordinationContactEmail: data.coordinationContactEmail || null,
    coordinationContactPhone: data.coordinationContactPhone || null,
    integrationAcknowledged: data.integrationAcknowledged ?? false,
  };

  if (existing) {
    await prisma.radiologyNetwork.update({ where: { id: existing.id }, data: netData });
  } else {
    await prisma.radiologyNetwork.create({
      data: { affiliateId: ctx.affiliateId, ...netData },
    });
  }

  await writeSectionSnapshot(8, data, ctx.userId, ctx.affiliateId);

  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}
