import { z } from "zod";

export const SELLER_SERVICE_TYPES = [
  { value: "clinic_visit", label: "Clinic Visit" },
  { value: "labs", label: "Labs" },
  { value: "imaging", label: "Imaging" },
  { value: "immunizations", label: "Immunizations" },
  { value: "dme", label: "Durable Medical Equipment (DME)" },
  { value: "procedures", label: "Procedures" },
  { value: "bundled_surgeries", label: "Bundled Surgeries" },
  { value: "specialist_care", label: "Specialist Care" },
  { value: "physical_therapy", label: "Physical Therapy" },
  { value: "infusion_services", label: "Infusion Services" },
  { value: "behavioral_health", label: "Behavioral Health (in-person or extended)" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other" },
] as const;

export const sellerServicesSchema = z.object({
  services: z.array(
    z.object({
      serviceType: z.string(),
      selected: z.boolean(),
    })
  ),
});

export type SellerServicesData = z.infer<typeof sellerServicesSchema>;
