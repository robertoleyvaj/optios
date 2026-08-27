import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: usar getUser() (verifica con servidor), no getSession() (solo cookie local).
  // Con timeout: si Auth de Supabase se pone lento/no responde, NO colgamos todo el sistema
  // (evita el 504 MIDDLEWARE_INVOCATION_TIMEOUT). Si no responde a tiempo, tratamos como
  // "sin sesión" (fail-closed → te manda a login, que es lo seguro).
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
  const user = await Promise.race([
    supabase.auth.getUser().then(r => r.data.user).catch(() => null),
    timeout,
  ])

  const path = request.nextUrl.pathname

  // Sin sesión → redirigir a login
  if (!user && path.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Con sesión en /login → redirigir a dashboard
  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Solo protegemos el panel y el login. Antes corría en TODAS las rutas (incluidas
// las API), lo que multiplicaba las llamadas a Auth y el riesgo de timeout global.
export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
