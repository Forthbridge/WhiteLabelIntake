import { z } from "zod";

export const section2Schema = z.object({
  programName: z.string().optional(),
});

export type Section2Data = z.infer<typeof section2Schema>;
