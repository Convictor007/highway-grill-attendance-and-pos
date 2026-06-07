import { useLayoutEffect, useState, type RefObject } from 'react'

export type PopoverPosition = {
  top: number
  left: number
  maxWidth: number
}

const VIEWPORT_PAD = 8

export function usePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>
): PopoverPosition | null {
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    const update = () => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const popover = popoverRef.current
      const popW = popover?.offsetWidth ?? 300
      const popH = popover?.offsetHeight ?? 340

      let left = rect.left
      let top = rect.bottom + 6

      if (left + popW + VIEWPORT_PAD > window.innerWidth) {
        left = rect.right - popW
      }
      if (left < VIEWPORT_PAD) {
        left = VIEWPORT_PAD
      }

      if (top + popH + VIEWPORT_PAD > window.innerHeight) {
        const above = rect.top - popH - 6
        top = above >= VIEWPORT_PAD ? above : VIEWPORT_PAD
      }

      setPosition({
        top,
        left,
        maxWidth: window.innerWidth - VIEWPORT_PAD * 2,
      })
    }

    update()
    const raf = requestAnimationFrame(update)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, popoverRef])

  return position
}
