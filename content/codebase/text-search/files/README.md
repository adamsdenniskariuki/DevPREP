# Finder

An in-memory full-text index for a help centre’s articles.

## Layout

- `src/tokenize.ts` lowercases text, splits it into words and drops stop words.
- `src/search-index.ts` holds `SearchIndex`: add, remove and search documents.
- `tests/` has the suite. Tests are exported `test*` functions in `tests/*.test.ts`. They use the global helpers `assert`, `assertEqual` and `assertThrows`.

## Rules

- A search matches documents containing every query word.
- Results are ranked by how many times the query words appear, then by id.
- Adding a document with an existing id replaces it.
