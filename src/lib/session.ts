/**
 * session.ts — Fuente de verdad única para datos del usuario en sesión
 *
 * REGLA: la sucursal de trabajo es SIEMPRE la del check-in del día
 * (localStorage.optios_demo_user.sucursal), nunca el valor de Supabase Auth
 * que puede ser 'Todas' para admin/gerente.
 */

const STORAGE_KEY = 'optios_demo_user'

type DemoUser = {
  nombre?: string
  apodo?: string
  iniciales?: string
  rol?: string
  sucursal?: string
  id?: string
  checkInDate?: string
}

function leerStorage(): DemoUser {
  if (typeof window === 'undefined') return {}  // SSR guard
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// Corrige variantes mal escritas de sucursal (ej. sesiones viejas con 'Bajavision')
// para que siempre coincida con el nombre canónico que usa el resto del sistema.
const SUCURSAL_CANONICA: Record<string, string> = {
  'bajavision': 'Baja Visión',
  'baja vision': 'Baja Visión',
  'baja visión': 'Baja Visión',
  '5 de mayo': '5 de Mayo',
  'plaza laureles': 'Plaza Laureles',
}
function normalizarSucursal(s: string | undefined): string | undefined {
  if (!s) return s
  const key = s.trim().toLowerCase()
  return SUCURSAL_CANONICA[key] ?? s
}

/**
 * Devuelve la sucursal real donde está trabajando el usuario hoy.
 * Prioridad: localStorage (check-in) → fallback 'Baja Visión'
 * NUNCA devuelve 'Todas'.
 */
export function getSucursalActual(): string {
  const u = leerStorage()
  if (u.sucursal && u.sucursal !== 'Todas') return normalizarSucursal(u.sucursal) as string
  return 'Baja Visión'
}

/**
 * Devuelve la sucursal para filtros de vista (puede ser 'Todas' para admin/gerente).
 * Usar solo en listados donde mostrar todas las sucursales tiene sentido.
 */
export function getSucursalFiltro(): string {
  const u = leerStorage()
  return normalizarSucursal(u.sucursal) || 'Todas'
}

/**
 * Datos básicos del usuario en sesión desde localStorage.
 */
export function getUsuarioLocal(): DemoUser {
  return leerStorage()
}
