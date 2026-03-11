import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_JOB_NAME, DEFAULT_JOB_WAGE } from '../src/db/jobStore.js'
import { getHomeMemoFieldMarkup } from '../src/pages/home.js'
import { getHistoryHeaderActionsMarkup } from '../src/pages/history.js'

test('default job should be 小时工 with wage 10', () => {
  assert.equal(DEFAULT_JOB_NAME, '小时工')
  assert.equal(DEFAULT_JOB_WAGE, 10)
})

test('home page should not render memo field', () => {
  assert.equal(getHomeMemoFieldMarkup(), '')
})

test('history page should not render export action in header', () => {
  assert.equal(getHistoryHeaderActionsMarkup(), '')
})
