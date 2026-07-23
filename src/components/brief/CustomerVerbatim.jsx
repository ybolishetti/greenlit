import Section from './Section'

export default function CustomerVerbatim({ symptomLanguage }) {
  if (!symptomLanguage?.length) return null
  return (
    <Section title="What the customer reported">
      <div className="space-y-2 rounded-xl border-l-2 border-brand/40 bg-panel/60 p-4 text-sm italic text-text/80">
        <p className="text-[11px] font-medium uppercase not-italic tracking-wide text-text-mute">
          Customer&apos;s words:
        </p>
        {symptomLanguage.map((s) => (
          <p key={s}>&ldquo;{s}&rdquo;</p>
        ))}
      </div>
    </Section>
  )
}
