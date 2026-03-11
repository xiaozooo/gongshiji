import test from 'node:test'
import assert from 'node:assert/strict'
import { getWagePlaceholder } from '../src/pages/home.js'

test('getWagePlaceholder should use selected job wage', () => {
  assert.equal(getWagePlaceholder({ wage: 18 }), '¥18')
  assert.equal(getWagePlaceholder({ wage: 20.5 }), '¥20.5')
})

test('getWagePlaceholder should fall back when no job is selected', () => {
  assert.equal(getWagePlaceholder(null), '工价')
})
