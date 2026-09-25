export interface AiClassifyInput {
  requestId: string;
  title: string;
  description: string;
  attachmentUrls: string[];
  locale: string;
}

export interface AiClassifyAlternative {
  serviceId: string;
  confidence: number;
}

export interface AiClassifyResult {
  categoryId: string | null;
  serviceId: string | null;
  confidence: number;
  possibleQuestions: string[];
  alternatives: AiClassifyAlternative[];
}
