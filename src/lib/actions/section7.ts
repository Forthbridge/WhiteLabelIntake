"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import type { Section7Data } from "@/lib/validations/section7";
import type { CompletionStatus } from "@/types";

export async function loadSection7(): Promise<Section7Data> {
  const ctx = await getSessionContext();

  const labNetwork = await prisma.labNetwork.findFirst({
    where: { affiliateId: ctx.affiliateId },
  });

  return {
    networkType: (labNetwork?.networkType as Section7Data["networkType"]) ?? null,
    otherNetworkName: labNetwork?.otherNetworkName ?? "",
    coordinationContactName: labNetwork?.coordinationContactName ?? "",
    coordinationContactEmail: labNetwork?.coordinationContactEmail ?? "",
    coordinationContactPhone: labNetwork?.coordinationContactPhone ?? "",
    integrationAcknowledged: labNetwork?.integrationAcknowledged ?? false,
  };
}

export async function saveSection7(data: Section7Data): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext();
  await assertNotSubmitted(ctx.affiliateId);

  const existing = await prisma.labNetwork.findFirst({
    where: { affiliateId: ctx.affiliateId },
  });

  const labData = {
    networkType: data.networkType,
    otherNetworkName: data.otherNetworkName || null,
    coordinationContactName: data.coordinationContactName || null,
    coordinationContactEmail: data.coordinationContactEmail || null,
    coordinationContactPhone: data.coordinationContactPhone || null,
    integrationAcknowledged: data.integrationAcknowledged ?? false,
  };

  if (existing) {
    await prisma.labNetwork.update({ where: { id: existing.id }, data: labData });
  } else {
    await prisma.labNetwork.create({
      data: { affiliateId: ctx.affiliateId, ...labData },
    });
  }

  await writeSectionSnapshot(7, data, ctx.userId, ctx.affiliateId);

  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}
