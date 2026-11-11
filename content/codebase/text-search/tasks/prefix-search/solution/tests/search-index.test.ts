import { SearchIndex } from '../src/search-index';

function sample() {
  const index = new SearchIndex();
  index.add('billing', 'Update your billing card. Billing runs monthly.');
  index.add('password', 'Reset your password from the sign-in page.');
  index.add('card', 'Your card was declined: check the card number.');
  return index;
}

export function testFindsDocumentsWithEveryWord() {
  assertEqual(sample().search('reset password'), ['password']);
}

export function testRanksByOccurrences() {
  assertEqual(sample().search('card'), ['card', 'billing']);
}

export function testRemove() {
  const index = sample();
  index.remove('card');
  assertEqual(index.search('card'), ['billing']);
  assertEqual(index.size(), 2);
}

export function testNoMatches() {
  assertEqual(sample().search('refund'), []);
  assertEqual(sample().search('the'), []);
}

export function testPrefixTerm() {
  assertEqual(sample().search('pass*'), ['password']);
}
