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

export const HypothesisSchema = z.object({
  type: z.literal('hypothesis'),
  round: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
  needs_more_info: z.array(z.string()).min(1).max(5),
  top_causes: z
    .array(z.object({ cause: z.string(), confidence: z.number().min(0).max(1) }))
    .max(3)
    .optional(),
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
})

export function formatZodError(error: z.ZodError) {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
}

export function getSchemaForIntent(intent: string) {
  switch (intent) {
    case 'interviewer':
      return InterviewerResponseSchema
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
      return '{"type":"question_batch","round":1,"questions":[{"id":"q_1","prompt":"...","ui":{"type":"single_select","options":[{"value":"a","label":"A"}]},"rationale":"..."}]} OR {"type":"done"}'
    case 'diagnostician_hypothesis':
      return '{"type":"hypothesis","round":1,"confidence":0.5,"needs_more_info":["..."],"top_causes":[{"cause":"...","confidence":0.3}]}'
    case 'diagnostician_final':
      return '{"type":"final","category":"...","urgency":"monitor","urgencyLabel":"...","probableCauses":[{"cause":"...","confidence":80}],"componentsToInspect":["..."],"estimateRange":[100,400],"symptomLanguage":["\\"quoted customer words\\""],"disclaimer":"...","inputs":{"audio":false,"photo":false,"video":false,"text":true}}'
    default:
      return ''
  }
}
