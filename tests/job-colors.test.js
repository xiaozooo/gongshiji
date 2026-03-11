import test from 'node:test'
import assert from 'node:assert/strict'
import { JOB_COLOR_PALETTE, pickJobColor } from '../src/utils/colors.js'

test('job color palette should contain multiple preset colors', () => {
  assert.ok(Array.isArray(JOB_COLOR_PALETTE))
  assert.ok(JOB_COLOR_PALETTE.length >= 8)
})

test('pickJobColor should be deterministic for same seed', () => {
  const c1 = pickJobColor('job-001')
  const c2 = pickJobColor('job-001')
  assert.equal(c1, c2)
  assert.ok(JOB_COLOR_PALETTE.includes(c1))
})

test('pickJobColor should fall back for empty seed', () => {
  const c = pickJobColor('')
  assert.equal(c, JOB_COLOR_PALETTE[0])
})
