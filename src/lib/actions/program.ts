"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext, assertPhaseNotSubmitted } from "./helpers";

export interface ProgramSummary {
  id: string;
  programName: string | null;
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const ctx = await getSessionContext();
  const programs = await prisma.program.findMany({
    where: { affiliateId: ctx.affiliateId },
    select: { id: true, programName: true },
    orderBy: { createdAt: "asc" },
  });
  return programs;
}

export async function duplicateProgram(
  sourceProgramId: string,
  newName: string
): Promise<string> {
  const ctx = await getSessionContext();
  await assertPhaseNotSubmitted(ctx.affiliateId, 1);

  // Verify source program belongs to this affiliate
  const source = await prisma.program.findFirst({
    where: { id: sourceProgramId, affiliateId: ctx.affiliateId },
    include: {
      services: true,
      subServices: true,
    },
  });
  if (!source) throw new Error("Source program not found");

  // Load network contracts + active terms for the source program
  const sourceContracts = await prisma.networkContract.findMany({
    where: { affiliateId: ctx.affiliateId, programId: sourceProgramId },
    include: {
      terms: {
        where: { status: "ACTIVE" },
      },
    },
  });

  // Create the new program with cloned fields
  const newProgram = await prisma.program.create({
    data: {
      affiliateId: ctx.affiliateId,
      programName: newName,
      contractStartDate: source.contractStartDate,
      contractEndDate: source.contractEndDate,
      adminContactName: source.adminContactName,
      adminContactEmail: source.adminContactEmail,
      executiveSponsorName: source.executiveSponsorName,
      executiveSponsorEmail: source.executiveSponsorEmail,
      estimatedMemberCount: source.estimatedMemberCount,
      defaultServicesConfirmed: source.defaultServicesConfirmed,
      geographicAvailability: source.geographicAvailability,
      itContactName: source.itContactName,
      itContactEmail: source.itContactEmail,
      itContactPhone: source.itContactPhone,
      w9FilePath: source.w9FilePath,
      achRoutingNumber: source.achRoutingNumber,
      achAccountNumber: source.achAccountNumber,
      achAccountType: source.achAccountType,
      achAccountHolderName: source.achAccountHolderName,
      bankDocFilePath: source.bankDocFilePath,
      paymentAchAccountHolderName: source.paymentAchAccountHolderName,
      paymentAchAccountType: source.paymentAchAccountType,
      paymentAchRoutingNumber: source.paymentAchRoutingNumber,
      paymentAchAccountNumber: source.paymentAchAccountNumber,
    },
  });

  // Clone services
  if (source.services.length > 0) {
    await prisma.service.createMany({
      data: source.services.map((s) => ({
        programId: newProgram.id,
        serviceType: s.serviceType,
        selected: s.selected,
        otherName: s.otherName,
      })),
    });
  }

  // Clone sub-services
  if (source.subServices.length > 0) {
    await prisma.subService.createMany({
      data: source.subServices.map((ss) => ({
        programId: newProgram.id,
        serviceType: ss.serviceType,
        subType: ss.subType,
        selected: ss.selected,
      })),
    });
  }

  // Clone network contracts + active terms
  for (const contract of sourceContracts) {
    const newContract = await prisma.networkContract.create({
      data: {
        affiliateId: ctx.affiliateId,
        sellerId: contract.sellerId,
        programId: newProgram.id,
        priceListId: contract.priceListId,
        notes: contract.notes,
      },
    });

    if (contract.terms.length > 0) {
      await prisma.networkContractTerm.createMany({
        data: contract.terms.map((term) => ({
          contractId: newContract.id,
          sellerLocationId: term.sellerLocationId,
          status: "ACTIVE" as const,
          startDate: new Date(),
          acceptedPricing: term.acceptedPricing ?? undefined,
          acceptedByUserId: ctx.userId,
          updatedByUserId: ctx.userId,
        })),
      });
    }
  }

  return newProgram.id;
}

export async function renameProgram(
  programId: string,
  name: string
): Promise<void> {
  const ctx = await getSessionContext();
  await assertPhaseNotSubmitted(ctx.affiliateId, 1);

  const program = await prisma.program.findFirst({
    where: { id: programId, affiliateId: ctx.affiliateId },
    select: { id: true },
  });
  if (!program) throw new Error("Program not found");

  await prisma.program.update({
    where: { id: programId },
    data: { programName: name || null },
  });
}

export async function deleteProgram(programId: string): Promise<void> {
  const ctx = await getSessionContext();
  await assertPhaseNotSubmitted(ctx.affiliateId, 1);

  // Count programs — prevent deleting the last one
  const count = await prisma.program.count({
    where: { affiliateId: ctx.affiliateId },
  });
  if (count <= 1) throw new Error("Cannot delete the only program");

  // Verify program belongs to this affiliate
  const program = await prisma.program.findFirst({
    where: { id: programId, affiliateId: ctx.affiliateId },
    select: { id: true },
  });
  if (!program) throw new Error("Program not found");

  // Cascade delete handles services, sub-services, network contracts, terms
  await prisma.program.delete({ where: { id: programId } });
}
