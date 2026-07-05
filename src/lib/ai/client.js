import { invokeEdge, invokeEdgeStream } from '../db/edge.js'
import { completeIntakeStub } from '../db/intakes.js'
import { enrichQuestionBatch } from '../intake/uiRules.js'
import {
  isStubMode,
  stubDiagnosticianFinal,
  stubDiagnosticianFinalStream,
  stubDiagnosticianHypothesis,
  stubInterviewer,
} from './stub.js'
import {
  FinalBriefSchema,
  HypothesisSchema,
  InterviewerResponseSchema,
  LlmInterviewerResponseSchema,
  formatZodError,
} from './schemas.js'

const FALLBACK_LLM = {
  type: 'question_batch',
  round: 1,
  questions: [
    {
      id: 'q_fallback',
      prompt: 'Anything else you can tell us about the problem?',
      question_intent: 'freeform_description',
      rationale: 'Fallback after validation failure.',
    },
  ],
}

function enrichInterviewerResponse(raw) {
  const parsed = LlmInterviewerResponseSchema.parse(raw)
  if (parsed.type === 'done') return parsed
  return enrichQuestionBatch(parsed)
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
    const raw = await callLlm(
      'interviewer',
      intakeId,
      payload,
      stubInterviewer,
      LlmInterviewerResponseSchema
    )
    return InterviewerResponseSchema.parse(enrichInterviewerResponse(raw))
  } catch (err) {
    if (err.code === 'validation_failed') {
      return InterviewerResponseSchema.parse(enrichInterviewerResponse(FALLBACK_LLM))
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

/**
 * Stream final brief fields for progressive UI render.
 * @param {string} intakeId
 * @param {object} payload
 * @param {(partial: object) => void} onPartial
 * @returns {Promise<object>} complete validated brief
 */
export async function runDiagnosticianFinalStream(intakeId, payload, onPartial) {
  if (isStubMode()) {
    let final = null
    for await (const partial of stubDiagnosticianFinalStream(payload)) {
      onPartial(partial)
      final = partial
    }
    const brief = FinalBriefSchema.parse(final)
    await completeIntakeStub(intakeId, brief)
    return brief
  }

  try {
    let final = null
    for await (const event of invokeEdgeStream('diagnostician_final', intakeId, {
      ...payload,
      stream: true,
    })) {
      if (event.type === 'partial' && event.brief) {
        onPartial(event.brief)
        final = event.brief
      }
      if (event.type === 'complete' && event.result) {
        final = event.result
      }
      if (event.type === 'error') {
        throw Object.assign(new Error(event.message || 'Stream failed'), { code: event.code })
      }
    }
    return FinalBriefSchema.parse(final)
  } catch (err) {
    if (err.code === 'edge_error' || err.code === 'llm_unconfigured') {
      let final = null
      for await (const partial of stubDiagnosticianFinalStream(payload)) {
        onPartial(partial)
        final = partial
      }
      const brief = FinalBriefSchema.parse(final)
      await completeIntakeStub(intakeId, brief)
      return brief
    }
    throw err
  }
}

export { formatZodError, isStubMode }
