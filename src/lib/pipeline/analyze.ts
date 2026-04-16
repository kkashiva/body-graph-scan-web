import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { REGIONS } from './regions';
import { createVlm } from './providers';
import type { AnalysisResult, GraphStateType } from './state';

/**
 * Extract JSON from a VLM response that may be wrapped in markdown fences.
 */
function extractJson(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  return JSON.parse(raw);
}

/**
 * Analyst node — invoked once per region via Send.
 * Reads `currentRegion` from state to know which crop to analyze.
 */
export async function analyzeRegion(
  state: GraphStateType,
): Promise<Partial<GraphStateType>> {
  const region = state.currentRegion;
  if (!region) throw new Error('analyzeRegion called without currentRegion');

  const regionDef = REGIONS.find((r) => r.name === region.regionName);
  if (!regionDef) throw new Error(`Unknown region: ${region.regionName}`);

  const prompt = regionDef.buildPrompt({
    gender: state.gender,
    age: state.age,
    heightCm: state.heightCm,
    weightKg: state.weightKg,
  });

  const vlm = createVlm();
  const modelName =
    process.env.VLM_MODEL ??
    (process.env.VLM_PROVIDER === 'qwen' ? 'qwen-vl-plus' : 'gemini-2.0-flash');

  const start = Date.now();

  const response = await vlm.invoke([
    new SystemMessage(prompt),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: `Analyze this cropped ${region.regionName} image. The user is ${state.gender}, ${state.age} years old, ${state.heightCm} cm, ${state.weightKg} kg.`,
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${region.imageBase64}`,
          },
        },
      ],
    }),
  ]);

  const latencyMs = Date.now() - start;
  const responseText =
    typeof response.content === 'string'
      ? response.content
      : response.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('');

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(responseText);
  } catch {
    // If JSON parsing fails, store the raw text and use fallback values
    parsed = {
      local_bf_estimate: 20,
      confidence: 0.3,
      explanation: `Failed to parse VLM response. Raw: ${responseText.slice(0, 500)}`,
    };
  }

  const result: AnalysisResult = {
    featureName: region.regionName,
    localBfEstimate: Number(parsed.local_bf_estimate) || 20,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    explanation: String(parsed.explanation ?? ''),
    circumferenceCm: regionDef.hasCircumference
      ? Number(parsed.circumference_cm) || undefined
      : undefined,
    rawResponse: parsed,
    modelUsed: modelName,
    latencyMs,
  };

  return { analyses: [result] };
}
