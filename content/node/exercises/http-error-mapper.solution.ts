export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HttpError'
  }
}

export interface ErrorResponse { status: number; body: { error: { code: string; message: string } } }

const reply = (status: number, code: string, message: string): ErrorResponse => ({ status, body: { error: { code, message } } })

export function toResponse(error: unknown): ErrorResponse {
  if (error instanceof HttpError) return reply(error.status, error.code, error.message)
  if (error instanceof SyntaxError) return reply(400, 'bad_json', 'Malformed JSON body')
  return reply(500, 'internal', 'Internal server error')
}
