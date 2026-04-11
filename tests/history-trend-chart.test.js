import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHistoryChartDatasets, buildHistoryChartOptions } from '../src/pages/history.js'

test('buildHistoryChartDatasets should return dual-axis bar/line datasets', () => {
  const points = [
    { date: '2026-03-01', dayLabel: '1', hours: 0, income: 0 },
    { date: '2026-03-02', dayLabel: '2', hours: 4, income: 80 },
    { date: '2026-03-03', dayLabel: '3', hours: 8, income: 160 }
  ]
  const [hoursDs, incomeDs] = buildHistoryChartDatasets(points, '2026-03-02')

  assert.equal(hoursDs.type, 'bar')
  assert.equal(hoursDs.yAxisID, 'yHours')
  assert.equal(incomeDs.type, 'line')
  assert.equal(incomeDs.yAxisID, 'yIncome')
  assert.equal(hoursDs.data[1], 4)
  assert.equal(incomeDs.data[2], 160)
  assert.notEqual(hoursDs.backgroundColor[1], hoursDs.backgroundColor[0])
})

test('buildHistoryChartOptions should expose two y axes and sparse x labels', () => {
  const points = [
    { date: '2026-03-01', dayLabel: '1', hours: 2, income: 20 },
    { date: '2026-03-02', dayLabel: '2', hours: 0, income: 0 },
    { date: '2026-03-03', dayLabel: '3', hours: 3, income: 30 },
    { date: '2026-03-04', dayLabel: '4', hours: 1, income: 10 }
  ]

  const options = buildHistoryChartOptions(points, '2026-03-03')

  assert.equal(Boolean(options.scales.yHours), true)
  assert.equal(Boolean(options.scales.yIncome), true)
  assert.equal(options.scales.x.ticks.callback(0, 0), '1')
  assert.equal(options.scales.x.ticks.callback(0, 3), '4')
})
