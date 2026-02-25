"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Gets the authenticated user's affiliate and program IDs.
 * Throws if not authenticated or no affiliate found.
 */
export async function getSessionContext(selectedProgramId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, affiliateId: true, role: true },
  });

  if (!user?.affiliateId) throw new Error("No affiliate found for user");

  // Resolve program ID: prefer explicit selection, fall back to first program
  let programId: string | null = null;
  if (selectedProgramId) {
    const program = await prisma.program.findFirst({
      where: { id: selectedProgramId, affiliateId: user.affiliateId },
      select: { id: true },
    });
    programId = program?.id ?? null;
  }
  if (!programId) {
    const program = await prisma.program.findFirst({
      where: { affiliateId: user.affiliateId },
      select: { id: true },
    });
    programId = program?.id ?? null;
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: user.affiliateId },
    select: { isAffiliate: true, isSeller: true },
  });

  return {
    userId: user.id,
    affiliateId: user.affiliateId,
    programId,
    role: user.role,
    isAffiliate: affiliate?.isAffiliate ?? true,
    isSeller: affiliate?.isSeller ?? false,
  };
}

/**
 * Auth gate for super-admin-only actions.
 * Throws if the user is not SUPER_ADMIN.
 */
export async function getSuperAdminContext(): Promise<{ userId: string; role: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Forbidden: requires SUPER_ADMIN role");

  return { userId: user.id, role: user.role };
}

/**
 * Resolves context for a specific affiliate.
 * SUPER_ADMIN can target any affiliate; other roles can only access their own.
 */
export async function getContextForAffiliate(targetAffiliateId: string, selectedProgramId?: string): Promise<{
  userId: string;
  affiliateId: string;
  programId: string | null;
  role: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, affiliateId: true, role: true },
  });

  if (!user) throw new Error("User not found");

  // Non-super-admins can only access their own affiliate
  if (user.role !== "SUPER_ADMIN" && user.affiliateId !== targetAffiliateId) {
    throw new Error("Forbidden: cannot access this affiliate");
  }

  let programId: string | null = null;
  if (selectedProgramId) {
    const program = await prisma.program.findFirst({
      where: { id: selectedProgramId, affiliateId: targetAffiliateId },
      select: { id: true },
    });
    programId = program?.id ?? null;
  }
  if (!programId) {
    const program = await prisma.program.findFirst({
      where: { affiliateId: targetAffiliateId },
      select: { id: true },
    });
    programId = program?.id ?? null;
  }

  return {
    userId: user.id,
    affiliateId: targetAffiliateId,
    programId,
    role: user.role,
  };
}

/**
 * Throws if the affiliate's form has been submitted (status = SUBMITTED).
 * Call at the top of save actions to enforce read-only after submission.
 */
export async function assertNotSubmitted(affiliateId: string) {
  const aff = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { status: true },
  });
  if (aff?.status === "SUBMITTED") {
    throw new Error("This form has been submitted and is locked. Contact your account manager to request changes.");
  }
}

/**
 * Phase-aware version of assertNotSubmitted.
 * Throws if the given phase has already been submitted.
 */
export async function assertPhaseNotSubmitted(affiliateId: string, phase: number) {
  if (phase === 1) {
    // Phase 1 still uses legacy Affiliate.status for backwards compatibility
    return assertNotSubmitted(affiliateId);
  }
  const phaseRecord = await prisma.affiliatePhase.findUnique({
    where: { affiliateId_phase: { affiliateId, phase } },
    select: { status: true },
  });
  if (phaseRecord?.status === "SUBMITTED") {
    throw new Error(`Phase ${phase} has been submitted and is locked. Contact your account manager to request changes.`);
  }
}

/**
 * Writes a section snapshot to the history table.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeSectionSnapshot(
  sectionId: number,
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  affiliateId: string,
  programId?: string | null
) {
  await prisma.sectionSnapshot.create({
    data: {
      sectionId,
      data,
      userId,
      affiliateId,
      programId: programId ?? undefined,
    },
  });
}
