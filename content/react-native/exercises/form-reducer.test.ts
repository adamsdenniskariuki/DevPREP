import { errorsFor, formReducer, initialForm, visibleErrors } from './index'

export function testErrors() {
  assertEqual(errorsFor({ email: '  ', password: '' }), { email: 'Required', password: 'Required' })
  assertEqual(errorsFor({ email: 'a@', password: 'short' }), { email: 'Invalid email', password: 'Too short' })
  assertEqual(errorsFor({ email: ' ana@example.com ', password: 'longenough' }), {})
}

export function testChangeDoesNotMutate() {
  const next = formReducer(initialForm, { type: 'change', field: 'email', value: 'x' })
  assertEqual(next.values.email, 'x')
  assertEqual(initialForm.values.email, '', 'initial state unchanged')
}

export function testOnlyTouchedErrorsShow() {
  let state = formReducer(initialForm, { type: 'change', field: 'email', value: 'bad' })
  assertEqual(visibleErrors(state), {})
  state = formReducer(state, { type: 'blur', field: 'email' })
  assertEqual(visibleErrors(state), { email: 'Invalid email' })
}

export function testSubmitTouchesAll() {
  const state = formReducer(initialForm, { type: 'submit' })
  assertEqual(state.submitted, true)
  assertEqual(visibleErrors(state), { email: 'Required', password: 'Required' })
}

export function testReset() {
  const dirty = formReducer(formReducer(initialForm, { type: 'change', field: 'password', value: 'x' }), { type: 'submit' })
  assertEqual(formReducer(dirty, { type: 'reset' }), initialForm)
}
