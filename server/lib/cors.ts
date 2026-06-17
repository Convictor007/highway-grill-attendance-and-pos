import { config } from './env'

export function corsHeaders(origin?: string | null): HeadersInit {
  const allowed = config.corsOrigin
  const value = origin && origin === allowed ? origin : allowed
  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export function withCors(response: Response, origin?: string | null): Response {
  const headers = corsHeaders(origin)
  for (const [key, val] of Object.entries(headers)) {
    response.headers.set(key, val)
  }
  return response
}
