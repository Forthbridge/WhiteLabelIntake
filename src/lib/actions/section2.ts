"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import type { Section2Data } from "@/lib/validations/section2";
import type { CompletionStatus } from "@/types";

export async function loadSection2(): Promise<Section2Data> {
  const ctx = await getSessionContext();

  const program = ctx.programId
    ? await prisma.program.findUnique({
        where: { id: ctx.programId },
        select: { programName: true },
      })
    : null;

  return {
    programName: program?.programName ?? "",
  };
}

export async function saveSection2(data: Section2Data): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext();
  await assertNotSubmitted(ctx.affiliateId);

  if (ctx.programId) {
    await prisma.program.update({
      where: { id: ctx.programId },
      data: {
        programName: data.programName || null,
      },
    });
  }

  await writeSectionSnapshot(2, data, ctx.userId, ctx.affiliateId, ctx.programId);

  return getCompletionStatuses(ctx.affiliateId);
}
