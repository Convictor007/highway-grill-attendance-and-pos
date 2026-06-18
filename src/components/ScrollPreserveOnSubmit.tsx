import { useEffect } from 'react'
import { afterPaint, getScrollY, setScrollY } from '../lib/scroll'

/**
 * Keeps the viewport position when forms submit (save buttons, Enter in inputs).
 * Works with React controlled forms that call preventDefault — the jump often
 * happens on the re-render after save, not on native navigation.
 */
export function ScrollPreserveOnSubmit() {
  useEffect(() => {
    const onSubmit = () => {
      const y = getScrollY()
      afterPaint(() => setScrollY(y))
    }

    document.addEventListener('submit', onSubmit, true)
    return () => document.removeEventListener('submit', onSubmit, true)
  }, [])

  return null
}
