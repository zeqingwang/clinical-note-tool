/** Structured clinical context passed to the HPI generator (alongside merged summary). */
export interface HpiStructuredInput {
  patientContext: {
    age?: number;
    sex?: string;
    relevantHistory?: string[];
    recentChanges?: string[];
  };

  presentation: {
    duration?: string;
    symptoms: string[];
    additionalContext?: string[];
  };

  initialEvaluation: {
    vitalSignsOrGeneralStatus?: string[];
    keyExamFindings?: string[];
  };

  objectiveData: {
    labs?: string[];
    imaging?: string[];
    ekg?: string[];
  };

  clinicalAssessment: {
    primaryDiagnosis?: string;
    etiologyOrTrigger?: string[];
    supportingEvidence?: string[];
  };

  edCourse: {
    treatments?: string[];
    responseOrReassessment?: string[];
  };

  severity: {
    indicators?: string[];
    levelOfCare?: string;
  };

  admissionRationale: {
    reasons: string[];
  };
}
