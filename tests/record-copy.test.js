import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCopyDate } from '../src/utils/recordCopy.js'

test('resolveCopyDate should prefer record.date when present', () => {
  const d = resolveCopyDate({ date: '2026-03-01', startTimestamp: '2026-03-02T01:00:00.000Z' })
  assert.equal(d, '2026-03-01')
})

test('resolveCopyDate should fallback to local date from startTimestamp', () => {
  const d = resolveCopyDate({ startTimestamp: '2026-03-02T01:00:00.000Z' })
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/)
})
