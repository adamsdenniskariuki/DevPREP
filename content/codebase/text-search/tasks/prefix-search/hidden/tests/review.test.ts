import { SearchIndex } from '../src/search-index';

function sample() {
  const index = new SearchIndex();
  index.add('pay', 'Payment failed? Update your payment card.');
  index.add('payout', 'Payouts arrive weekly.');
  index.add('pass', 'Passwords must be long.');
  return index;
}

export function testPrefixMatchesSeveralWords() {
  assertEqual(sample().search('pay*'), ['pay', 'payout']);
}

export function testPrefixCombinesWithExactTerms() {
  assertEqual(sample().search('pay* card'), ['pay']);
  assertEqual(sample().search('weekly pay*'), ['payout']);
}

export function testExactTermStillExact() {
  assertEqual(sample().search('pay'), []);
}

export function testPrefixIsCaseInsensitive() {
  assertEqual(sample().search('PASS*'), ['pass']);
}
