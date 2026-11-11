import { tokenize } from '../src/tokenize';

export function testLowercasesAndSplits() {
  assertEqual(tokenize('Reset your PASSWORD, now!'), ['reset', 'your', 'password', 'now']);
}

export function testDropsStopWords() {
  assertEqual(tokenize('The end of the road'), ['end', 'road']);
}
