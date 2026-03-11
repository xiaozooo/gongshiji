import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_START_TIME, DEFAULT_END_TIME } from '../src/pages/home.js'

test('home page should default to a 09:00-17:00 workday', () => {
  assert.equal(DEFAULT_START_TIME, '09:00')
  assert.equal(DEFAULT_END_TIME, '17:00')
})
