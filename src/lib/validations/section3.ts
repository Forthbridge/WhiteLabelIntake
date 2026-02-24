import { z } from "zod";

export const section3Schema = z.object({
  services: z.array(
    z.object({
      serviceType: z.string(),
      selected: z.boolean(),
      otherName: z.string().optional(),
    })
  ),
});

export type Section3Data = z.infer<typeof section3Schema>;

export const SERVICE_TYPES = [
  { value: "labs", label: "Labs" },
  { value: "imaging", label: "Imaging" },
  { value: "immunizations", label: "Immunizations" },
  { value: "dme", label: "Durable Medical Equipment (DME)" },
  { value: "bundled_surgeries", label: "Bundled Surgeries" },
  { value: "specialist_care", label: "Specialist Care" },
  { value: "physical_therapy", label: "Physical Therapy" },
  { value: "infusion_services", label: "Infusion Services" },
  { value: "behavioral_health", label: "Behavioral Health (in-person or extended)" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other" },
] as const;
