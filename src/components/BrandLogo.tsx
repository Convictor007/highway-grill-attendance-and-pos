import hgLogo from '../assets/HG_logo.png'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function BrandLogo({ size = 'md', className = '' }: Props) {
  return (
    <img
      src={hgLogo}
      alt="Highway Grill"
      className={`brand-logo brand-logo--${size}${className ? ` ${className}` : ''}`}
    />
  )
}
