"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, assertPhaseNotSubmitted, writeSectionSnapshot } from "./helpers";
import { getCompletionStatuses } from "./completion";
import { SUB_SERVICE_TYPES } from "@/lib/validations/section11";
import type { Section11Data } from "@/lib/validations/section11";
import type { CompletionStatus } from "@/types";

export async function loadSection11(): Promise<Section11Data> {
  const ctx = await getSessionContext();

  const program = await prisma.program.findFirst({
    where: { affiliateId: ctx.affiliateId },
    include: { services: true, subServices: true },
  });

  if (!program) return { categories: {} };

  // Get selected service types from Section 3
  const selectedServiceTypes = program.services
    .filter((s) => s.selected)
    .map((s) => s.serviceType);

  const subServiceMap = new Map(
    program.subServices.map((ss) => [`${ss.serviceType}:${ss.subType}`, ss.selected])
  );

  const categories: Section11Data["categories"] = {};
  for (const serviceType of selectedServiceTypes) {
    const subItems = SUB_SERVICE_TYPES[serviceType];
    if (!subItems) continue;
    categories[serviceType] = subItems.map((item) => ({
      subType: item.value,
      selected: subServiceMap.get(`${serviceType}:${item.value}`) ?? false,
    }));
  }

  return { categories };
}

export async function saveSection11(data: Section11Data, selectedProgramId?: string): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext(selectedProgramId);
  await assertPhaseNotSubmitted(ctx.affiliateId, 1);

  if (!ctx.programId) return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);

  // Flatten categories into SubService records
  const records: { programId: string; serviceType: string; subType: string; selected: boolean }[] = [];
  for (const [serviceType, items] of Object.entries(data.categories)) {
    for (const item of items) {
      records.push({
        programId: ctx.programId,
        serviceType,
        subType: item.subType,
        selected: item.selected,
      });
    }
  }

  await prisma.$transaction([
    prisma.subService.deleteMany({ where: { programId: ctx.programId } }),
    prisma.subService.createMany({ data: records }),
  ]);

  await writeSectionSnapshot(11, data, ctx.userId, ctx.affiliateId, ctx.programId);
  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}
