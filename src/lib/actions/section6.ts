"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import type { Section6Data } from "@/lib/validations/section6";
import type { CompletionStatus } from "@/types";

export async function loadSection6(): Promise<Section6Data> {
  const ctx = await getSessionContext();

  const providers = await prisma.provider.findMany({
    where: { affiliateId: ctx.affiliateId },
    orderBy: { createdAt: "asc" },
  });

  return {
    providers: providers.map((p) => ({
      id: p.id,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      providerType: p.providerType as "physician" | "np" | "pa" | "other" | null,
      licenseNumber: p.licenseNumber ?? "",
      licenseState: p.licenseState ?? "",
      npi: p.npi ?? "",
      deaNumber: p.deaNumber ?? "",
    })),
  };
}

interface SaveSection6Result {
  statuses: Record<number, CompletionStatus>;
  /** IDs assigned to each provider (same order as input). */
  providerIds: string[];
}

export async function saveSection6(data: Section6Data): Promise<SaveSection6Result> {
  const ctx = await getSessionContext();
  await assertNotSubmitted(ctx.affiliateId);

  const providerIds: string[] = [];

  for (const prov of data.providers) {
    const providerData = {
      firstName: prov.firstName || null,
      lastName: prov.lastName || null,
      providerType: prov.providerType || null,
      licenseNumber: prov.licenseNumber || null,
      licenseState: prov.licenseState || null,
      npi: prov.npi || null,
      deaNumber: prov.deaNumber || null,
    };

    if (prov.id) {
      await prisma.provider.update({
        where: { id: prov.id },
        data: providerData,
      });
      providerIds.push(prov.id);
    } else {
      const created = await prisma.provider.create({
        data: { affiliateId: ctx.affiliateId, ...providerData },
      });
      providerIds.push(created.id);
    }
  }

  // Use the resolved IDs for the snapshot (don't mutate input)
  const providersWithIds = data.providers.map((p, i) => ({ ...p, id: providerIds[i] }));
  await writeSectionSnapshot(6, { providers: providersWithIds }, ctx.userId, ctx.affiliateId);

  const statuses = await getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
  return { statuses, providerIds };
}

export async function deleteProvider(providerId: string) {
  const ctx = await getSessionContext();
  const provider = await prisma.provider.findFirst({
    where: { id: providerId, affiliateId: ctx.affiliateId },
  });
  if (!provider) throw new Error("Provider not found");
  await prisma.provider.delete({ where: { id: providerId } });
}
