export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <div className="h-7 w-7 rounded-md bg-brand flex items-center justify-center">
        <div className="h-2.5 w-2.5 rounded-full bg-ink" />
      </div>
      <span className="text-lg font-semibold tracking-tight text-white">
        greenlit
      </span>
    </div>
  )
}
