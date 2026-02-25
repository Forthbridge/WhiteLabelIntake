"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, writeSectionSnapshot, assertNotSubmitted } from "./helpers";
import { getCompletionStatuses } from "./completion";
import { encryptField } from "@/lib/encryption";
import type { Section4Data } from "@/lib/validations/section4";
import type { CompletionStatus } from "@/types";

export async function saveSection4(data: Section4Data, selectedProgramId?: string): Promise<Record<number, CompletionStatus>> {
  const ctx = await getSessionContext(selectedProgramId);
  await assertNotSubmitted(ctx.affiliateId);
  if (!ctx.programId) return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);

  await prisma.program.update({
    where: { id: ctx.programId },
    data: {
      w9FilePath: data.w9FilePath,
      achRoutingNumber: data.achRoutingNumber ? encryptField(data.achRoutingNumber) : null,
      achAccountNumber: data.achAccountNumber ? encryptField(data.achAccountNumber) : null,
      achAccountType: data.achAccountType,
      achAccountHolderName: data.achAccountHolderName || null,
      bankDocFilePath: data.bankDocFilePath,
      paymentAchAccountHolderName: data.paymentAchAccountHolderName || null,
      paymentAchAccountType: data.paymentAchAccountType,
      paymentAchRoutingNumber: data.paymentAchRoutingNumber ? encryptField(data.paymentAchRoutingNumber) : null,
      paymentAchAccountNumber: data.paymentAchAccountNumber ? encryptField(data.paymentAchAccountNumber) : null,
    },
  });

  await writeSectionSnapshot(
    4,
    {
      w9FilePath: data.w9FilePath,
      achAccountType: data.achAccountType,
      achAccountHolderName: data.achAccountHolderName,
      bankDocFilePath: data.bankDocFilePath,
      hasAchRouting: !!data.achRoutingNumber,
      hasAchAccount: !!data.achAccountNumber,
      paymentAchAccountHolderName: data.paymentAchAccountHolderName,
      paymentAchAccountType: data.paymentAchAccountType,
      hasPaymentAchRouting: !!data.paymentAchRoutingNumber,
      hasPaymentAchAccount: !!data.paymentAchAccountNumber,
    },
    ctx.userId,
    ctx.affiliateId,
    ctx.programId
  );

  return getCompletionStatuses(ctx.affiliateId, ctx.programId ?? undefined);
}
