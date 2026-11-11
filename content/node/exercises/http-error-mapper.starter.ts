export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, options?: { cause?: unknown }) {
    super(message)
  }
}

export interface ErrorResponse { status: number; body: { error: { code: string; message: string } } }

export function toResponse(error: unknown): ErrorResponse {
  // TODO: map known errors and hide unknown ones.
  const message = error instanceof Error ? error.message : String(error)
  return { status: 500, body: { error: { code: 'internal', message } } }
}
