import { useNotification } from '../hooks/useNotification'
import { cancelMistakenClockIn, clockIn as doClockIn, clockOut as doClockOut, clockErrorMessage } from '../lib/clock'

type Props = {
  open: boolean
  onBreak: boolean
  clockInAt: string | null
  busy: boolean
  setBusy: (v: boolean) => void
  canClock: boolean
  geofenceRequired: boolean
  geofenceCanClockIn: boolean
  geofenceLoading: boolean
  isRestDay?: boolean
  noShiftToday?: boolean
  onRefresh: () => Promise<void>
  onGeofenceRefresh?: () => Promise<void>
  onBreakStart?: () => Promise<void>
  onBreakEnd?: () => Promise<void>
  clockError: string | null
  setClockError: (msg: string | null) => void
  compact?: boolean
}

function formatClockIn(iso: string | null) {
  if (!iso) return ''
  return new Date(iso.replace(' ', 'T')).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ClockActions({
  open,
  onBreak,
  clockInAt,
  busy,
  setBusy,
  canClock,
  geofenceRequired,
  geofenceCanClockIn,
  geofenceLoading,
  isRestDay,
  noShiftToday,
  onRefresh,
  onGeofenceRefresh,
  onBreakStart,
  onBreakEnd,
  clockError,
  setClockError,
  compact,
}: Props) {
  const { confirm } = useNotification()
  const btnSm = compact ? ' btn-sm' : ''

  const handleClockIn = async () => {
    if (!canClock) return
    if (isRestDay) {
      const ok = await confirm('Today is your rest day. Clock in anyway?', {
        title: 'Rest day',
        confirmLabel: 'Clock in',
      })
      if (!ok) return
    } else if (noShiftToday) {
      const ok = await confirm('No work shift is scheduled for today. Clock in anyway?', {
        title: 'No shift today',
        confirmLabel: 'Clock in',
      })
      if (!ok) return
    }

    setBusy(true)
    setClockError(null)
    try {
      await doClockIn(geofenceRequired)
      await onGeofenceRefresh?.()
      await onRefresh()
    } catch (err) {
      const msg = clockErrorMessage(err)
      if (/already clocked/i.test(msg)) {
        await onRefresh()
        setClockError('You are clocked in — tap Clock out below.')
      } else {
        setClockError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleClockOut = async () => {
    if (!canClock) return
    setBusy(true)
    setClockError(null)
    try {
      await doClockOut()
      await onRefresh()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCancelMistake = async () => {
    if (!canClock || !open) return
    const ok = await confirm('Remove this clock-in? No hours will be recorded.', {
      title: 'Cancel clock-in',
      variant: 'danger',
      confirmLabel: 'Cancel clock-in',
    })
    if (!ok) return
    setBusy(true)
    setClockError(null)
    try {
      await cancelMistakenClockIn()
      await onRefresh()
    } catch (err) {
      setClockError(clockErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="clock-actions">
        <button
          type="button"
          className={`btn btn-clock-in${btnSm}`}
          disabled={busy || !canClock || !geofenceCanClockIn || geofenceLoading}
          onClick={handleClockIn}
        >
          Clock in
        </button>
        {clockError && <p className="error-msg">{clockError}</p>}
      </div>
    )
  }

  return (
    <div className="clock-actions clock-actions--open">
      <p className="clock-since">
        Clocked in at <strong>{formatClockIn(clockInAt)}</strong>
      </p>
      <button
        type="button"
        className={`btn btn-clock-out btn-clock-out--primary${btnSm}`}
        disabled={busy || onBreak || !canClock}
        onClick={handleClockOut}
      >
        Clock out
      </button>
      <div className="clock-actions-secondary">
        {onBreakStart && onBreakEnd && (
          !onBreak ? (
            <button type="button" className={`btn btn-ghost${btnSm}`} disabled={busy || !canClock} onClick={onBreakStart}>
              Start break
            </button>
          ) : (
            <button type="button" className={`btn btn-primary${btnSm}`} disabled={busy || !canClock} onClick={onBreakEnd}>
              End break
            </button>
          )
        )}
        <button
          type="button"
          className="text-link text-link--danger"
          disabled={busy || !canClock}
          onClick={handleCancelMistake}
        >
          Cancel — clocked in by mistake
        </button>
      </div>
      {clockError && <p className="error-msg">{clockError}</p>}
    </div>
  )
}
