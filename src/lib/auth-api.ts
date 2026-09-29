import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────
// Protección de rutas /api (lado servidor)
//
// Cada ruta llama requireRol([...]) al inicio:
//   1. Verifica que haya sesión válida (cookie de Supabase Auth).
//   2. Busca el rol en la tabla `usuarios` (NO en el navegador ni en
//      user_metadata, que el propio usuario podría modificar).
//   3. Si no tiene sesión → 401. Si su rol no está permitido → 403.
// ─────────────────────────────────────────────────────────────

export type Rol = 'administrador' | 'gerente' | 'vendedor' | 'repartidor'
export type UsuarioApi = { authId: string; id: string; nombre: string; rol: Rol; sucursal: string }

export const TODOS: Rol[] = ['administrador', 'gerente', 'vendedor', 'repartidor']
export const TIENDA: Rol[] = ['administrador', 'gerente', 'vendedor']
export const GESTION: Rol[] = ['administrador', 'gerente']
export const ADMIN: Rol[] = ['administrador']

// Caché corto del rol por usuario para no consultar la BD en cada request
const cache = new Map<string, { u: UsuarioApi; exp: number }>()
const TTL_MS = 60_000

async function usuarioActual(): Promise<UsuarioApi | null> {
  const sb = await createClient()

  // getClaims valida la firma del JWT; si no está disponible, getUser lo valida contra Auth
  let authId: string | null = null
  try {
    const auth = sb.auth as unknown as { getClaims?: () => Promise<{ data: { claims?: { sub?: string } } | null }> }
    if (typeof auth.getClaims === 'function') {
      const r = await auth.getClaims()
      authId = r.data?.claims?.sub ?? null
    } else {
      const r = await sb.auth.getUser()
      authId = r.data.user?.id ?? null
    }
  } catch { authId = null }
  if (!authId) return null

  const hit = cache.get(authId)
  if (hit && hit.exp > Date.now()) return hit.u

  const { data } = await createAdminClient()
    .from('usuarios')
    .select('id, nombre, rol, sucursal, activo')
    .eq('auth_user_id', authId)
    .maybeSingle()
  if (!data || data.activo === false) return null

  const u: UsuarioApi = {
    authId, id: String(data.id), nombre: data.nombre ?? '', rol: (data.rol ?? 'vendedor') as Rol, sucursal: data.sucursal ?? '',
  }
  cache.set(authId, { u, exp: Date.now() + TTL_MS })
  return u
}

export async function requireRol(roles: Rol[]):
  Promise<{ ok: true; usuario: UsuarioApi } | { ok: false; res: NextResponse }> {
  const u = await usuarioActual()
  if (!u) return { ok: false, res: NextResponse.json({ ok: false, error: 'Sesión no válida' }, { status: 401 }) }
  if (!roles.includes(u.rol)) return { ok: false, res: NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 }) }
  return { ok: true, usuario: u }
}

// Quita campos sensibles (costo) a quien no es administrador
export function sinCosto<T extends Record<string, unknown>>(rows: T[], u: UsuarioApi): T[] {
  if (u.rol === 'administrador') return rows
  return rows.map(r => { const { costo: _c, ...rest } = r; void _c; return rest as T })
}

// ¿Puede ver/modificar datos de otro empleado? Solo admin y gerente.
export const esGestor = (u: UsuarioApi) => u.rol === 'administrador' || u.rol === 'gerente'
