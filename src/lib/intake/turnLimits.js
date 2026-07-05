const MAX_QUESTIONS = 6
const MAX_ROUNDS = 3
const MAX_QUESTIONS_PER_ROUND = 3
const CONFIDENCE_FORCE_DONE = 0.75

export function countQuestionsAsked(messages) {
  return messages
    .filter((m) => m.role === 'interviewer')
    .flatMap((m) => (m.content?.type === 'question_batch' ? m.content.questions : []))
    .length
}

export function getCurrentRound(messages) {
  const batches = messages.filter(
    (m) => m.role === 'interviewer' && m.content?.type === 'question_batch'
  )
  if (batches.length === 0) return 1
  return batches[batches.length - 1].content.round
}

export function getLastHypothesis(messages) {
  const hypos = messages.filter(
    (m) => m.role === 'diagnostician' && m.content?.type === 'hypothesis'
  )
  return hypos.length ? hypos[hypos.length - 1].content : null
}

export function shouldForceDone(messages) {
  const round = getCurrentRound(messages)
  const hypothesis = getLastHypothesis(messages)
  if (hypothesis?.confidence >= CONFIDENCE_FORCE_DONE) return true
  if (round >= MAX_ROUNDS) return true
  if (countQuestionsAsked(messages) >= MAX_QUESTIONS) return true
  return false
}

export function canStartNewRound(messages) {
  const round = getCurrentRound(messages)
  const questions = countQuestionsAsked(messages)
  return round < MAX_ROUNDS && questions < MAX_QUESTIONS
}

export function clampBatchSize(requested, messages) {
  const asked = countQuestionsAsked(messages)
  const remaining = MAX_QUESTIONS - asked
  return Math.min(requested, MAX_QUESTIONS_PER_ROUND, remaining)
}

export { MAX_QUESTIONS, MAX_ROUNDS, MAX_QUESTIONS_PER_ROUND, CONFIDENCE_FORCE_DONE }
