import test from 'node:test'
import assert from 'node:assert/strict'
import { calcNetWorkMinutes } from '../src/utils/time.js'
import { generateCSV, parseCSV } from '../src/utils/csv.js'

test('calcNetWorkMinutes should subtract break minutes and clamp to zero', () => {
  assert.equal(calcNetWorkMinutes(120, 20), 100)
  assert.equal(calcNetWorkMinutes(60, 0), 60)
  assert.equal(calcNetWorkMinutes(60, 80), 0)
  assert.equal(calcNetWorkMinutes(60, -10), 60)
})

test('generateCSV should include breakMinutes column', () => {
  const csv = generateCSV([
    {
      id: 'r1',
      jobId: 'j1',
      jobName: '测试岗位',
      date: '2026-03-11',
      startTimestamp: '2026-03-11T01:00:00.000Z',
      endTimestamp: '2026-03-11T03:00:00.000Z',
      hours: 1.5,
      breakMinutes: 30,
      wage: 20,
      memo: 'note'
    }
  ])
  assert.match(csv, /breakMinutes/)
  assert.match(csv, /,30,/)
})

test('parseCSV should parse breakMinutes', () => {
  const csv = 'recordId,jobId,jobName,date,startTimestamp,endTimestamp,hours,breakMinutes,wage,gross,memo\n' +
    'r1,j1,测试岗位,2026-03-11,2026-03-11T01:00:00.000Z,2026-03-11T03:00:00.000Z,1.50,30,20.00,30.00,note'
  const records = parseCSV(csv)
  assert.equal(records.length, 1)
  assert.equal(records[0].breakMinutes, 30)
})
