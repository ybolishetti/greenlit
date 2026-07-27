export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img src="/logo.png" alt="Greenlit logo" className="h-7 w-7" />
      <span className="text-lg font-semibold tracking-tight text-white">
        greenlit
      </span>
    </div>
  )
}
