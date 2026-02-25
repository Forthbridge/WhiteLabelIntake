"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";
import { computeSellerStatuses } from "./seller-org";
import type { SellerSectionId } from "@/types";

export async function submitSellerFlow(): Promise<void> {
  const ctx = await getSessionContext();

  // Server-side gate: all seller sections (S-1 through S-6) must be complete
  const statuses = await computeSellerStatuses(ctx.affiliateId);
  const requiredSections: SellerSectionId[] = ["S-1", "S-2", "S-3", "S-4", "S-5", "S-6"];
  const incomplete = requiredSections.filter((id) => statuses[id] !== "complete");

  if (incomplete.length > 0) {
    throw new Error(`Cannot submit: incomplete sections — ${incomplete.join(", ")}`);
  }

  // Mark seller flow as submitted
  await prisma.onboardingFlow.upsert({
    where: {
      affiliateId_flowType: {
        affiliateId: ctx.affiliateId,
        flowType: "SELLER",
      },
    },
    update: {
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
    create: {
      affiliateId: ctx.affiliateId,
      flowType: "SELLER",
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  // Auto-self-contract: if this org is also an affiliate (dual-role),
  // create a NetworkContract so their seller locations appear in their buyer network
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: ctx.affiliateId },
    select: { isAffiliate: true },
  });

  if (affiliate?.isAffiliate) {
    // Ensure self-contracts exist for all programs; active terms are auto-created by loadNetworkData
    const programs = await prisma.program.findMany({
      where: { affiliateId: ctx.affiliateId },
      select: { id: true },
    });
    if (programs.length > 0) {
      await prisma.networkContract.createMany({
        data: programs.map((prog) => ({
          affiliateId: ctx.affiliateId,
          sellerId: ctx.affiliateId,
          programId: prog.id,
        })),
        skipDuplicates: true,
      });
    } else {
      // Legacy null-program contract if no programs exist
      await prisma.networkContract.createMany({
        data: [{ affiliateId: ctx.affiliateId, sellerId: ctx.affiliateId }],
        skipDuplicates: true,
      });
    }
  }
}
