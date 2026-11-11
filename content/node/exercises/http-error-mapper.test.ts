import { HttpError, toResponse } from './index'

export function testHttpErrorFields() {
  const cause = new Error('row missing')
  const error = new HttpError(404, 'not_found', 'Order 7 not found', { cause })
  assert(error instanceof Error)
  assertEqual(error.name, 'HttpError')
  assertEqual(error.status, 404)
  assertEqual(error.cause, cause)
}

export function testMapsHttpError() {
  assertEqual(toResponse(new HttpError(409, 'conflict', 'Version mismatch')), {
    status: 409, body: { error: { code: 'conflict', message: 'Version mismatch' } },
  })
}

export function testMapsBadJson() {
  let parseError: unknown
  try { JSON.parse('{oops') } catch (error) { parseError = error }
  assertEqual(toResponse(parseError), { status: 400, body: { error: { code: 'bad_json', message: 'Malformed JSON body' } } })
}

export function testHidesUnknownErrors() {
  const response = toResponse(new TypeError("Cannot read properties of undefined (reading 'id')"))
  assertEqual(response, { status: 500, body: { error: { code: 'internal', message: 'Internal server error' } } })
}

export function testHandlesNonErrorValues() {
  assertEqual(toResponse('db password is hunter2').status, 500)
  assertEqual(toResponse(undefined).body.error.code, 'internal')
}
