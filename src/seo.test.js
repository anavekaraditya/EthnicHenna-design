import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStructuredData, canonicalUrl, getPageKey, seoPages } from './seo.js'

test('public routes have unique SEO metadata and canonical URLs', () => {
  const publicKeys = ['home', 'work', 'designs', 'bridal', 'events']
  const titles = publicKeys.map((key) => seoPages[key].title)
  assert.equal(new Set(titles).size, publicKeys.length)
  for (const key of publicKeys) {
    assert.ok(seoPages[key].description.length > 80)
    assert.equal(canonicalUrl(seoPages[key].path).startsWith('https://ethnic-henna-design.vercel.app'), true)
    assert.equal(seoPages[key].robots, 'index,follow')
  }
})

test('hash compatibility routes map to their canonical page', () => {
  assert.equal(getPageKey('/', '#collections'), 'designs')
  assert.equal(getPageKey('/', '#bridal'), 'bridal')
  assert.equal(getPageKey('/', '#admin'), 'admin')
  assert.equal(getPageKey('/'), 'home')
})

test('structured data stays limited to verified service information', () => {
  const homeData = buildStructuredData('home')
  assert.equal(homeData[0]['@type'], 'ProfessionalService')
  assert.equal(homeData[0].address.streetAddress, undefined)
  assert.equal(homeData[0].aggregateRating, undefined)
  assert.equal(buildStructuredData('admin').length, 0)
  assert.equal(buildStructuredData('bridal')[0]['@type'], 'Service')
  assert.equal(buildStructuredData('events')[0]['@type'], 'Service')
})
