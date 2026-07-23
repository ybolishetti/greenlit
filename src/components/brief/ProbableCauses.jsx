import Section from './Section'

export default function ProbableCauses({ probableCauses }) {
  if (!probableCauses?.length) return null
  return (
    <Section title="Ranked probable causes" subtitle="AI triage suggestions — verify before repair." bordered>
      <div className="space-y-3">
        {probableCauses.map((c) => (
          <div key={c.cause} className="rounded-xl border border-line bg-ink/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text">{c.cause}</span>
              <span className="text-text-dim">{c.confidence}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand" style={{ width: `${c.confidence}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
