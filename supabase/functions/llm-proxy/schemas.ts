/**
 * Mirrors src/lib/ai/schemas.js exactly — keep in sync when schemas change.
 */
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

export const SelectOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
})

export const SingleSelectUISchema = z.object({
  type: z.literal('single_select'),
  options: z.array(SelectOptionSchema).min(3).max(6),
})

export const MultiSelectUISchema = z.object({
  type: z.literal('multi_select'),
  options: z.array(SelectOptionSchema).min(2).max(8),
  mutexValue: z.string().optional(),
})

export const SliderUISchema = z.object({
  type: z.literal('slider'),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  lowLabel: z.string(),
  highLabel: z.string(),
})

export const ToggleUISchema = z.object({
  type: z.literal('toggle'),
  trueLabel: z.string(),
  falseLabel: z.string(),
})

export const NaturalLanguageUISchema = z.object({
  type: z.literal('natural_language'),
  placeholder: z.string().optional(),
})

export const MediaRequestUISchema = z.object({
  type: z.literal('media_request'),
  kind: z.enum(['audio', 'video', 'photo']),
  prompt: z.string(),
})

export const UISchema = z.discriminatedUnion('type', [
  SingleSelectUISchema,
  MultiSelectUISchema,
  SliderUISchema,
  ToggleUISchema,
  NaturalLanguageUISchema,
  MediaRequestUISchema,
])

export const MediaSummaryItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('audio'), duration_seconds: z.number().optional(), media_id: z.string().uuid() }),
  z.object({ kind: z.literal('video'), media_id: z.string().uuid() }),
  z.object({ kind: z.literal('photo'), media_id: z.string().uuid() }),
  z.object({ kind: z.literal('text'), text_content: z.string() }),
])

export const VehicleSchema = z.object({
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  make: z.string().min(1),
  model: z.string().min(1),
  mileage: z.number().int().min(0).nullable().optional(),
  trim: z.string().nullable().optional(),
})

export const QuestionIntentSchema = z.enum([
  'symptom_timing',
  'symptom_location',
  'symptom_duration',
  'symptom_frequency',
  'pedal_feel',
  'steering_feel',
  'vibration_intensity',
  'vibration_location',
  'warning_lights',
  'visible_damage',
  'sound_capture',
  'motion_capture',
  'safety_confirmation',
  'freeform_description',
  // Added for the Anthropic-powered diagnosis engine (2026-08-03)
  'smell_description',
  'driving_conditions',
  'recent_repairs',
  'fluid_check',
  // Split from fluid_check (2026-08-04): fluid_check is type/color identification
  // only; fluid_level is the separate "is it low/dropping" question.
  'fluid_level',
  // Added 2026-08-04: generic "how strong/faint" slider, distinct from the
  // domain-specific pedal_feel/steering_feel/vibration_intensity sliders.
  'symptom_intensity',
])

export const InterviewerQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  question_intent: QuestionIntentSchema,
  rationale: z.string(),
})

export const QuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  question_intent: QuestionIntentSchema.optional(),
  ui: UISchema,
  rationale: z.string(),
})

export const LlmQuestionBatchSchema = z.object({
  type: z.literal('question_batch'),
  round: z.number().int().min(1).max(3),
  questions: z.array(InterviewerQuestionSchema).min(1).max(3),
})

export const QuestionBatchSchema = z.object({
  type: z.literal('question_batch'),
  round: z.number().int().min(1).max(3),
  questions: z.array(QuestionSchema).min(1).max(3),
})

export const InterviewerDoneSchema = z.object({
  type: z.literal('done'),
})

export const LlmInterviewerResponseSchema = z.discriminatedUnion('type', [
  LlmQuestionBatchSchema,
  InterviewerDoneSchema,
])

export const InterviewerResponseSchema = z.discriminatedUnion('type', [
  QuestionBatchSchema,
  InterviewerDoneSchema,
])

const HypothesisObjectSchema = z.object({
  type: z.literal('hypothesis'),
  round: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
  needs_more_info: z.array(z.string()).max(5).default([]),
  top_causes: z
    .array(z.object({ cause: z.string(), confidence: z.number().min(0).max(1) }))
    .max(3)
    .optional(),
})

// Round-3, low-confidence hypotheses must stop asking for more info even if
// the model still lists gaps — server-authoritative so a client bypass can't
// keep the interview looping past the turn-limit force-done threshold (0.90,
// distinct from the 0.60 low_confidence flag used elsewhere).
export const HypothesisSchema = HypothesisObjectSchema.transform((h) => {
  if (h.round === 3 && h.confidence < 0.9 && h.needs_more_info.length > 0) {
    return { ...h, needs_more_info: [] }
  }
  return h
})

export const FinalBriefSchema = z.object({
  type: z.literal('final'),
  category: z.string(),
  urgency: z.enum(['immediate', 'monitor', 'routine']),
  urgencyLabel: z.string(),
  probableCauses: z.array(
    z.object({ cause: z.string(), confidence: z.number().min(0).max(100) })
  ),
  componentsToInspect: z.array(z.string()),
  estimateRange: z.tuple([z.number(), z.number()]),
  symptomLanguage: z.array(z.string()).min(1),
  disclaimer: z.string(),
  inputs: z.object({
    audio: z.boolean(),
    photo: z.boolean(),
    video: z.boolean(),
    text: z.boolean(),
  }),
  // Overall diagnostician confidence (0-1). Optional because older/stub
  // briefs won't carry it; backfilled server-side from the last hypothesis
  // when the model omits it. Drives intakes.low_confidence (< 0.60) and the
  // per-cause display clamp — see enforceSafetyRules in index.ts.
  confidence: z.number().min(0).max(1).optional(),
})

export function formatZodError(error: z.ZodError) {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
}

export function getSchemaForIntent(intent: string) {
  switch (intent) {
    case 'interviewer':
      return LlmInterviewerResponseSchema
    case 'diagnostician_hypothesis':
      return HypothesisSchema
    case 'diagnostician_final':
      return FinalBriefSchema
    default:
      return null
  }
}

export function schemaHintForIntent(intent: string): string {
  switch (intent) {
    case 'interviewer':
      return '{"type":"question_batch","round":1,"questions":[{"id":"q_1","prompt":"...","question_intent":"symptom_timing","rationale":"..."}]} OR {"type":"done"}'
    case 'diagnostician_hypothesis':
      return '{"type":"hypothesis","round":1,"confidence":0.5,"needs_more_info":["..."],"top_causes":[{"cause":"...","confidence":0.3}]}'
    case 'diagnostician_final':
      return '{"type":"final","category":"...","urgency":"monitor","urgencyLabel":"...","probableCauses":[{"cause":"...","confidence":80}],"componentsToInspect":["..."],"estimateRange":[100,400],"symptomLanguage":["\\"quoted customer words\\""],"disclaimer":"...","inputs":{"audio":false,"photo":false,"video":false,"text":true},"confidence":0.8}'
    default:
      return ''
  }
}
