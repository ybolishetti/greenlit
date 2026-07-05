import { countQuestionsAsked, getCurrentRound, MAX_QUESTIONS, MAX_ROUNDS } from '../../lib/intake/turnLimits'

export default function ConversationProgress({ messages }) {
  const round = getCurrentRound(messages)
  const asked = countQuestionsAsked(messages)
  return (
    <div className="mb-6 flex gap-1.5">
      {Array.from({ length: MAX_ROUNDS }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < round ? 'bg-brand' : 'bg-line'}`}
        />
      ))}
      <span className="ml-2 text-xs text-text-mute">
        {asked}/{MAX_QUESTIONS} questions
      </span>
    </div>
  )
}
