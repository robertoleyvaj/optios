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

  // Usamos getSession() en vez de getUser(): getSession valida el JWT LOCALMENTE (firma +
  // expiración) sin llamar al servidor de Auth en cada request. getUser hacía una llamada de
  // red por CADA navegación, y con varios usuarios saturaba Supabase Auth (se ponía lento,
  // expulsaba a la gente y colgaba el login). Para decidir la ruta, getSession es suficiente y
  // seguro (las lecturas a la BD ya están protegidas por RLS, que valida el JWT del lado server).
  // Solo hace red cuando el token está vencido (para refrescarlo), que es raro.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
  const user = await Promise.race([
    supabase.auth.getSession().then(r => r.data.session?.user ?? null).catch(() => null),
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
