export type Field = 'email' | 'password'
export interface FormState { values: Record<Field, string>; touched: Record<Field, boolean>; submitted: boolean }
export type FormAction = { type: 'change'; field: Field; value: string } | { type: 'blur'; field: Field } | { type: 'submit' } | { type: 'reset' }

export const initialForm: FormState = { values: { email: '', password: '' }, touched: { email: false, password: false }, submitted: false }

export function errorsFor(values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  const email = values.email.trim()
  if (!email) errors.email = 'Required'
  else if (!/^[^@\s]+@[^@\s]+$/.test(email)) errors.email = 'Invalid email'
  if (!values.password) errors.password = 'Required'
  else if (values.password.length < 8) errors.password = 'Too short'
  return errors
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'change': return { ...state, values: { ...state.values, [action.field]: action.value } }
    case 'blur': return { ...state, touched: { ...state.touched, [action.field]: true } }
    case 'submit': return { ...state, submitted: true, touched: { email: true, password: true } }
    case 'reset': return initialForm
  }
}

export function visibleErrors(state: FormState): Partial<Record<Field, string>> {
  const all = errorsFor(state.values)
  const shown: Partial<Record<Field, string>> = {}
  for (const field of ['email', 'password'] as Field[]) if (state.touched[field] && all[field]) shown[field] = all[field]
  return shown
}
