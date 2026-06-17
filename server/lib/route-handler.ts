import { jsonError } from './api-response'
import { UnauthorizedError } from './auth'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export async function handleRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof UnauthorizedError) return jsonError('Unauthorized', 401)
    if (e instanceof ForbiddenError) return jsonError(e.message, 403)
    if (e instanceof NotFoundError) return jsonError(e.message, 404)
    if (e instanceof ValidationError) return jsonError(e.message, 422)
    if (e instanceof Response) return e
    const message = e instanceof Error ? e.message : 'Server error'
    const status =
      message.toLowerCase().includes('not found') ? 404
      : message.toLowerCase().includes('invalid') || message.toLowerCase().includes('required') ? 422
      : 400
    return jsonError(message, status)
  }
}
