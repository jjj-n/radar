/**
 * Decides what to tell the reader when a log stream is no longer live, and
 * where to put it.
 *
 * A stream stops in two ways and both look identical on screen: the lines
 * freeze and the Stop control disappears. That is indistinguishable from a
 * workload that simply went quiet, which is the wrong thing to conclude
 * while debugging one.
 *
 * With nothing in the buffer the message takes the log body, because there is
 * nothing else to show. With lines already there it must not take the body:
 * those lines are usually the last thing the workload said, and they are what
 * the reader came for.
 */
export type StreamNoticeTone = 'stopped' | 'ended'

export interface StreamNotice {
  tone: StreamNoticeTone
  /** The reason, when there is one worth showing. */
  detail: string | null
}

export interface StreamNoticePlacement {
  /** Replaces the log body. */
  body: StreamNotice | null
  /** Sits above the log body, which keeps rendering. */
  banner: StreamNotice | null
}

/**
 * `endedReason` is what the server sent with its end event. It is often a
 * bare marker like "stream ended" that repeats the headline, so anything that
 * does not add information is dropped rather than shown twice.
 */
const UNINFORMATIVE_END_REASONS = new Set(['', 'stream ended', 'end', 'eof'])

export function placeStreamNotice(
  streamError: string | null | undefined,
  endedReason: string | null | undefined,
  hasEntries: boolean,
): StreamNoticePlacement {
  let notice: StreamNotice | null = null

  if (streamError) {
    notice = { tone: 'stopped', detail: streamError }
  } else if (endedReason !== null && endedReason !== undefined) {
    const trimmed = endedReason.trim()
    const detail = UNINFORMATIVE_END_REASONS.has(trimmed.toLowerCase()) ? null : trimmed
    notice = { tone: 'ended', detail }
  }

  if (!notice) return { body: null, banner: null }
  return hasEntries ? { body: null, banner: notice } : { body: notice, banner: null }
}

/** The headline for a notice. The detail, when present, follows it. */
export function streamNoticeHeadline(tone: StreamNoticeTone, hasEntries: boolean): string {
  if (tone === 'stopped') {
    return hasEntries
      ? 'Stream stopped, so these lines are no longer updating.'
      : 'Stream stopped.'
  }
  return hasEntries
    ? 'Stream ended. These are the last lines the container produced.'
    : 'Stream ended before any lines arrived.'
}
