import { z } from "zod";

export const priceListRuleSchema = z.object({
  buyerId: z.string(),
  buyerName: z.string().optional(),
  programId: z.string().nullable().optional(),
  programName: z.string().nullable().optional(),
});

export const bundleTargetSchema = z.object({
  serviceType: z.string().min(1),
  subType: z.string().nullable().optional(),
});

export const bundleRuleSchema = z.object({
  name: z.string().min(1, "Bundle name is required"),
  ruleType: z.literal("flat_rate"),
  price: z.number().nonnegative("Price must be >= 0"),
  includesVisitFee: z.boolean().default(false),
  targets: z.array(bundleTargetSchema).min(1, "At least one target required"),
});

export const locationOverrideSchema = z.object({
  sellerLocationId: z.string(),
  locationName: z.string().optional(),
  visitPrices: z.array(
    z.object({
      serviceType: z.string(),
      price: z.number().nonnegative().nullable().optional(),
    })
  ).optional(),
  subServicePrices: z.array(
    z.object({
      serviceType: z.string(),
      subType: z.string(),
      unitPrice: z.number().nonnegative().nullable().optional(),
    })
  ).optional(),
  bundleRules: z.array(bundleRuleSchema).optional(),
});

export const priceListSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  isPublic: z.boolean(),
  rules: z.array(priceListRuleSchema).optional(),
  visitPrices: z.array(
    z.object({
      serviceType: z.string(),
      price: z.number().nonnegative().nullable().optional(),
    })
  ).optional(),
  subServicePrices: z.array(
    z.object({
      serviceType: z.string(),
      subType: z.string(),
      unitPrice: z.number().nonnegative().nullable().optional(),
    })
  ).optional(),
  bundleRules: z.array(bundleRuleSchema).optional(),
  locationOverrides: z.array(locationOverrideSchema).optional(),
});

export type PriceListData = z.infer<typeof priceListSchema>;
export type PriceListRuleData = z.infer<typeof priceListRuleSchema>;
export type LocationOverrideData = z.infer<typeof locationOverrideSchema>;
export type BundleRuleData = z.infer<typeof bundleRuleSchema>;
export type BundleTargetData = z.infer<typeof bundleTargetSchema>;
