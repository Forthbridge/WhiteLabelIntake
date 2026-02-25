import { z } from "zod";

export const sellerPricingSchema = z.object({
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

export type SellerPricingData = z.infer<typeof sellerPricingSchema>;
