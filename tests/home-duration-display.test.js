import test from 'node:test'
import assert from 'node:assert/strict'
import { formatWorkDurationHours, formatWorkMinutesBreakdown } from '../src/pages/home.js'

test('formatWorkDurationHours should show work minutes as hours', () => {
  assert.equal(formatWorkDurationHours(0), '0')
  assert.equal(formatWorkDurationHours(30), '0.5')
  assert.equal(formatWorkDurationHours(90), '1.5')
  assert.equal(formatWorkDurationHours(120), '2')
})

test('formatWorkMinutesBreakdown should show total minus break equals work minutes', () => {
  assert.equal(formatWorkMinutesBreakdown(0, 0), '')
  assert.equal(formatWorkMinutesBreakdown(120, 30), '总120分钟 - 休息30分钟 = 工作90分钟')
  assert.equal(formatWorkMinutesBreakdown(45, 0), '总45分钟 - 休息0分钟 = 工作45分钟')
})
