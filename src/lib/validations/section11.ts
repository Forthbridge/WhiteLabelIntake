import { z } from "zod";

// ─── Sub-Service Item Definition ─────────────────────────────────────

export interface SubServiceItem {
  value: string;   // unique handle/key
  label: string;   // display name
  group?: string;  // optional grouping within category
}

// ─── SUB_SERVICE_TYPES ───────────────────────────────────────────────
// Maps Section 3 service types to their configurable sub-items.
// Keys match the serviceType values from SERVICE_TYPES in section3.ts.

export const SUB_SERVICE_TYPES: Record<string, SubServiceItem[]> = {
  labs: [
    { value: "abo-group-and-rh-type", label: "ABO Group and Rh Type", group: "Blood" },
    { value: "acth", label: "ACTH", group: "Endocrine" },
    { value: "ana-screen", label: "ANA Screen, IFA, with Reflex", group: "Autoimmune" },
    { value: "anca-vasculitides", label: "ANCA Vasculitides", group: "Autoimmune" },
    { value: "albumin-random-urine", label: "Albumin, Random Urine with Creatinine", group: "Urine" },
    { value: "amylase", label: "Amylase", group: "Metabolic" },
    { value: "anti-ccp", label: "Anti CCP", group: "Autoimmune" },
    { value: "antiphospholipid-panel", label: "Antiphospholipid Antibody Panel", group: "Autoimmune" },
    { value: "apolipoprotein-b", label: "Apolipoprotein B", group: "Lipid" },
    { value: "bv-vaginitis-panel", label: "Bacterial Vaginosis/Vaginitis Panel", group: "Infectious" },
    { value: "bilirubin-total", label: "Bilirubin, Total", group: "Liver" },
    { value: "c-reactive-protein", label: "C-Reactive Protein (CRP)", group: "Inflammatory" },
    { value: "cbc-diff-platelets", label: "CBC (includes Differential and Platelets)", group: "Blood" },
    { value: "calcitriol", label: "Calcitriol 1,25-Dihydroxyvitamin D", group: "Endocrine" },
    { value: "calprotectin-stool", label: "Calprotectin, Stool", group: "GI" },
    { value: "cardio-iq-nt-probnp", label: "Cardio IQ NT ProBNP", group: "Cardiac" },
    { value: "celiac-comprehensive", label: "Celiac Disease Comprehensive Panel", group: "GI" },
    { value: "celiac-panel", label: "Celiac Panel", group: "GI" },
    { value: "centromere-b-antibody", label: "Centromere B Antibody", group: "Autoimmune" },
    { value: "ct-ng-rectal", label: "Chlamydia/Gonorrhoeae RNA, TMA, Rectal", group: "STI" },
    { value: "ct-ng-throat", label: "Chlamydia/Gonorrhoeae RNA, TMA, Throat", group: "STI" },
    { value: "ct-ng-urogenital", label: "Chlamydia/Gonorrhoeae RNA, TMA, Urogenital", group: "STI" },
    { value: "chromatin-antibody", label: "Chromatin (Nucleosomal) Antibody", group: "Autoimmune" },
    { value: "c-diff", label: "Clostridium Difficile Cytotoxicity Assay", group: "Infectious" },
    { value: "complement-c3-c4", label: "Complement Component C3c and C4c", group: "Autoimmune" },
    { value: "comprehensive-metabolic", label: "Comprehensive Metabolic Panel", group: "Metabolic" },
    { value: "cortisol-total", label: "Cortisol, Total", group: "Endocrine" },
    { value: "ck-total", label: "Creatinine Kinase (CK), Total", group: "Metabolic" },
    { value: "culture-aerobic-anaerobic", label: "Culture, Aerobic and Anaerobic", group: "Infectious" },
    { value: "culture-throat-strep", label: "Culture, Throat, with Group A Strep", group: "Infectious" },
    { value: "culture-urine", label: "Culture, Urine, Routine", group: "Infectious" },
    { value: "culture-aerobic", label: "Culture, Aerobic Bacteria", group: "Infectious" },
    { value: "d-dimer", label: "D-dimer, Quantitative", group: "Blood" },
    { value: "dna-ds-antibody", label: "DNA (ds) Antibody", group: "Autoimmune" },
    { value: "direct-bilirubin", label: "Direct Bilirubin", group: "Liver" },
    { value: "drug-screen-urine", label: "Drug Monitoring, Panel 5, Screen, Urine", group: "Toxicology" },
    { value: "estradiol", label: "Estradiol", group: "Endocrine" },
    { value: "fsh", label: "FSH (Follicle Stimulating Hormone)", group: "Endocrine" },
    { value: "fta-abs", label: "FTA-ABS", group: "STI" },
    { value: "fecal-globin", label: "Fecal Globin by Immunochemistry", group: "GI" },
    { value: "free-t4", label: "Free T4", group: "Thyroid" },
    { value: "ggt", label: "Gamma Glutamyl Transferase (GGT)", group: "Liver" },
    { value: "hemoglobin-a1c", label: "Hemoglobin A1c", group: "Diabetes" },
    { value: "hiv-antigen-antibody", label: "HIV 1/2 Antigen and Antibodies, 4th Gen", group: "STI" },
    { value: "hiv-rna-quantitative", label: "HIV-1 RNA, Quantitative, Real-Time PCR", group: "STI" },
    { value: "hla-b27", label: "HLA-B27 Antigen", group: "Autoimmune" },
    { value: "hpv-mrna", label: "HPV mRNA E6/E7", group: "STI" },
    { value: "h-pylori-stool", label: "H. pylori Antigen, EIA, Stool", group: "GI" },
    { value: "h-pylori-breath", label: "H. pylori, Urea Breath Test", group: "GI" },
    { value: "hepatitis-a-total", label: "Hepatitis A Antibody, Total with Reflex", group: "Hepatitis" },
    { value: "hepatitis-a-igm", label: "Hepatitis A IgM Antibody", group: "Hepatitis" },
    { value: "hepatitis-b-core", label: "Hepatitis B Core Antibody, Total", group: "Hepatitis" },
    { value: "hepatitis-b-surface-ab-quant", label: "Hepatitis B Surface Antibody, Quantitative", group: "Hepatitis" },
    { value: "hepatitis-b-surface-ab-qual", label: "Hepatitis B Surface Antibody, Qualitative", group: "Hepatitis" },
    { value: "hepatitis-b-surface-ag", label: "Hepatitis B Surface Antigen with Reflex", group: "Hepatitis" },
    { value: "hepatitis-c-screening", label: "Hepatitis C Screening", group: "Hepatitis" },
    { value: "hepatitis-c-viral-load", label: "Hepatitis C Viral Load", group: "Hepatitis" },
    { value: "herpes-simplex-pcr", label: "Herpes Simplex Virus 1 & 2 DNA, PCR", group: "STI" },
    { value: "homocysteine", label: "Homocysteine", group: "Cardiac" },
    { value: "insulin", label: "Insulin", group: "Diabetes" },
    { value: "iron-tibc-ferritin", label: "Iron, TIBC and Ferritin Panel", group: "Blood" },
    { value: "iron-total", label: "Iron, Total", group: "Blood" },
    { value: "jo-1-antibody", label: "Jo-1 Antibody", group: "Autoimmune" },
    { value: "lactate-dehydrogenase", label: "Lactate Dehydrogenase (LD)", group: "Metabolic" },
    { value: "lead-venous", label: "Lead (venous)", group: "Toxicology" },
    { value: "lipase", label: "Lipase", group: "GI" },
    { value: "lipid-panel", label: "Lipid Panel, Standard", group: "Lipid" },
    { value: "lipoprotein-a", label: "Lipoprotein (a)", group: "Lipid" },
    { value: "liver-panel", label: "Liver Panel", group: "Liver" },
    { value: "luteinizing-hormone", label: "Luteinizing Hormone", group: "Endocrine" },
    { value: "lyme-disease", label: "Lyme Disease Ab with Reflex", group: "Infectious" },
    { value: "magnesium", label: "Magnesium", group: "Metabolic" },
    { value: "measles-igg-immune", label: "Measles Antibody (IgG), Immune Status", group: "Infectious" },
    { value: "mmr-antibodies", label: "MMR Antibodies (IgG), Immune Status", group: "Infectious" },
    { value: "mrsa-pcr", label: "MRSA, PCR", group: "Infectious" },
    { value: "mpox-pcr", label: "Mpox Virus DNA, PCR", group: "Infectious" },
    { value: "nicotine-cotinine", label: "Nicotine and Cotinine, Serum/Plasma", group: "Toxicology" },
    { value: "ova-parasites", label: "Ova and Parasites with Giardia Antigen", group: "GI" },
    { value: "psa-total", label: "PSA, Total", group: "Cancer Screening" },
    { value: "pth-intact", label: "PTH, Intact without Calcium", group: "Endocrine" },
    { value: "ptt-activated", label: "Partial Thromboplastin Time, Activated", group: "Blood" },
    { value: "phosphate", label: "Phosphate (as Phosphorus)", group: "Metabolic" },
    { value: "plasma-renin", label: "Plasma Renin Activity", group: "Endocrine" },
    { value: "progesterone", label: "Progesterone", group: "Endocrine" },
    { value: "prolactin", label: "Prolactin", group: "Endocrine" },
    { value: "protein-electrophoresis", label: "Protein, Total and Electrophoresis", group: "Blood" },
    { value: "prothrombin-inr", label: "Prothrombin Time with INR", group: "Blood" },
    { value: "quantiferon-tb", label: "QuantiFERON-TB Gold Plus", group: "Infectious" },
    { value: "rpr-syphilis", label: "RPR (Syphilis) with Reflex", group: "STI" },
    { value: "reticulocyte-count", label: "Reticulocyte Count, Automated", group: "Blood" },
    { value: "retinopathy-screening", label: "Retinopathy Screening", group: "Diabetes" },
    { value: "rheumatoid-factor", label: "Rheumatoid Factor", group: "Autoimmune" },
    { value: "ribosomal-p-antibody", label: "Ribosomal P Antibody", group: "Autoimmune" },
    { value: "sars-cov-2-pcr", label: "SARS-CoV-2 RNA (COVID-19), NAAT", group: "Infectious" },
    { value: "stool-culture", label: "Salmonella/Shigella Culture Panel", group: "GI" },
    { value: "scleroderma-scl70", label: "Scleroderma Antibody (Scl-70)", group: "Autoimmune" },
    { value: "sed-rate", label: "Sed Rate (ESR)", group: "Inflammatory" },
    { value: "shbg", label: "Sex Hormone Binding Globulin (SHBG)", group: "Endocrine" },
    { value: "sickle-cell-screen", label: "Sickle Cell Screen", group: "Blood" },
    { value: "sjogrens-ss-a", label: "Sjogren's Antibody (SS-A)", group: "Autoimmune" },
    { value: "sjogrens-ss-b", label: "Sjogren's Antibody (SS-B)", group: "Autoimmune" },
    { value: "sm-antibody", label: "Sm Antibody", group: "Autoimmune" },
    { value: "sm-rnp-antibody", label: "Sm/RNP Antibody", group: "Autoimmune" },
    { value: "synovial-fluid", label: "Synovial Fluid Analysis, Complete", group: "Inflammatory" },
    { value: "t3-total", label: "T3 Total", group: "Thyroid" },
    { value: "t3-free", label: "T3, Free", group: "Thyroid" },
    { value: "trab", label: "TRAb (TSH Receptor Binding Antibody)", group: "Thyroid" },
    { value: "tsh", label: "TSH", group: "Thyroid" },
    { value: "testosterone-free", label: "Testosterone, Free", group: "Endocrine" },
    { value: "testosterone-total", label: "Testosterone, Total", group: "Endocrine" },
    { value: "thinprep-pap-hpv", label: "ThinPrep Pap and HPV mRNA", group: "STI" },
    { value: "thyroglobulin-panel", label: "Thyroglobulin Panel", group: "Thyroid" },
    { value: "tpo-antibodies", label: "Thyroid Peroxidase Antibodies (TPO)", group: "Thyroid" },
    { value: "tissue-pathology", label: "Tissue, Pathology Report", group: "Pathology" },
    { value: "trichomonas", label: "Trichomonas Vaginalis RNA, TMA", group: "STI" },
    { value: "uric-acid", label: "Uric Acid", group: "Metabolic" },
    { value: "urinalysis-complete", label: "Urinalysis, Complete with Reflex to Culture", group: "Urine" },
    { value: "varicella-zoster-immunity", label: "Varicella-Zoster Virus Antibody (Immunity)", group: "Infectious" },
    { value: "visby-pcr-sti", label: "Visby PCR STI", group: "STI" },
    { value: "vitamin-b12-folate", label: "Vitamin B12 (Cobalamin) and Folate Panel", group: "Blood" },
    { value: "vitamin-d", label: "Vitamin D, 25-Hydroxy, Total", group: "Endocrine" },
    { value: "hcg-quantitative", label: "hCG, Total, Quantitative", group: "Endocrine" },
  ],

  imaging: [
    { value: "all-xrays", label: "All X-Rays" },
  ],

  immunizations: [
    // Routine Adult
    { value: "flu-standard", label: "Influenza (Standard Dose)", group: "Routine" },
    { value: "flu-high-dose", label: "Influenza (High Dose / 65+)", group: "Routine" },
    { value: "flu-nasal", label: "Influenza (Nasal / FluMist)", group: "Routine" },
    { value: "covid-19-mrna", label: "COVID-19 (mRNA — Moderna/Pfizer)", group: "Routine" },
    { value: "covid-19-protein", label: "COVID-19 (Protein — Novavax)", group: "Routine" },
    { value: "tdap", label: "Tdap (Tetanus, Diphtheria, Pertussis)", group: "Routine" },
    { value: "td", label: "Td (Tetanus, Diphtheria)", group: "Routine" },
    { value: "mmr", label: "MMR (Measles, Mumps, Rubella)", group: "Routine" },
    { value: "varicella", label: "Varicella (Chickenpox)", group: "Routine" },
    { value: "shingrix", label: "Shingrix (Shingles / Zoster)", group: "Routine" },
    { value: "pneumovax-23", label: "Pneumovax 23 (Pneumococcal Polysaccharide)", group: "Routine" },
    { value: "prevnar-20", label: "Prevnar 20 (Pneumococcal Conjugate)", group: "Routine" },
    // Hepatitis
    { value: "hepatitis-a", label: "Hepatitis A", group: "Hepatitis" },
    { value: "hepatitis-b", label: "Hepatitis B", group: "Hepatitis" },
    { value: "heplisav-b", label: "Heplisav-B (Hepatitis B — 2-dose)", group: "Hepatitis" },
    { value: "twinrix", label: "Twinrix (Hepatitis A + B)", group: "Hepatitis" },
    // HPV & Meningococcal
    { value: "hpv-gardasil9", label: "HPV (Gardasil 9)", group: "Adolescent/Young Adult" },
    { value: "meningococcal-acwy", label: "Meningococcal ACWY", group: "Adolescent/Young Adult" },
    { value: "meningococcal-b", label: "Meningococcal B", group: "Adolescent/Young Adult" },
    // Pediatric (if applicable)
    { value: "dtap", label: "DTaP (Pediatric)", group: "Pediatric" },
    { value: "ipv", label: "IPV (Polio)", group: "Pediatric" },
    { value: "hib", label: "Hib (Haemophilus influenzae type b)", group: "Pediatric" },
    { value: "rotavirus", label: "Rotavirus", group: "Pediatric" },
    { value: "pcv", label: "PCV (Pneumococcal Conjugate — Pediatric)", group: "Pediatric" },
    // Travel & Specialty
    { value: "rabies", label: "Rabies", group: "Travel/Specialty" },
    { value: "yellow-fever", label: "Yellow Fever", group: "Travel/Specialty" },
    { value: "typhoid", label: "Typhoid", group: "Travel/Specialty" },
    { value: "japanese-encephalitis", label: "Japanese Encephalitis", group: "Travel/Specialty" },
    { value: "cholera", label: "Cholera", group: "Travel/Specialty" },
    { value: "anthrax", label: "Anthrax", group: "Travel/Specialty" },
    { value: "jynneos-mpox", label: "Jynneos (Mpox/Smallpox)", group: "Travel/Specialty" },
    // Screening
    { value: "ppd-tb-skin-test", label: "PPD / TB Skin Test", group: "Screening" },
    { value: "quantiferon-tb", label: "QuantiFERON-TB Gold Plus", group: "Screening" },
    // RSV
    { value: "rsv-abrysvo", label: "RSV (Abrysvo)", group: "RSV" },
    { value: "rsv-arexvy", label: "RSV (Arexvy)", group: "RSV" },
  ],

  dme: [
    { value: "ankle-brace-stirrup", label: "Ankle Brace Stirrup" },
    { value: "ankle-gameday-brace", label: "Ankle Gameday Brace" },
    { value: "back-support", label: "Back Support" },
    { value: "cervical-collar", label: "Cervical Collar" },
    { value: "crutches", label: "Crutches" },
    { value: "elbow-strap", label: "Elbow Strap" },
    { value: "fiberglass-casting", label: "Fiberglass Casting Material" },
    { value: "short-leg-cast", label: "Short Leg Cast Application" },
    { value: "hinged-knee-support", label: "Hinged Knee Support Wrap Around" },
    { value: "padded-arm-sling", label: "Padded Arm Sling" },
    { value: "walking-boot", label: "Pneumatic Walking Boot" },
    { value: "walking-boot-short", label: "Pneumatic Walking Boot Short" },
    { value: "post-op-shoe", label: "Post-op Shoe" },
    { value: "thumb-spica", label: "Thumb Spica" },
    { value: "universal-wrist-brace", label: "Universal Wrist Brace" },
  ],

  specialist_care: [
    { value: "allergy-immunology", label: "Allergy/Immunology", group: "Medical" },
    { value: "cardiology", label: "Cardiology", group: "Medical" },
    { value: "critical-care", label: "Critical Care", group: "Medical" },
    { value: "dermatology", label: "Dermatology", group: "Medical" },
    { value: "endocrinology", label: "Endocrinology", group: "Medical" },
    { value: "gastroenterology", label: "Gastroenterology", group: "Medical" },
    { value: "gi-endoscopy", label: "GI Endoscopy", group: "Medical" },
    { value: "hematology", label: "Hematology", group: "Medical" },
    { value: "infectious-disease", label: "Infectious Disease/Immunology", group: "Medical" },
    { value: "nephrology", label: "Nephrology", group: "Medical" },
    { value: "neurology", label: "Neurology", group: "Medical" },
    { value: "obstetrics-gynecology", label: "Obstetrics/Gynecology", group: "Medical" },
    { value: "oncology", label: "Oncology", group: "Medical" },
    { value: "ophthalmology", label: "Ophthalmology", group: "Medical" },
    { value: "otolaryngology", label: "Otolaryngology (ENT)", group: "Medical" },
    { value: "pain-management", label: "Pain Management", group: "Medical" },
    { value: "podiatry", label: "Podiatry", group: "Medical" },
    { value: "pulmonary-medicine", label: "Pulmonary Medicine", group: "Medical" },
    { value: "reproductive-endocrinology", label: "Reproductive Endocrinology & Infertility", group: "Medical" },
    { value: "rheumatology", label: "Rheumatology", group: "Medical" },
    { value: "urology", label: "Urology", group: "Medical" },
    // Surgical
    { value: "bariatric-surgery", label: "Bariatric Surgery", group: "Surgical" },
    { value: "breast-surgery", label: "Breast Surgery", group: "Surgical" },
    { value: "cardiac-surgery", label: "Cardiac Surgery", group: "Surgical" },
    { value: "colon-rectal-surgery", label: "Colon and Rectal Surgery", group: "Surgical" },
    { value: "general-surgery", label: "General Surgery", group: "Surgical" },
    { value: "hand-surgery", label: "Hand Surgery", group: "Surgical" },
    { value: "neurosurgery", label: "Neurosurgery", group: "Surgical" },
    { value: "orthopedic-surgery", label: "Orthopedic Surgery", group: "Surgical" },
    { value: "plastic-surgery", label: "Plastic Surgery", group: "Surgical" },
    { value: "vascular-surgery", label: "Vascular Surgery", group: "Surgical" },
    // Diagnostic
    { value: "colonoscopy-evaluation", label: "Colonoscopy Evaluation", group: "Diagnostic" },
    { value: "cologuard", label: "Cologuard", group: "Diagnostic" },
    { value: "diagnostic-sleep-study", label: "Diagnostic Sleep Study", group: "Diagnostic" },
    { value: "emg", label: "EMG", group: "Diagnostic" },
    { value: "holter-monitor", label: "Holter Monitor", group: "Diagnostic" },
    { value: "nerve-conduction-study", label: "Nerve Conduction Study", group: "Diagnostic" },
    { value: "treadmill-stress-test", label: "Treadmill Stress Test", group: "Diagnostic" },
    { value: "interventional-radiology", label: "Interventional Radiology", group: "Diagnostic" },
    // Other
    { value: "acupuncture", label: "Acupuncture", group: "Other" },
    { value: "brca", label: "BRCA Referral", group: "Other" },
    { value: "chiropractic", label: "Chiropractic Medicine", group: "Other" },
    { value: "dentist", label: "Dentist", group: "Other" },
    { value: "diabetes-educator", label: "Diabetes Educator", group: "Other" },
    { value: "diabetic-eye-exam", label: "Annual Diabetic Eye Exam", group: "Other" },
    { value: "dietician", label: "Dietician", group: "Other" },
    { value: "emergency-medicine", label: "Emergency Medicine", group: "Other" },
    { value: "functional-capacity-eval", label: "Functional Capacity Evaluation (FCE)", group: "Other" },
    { value: "newborn-screening", label: "Newborn Screening", group: "Other" },
    { value: "vestibular-therapy", label: "Vestibular Therapy Evaluation", group: "Other" },
    { value: "wound-care", label: "Wound Care", group: "Other" },
  ],

  bundled_surgeries: [
    { value: "knee-arthroscopy", label: "Knee Arthroscopy" },
    { value: "shoulder-arthroscopy", label: "Shoulder Arthroscopy" },
    { value: "carpal-tunnel-release", label: "Carpal Tunnel Release" },
    { value: "hernia-repair", label: "Hernia Repair" },
    { value: "cholecystectomy", label: "Cholecystectomy (Gallbladder Removal)" },
    { value: "tonsillectomy", label: "Tonsillectomy" },
    { value: "appendectomy", label: "Appendectomy" },
    { value: "hysterectomy", label: "Hysterectomy" },
    { value: "joint-replacement-hip", label: "Joint Replacement — Hip" },
    { value: "joint-replacement-knee", label: "Joint Replacement — Knee" },
    { value: "spinal-fusion", label: "Spinal Fusion" },
    { value: "rotator-cuff-repair", label: "Rotator Cuff Repair" },
  ],

  infusion_services: [
    { value: "iv-hydration", label: "IV Hydration" },
    { value: "iron-infusion", label: "Iron Infusion" },
    { value: "biologic-infusion", label: "Biologic Infusion (e.g. Remicade, Entyvio)" },
    { value: "antibiotic-infusion", label: "Antibiotic Infusion" },
    { value: "blood-transfusion", label: "Blood Transfusion" },
    { value: "chemotherapy", label: "Chemotherapy Infusion" },
    { value: "immunoglobulin", label: "Immunoglobulin (IVIG)" },
  ],

  physical_therapy: [
    { value: "physical-therapy", label: "Physical Therapy" },
    { value: "occupational-therapy", label: "Occupational Therapy" },
    { value: "speech-therapy", label: "Speech Therapy" },
    { value: "concussion-therapy", label: "Concussion Therapy" },
    { value: "work-hardening", label: "Work Hardening & Conditioning" },
  ],

  behavioral_health: [
    { value: "psychiatry", label: "Psychiatry" },
    { value: "child-psychiatry", label: "Child Psychiatry" },
    { value: "psychology", label: "Psychology" },
    { value: "counseling", label: "Counseling" },
    { value: "detoxification", label: "Detoxification" },
    { value: "drug-rehabilitation", label: "Drug Rehabilitation" },
    { value: "eap", label: "EAP (Employee Assistance Program)" },
    { value: "emotional-wellness-coach", label: "Emotional Wellness Coach" },
  ],

  pharmacy: [
    { value: "generic-formulary", label: "Generic Formulary" },
    { value: "preferred-brand", label: "Preferred Brand" },
    { value: "non-preferred-brand", label: "Non-Preferred Brand" },
    { value: "specialty-pharmacy", label: "Specialty Pharmacy" },
    { value: "over-the-counter", label: "Over-the-Counter (OTC)" },
    { value: "compound-pharmacy", label: "Compound Pharmacy" },
  ],
};

// ─── Zod Schema ──────────────────────────────────────────────────────

const subServiceItemSchema = z.object({
  subType: z.string(),
  selected: z.boolean(),
});

export const section11Schema = z.object({
  categories: z.record(z.string(), z.array(subServiceItemSchema)),
});

export type Section11Data = z.infer<typeof section11Schema>;

// ─── Helpers ─────────────────────────────────────────────────────────

export function getSubServiceLabel(serviceType: string, subType: string): string {
  const items = SUB_SERVICE_TYPES[serviceType];
  if (!items) return subType;
  return items.find((i) => i.value === subType)?.label ?? subType;
}

export function getGroupsForServiceType(serviceType: string): string[] {
  const items = SUB_SERVICE_TYPES[serviceType];
  if (!items) return [];
  const groups = new Set<string>();
  for (const item of items) {
    if (item.group) groups.add(item.group);
  }
  return Array.from(groups);
}
