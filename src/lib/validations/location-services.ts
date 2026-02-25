import { z } from "zod";

export const locationServicesSchema = z.object({
  locationId: z.string(),
  overrides: z.array(
    z.object({
      serviceType: z.string(),
      available: z.boolean(),
    })
  ),
  subServices: z.array(
    z.object({
      serviceType: z.string(),
      subType: z.string(),
      available: z.boolean(),
    })
  ),
});

export type LocationServicesData = z.infer<typeof locationServicesSchema>;
