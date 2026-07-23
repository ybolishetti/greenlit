export default function VehicleLine({ vehicle }) {
  if (!vehicle) return null
  return (
    <p className="mt-2 text-xs text-text-mute">
      {vehicle.year} {vehicle.make} {vehicle.model}
      {vehicle.mileage != null ? ` · ${vehicle.mileage.toLocaleString()} mi` : ''}
    </p>
  )
}
