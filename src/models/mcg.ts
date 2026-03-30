import { z } from "zod";

export const mcgDiagnosisCriterionValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export type McgDiagnosisCriterionValue = z.infer<typeof mcgDiagnosisCriterionValueSchema>;

export const mcgDiagnosisCriteriaSchema = z.record(z.string(), mcgDiagnosisCriterionValueSchema);

export const mcgDiseaseBlockSchema = z.object({
  diagnosisCriteria: mcgDiagnosisCriteriaSchema,
  inpatientIndicators: z.array(z.string()),
  riskFactors: z.array(z.string()),
});

export type MCGDiseaseBlock = z.infer<typeof mcgDiseaseBlockSchema>;

export const mcgCriteriaSchema = z.record(z.string(), mcgDiseaseBlockSchema);

export type MCGCriteria = z.infer<typeof mcgCriteriaSchema>;

export const MCG_COLLECTION = "mcgDocuments";
