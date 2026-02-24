import { z } from "zod";

export const section1Schema = z.object({
  legalName: z.string().optional(),
  adminContactName: z.string().optional(),
  adminContactEmail: z.string().email().optional().or(z.literal("")),
  executiveSponsorName: z.string().optional(),
  executiveSponsorEmail: z.string().email().optional().or(z.literal("")),
  itContactName: z.string().optional(),
  itContactEmail: z.string().email().optional().or(z.literal("")),
  itContactPhone: z.string().optional(),
});

export type Section1Data = z.infer<typeof section1Schema>;
