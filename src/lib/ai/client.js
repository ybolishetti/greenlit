import { invokeEdge } from '../db/edge.js'
import { completeIntakeStub } from '../db/intakes.js'
import { isStubMode, stubDiagnosticianFinal, stubDiagnosticianHypothesis, stubInterviewer } from './stub.js'
import {
  FinalBriefSchema,
  HypothesisSchema,
  InterviewerResponseSchema,
  formatZodError,
} from './schemas.js'

const FALLBACK_QUESTION = {
  type: 'question_batch',
  round: 1,
  questions: [
    {
      id: 'q_fallback',
      prompt: 'Anything else you can tell us about the problem?',
      ui: { type: 'natural_language', placeholder: 'Describe what you notice…' },
      rationale: 'Fallback after validation failure.',
    },
  ],
}

async function callLlm(intent, intakeId, payload, stubFn, schema) {
  if (isStubMode()) {
    const raw = await stubFn({ ...payload, intent })
    return schema.parse(raw)
  }

  try {
    const data = await invokeEdge(intent, intakeId, payload)
    return schema.parse(data.result)
  } catch (err) {
    if (err.code === 'validation_failed') {
      throw err
    }
    if (err.code === 'edge_error' || err.code === 'llm_unconfigured') {
      const raw = await stubFn({ ...payload, intent })
      return schema.parse(raw)
    }
    throw err
  }
}

export async function runInterviewer(intakeId, payload) {
  try {
    return await callLlm(
      'interviewer',
      intakeId,
      payload,
      stubInterviewer,
      InterviewerResponseSchema
    )
  } catch (err) {
    if (err.code === 'validation_failed') {
      return InterviewerResponseSchema.parse(FALLBACK_QUESTION)
    }
    throw err
  }
}

export async function runDiagnosticianHypothesis(intakeId, payload) {
  return callLlm(
    'diagnostician_hypothesis',
    intakeId,
    payload,
    stubDiagnosticianHypothesis,
    HypothesisSchema
  )
}

export async function runDiagnosticianFinal(intakeId, payload) {
  if (isStubMode()) {
    const raw = await stubDiagnosticianFinal(payload)
    const brief = FinalBriefSchema.parse(raw)
    await completeIntakeStub(intakeId, brief)
    return brief
  }

  try {
    const data = await invokeEdge('diagnostician_final', intakeId, payload)
    return FinalBriefSchema.parse(data.result)
  } catch (err) {
    if (err.code === 'edge_error' || err.code === 'llm_unconfigured') {
      const raw = await stubDiagnosticianFinal(payload)
      const brief = FinalBriefSchema.parse(raw)
      await completeIntakeStub(intakeId, brief)
      return brief
    }
    throw err
  }
}

export { formatZodError, isStubMode }
