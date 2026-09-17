import { describe, expect, it } from 'vitest'

import { placeStreamNotice, streamNoticeHeadline } from './stream-notice'

const FAILURE = 'Failed to open log stream: container "checkout" is waiting to start'

describe('placeStreamNotice', () => {
  it('says nothing while the stream is still live', () => {
    expect(placeStreamNotice(null, null, true)).toEqual({ body: null, banner: null })
    expect(placeStreamNotice(null, null, false)).toEqual({ body: null, banner: null })
  })

  it('reports a clean end, which used to leave the view looking live', () => {
    // Deleting a pod mid-stream makes the server send `end`, not `error`. The
    // lines froze and nothing said why, which reads like a quiet workload.
    expect(placeStreamNotice(null, 'stream ended', true)).toEqual({
      body: null,
      banner: { tone: 'ended', detail: null },
    })
  })

  it('drops an end reason that only repeats the headline', () => {
    for (const reason of ['stream ended', 'Stream Ended', ' end ', 'EOF', '']) {
      expect(placeStreamNotice(null, reason, true).banner).toEqual({ tone: 'ended', detail: null })
    }
  })

  it('keeps an end reason that actually says something', () => {
    expect(placeStreamNotice(null, 'container exited with code 137', true).banner).toEqual({
      tone: 'ended',
      detail: 'container exited with code 137',
    })
  })

  it('prefers a failure over an end when both are set', () => {
    // The error listener also fires on the close that follows a clean end, so
    // a real failure must not be downgraded to "ended".
    expect(placeStreamNotice(FAILURE, 'stream ended', true).banner).toEqual({
      tone: 'stopped',
      detail: FAILURE,
    })
  })

  it('takes the body when no lines arrived, and the banner once they have', () => {
    expect(placeStreamNotice(FAILURE, null, false)).toEqual({
      body: { tone: 'stopped', detail: FAILURE },
      banner: null,
    })
    expect(placeStreamNotice(FAILURE, null, true)).toEqual({
      body: null,
      banner: { tone: 'stopped', detail: FAILURE },
    })
  })

  it('never puts one notice in both places', () => {
    for (const hasEntries of [true, false]) {
      const { body, banner } = placeStreamNotice(FAILURE, null, hasEntries)
      expect(body && banner).toBeFalsy()
    }
  })
})

describe('streamNoticeHeadline', () => {
  it('tells a reader with lines on screen that those lines are now stale', () => {
    expect(streamNoticeHeadline('stopped', true)).toContain('no longer updating')
    expect(streamNoticeHeadline('ended', true)).toContain('last lines')
  })

  it('does not promise lines that never arrived', () => {
    expect(streamNoticeHeadline('ended', false)).toBe('Stream ended before any lines arrived.')
    expect(streamNoticeHeadline('stopped', false)).toBe('Stream stopped.')
  })
})
