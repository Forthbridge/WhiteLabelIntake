import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "TestPass123!";

// Store created IDs for teardown
export interface SeedResult {
  superAdminUserId: string;
  buyerAffiliateId: string;
  buyerAdminUserId: string;
  buyerProgramId: string;
  collabUserId: string;
  sellerAffiliateId: string;
  sellerAdminUserId: string;
  sellerLocationIds: string[];
  sellerPriceListId: string;
  dualAffiliateId: string;
  dualAdminUserId: string;
  dualProgramId: string;
  dualSellerLocationId: string;
  networkContractId: string;
}

export async function seedTestData(): Promise<SeedResult> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  // 1. Super-admin user (no affiliate)
  const superAdmin = await prisma.user.upsert({
    where: { email: "e2e-superadmin@test.com" },
    update: { passwordHash, role: "SUPER_ADMIN", deletedAt: null },
    create: {
      email: "e2e-superadmin@test.com",
      name: "E2E Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  // 2. Buyer affiliate (isAffiliate: true, isSeller: false, marketplace: true)
  const buyerAffiliate = await prisma.affiliate.create({
    data: {
      legalName: "E2E Buyer Corp",
      status: "DRAFT",
      isAffiliate: true,
      isSeller: false,
      marketplaceEnabled: true,
    },
  });

  const buyerAdmin = await prisma.user.upsert({
    where: { email: "e2e-buyer-admin@test.com" },
    update: { passwordHash, role: "ADMIN", affiliateId: buyerAffiliate.id, deletedAt: null },
    create: {
      email: "e2e-buyer-admin@test.com",
      name: "E2E Buyer Admin",
      passwordHash,
      role: "ADMIN",
      affiliateId: buyerAffiliate.id,
    },
  });

  const buyerProgram = await prisma.program.create({
    data: {
      affiliateId: buyerAffiliate.id,
      // No programName — buyer starts with blank form so Section 2 is "not_started"
    },
  });

  const collab = await prisma.user.upsert({
    where: { email: "e2e-collab@test.com" },
    update: { passwordHash, role: "COLLABORATOR", affiliateId: buyerAffiliate.id, deletedAt: null },
    create: {
      email: "e2e-collab@test.com",
      name: "E2E Collaborator",
      passwordHash,
      role: "COLLABORATOR",
      affiliateId: buyerAffiliate.id,
    },
  });

  // 3. Seller affiliate (isAffiliate: false, isSeller: true)
  const sellerAffiliate = await prisma.affiliate.create({
    data: {
      legalName: "E2E Seller Corp",
      status: "DRAFT",
      isAffiliate: false,
      isSeller: true,
    },
  });

  const sellerAdmin = await prisma.user.upsert({
    where: { email: "e2e-seller-admin@test.com" },
    update: { passwordHash, role: "ADMIN", affiliateId: sellerAffiliate.id, deletedAt: null },
    create: {
      email: "e2e-seller-admin@test.com",
      name: "E2E Seller Admin",
      passwordHash,
      role: "ADMIN",
      affiliateId: sellerAffiliate.id,
    },
  });

  await prisma.sellerProfile.upsert({
    where: { affiliateId: sellerAffiliate.id },
    update: {},
    create: {
      affiliateId: sellerAffiliate.id,
      legalName: "E2E Seller Corp",
      adminContactName: "Seller Admin",
      adminContactEmail: "e2e-seller-admin@test.com",
    },
  });

  const sellerLoc1 = await prisma.sellerLocation.create({
    data: {
      affiliateId: sellerAffiliate.id,
      locationName: "E2E Seller Location 1",
      streetAddress: "100 Test Street",
      city: "Columbus",
      state: "OH",
      zip: "43215",
      locationNpi: "1234567890",
      phoneNumber: "614-555-0100",
      latitude: 39.9612,
      longitude: -82.9988,
    },
  });

  const sellerLoc2 = await prisma.sellerLocation.create({
    data: {
      affiliateId: sellerAffiliate.id,
      locationName: "E2E Seller Location 2",
      streetAddress: "200 Test Avenue",
      city: "Cleveland",
      state: "OH",
      zip: "44114",
      locationNpi: "0987654321",
      phoneNumber: "216-555-0200",
      latitude: 41.4993,
      longitude: -81.6944,
    },
  });

  // Seller service offerings
  await prisma.sellerServiceOffering.create({
    data: {
      affiliateId: sellerAffiliate.id,
      serviceType: "clinic_visit",
      selected: true,
      basePricePerVisit: 150.0,
    },
  });

  await prisma.sellerServiceOffering.create({
    data: {
      affiliateId: sellerAffiliate.id,
      serviceType: "labs",
      selected: true,
    },
  });

  // A few org-level sub-services with pricing
  await prisma.sellerOrgSubService.create({
    data: {
      affiliateId: sellerAffiliate.id,
      serviceType: "labs",
      subType: "cbc-diff-platelets",
      selected: true,
      unitPrice: 25.0,
    },
  });

  await prisma.sellerOrgSubService.create({
    data: {
      affiliateId: sellerAffiliate.id,
      serviceType: "labs",
      subType: "hemoglobin-a1c",
      selected: true,
      unitPrice: 35.0,
    },
  });

  // Seller price list
  const priceList = await prisma.sellerPriceList.create({
    data: {
      affiliateId: sellerAffiliate.id,
      name: "Standard",
      isDefault: true,
      isPublic: true,
    },
  });

  // Price list visit price
  await prisma.sellerPriceListVisit.create({
    data: {
      priceListId: priceList.id,
      serviceType: "clinic_visit",
      pricePerVisit: 150.0,
    },
  });

  // Price list sub-service prices
  await prisma.sellerPriceListSubService.create({
    data: {
      priceListId: priceList.id,
      serviceType: "labs",
      subType: "cbc-diff-platelets",
      unitPrice: 25.0,
    },
  });

  await prisma.sellerPriceListSubService.create({
    data: {
      priceListId: priceList.id,
      serviceType: "labs",
      subType: "hemoglobin-a1c",
      unitPrice: 35.0,
    },
  });

  // Seller onboarding flow (DRAFT)
  await prisma.onboardingFlow.create({
    data: {
      affiliateId: sellerAffiliate.id,
      flowType: "SELLER",
      status: "DRAFT",
    },
  });

  // 4. Dual-role affiliate (isAffiliate: true, isSeller: true)
  const dualAffiliate = await prisma.affiliate.create({
    data: {
      legalName: "E2E Dual Corp",
      status: "DRAFT",
      isAffiliate: true,
      isSeller: true,
      marketplaceEnabled: true,
    },
  });

  const dualAdmin = await prisma.user.upsert({
    where: { email: "e2e-dual@test.com" },
    update: { passwordHash, role: "ADMIN", affiliateId: dualAffiliate.id, deletedAt: null },
    create: {
      email: "e2e-dual@test.com",
      name: "E2E Dual Admin",
      passwordHash,
      role: "ADMIN",
      affiliateId: dualAffiliate.id,
    },
  });

  const dualProgram = await prisma.program.create({
    data: {
      affiliateId: dualAffiliate.id,
      programName: "E2E Dual Plan",
    },
  });

  await prisma.sellerProfile.upsert({
    where: { affiliateId: dualAffiliate.id },
    update: {},
    create: {
      affiliateId: dualAffiliate.id,
      legalName: "E2E Dual Corp",
      adminContactName: "Dual Admin",
      adminContactEmail: "e2e-dual@test.com",
    },
  });

  const dualSellerLoc = await prisma.sellerLocation.create({
    data: {
      affiliateId: dualAffiliate.id,
      locationName: "E2E Dual Location 1",
      streetAddress: "300 Dual Street",
      city: "Cincinnati",
      state: "OH",
      zip: "45202",
      locationNpi: "1122334455",
      phoneNumber: "513-555-0300",
      latitude: 39.1031,
      longitude: -84.512,
    },
  });

  // 5. Network contract: buyer → seller
  const contract = await prisma.networkContract.create({
    data: {
      affiliateId: buyerAffiliate.id,
      sellerId: sellerAffiliate.id,
      programId: buyerProgram.id,
    },
  });

  console.log("[e2e seed] Test data created successfully");

  return {
    superAdminUserId: superAdmin.id,
    buyerAffiliateId: buyerAffiliate.id,
    buyerAdminUserId: buyerAdmin.id,
    buyerProgramId: buyerProgram.id,
    collabUserId: collab.id,
    sellerAffiliateId: sellerAffiliate.id,
    sellerAdminUserId: sellerAdmin.id,
    sellerLocationIds: [sellerLoc1.id, sellerLoc2.id],
    sellerPriceListId: priceList.id,
    dualAffiliateId: dualAffiliate.id,
    dualAdminUserId: dualAdmin.id,
    dualProgramId: dualProgram.id,
    dualSellerLocationId: dualSellerLoc.id,
    networkContractId: contract.id,
  };
}

export async function teardownTestData(): Promise<void> {
  // Find all e2e affiliates by legalName prefix
  const e2eAffiliates = await prisma.affiliate.findMany({
    where: { legalName: { startsWith: "E2E " } },
    select: { id: true },
  });

  // Also find affiliates owned by e2e- users (e.g. registration-created affiliates with no legalName)
  const e2eUsers = await prisma.user.findMany({
    where: { email: { startsWith: "e2e-" } },
    select: { id: true, affiliateId: true },
  });
  const userAffIds = e2eUsers
    .map((u) => u.affiliateId)
    .filter((id): id is string => id !== null);

  // Also find orphaned affiliates with no legalName and no users (left behind by crashed test runs)
  const orphanedAffiliates = await prisma.affiliate.findMany({
    where: { legalName: null, users: { none: {} } },
    select: { id: true },
  });

  const affIds = [
    ...new Set([
      ...e2eAffiliates.map((a) => a.id),
      ...userAffIds,
      ...orphanedAffiliates.map((a) => a.id),
    ]),
  ];
  const userIds = e2eUsers.map((u) => u.id);

  if (affIds.length === 0 && userIds.length === 0) {
    console.log("[e2e teardown] No test data found");
    return;
  }

  // Delete in reverse dependency order using a transaction
  await prisma.$transaction([
    // Network contract terms (depend on contracts + seller locations)
    prisma.networkContractTerm.deleteMany({
      where: {
        contract: {
          OR: [
            { affiliateId: { in: affIds } },
            { sellerId: { in: affIds } },
          ],
        },
      },
    }),

    // Network contracts
    prisma.networkContract.deleteMany({
      where: {
        OR: [
          { affiliateId: { in: affIds } },
          { sellerId: { in: affIds } },
        ],
      },
    }),

    // Price list sub-service prices
    prisma.sellerPriceListSubService.deleteMany({
      where: { priceList: { affiliateId: { in: affIds } } },
    }),

    // Price list visit prices
    prisma.sellerPriceListVisit.deleteMany({
      where: { priceList: { affiliateId: { in: affIds } } },
    }),

    // Price list rules
    prisma.sellerPriceListRule.deleteMany({
      where: {
        OR: [
          { priceList: { affiliateId: { in: affIds } } },
          { buyerId: { in: affIds } },
        ],
      },
    }),

    // Price lists
    prisma.sellerPriceList.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Seller location sub-services
    prisma.sellerLocationSubService.deleteMany({
      where: { sellerLocation: { affiliateId: { in: affIds } } },
    }),

    // Seller location service configs
    prisma.sellerLocationServiceConfig.deleteMany({
      where: { sellerLocation: { affiliateId: { in: affIds } } },
    }),

    // Seller provider locations
    prisma.sellerProviderLocation.deleteMany({
      where: { sellerProvider: { affiliateId: { in: affIds } } },
    }),

    // Seller scheduling integrations
    prisma.sellerSchedulingIntegration.deleteMany({
      where: { sellerLocation: { affiliateId: { in: affIds } } },
    }),

    // Seller org sub-services
    prisma.sellerOrgSubService.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Seller service offerings
    prisma.sellerServiceOffering.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Seller locations
    prisma.sellerLocation.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Seller providers
    prisma.sellerProvider.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Seller lab networks
    prisma.sellerLabNetwork.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Seller profiles
    prisma.sellerProfile.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Onboarding flows
    prisma.onboardingFlow.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Section reviews
    prisma.sectionReview.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Section snapshots
    prisma.sectionSnapshot.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Care nav configs
    prisma.careNavConfig.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Affiliate sub-services (program-scoped)
    prisma.subService.deleteMany({
      where: { program: { affiliateId: { in: affIds } } },
    }),

    // Affiliate services (program-scoped)
    prisma.service.deleteMany({
      where: { program: { affiliateId: { in: affIds } } },
    }),

    // Affiliate locations
    prisma.location.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Affiliate providers
    prisma.provider.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Lab networks
    prisma.labNetwork.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Radiology networks (if model exists)
    prisma.radiologyNetwork.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Programs
    prisma.program.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Affiliate phases
    prisma.affiliatePhase.deleteMany({
      where: { affiliateId: { in: affIds } },
    }),

    // Users (e2e- prefix)
    prisma.user.deleteMany({
      where: { email: { startsWith: "e2e-" } },
    }),

    // Affiliates (use collected IDs to catch registration-created affiliates with no legalName)
    prisma.affiliate.deleteMany({
      where: { id: { in: affIds } },
    }),
  ]);

  console.log("[e2e teardown] Test data cleaned up");
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
