-- Partial unique indexes for composite uniques with nullable columns.
-- PostgreSQL allows multiple NULLs in a UNIQUE constraint by default,
-- so we need partial indexes to enforce "at most one NULL" per group.
--
-- Run with: psql $DATABASE_URL -f scripts/add-partial-unique-indexes.sql
-- Or via Supabase SQL Editor.

-- NetworkContract: (affiliateId, sellerId) when programId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_contract_org_scope
  ON network_contracts (affiliate_id, seller_id)
  WHERE program_id IS NULL;

-- SellerPriceListVisit: (priceListId, serviceType) when sellerLocationId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_visit_org_scope
  ON seller_price_list_visits (price_list_id, service_type)
  WHERE seller_location_id IS NULL;

-- SellerPriceListSubService: (priceListId, serviceType, subType) when sellerLocationId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_sub_org_scope
  ON seller_price_list_sub_services (price_list_id, service_type, sub_type)
  WHERE seller_location_id IS NULL;

-- SellerPriceListRule: (priceListId, buyerId) when programId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_rule_org_scope
  ON seller_price_list_rules (price_list_id, buyer_id)
  WHERE program_id IS NULL;
