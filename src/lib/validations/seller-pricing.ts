import { z } from "zod";

export const sellerPricingSchema = z.object({
  primaryCarePrice: z.number().positive().optional().nullable(),
  urgentCarePrice: z.number().positive().optional().nullable(),
});

export type SellerPricingData = z.infer<typeof sellerPricingSchema>;
