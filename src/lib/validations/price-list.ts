import { z } from "zod";

export const priceListRuleSchema = z.object({
  buyerId: z.string(),
  buyerName: z.string().optional(),
  programId: z.string().nullable().optional(),
  programName: z.string().nullable().optional(),
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
  locationOverrides: z.array(locationOverrideSchema).optional(),
});

export type PriceListData = z.infer<typeof priceListSchema>;
export type PriceListRuleData = z.infer<typeof priceListRuleSchema>;
export type LocationOverrideData = z.infer<typeof locationOverrideSchema>;
