-- Partial unique indexes for composite uniques with nullable columns.
-- PostgreSQL allows multiple NULLs in a UNIQUE constraint by default,
-- so we need partial indexes to enforce "at most one NULL" per group.
--
-- Note: Prisma uses camelCase column names (no @map directives in schema).
--
-- Run with: psql $DIRECT_URL -f scripts/add-partial-unique-indexes.sql
-- Or via Supabase SQL Editor.
-- Already applied to production on 2026-02-25.

-- NetworkContract: (affiliateId, sellerId) when programId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_contract_org_scope
  ON network_contracts ("affiliateId", "sellerId")
  WHERE "programId" IS NULL;

-- SellerPriceListVisit: (priceListId, serviceType) when sellerLocationId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_visit_org_scope
  ON seller_price_list_visits ("priceListId", "serviceType")
  WHERE "sellerLocationId" IS NULL;

-- SellerPriceListSubService: (priceListId, serviceType, subType) when sellerLocationId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_sub_org_scope
  ON seller_price_list_sub_services ("priceListId", "serviceType", "subType")
  WHERE "sellerLocationId" IS NULL;

-- SellerPriceListRule: (priceListId, buyerId) when programId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_rule_org_scope
  ON seller_price_list_rules ("priceListId", "buyerId")
  WHERE "programId" IS NULL;
