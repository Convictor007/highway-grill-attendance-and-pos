import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { corsHeaders } from './lib/cors'

function isApi(pathname: string) {
  return pathname.startsWith('/api')
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.svg' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')

  if (isApi(pathname)) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
    }
    const response = NextResponse.next()
    for (const [key, val] of Object.entries(corsHeaders(origin))) {
      response.headers.set(key, val)
    }
    return response
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  return NextResponse.rewrite(new URL('/index.html', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
