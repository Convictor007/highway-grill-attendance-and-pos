import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'

type Props = {
  open: boolean
  dayLabel: string
  dayIndex: number
  text: string
  branchId: string
  weekStart: string
  allFootnotes: Record<string, string>
  onClose: () => void
  onSaved: () => void
}

export function ScheduleFootnoteEditModal({
  open,
  dayLabel,
  dayIndex,
  text,
  branchId,
  weekStart,
  allFootnotes,
  onClose,
  onSaved,
}: Props) {
  const [note, setNote] = useState(text)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNote(text)
    setError(null)
  }, [open, text])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const dayFootnotes = { ...allFootnotes }
      const trimmed = note.trim()
      if (trimmed) {
        dayFootnotes[String(dayIndex)] = trimmed
      } else {
        delete dayFootnotes[String(dayIndex)]
      }

      await api('/shifts/roster/footnotes', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: branchId,
          week_start: weekStart,
          day_footnotes: dayFootnotes,
        }),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save note')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title={`Edit ${dayLabel} note`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p className="muted-block" style={{ marginTop: 0 }}>
        Shown on the weekly schedule for this day (e.g. GENERAL CLEANING). Leave blank to remove.
      </p>
      <div className="form-group">
        <label>Note for {dayLabel}</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. GENERAL CLEANING"
        />
      </div>
      {error && <p className="error-msg">{error}</p>}
    </Modal>
  )
}
