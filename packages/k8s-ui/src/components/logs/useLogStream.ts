import { useState, useRef, useCallback, useEffect } from 'react'
import { attachLogStreamListeners, type LogStreamHandlers } from './log-stream-listeners'

export type { LogStreamHandlers }

/**
 * Manages an SSE log stream: EventSource lifecycle, isStreaming state, cleanup.
 * Callers provide a factory function that creates the EventSource with current params.
 */
export function useLogStream() {
  const [isStreaming, setIsStreaming] = useState(false)
  // Set when the connection fails (and not on a clean end — see endedRef).
  const [streamError, setStreamError] = useState<string | null>(null)
  // True from a start attempt until the stream first settles (connected / end /
  // error / stop). Lets callers show a connecting spinner that won't reappear
  // after a clean end. Starts true so an auto-stream viewer paints the spinner
  // immediately instead of flashing the empty state.
  const [connecting, setConnecting] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)
  // EventSource fires a generic 'error' on the normal close that follows the
  // server's 'end'; this distinguishes a clean end from a real failure.
  const endedRef = useRef(false)

  const stopStreaming = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setIsStreaming(false)
    setConnecting(false)
    setStreamError(null)
  }, [])

  const startStreaming = useCallback((
    create: () => EventSource,
    handlers: LogStreamHandlers,
    errorContext = 'Log stream error',
  ) => {
    eventSourceRef.current?.close()
    endedRef.current = false
    setStreamError(null)
    setConnecting(true)
    const es = create()
    attachLogStreamListeners(es, handlers, errorContext, {
      setIsStreaming,
      setConnecting,
      setStreamError,
      isCurrent: () => eventSourceRef.current === es,
      ended: endedRef,
    })
    eventSourceRef.current = es
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { eventSourceRef.current?.close() }, [])

  return { isStreaming, streamError, connecting, startStreaming, stopStreaming }
}
