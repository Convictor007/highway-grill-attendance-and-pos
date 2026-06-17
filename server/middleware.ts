import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { corsHeaders } from './lib/cors'

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

  const response = NextResponse.next()
  for (const [key, val] of Object.entries(corsHeaders(origin))) {
    response.headers.set(key, val)
  }
  return response
}

export const config = {
  matcher: '/api/:path*',
}
