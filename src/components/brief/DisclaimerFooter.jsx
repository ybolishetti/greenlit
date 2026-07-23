export default function DisclaimerFooter({ disclaimer }) {
  if (!disclaimer) return null
  return <p className="mt-8 text-xs text-text-mute">{disclaimer}</p>
}
