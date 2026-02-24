import { z } from "zod";

export const locationServicesSchema = z.object({
  locationId: z.string(),
  overrides: z.array(
    z.object({
      serviceType: z.string(),
      available: z.boolean(),
      pricePerVisit: z.number().positive().nullable().optional(),
    })
  ),
  subServices: z.array(
    z.object({
      serviceType: z.string(),
      subType: z.string(),
      available: z.boolean(),
      unitPrice: z.number().positive().nullable().optional(),
    })
  ),
});

export type LocationServicesData = z.infer<typeof locationServicesSchema>;
