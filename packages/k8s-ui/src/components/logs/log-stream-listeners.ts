import { handleSSEError } from '../../utils/log-format'

export interface LogStreamHandlers {
  /** Called when stream connects with parsed event data. setIsStreaming(true) is called automatically. */
  onConnected?: (data: unknown) => void
  /** Called for each log event with parsed event data */
  onLog: (data: unknown) => void
  /** Called when new pods are discovered during streaming (workload logs only) */
  onPodAdded?: (data: unknown) => void
  /** Called when pods are terminated during streaming (workload logs only) */
  onPodRemoved?: (data: unknown) => void
  /** Called when the server ends the stream cleanly */
  onEnd?: (data: unknown) => void
}

/** The stream state the listeners drive, supplied by the hook that owns it. */
export interface LogStreamControls {
  setIsStreaming: (streaming: boolean) => void
  setConnecting: (connecting: boolean) => void
  setStreamError: (message: string | null) => void
  /**
   * False once this EventSource has been superseded. Closing or replacing one
   * (Stop, container switch, restart) can fire a late, async 'error' that would
   * otherwise corrupt the new stream's state or show a false failure.
   */
  isCurrent: () => boolean
  /** Shared across listeners: 'end' sets it, 'error' reads it. */
  ended: { current: boolean }
}

function parsed(event: Event): unknown {
  return JSON.parse((event as MessageEvent).data)
}

/**
 * Wires the SSE event listeners onto `es`. Split out of useLogStream so the
 * event-to-state mapping can be exercised directly: the interesting cases are
 * orderings (a failure before or after 'connected', an error after a clean
 * 'end') and they are invisible to a test of the parsing helpers alone.
 */
export function attachLogStreamListeners(
  es: EventSource,
  handlers: LogStreamHandlers,
  errorContext: string,
  ctl: LogStreamControls,
): void {
  es.addEventListener('connected', (event) => {
    if (!ctl.isCurrent()) return
    ctl.setIsStreaming(true)
    ctl.setConnecting(false)
    if (handlers.onConnected) {
      try { handlers.onConnected(parsed(event)) } catch (e) {
        console.error('Failed to parse connected event:', e)
      }
    }
  })

  es.addEventListener('log', (event) => {
    if (!ctl.isCurrent()) return
    ctl.setConnecting(false)
    try { handlers.onLog(parsed(event)) } catch (e) {
      console.error('Failed to parse log event:', e)
    }
  })

  es.addEventListener('pod_added', (event) => {
    if (!ctl.isCurrent()) return
    if (handlers.onPodAdded) {
      try { handlers.onPodAdded(parsed(event)) } catch (e) {
        console.error('Failed to parse pod_added event:', e)
      }
    }
  })

  es.addEventListener('pod_removed', (event) => {
    if (!ctl.isCurrent()) return
    if (handlers.onPodRemoved) {
      try { handlers.onPodRemoved(parsed(event)) } catch (e) {
        console.error('Failed to parse pod_removed event:', e)
      }
    }
  })

  es.addEventListener('end', (event) => {
    if (!ctl.isCurrent()) return
    ctl.ended.current = true
    ctl.setIsStreaming(false)
    ctl.setConnecting(false)
    if (handlers.onEnd) {
      try { handlers.onEnd(parsed(event)) } catch (e) {
        console.error('Failed to parse end event:', e)
      }
    }
  })

  es.addEventListener('error', (event) => {
    if (!ctl.isCurrent()) { es.close(); return }
    ctl.setIsStreaming(false)
    ctl.setConnecting(false)
    es.close()
    // The browser fires 'error' on the normal close that follows a clean
    // 'end'; that's not a failure, so don't log it or surface it.
    if (ctl.ended.current) return
    ctl.setStreamError(handleSSEError(event, errorContext))
  })
}
