import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getWeekRange,
  getMonthRange,
  aggregateDaily,
  aggregateJobs,
  summarizeTotals
} from '../src/utils/historyStats.js'

test('getWeekRange should return monday-sunday range', () => {
  const { start, end } = getWeekRange('2026-03-11') // Wednesday
  assert.equal(start, '2026-03-09')
  assert.equal(end, '2026-03-15')
})

test('getMonthRange should return first and last day', () => {
  const { start, end } = getMonthRange('2026-02')
  assert.equal(start, '2026-02-01')
  assert.equal(end, '2026-02-28')
})

test('aggregateDaily and summarizeTotals should use net hours and income', () => {
  const records = [
    { id: '1', date: '2026-03-10', hours: 2.0, wage: 20, jobId: 'a', jobName: 'A' },
    { id: '2', date: '2026-03-10', hours: 1.5, wage: 30, jobId: 'b', jobName: 'B' },
    { id: '3', date: '2026-03-11', hours: 1.0, wage: 20, jobId: 'a', jobName: 'A' }
  ]
  const daily = aggregateDaily(records)
  assert.equal(daily.length, 2)
  assert.equal(daily[0].date, '2026-03-10')
  assert.equal(daily[0].hours, 3.5)
  assert.equal(daily[0].income, 85)

  const summary = summarizeTotals(records)
  assert.equal(summary.totalHours, 4.5)
  assert.equal(summary.totalIncome, 105)
  assert.equal(summary.workedDays, 2)
  assert.equal(summary.avgHourly, 105 / 4.5)
})

test('aggregateJobs should group by job', () => {
  const records = [
    { id: '1', date: '2026-03-10', hours: 2.0, wage: 20, jobId: 'a', jobName: 'A' },
    { id: '2', date: '2026-03-10', hours: 1.5, wage: 30, jobId: 'b', jobName: 'B' },
    { id: '3', date: '2026-03-11', hours: 1.0, wage: 20, jobId: 'a', jobName: 'A' }
  ]
  const jobs = aggregateJobs(records)
  assert.equal(jobs.length, 2)
  const a = jobs.find(j => j.jobId === 'a')
  assert.equal(a.hours, 3)
  assert.equal(a.income, 60)
  assert.equal(a.records, 2)
  assert.equal(a.workedDays, 2)
})
