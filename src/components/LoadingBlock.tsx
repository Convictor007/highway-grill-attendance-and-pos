export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return <p className="loading-block">{label}</p>
}
