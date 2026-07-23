import Section from './Section'

export default function InspectionTargets({ componentsToInspect }) {
  if (!componentsToInspect?.length) return null
  return (
    <Section title="Components to inspect first">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {componentsToInspect.map((c) => (
          <li key={c} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-text/80">
            {c}
          </li>
        ))}
      </ul>
    </Section>
  )
}
