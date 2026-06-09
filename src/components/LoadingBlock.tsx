import { Spinner } from './Spinner'

type Props = {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingBlock({ label = 'Loading…', size = 'md', className = '' }: Props) {
  return (
    <div className={`loading-block ${className}`.trim()} role="status" aria-live="polite">
      <Spinner size={size} label={label} />
      <span>{label}</span>
    </div>
  )
}
