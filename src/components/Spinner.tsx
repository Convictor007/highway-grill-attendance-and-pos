type SpinnerSize = 'sm' | 'md' | 'lg'

type Props = {
  size?: SpinnerSize
  className?: string
  label?: string
}

const sizeClass: Record<SpinnerSize, string> = {
  sm: 'spinner--sm',
  md: 'spinner--md',
  lg: 'spinner--lg',
}

export function Spinner({ size = 'md', className = '', label = 'Loading' }: Props) {
  return (
    <span
      className={`spinner ${sizeClass[size]} ${className}`.trim()}
      role="status"
      aria-label={label}
    />
  )
}
