import test from 'node:test'
import assert from 'node:assert/strict'
import { HISTORY_RECORD_ACTION_TRIGGER, buildHistoryEditModalContent } from '../src/pages/history.js'
import { getWageInputValueForEdit, getWagePlaceholder } from '../src/utils/wage.js'

test('history record action should be opened by click', () => {
  assert.equal(HISTORY_RECORD_ACTION_TRIGGER, 'click')
})

test('history edit modal should align with home fields', () => {
  const rec = {
    jobName: '小时工',
    date: '2026-03-11',
    startTimestamp: '2026-03-11T09:00:00.000Z',
    endTimestamp: '2026-03-11T17:00:00.000Z',
    breakMinutes: 30
  }
  const html = buildHistoryEditModalContent({
    rec,
    dateValue: '2026-03-11',
    startTimeValue: '09:00',
    endTimeValue: '17:00',
    wagePlaceholder: '¥20',
    wageValue: ''
  })

  assert.match(html, /id="er-date"/)
  assert.match(html, /id="er-start"/)
  assert.match(html, /id="er-end"/)
  assert.match(html, /id="er-break"/)
  assert.match(html, /id="er-wage"/)
  assert.doesNotMatch(html, /id="er-memo"/)
  assert.doesNotMatch(html, /备注/)
})

test('edit wage should keep empty when same as job wage', () => {
  assert.equal(getWageInputValueForEdit(20, 20), '')
  assert.equal(getWageInputValueForEdit(19.5, 20), '19.5')
  assert.equal(getWageInputValueForEdit(undefined, 20), '')
  assert.equal(getWagePlaceholder({ wage: 18 }), '¥18')
})
