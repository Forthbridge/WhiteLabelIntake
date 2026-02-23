"use server";

import { prisma } from "@/lib/prisma";
import { getSuperAdminContext } from "./helpers";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────

export interface AffiliateListItem {
  id: string;
  legalName: string | null;
  status: string;
  createdAt: Date;
  adminUser: { name: string | null; email: string } | null;
  programName: string | null;
  completionPct: number;
}

export interface AffiliateDetail {
  id: string;
  legalName: string | null;
  status: string;
  isAffiliate: boolean;
  isSeller: boolean;
  marketplaceEnabled: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  users: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    deletedAt: Date | null;
    createdAt: Date;
  }[];
}

export interface UserListItem {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  deletedAt: Date | null;
  createdAt: Date;
  affiliate: { id: string; legalName: string | null } | null;
}

// ─── List Affiliates ────────────────────────────────────────────────

export async function listAffiliates(): Promise<AffiliateListItem[]> {
  await getSuperAdminContext();

  const affiliates = await prisma.affiliate.findMany({
    where: { deletedAt: null },
    include: {
      users: {
        where: { role: "ADMIN", deletedAt: null },
        take: 1,
        select: { name: true, email: true },
      },
      programs: {
        take: 1,
        select: { programName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return affiliates.map((a) => ({
    id: a.id,
    legalName: a.legalName,
    status: a.status,
    createdAt: a.createdAt,
    adminUser: a.users[0] ?? null,
    programName: a.programs[0]?.programName ?? null,
    completionPct: 0, // Will be computed on detail page
  }));
}

// ─── Get Affiliate Detail ───────────────────────────────────────────

export async function getAffiliateDetail(affiliateId: string): Promise<AffiliateDetail | null> {
  await getSuperAdminContext();

  return prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: {
      users: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          deletedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ─── Create Affiliate + Admin ───────────────────────────────────────

export async function createAffiliateWithAdmin(input: {
  email: string;
  name: string;
  password?: string;
  legalName?: string;
}): Promise<{ affiliateId: string; userId: string }> {
  await getSuperAdminContext();

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("A user with this email already exists");

  const password = input.password || generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const affiliate = await prisma.affiliate.create({
    data: {
      legalName: input.legalName || null,
      users: {
        create: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: "ADMIN",
        },
      },
    },
    include: { users: true },
  });

  // Create initial program
  await prisma.program.create({
    data: { affiliateId: affiliate.id },
  });

  return {
    affiliateId: affiliate.id,
    userId: affiliate.users[0].id,
  };
}

// ─── List All Users ─────────────────────────────────────────────────

export async function listAllUsers(): Promise<UserListItem[]> {
  await getSuperAdminContext();

  return prisma.user.findMany({
    where: { deletedAt: null, role: { not: "SUPER_ADMIN" } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      deletedAt: true,
      createdAt: true,
      affiliate: {
        select: { id: true, legalName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Create User for Affiliate ──────────────────────────────────────

export async function createUserForAffiliate(input: {
  email: string;
  name: string;
  affiliateId: string;
  role: "ADMIN" | "COLLABORATOR";
}): Promise<{ userId: string }> {
  await getSuperAdminContext();

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("A user with this email already exists");

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      affiliateId: input.affiliateId,
    },
  });

  return { userId: user.id };
}

// ─── Soft Delete ────────────────────────────────────────────────────

export async function softDeleteAffiliate(affiliateId: string): Promise<void> {
  await getSuperAdminContext();

  const now = new Date();

  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { deletedAt: now },
  });

  await prisma.user.updateMany({
    where: { affiliateId },
    data: { deletedAt: now },
  });
}

export async function softDeleteUser(userId: string): Promise<void> {
  await getSuperAdminContext();

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
}

export async function restoreAffiliate(affiliateId: string): Promise<void> {
  await getSuperAdminContext();

  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { deletedAt: null },
  });

  await prisma.user.updateMany({
    where: { affiliateId },
    data: { deletedAt: null },
  });
}

// ─── Unlock Submitted Form ──────────────────────────────────────────

export async function unlockAffiliate(affiliateId: string): Promise<void> {
  await getSuperAdminContext();

  await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        status: "DRAFT",
        submittedAt: null,
      },
    }),
    prisma.affiliatePhase.updateMany({
      where: { affiliateId, phase: 1 },
      data: { status: "DRAFT", submittedAt: null },
    }),
  ]);
}

// ─── Phase Management ───────────────────────────────────────────────

export interface PhaseStatus {
  phase: number;
  status: string;
  unlockedAt: Date | null;
  submittedAt: Date | null;
}

export async function getPhaseStatuses(affiliateId: string): Promise<PhaseStatus[]> {
  await getSuperAdminContext();

  const phases = await prisma.affiliatePhase.findMany({
    where: { affiliateId },
    orderBy: { phase: "asc" },
    select: { phase: true, status: true, unlockedAt: true, submittedAt: true },
  });
  return phases;
}

export async function unlockPhase(affiliateId: string, phaseNumber: number): Promise<void> {
  await getSuperAdminContext();

  await prisma.affiliatePhase.upsert({
    where: { affiliateId_phase: { affiliateId, phase: phaseNumber } },
    update: { status: "DRAFT", unlockedAt: new Date(), submittedAt: null },
    create: { affiliateId, phase: phaseNumber, status: "DRAFT", unlockedAt: new Date() },
  });
}

export async function lockPhase(affiliateId: string, phaseNumber: number): Promise<void> {
  await getSuperAdminContext();

  if (phaseNumber === 1) {
    // Phase 1 lock = submit the affiliate
    await prisma.$transaction([
      prisma.affiliate.update({
        where: { id: affiliateId },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      }),
      prisma.affiliatePhase.upsert({
        where: { affiliateId_phase: { affiliateId, phase: 1 } },
        update: { status: "SUBMITTED", submittedAt: new Date() },
        create: { affiliateId, phase: 1, status: "SUBMITTED", submittedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.affiliatePhase.update({
      where: { affiliateId_phase: { affiliateId, phase: phaseNumber } },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  }
}

export async function unlockPhaseForEditing(affiliateId: string, phaseNumber: number): Promise<void> {
  await getSuperAdminContext();

  if (phaseNumber === 1) {
    return unlockAffiliate(affiliateId);
  }

  await prisma.affiliatePhase.update({
    where: { affiliateId_phase: { affiliateId, phase: phaseNumber } },
    data: { status: "DRAFT", submittedAt: null },
  });
}

// ─── Role Management ─────────────────────────────────────────────

export async function updateAffiliateRoles(
  affiliateId: string,
  roles: { isAffiliate: boolean; isSeller: boolean; marketplaceEnabled?: boolean }
): Promise<void> {
  await getSuperAdminContext();

  if (!roles.isAffiliate && !roles.isSeller) {
    throw new Error("Organization must have at least one role enabled");
  }

  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      isAffiliate: roles.isAffiliate,
      isSeller: roles.isSeller,
      ...(roles.marketplaceEnabled !== undefined && { marketplaceEnabled: roles.marketplaceEnabled }),
    },
  });
}

// ─── Network Contract Management ──────────────────────────────────

export interface NetworkContractItem {
  id: string;
  affiliateId: string;
  affiliateName: string | null;
  sellerId: string;
  sellerName: string | null;
  notes: string | null;
  activeTermCount: number;
  totalLocationCount: number;
  createdAt: Date;
}

export async function listNetworkContracts(
  affiliateId?: string
): Promise<NetworkContractItem[]> {
  await getSuperAdminContext();

  const contracts = await prisma.networkContract.findMany({
    where: affiliateId ? { affiliateId } : undefined,
    include: {
      affiliate: { select: { legalName: true } },
      seller: { select: { legalName: true, _count: { select: { sellerLocations: true } } } },
      terms: {
        orderBy: { createdAt: "desc" },
        select: { sellerLocationId: true, status: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((c) => {
    // Dedupe terms to get latest per location
    const latestPerLoc = new Map<string, string>();
    for (const t of c.terms) {
      if (!latestPerLoc.has(t.sellerLocationId)) {
        latestPerLoc.set(t.sellerLocationId, t.status);
      }
    }
    const activeCount = Array.from(latestPerLoc.values()).filter((s) => s === "ACTIVE").length;

    return {
      id: c.id,
      affiliateId: c.affiliateId,
      affiliateName: c.affiliate.legalName,
      sellerId: c.sellerId,
      sellerName: c.seller.legalName,
      notes: c.notes,
      activeTermCount: activeCount,
      totalLocationCount: c.seller._count.sellerLocations,
      createdAt: c.createdAt,
    };
  });
}

export async function createNetworkContract(input: {
  affiliateId: string;
  sellerId: string;
  notes?: string;
}): Promise<{ contractId: string }> {
  await getSuperAdminContext();

  // Validate both orgs exist and have correct roles
  const [affiliate, seller] = await Promise.all([
    prisma.affiliate.findUnique({ where: { id: input.affiliateId }, select: { isAffiliate: true } }),
    prisma.affiliate.findUnique({ where: { id: input.sellerId }, select: { isSeller: true } }),
  ]);

  if (!affiliate?.isAffiliate) throw new Error("Target organization is not an affiliate");
  if (!seller?.isSeller) throw new Error("Target organization is not a seller");

  const isSelfContract = input.affiliateId === input.sellerId;

  const contract = await prisma.networkContract.create({
    data: {
      affiliateId: input.affiliateId,
      sellerId: input.sellerId,
      notes: input.notes || null,
    },
  });

  // Self-contracts: create ACTIVE terms for all seller locations
  if (isSelfContract) {
    const selfLocations = await prisma.sellerLocation.findMany({
      where: { affiliateId: input.affiliateId },
      select: { id: true },
    });

    if (selfLocations.length > 0) {
      await prisma.networkContractTerm.createMany({
        data: selfLocations.map((loc) => ({
          contractId: contract.id,
          sellerLocationId: loc.id,
          status: "ACTIVE" as const,
        })),
      });
    }
  }

  return { contractId: contract.id };
}

export async function deleteNetworkContract(contractId: string): Promise<void> {
  await getSuperAdminContext();
  await prisma.networkContract.delete({ where: { id: contractId } });
}

// ─── List sellers (for contract creation) ─────────────────────────

export async function listSellers(): Promise<{ id: string; legalName: string | null }[]> {
  await getSuperAdminContext();
  return prisma.affiliate.findMany({
    where: { isSeller: true, deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });
}

// ─── Seller Flow Management ──────────────────────────────────────

export interface SellerFlowStatus {
  status: string;
  submittedAt: Date | null;
}

export async function getSellerFlowStatus(affiliateId: string): Promise<SellerFlowStatus | null> {
  await getSuperAdminContext();

  const flow = await prisma.onboardingFlow.findUnique({
    where: { affiliateId_flowType: { affiliateId, flowType: "SELLER" } },
    select: { status: true, submittedAt: true },
  });

  return flow;
}

export async function unlockSellerFlow(affiliateId: string): Promise<void> {
  await getSuperAdminContext();

  await prisma.onboardingFlow.update({
    where: { affiliateId_flowType: { affiliateId, flowType: "SELLER" } },
    data: { status: "DRAFT", submittedAt: null },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-10) + "A1!";
}
