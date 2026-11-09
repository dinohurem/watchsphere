import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { UndoTarget, apiErrorMessage, describeUndo, undoBatch } from './catalogApi'

interface UndoToastProps {
  target: UndoTarget | null
  onClose: () => void
  onUndone: () => void
}

/** Bottom toast shown after every import / bulk action, with a one-click Undo. */
export function UndoToast({ target, onClose, onUndone }: UndoToastProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setMessage(null)
    if (!target) return
    const timer = setTimeout(onClose, 20000)
    return () => clearTimeout(timer)
  }, [target])

  if (!target) return null

  const handleUndo = async () => {
    setBusy(true)
    try {
      const result = await undoBatch(target.batchId)
      setMessage(describeUndo(result))
      onUndone()
      setTimeout(onClose, 4000)
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Undo failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-3 bg-primary text-white rounded-lg shadow-lg px-4 py-3 text-sm">
        <span className="truncate">{message ?? target.summary}</span>
        {!message && (
          <button
            onClick={handleUndo}
            disabled={busy}
            className="flex items-center gap-1 font-medium text-accent hover:underline disabled:opacity-50"
          >
            <RotateCcw size={14} />
            {busy ? 'Undoing...' : 'Undo'}
          </button>
        )}
        <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
