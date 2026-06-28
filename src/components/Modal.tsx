import { useEffect, type ReactNode } from 'react'

type ModalSize = 'default' | 'wide' | 'large' | 'full'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** @deprecated use size="wide" */
  wide?: boolean
  size?: ModalSize
  hideHeader?: boolean
  panelClassName?: string
  /**
   * @deprecated Backdrop clicks never close modals project-wide. Kept only for
   * call-site compatibility; setting it has no effect. Close via the × button,
   * footer actions, or the Escape key.
   */
  closeOnBackdropClick?: boolean
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
  size,
  hideHeader = false,
  panelClassName = '',
}: Props) {
  const panelSize: ModalSize = size ?? (wide ? 'wide' : 'default')
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const panelClasses = [
    'modal-panel',
    panelSize !== 'default' ? `modal-panel--${panelSize}` : '',
    panelClassName,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="modal-overlay" role="presentation">
      <div className={panelClasses} role="dialog" aria-modal="true" aria-label={title}>
        {hideHeader ? (
          <span className="modal-title-sr">{title}</span>
        ) : (
          <header className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>
        )}
        <div className={`modal-body${hideHeader ? ' modal-body--flush-top' : ''}`}>{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}
