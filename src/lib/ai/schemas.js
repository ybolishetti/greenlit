/**
 * Canonical message-contract schemas for Greenlit v2.
 * Edge Function validators in supabase/functions/llm-proxy/schemas.ts mirror these exactly.
 */
import { z } from 'zod'

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
])

/** LLM output — ui is derived client-side via uiRules.js */
export const InterviewerQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  question_intent: QuestionIntentSchema,
  rationale: z.string(),
})

/** Stored/rendered question — includes derived ui (or legacy ui-only records) */
export const QuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  question_intent: QuestionIntentSchema.optional(),
  ui: UISchema,
  rationale: z.string(),
})

export const LlmPayloadSchema = z.object({
  round: z.number().int().min(1).max(3).optional(),
  vehicle: VehicleSchema.nullable().optional(),
  media_summary: z.array(MediaSummaryItemSchema).optional(),
  conversation: z.array(z.object({ role: z.string(), content: z.unknown() })).optional(),
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

/** Raw LLM interviewer output (no ui field) */
export const LlmInterviewerResponseSchema = z.discriminatedUnion('type', [
  LlmQuestionBatchSchema,
  InterviewerDoneSchema,
])

export const InterviewerResponseSchema = z.discriminatedUnion('type', [
  QuestionBatchSchema,
  InterviewerDoneSchema,
])

export const UserAnswerSchema = z.object({
  type: z.literal('answer'),
  answer_to: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
  free_text: z.string().optional(),
})

export const HypothesisSchema = z.object({
  type: z.literal('hypothesis'),
  round: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
  needs_more_info: z.array(z.string()).max(5).default([]),
  top_causes: z
    .array(
      z.object({
        cause: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(3)
    .optional(),
})

export const FinalBriefSchema = z.object({
  type: z.literal('final'),
  category: z.string(),
  urgency: z.enum(['immediate', 'monitor', 'routine']),
  urgencyLabel: z.string(),
  probableCauses: z.array(
    z.object({
      cause: z.string(),
      confidence: z.number().min(0).max(100),
    })
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
})

export const SystemEventSchema = z.object({
  type: z.literal('system_event'),
  event: z.enum([
    'round_start',
    'round_end',
    'forced_done',
    'validation_failed',
    'ai_error',
    'stub_mode',
    'intake_started',
  ]),
  round: z.number().int().optional(),
  details: z.record(z.unknown()).optional(),
})

export function formatZodError(error) {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
}
