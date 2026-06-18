export type LoadOptions = {
  /** Refresh data without full-page loading state (keeps scroll position). */
  silent?: boolean
}

/** Restore scroll after React has painted following state updates. */
export function afterPaint(fn: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}

export function getScrollY(): number {
  return window.scrollY
}

export function setScrollY(y: number) {
  window.scrollTo({ top: y, left: 0, behavior: 'instant' })
}

/** Run async work and restore scroll position when it finishes. */
export async function preserveScroll<T>(work: () => Promise<T>): Promise<T> {
  const y = getScrollY()
  try {
    return await work()
  } finally {
    afterPaint(() => setScrollY(y))
  }
}

/** Call before toggling loading off after a silent refresh. */
export function restoreScrollY(y: number) {
  afterPaint(() => setScrollY(y))
}

/** Use at the start/end of page `load` helpers when supporting silent refresh. */
export function resolveLoadBehavior(options?: LoadOptions) {
  const scrollY = options?.silent ? getScrollY() : null
  return {
    showLoading: !options?.silent,
    finish: () => {
      if (scrollY !== null) restoreScrollY(scrollY)
    },
  }
}
