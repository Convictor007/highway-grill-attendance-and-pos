import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Modal } from '../components/Modal'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export type Toast = {
  id: string
  type: NotificationType
  message: string
  title?: string
  duration: number
}

export type ConfirmOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

export type PromptOptions = {
  title?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
}

type NotifyInput = {
  type: NotificationType
  message: string
  title?: string
  duration?: number
}

type NotificationContextValue = {
  toasts: Toast[]
  notify: (input: NotifyInput) => string
  success: (message: string, title?: string) => string
  error: (message: string, title?: string) => string
  warning: (message: string, title?: string) => string
  info: (message: string, title?: string) => string
  dismiss: (id: string) => void
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

let toastCounter = 0

function nextToastId() {
  toastCounter += 1
  return `toast-${toastCounter}`
}

function ToastIcon({ type }: { type: NotificationType }) {
  if (type === 'success') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="notification-toast__icon">
        <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4.2 6.8-5.2 5.2a.8.8 0 0 1-1.1 0l-2.5-2.5a.8.8 0 1 1 1.1-1.1l1.9 1.9 4.6-4.6a.8.8 0 1 1 1.2 1.1Z" />
      </svg>
    )
  }
  if (type === 'error') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="notification-toast__icon">
        <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm.8 4.2a.8.8 0 0 0-1.6 0v5.2a.8.8 0 0 0 1.6 0V5.2ZM10 14.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
      </svg>
    )
  }
  if (type === 'warning') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="notification-toast__icon">
        <path d="M10 1.5 1.8 16.5h16.4L10 1.5Zm.8 4.7v5.2h-1.6V6.2h1.6Zm-.8 8.6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="notification-toast__icon">
      <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm.8 4.2v5.2h-1.6V5.2h1.6Zm-.8 8.6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  )
}

function NotificationToasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="notification-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`notification-toast notification-toast--${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <ToastIcon type={toast.type} />
          <div className="notification-toast__body">
            {toast.title ? <p className="notification-toast__title">{toast.title}</p> : null}
            <p className="notification-toast__message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="notification-toast__close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    ({ type, message, title, duration = 5000 }: NotifyInput) => {
      const id = nextToastId()
      const toast: Toast = { id, type, message, title, duration }
      setToasts((items) => [...items, toast])

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }

      return id
    },
    [dismiss]
  )

  const success = useCallback(
    (message: string, title?: string) => notify({ type: 'success', message, title }),
    [notify]
  )
  const error = useCallback(
    (message: string, title?: string) => notify({ type: 'error', message, title, duration: 7000 }),
    [notify]
  )
  const warning = useCallback(
    (message: string, title?: string) => notify({ type: 'warning', message, title }),
    [notify]
  )
  const info = useCallback(
    (message: string, title?: string) => notify({ type: 'info', message, title }),
    [notify]
  )

  const [confirmState, setConfirmState] = useState<{
    message: string
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, options, resolve })
    })
  }, [])

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmState((state) => {
      state?.resolve(value)
      return null
    })
  }, [])

  const [promptState, setPromptState] = useState<{
    message: string
    options: PromptOptions
    value: string
    resolve: (value: string | null) => void
  } | null>(null)

  const prompt = useCallback((message: string, options: PromptOptions = {}) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({
        message,
        options,
        value: options.defaultValue ?? '',
        resolve,
      })
    })
  }, [])

  const closePrompt = useCallback((value: string | null) => {
    setPromptState((state) => {
      state?.resolve(value)
      return null
    })
  }, [])

  useEffect(() => {
    const timersMap = timers.current
    return () => {
      for (const timer of timersMap.values()) clearTimeout(timer)
      timersMap.clear()
    }
  }, [])

  const value = useMemo(
    () => ({ toasts, notify, success, error, warning, info, dismiss, confirm, prompt }),
    [toasts, notify, success, error, warning, info, dismiss, confirm, prompt]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToasts toasts={toasts} onDismiss={dismiss} />
      <Modal
        open={confirmState !== null}
        title={confirmState?.options.title ?? 'Confirm'}
        onClose={() => closeConfirm(false)}
        closeOnBackdropClick={false}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => closeConfirm(false)}>
              {confirmState?.options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`btn ${
                confirmState?.options.variant === 'danger' ? 'btn-danger' : 'btn-primary'
              }`}
              onClick={() => closeConfirm(true)}
            >
              {confirmState?.options.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <p>{confirmState?.message}</p>
      </Modal>
      <Modal
        open={promptState !== null}
        title={promptState?.options.title ?? 'Input required'}
        onClose={() => closePrompt(null)}
        closeOnBackdropClick={false}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => closePrompt(null)}>
              {promptState?.options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => closePrompt(promptState?.value ?? '')}
            >
              {promptState?.options.confirmLabel ?? 'OK'}
            </button>
          </>
        }
      >
        <p>{promptState?.message}</p>
        <label className="notification-prompt-field">
          <span>{promptState?.options.label ?? 'Value'}</span>
          <input
            type="text"
            value={promptState?.value ?? ''}
            placeholder={promptState?.options.placeholder}
            onChange={(e) =>
              setPromptState((state) => (state ? { ...state, value: e.target.value } : state))
            }
            autoFocus
          />
        </label>
      </Modal>
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return ctx
}
