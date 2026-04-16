// Region definitions for the fan-out pipeline.
// Bounding boxes are in silhouette viewBox coordinates (100 × 177).
// The cropper scales these to pixel coordinates using the actual image dimensions.

export type RegionDef = {
  name: string;
  imageType: 'front' | 'profile';
  /** ViewBox bounding box { x, y, width, height } */
  box: { x: number; y: number; w: number; h: number };
  /** Whether this region should return a circumference estimate */
  hasCircumference: boolean;
  /** Measurement region name for body_measurements table (if applicable) */
  measurementRegion?: string;
  /** Builds the system prompt, interpolating user metadata */
  buildPrompt: (ctx: PromptContext) => string;
};

export type PromptContext = {
  gender: string;
  age: number;
  heightCm: number;
  weightKg: number;
};

const JSON_SCHEMA_VISUAL = `Return ONLY valid JSON (no markdown fences): { "local_bf_estimate": <number 0-40>, "confidence": <number 0-1>, "explanation": "<string>" }`;

const JSON_SCHEMA_CIRCUMFERENCE = `Return ONLY valid JSON (no markdown fences): { "local_bf_estimate": <number 0-40>, "confidence": <number 0-1>, "explanation": "<string>", "circumference_cm": <number> }`;

export const REGIONS: RegionDef[] = [
  {
    name: 'jawline',
    imageType: 'front',
    box: { x: 35, y: 8, w: 30, h: 18 },
    hasCircumference: false,
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's jawline and chin area. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Assess subcutaneous fat in the jaw/chin region. Look for: jawline definition, presence of double chin, submental fat. Provide a visual body fat estimate for this region from 0-40. ${JSON_SCHEMA_VISUAL}`,
  },
  {
    name: 'neck',
    imageType: 'front',
    box: { x: 35, y: 22, w: 30, h: 14 },
    hasCircumference: true,
    measurementRegion: 'neck',
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's neck. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Assess fat deposition around the neck and estimate the neck circumference in centimeters. Look for: neck width relative to head, visible fat rolls, skin fold thickness. A typical adult neck circumference ranges 30-50 cm. ${JSON_SCHEMA_CIRCUMFERENCE}`,
  },
  {
    name: 'chest',
    imageType: 'front',
    box: { x: 22, y: 32, w: 56, h: 22 },
    hasCircumference: true,
    measurementRegion: 'chest',
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's chest area. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Assess chest fat and estimate chest circumference in centimeters. Look for: pectoral definition, gynecomastia signs, chest width, rib visibility. A typical adult chest circumference ranges 80-130 cm. ${JSON_SCHEMA_CIRCUMFERENCE}`,
  },
  {
    name: 'triceps',
    imageType: 'front',
    box: { x: 18, y: 30, w: 64, h: 35 },
    hasCircumference: false,
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's arms and triceps. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Assess arm fat and muscle definition. Look for: tricep hang (bat wings), bicep/tricep separation, overall arm definition, skin fold at the back of the arm. ${JSON_SCHEMA_VISUAL}`,
  },
  {
    name: 'belly',
    imageType: 'front',
    box: { x: 28, y: 50, w: 44, h: 26 },
    hasCircumference: false,
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's midsection. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Assess abdominal fat. Look for: presence of love handles, abdominal distension, muscle definition (abs visibility), skin folds, subcutaneous fat layer thickness. This is the most informative region for body fat estimation. ${JSON_SCHEMA_VISUAL}`,
  },
  {
    name: 'waist',
    imageType: 'front',
    box: { x: 30, y: 68, w: 40, h: 18 },
    hasCircumference: true,
    measurementRegion: 'waist',
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's waist area. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Estimate the waist circumference in centimeters at the navel level. Look for: waist-to-hip ratio, muffin top, oblique definition, narrowing at the natural waist. A typical adult waist circumference ranges 60-120 cm. ${JSON_SCHEMA_CIRCUMFERENCE}`,
  },
  {
    name: 'hips',
    imageType: 'front',
    box: { x: 28, y: 80, w: 44, h: 18 },
    hasCircumference: true,
    measurementRegion: 'hips',
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's hip region. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Estimate hip circumference in centimeters at the widest point. Look for: hip width, gluteal fat, saddlebags, overall pelvic fat distribution. A typical adult hip circumference ranges 80-130 cm. ${JSON_SCHEMA_CIRCUMFERENCE}`,
  },
  {
    name: 'forearms',
    imageType: 'front',
    box: { x: 18, y: 58, w: 64, h: 18 },
    hasCircumference: false,
    buildPrompt: (ctx) =>
      `You are an expert anthropometrist. Analyze this image of a user's forearms. The user is ${ctx.age} years old, ${ctx.gender}, ${ctx.heightCm} cm tall, ${ctx.weightKg} kg. Assess forearm leanness. Look for: vein visibility (vascularity), tendon definition, subcutaneous fat coverage, wrist-to-forearm taper. Vascularity is a strong indicator of low body fat. ${JSON_SCHEMA_VISUAL}`,
  },
];
