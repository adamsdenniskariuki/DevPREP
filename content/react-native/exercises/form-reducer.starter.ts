export type Field = 'email' | 'password'
export interface FormState { values: Record<Field, string>; touched: Record<Field, boolean>; submitted: boolean }
export type FormAction = { type: 'change'; field: Field; value: string } | { type: 'blur'; field: Field } | { type: 'submit' } | { type: 'reset' }

export const initialForm: FormState = { values: { email: '', password: '' }, touched: { email: false, password: false }, submitted: false }

export function errorsFor(values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  if (!values.email) errors.email = 'Required'
  if (!values.password) errors.password = 'Required'
  return errors
}

export function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === 'change') state.values[action.field] = action.value
  return state
}

export function visibleErrors(state: FormState): Partial<Record<Field, string>> {
  return errorsFor(state.values)
}
