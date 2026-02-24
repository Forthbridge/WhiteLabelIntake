"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import { section1Schema, type Section1Data } from "@/lib/validations/section1";
import type { Prisma } from "@prisma/client";
import type { CompletionStatus } from "@/types";

export async function loadSection1(): Promise<Section1Data> {
  const ctx = await getSessionContext();

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: ctx.affiliateId },
    select: { legalName: true },
  });

  const program = ctx.programId
    ? await prisma.program.findUnique({
        where: { id: ctx.programId },
        select: {
          adminContactName: true,
          adminContactEmail: true,
          executiveSponsorName: true,
          executiveSponsorEmail: true,
          itContactName: true,
          itContactEmail: true,
          itContactPhone: true,
        },
      })
    : null;

  return {
    legalName: affiliate?.legalName ?? "",
    adminContactName: program?.adminContactName ?? "",
    adminContactEmail: program?.adminContactEmail ?? "",
    executiveSponsorName: program?.executiveSponsorName ?? "",
    executiveSponsorEmail: program?.executiveSponsorEmail ?? "",
    itContactName: program?.itContactName ?? "",
    itContactEmail: program?.itContactEmail ?? "",
    itContactPhone: program?.itContactPhone ?? "",
  };
}

export async function saveSection1(data: Section1Data): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext();
  await assertNotSubmitted(ctx.affiliateId);
  const parsed = section1Schema.parse(data);

  // Update affiliate legal name
  await prisma.affiliate.update({
    where: { id: ctx.affiliateId },
    data: { legalName: parsed.legalName || null },
  });

  // Update program fields
  if (ctx.programId) {
    await prisma.program.update({
      where: { id: ctx.programId },
      data: {
        adminContactName: parsed.adminContactName || null,
        adminContactEmail: parsed.adminContactEmail || null,
        executiveSponsorName: parsed.executiveSponsorName || null,
        executiveSponsorEmail: parsed.executiveSponsorEmail || null,
        itContactName: parsed.itContactName || null,
        itContactEmail: parsed.itContactEmail || null,
        itContactPhone: parsed.itContactPhone || null,
      },
    });
  }

  await writeSectionSnapshot(1, parsed as unknown as Prisma.InputJsonValue, ctx.userId, ctx.affiliateId, ctx.programId);

  return getCompletionStatuses(ctx.affiliateId);
}
