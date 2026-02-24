import { z } from "zod";

export const section9Schema = z.object({
  primaryEscalationName: z.string().optional(),
  primaryEscalationEmail: z.string().email().optional().or(z.literal("")),
  secondaryEscalationName: z.string().optional(),
  secondaryEscalationEmail: z.string().email().optional().or(z.literal("")),
});

export type Section9Data = z.infer<typeof section9Schema>;
