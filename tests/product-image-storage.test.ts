import assert from 'node:assert/strict'
import test from 'node:test'
import { productInputFromForm } from '../src/lib/product-image-storage'

function getParsedPrice(value: string) {
  const form = new FormData()
  form.set('price', value)
  return productInputFromForm(form, '').price
}

test('parses plain and Indonesian-grouped product prices', () => {
  assert.equal(getParsedPrice('38000'), 38000)
  assert.equal(getParsedPrice('38.000'), 38000)
  assert.equal(getParsedPrice('1.234.567'), 1234567)
})

test('rejects malformed or unsafe product price formats', () => {
  for (const value of ['', '38.00', '38,000', '38..000', '1.234.56', '9007199254740992']) {
    assert.equal(Number.isNaN(getParsedPrice(value)), true, `expected "${value}" to be rejected`)
  }
})
