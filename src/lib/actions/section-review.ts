"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContext } from "./helpers";

export interface SectionReviewRow {
  sectionId: number;
  userId: string;
  confirmedAt: Date;
}

export async function loadSectionReviews(): Promise<SectionReviewRow[]> {
  const ctx = await getSessionContext();

  const rows = await prisma.sectionReview.findMany({
    where: { affiliateId: ctx.affiliateId },
    select: { sectionId: true, userId: true, confirmedAt: true },
  });

  return rows;
}

export async function toggleSectionReview(
  sectionId: number,
  confirmed: boolean
): Promise<void> {
  const ctx = await getSessionContext();

  if (confirmed) {
    await prisma.sectionReview.upsert({
      where: {
        affiliateId_sectionId: {
          affiliateId: ctx.affiliateId,
          sectionId,
        },
      },
      create: {
        affiliateId: ctx.affiliateId,
        sectionId,
        userId: ctx.userId,
        confirmedAt: new Date(),
      },
      update: {
        userId: ctx.userId,
        confirmedAt: new Date(),
      },
    });
  } else {
    await prisma.sectionReview.deleteMany({
      where: {
        affiliateId: ctx.affiliateId,
        sectionId,
      },
    });
  }
}
