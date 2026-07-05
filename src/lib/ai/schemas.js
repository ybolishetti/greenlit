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

export const QuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  ui: UISchema,
  rationale: z.string(),
})

export const QuestionBatchSchema = z.object({
  type: z.literal('question_batch'),
  round: z.number().int().min(1).max(3),
  questions: z.array(QuestionSchema).min(1).max(3),
})

export const InterviewerDoneSchema = z.object({
  type: z.literal('done'),
})

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
  needs_more_info: z.array(z.string()).min(1).max(5),
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

export const MediaSummaryItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('audio'), duration_seconds: z.number().optional(), media_id: z.string().uuid() }),
  z.object({ kind: z.literal('video'), media_id: z.string().uuid() }),
  z.object({ kind: z.literal('photo'), media_id: z.string().uuid() }),
  z.object({ kind: z.literal('text'), text_content: z.string() }),
])

export function formatZodError(error) {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
}
