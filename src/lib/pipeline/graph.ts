import { StateGraph, Send, START, END } from '@langchain/langgraph';
import { sql } from '@/lib/db';
import { GraphState, type GraphStateType } from './state';
import { cropImages } from './crop';
import { analyzeRegion } from './analyze';
import { aggregate } from './aggregate';

/**
 * Conditional edge: fan-out to one analyze_region invocation per cropped region.
 */
function routeToAnalysts(state: GraphStateType) {
  return state.croppedRegions.map(
    (region) => new Send('analyze_region', { currentRegion: region }),
  );
}

/**
 * Build and compile the LangGraph pipeline.
 */
function buildGraph() {
  const graph = new StateGraph(GraphState)
    .addNode('crop_images', cropImages)
    .addNode('analyze_region', analyzeRegion)
    .addNode('aggregate', aggregate)
    .addEdge(START, 'crop_images')
    .addConditionalEdges('crop_images', routeToAnalysts)
    .addEdge('analyze_region', 'aggregate')
    .addEdge('aggregate', END);

  return graph.compile();
}

// Compile once at module load
const pipeline = buildGraph();

type ScanRow = {
  front_image_url: string;
  profile_image_url: string;
  height_cm_snapshot: number;
  weight_kg_snapshot: number;
  user_id: string;
};

type ProfileRow = {
  gender: string;
  date_of_birth: string;
};

type ConfigRow = {
  id: string;
};

/**
 * Run the full analysis pipeline for a scan.
 * Called from the finalize route via after().
 */
export async function runPipeline(scanId: string): Promise<void> {
  try {
    // Load scan
    const scans = (await sql`
      SELECT front_image_url, profile_image_url,
             height_cm_snapshot, weight_kg_snapshot, user_id
      FROM scans WHERE id = ${scanId}
    `) as ScanRow[];

    if (scans.length === 0) throw new Error(`Scan ${scanId} not found`);
    const scan = scans[0];

    if (!scan.front_image_url || !scan.profile_image_url) {
      throw new Error('Scan missing image URLs');
    }

    // Load profile
    const profiles = (await sql`
      SELECT gender, date_of_birth FROM user_profiles
      WHERE user_id = ${scan.user_id}
    `) as ProfileRow[];

    if (profiles.length === 0) throw new Error('User profile not found');
    const profile = profiles[0];

    // Compute age from DOB
    const dob = new Date(profile.date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    if (
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
    ) {
      age--;
    }

    // Load active analysis config for gender
    const genderTarget = profile.gender === 'female' ? 'female' : 'male';
    const configs = (await sql`
      SELECT id FROM analysis_configs
      WHERE gender_target = ${genderTarget} AND is_active = true
      LIMIT 1
    `) as ConfigRow[];

    // Fall back to 'any' gender config
    const configId =
      configs[0]?.id ??
      ((await sql`
        SELECT id FROM analysis_configs
        WHERE gender_target = 'any' AND is_active = true
        LIMIT 1
      `) as ConfigRow[])[0]?.id;

    if (!configId) throw new Error('No active analysis config found');

    // Link config to scan
    await sql`
      UPDATE scans SET analysis_config_id = ${configId} WHERE id = ${scanId}
    `;

    // Run the graph
    await pipeline.invoke({
      scanId,
      frontImageUrl: scan.front_image_url,
      profileImageUrl: scan.profile_image_url,
      gender: genderTarget,
      age,
      heightCm: Number(scan.height_cm_snapshot),
      weightKg: Number(scan.weight_kg_snapshot),
      configId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown pipeline error';
    console.error(`[pipeline] Scan ${scanId} failed:`, message);
    await sql`
      UPDATE scans
      SET status = 'failed', error_message = ${message}
      WHERE id = ${scanId}
    `;
  }
}
