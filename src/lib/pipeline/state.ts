import { Annotation } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// Shared types used across pipeline nodes
// ---------------------------------------------------------------------------

export type CroppedRegion = {
  regionName: string;
  imageBase64: string;
  imageType: 'front' | 'profile';
  boundingBox: { x: number; y: number; width: number; height: number };
};

export type AnalysisResult = {
  featureName: string;
  localBfEstimate: number;
  confidence: number;
  explanation: string;
  circumferenceCm?: number;
  rawResponse: Record<string, unknown>;
  modelUsed: string;
  latencyMs: number;
};

export type FinalResult = {
  bodyFatPct: number;
  bmi: number;
  method: string;
  confidenceScore: number;
  notes: string;
};

// ---------------------------------------------------------------------------
// LangGraph state annotation
// ---------------------------------------------------------------------------

export const GraphState = Annotation.Root({
  // --- Input (set before graph invocation) ---
  scanId: Annotation<string>,
  frontImageUrl: Annotation<string>,
  profileImageUrl: Annotation<string>,
  gender: Annotation<string>,
  age: Annotation<number>,
  heightCm: Annotation<number>,
  weightKg: Annotation<number>,
  configId: Annotation<string>,

  // --- Cropper output ---
  croppedRegions: Annotation<CroppedRegion[]>({
    default: () => [],
    reducer: (_, update) => update,
  }),

  // --- Fan-out routing (set per Send) ---
  currentRegion: Annotation<CroppedRegion | null>({
    default: () => null,
    reducer: (_, update) => update,
  }),

  // --- Analyst outputs (concat reducer for fan-in) ---
  analyses: Annotation<AnalysisResult[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...update],
  }),

  // --- Aggregator output ---
  result: Annotation<FinalResult | null>({
    default: () => null,
    reducer: (_, update) => update,
  }),
});

export type GraphStateType = typeof GraphState.State;
