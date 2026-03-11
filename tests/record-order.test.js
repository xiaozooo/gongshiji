import test from 'node:test'
import assert from 'node:assert/strict'
import { pickLatestRecord } from '../src/db/recordStore.js'

test('pickLatestRecord should use createdAt order first', () => {
  const records = [
    { id: 'a', startTimestamp: '2026-03-01T08:00:00.000Z', createdAt: '2026-03-11T01:00:00.000Z' },
    { id: 'b', startTimestamp: '2026-03-10T08:00:00.000Z', createdAt: '2026-03-11T02:00:00.000Z' }
  ]
  const latest = pickLatestRecord(records)
  assert.equal(latest.id, 'b')
})
