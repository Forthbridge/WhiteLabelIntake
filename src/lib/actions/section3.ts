"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import { SERVICE_TYPES } from "@/lib/validations/section3";
import type { Section3Data } from "@/lib/validations/section3";
import type { CompletionStatus } from "@/types";

export async function loadSection3(): Promise<Section3Data> {
  const ctx = await getSessionContext();

  const services = ctx.programId
    ? await prisma.service.findMany({
        where: { programId: ctx.programId },
        select: { serviceType: true, selected: true, otherName: true },
      })
    : [];

  const serviceMap = new Map(services.map((s) => [s.serviceType, s]));

  return {
    services: SERVICE_TYPES.map((st) => ({
      serviceType: st.value,
      selected: ("locked" in st && st.locked) ? true : (serviceMap.get(st.value)?.selected ?? false),
      otherName: serviceMap.get(st.value)?.otherName ?? "",
    })),
  };
}

export async function saveSection3(data: Section3Data, selectedProgramId?: string): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext(selectedProgramId);
  await assertNotSubmitted(ctx.affiliateId);
  if (!ctx.programId) return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);

  // Replace all services in one transaction: deleteMany + createMany (PgBouncer-safe)
  await prisma.$transaction([
    prisma.service.deleteMany({
      where: { programId: ctx.programId },
    }),
    prisma.service.createMany({
      data: data.services.map((svc) => ({
        programId: ctx.programId!,
        serviceType: svc.serviceType,
        selected: svc.selected,
        otherName: svc.otherName || null,
      })),
    }),
  ]);

  await writeSectionSnapshot(3, { services: data.services }, ctx.userId, ctx.affiliateId, ctx.programId);

  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}
