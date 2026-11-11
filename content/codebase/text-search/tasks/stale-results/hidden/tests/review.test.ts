import { SearchIndex } from '../src/search-index';

export function testEditedArticleDropsOldWords() {
  const index = new SearchIndex();
  index.add('a1', 'Refunds take five days');
  index.add('a1', 'Exchanges take two days');
  assertEqual(index.search('refunds'), []);
  assertEqual(index.search('exchanges'), ['a1']);
}

export function testReAddingSameTextDoesNotDoubleCount() {
  const index = new SearchIndex();
  index.add('a', 'card card');
  index.add('b', 'card card card');
  index.add('a', 'card card');
  index.add('a', 'card card');
  assertEqual(index.search('card'), ['b', 'a']);
}

export function testRemoveAfterReAddClearsEverything() {
  const index = new SearchIndex();
  index.add('a', 'old words');
  index.add('a', 'new words');
  index.remove('a');
  assertEqual(index.search('old'), []);
  assertEqual(index.search('words'), []);
  assertEqual(index.size(), 0);
}
