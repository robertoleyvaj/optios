import { NextResponse, type NextRequest } from 'next/server'

// Auth es demo via localStorage — no hay sesión Supabase que verificar en el servidor.
// El middleware solo pasa todo sin bloquear.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
