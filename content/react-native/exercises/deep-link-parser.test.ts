import { parseDeepLink } from './index'

const config = {
  prefixes: ['shop://', 'https://shop.example/'],
  screens: { Home: '', Product: 'product/:id', Review: 'product/:id/reviews/:reviewId', Search: 'search' },
}

export function testHomeAndStatic() {
  assertEqual(parseDeepLink('shop://', config), { screen: 'Home', params: {} })
  assertEqual(parseDeepLink('shop://search', config), { screen: 'Search', params: {} })
}

export function testPathParams() {
  assertEqual(parseDeepLink('https://shop.example/product/42', config), { screen: 'Product', params: { id: '42' } })
  assertEqual(parseDeepLink('shop://product/7/reviews/r1', config), { screen: 'Review', params: { id: '7', reviewId: 'r1' } })
}

export function testQueryAndDecoding() {
  assertEqual(parseDeepLink('shop://search?q=red+shoes&size=10', config), { screen: 'Search', params: { q: 'red shoes', size: '10' } })
  assertEqual(parseDeepLink('shop://product/a%20b?id=x&ref=mail', config), { screen: 'Product', params: { id: 'a b', ref: 'mail' } })
}

export function testExtraSlashes() {
  assertEqual(parseDeepLink('shop:///product//9/', config), { screen: 'Product', params: { id: '9' } })
}

export function testNoMatch() {
  assertEqual(parseDeepLink('other://product/1', config), null)
  assertEqual(parseDeepLink('shop://cart', config), null)
}
