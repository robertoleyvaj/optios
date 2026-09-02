import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { fetchMes } from '@/lib/analisis/queries'
import { computePendientes } from '@/lib/analisis/pendientes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Solo el administrador. Devuelve {ok, user} o null.
async function getAdmin(): Promise<{ nombre: string } | null> {
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    if (user.user_metadata?.rol === 'administrador') return { nombre: user.user_metadata?.nombre || user.email || 'admin' }
    const admin = createAdminClient()
    const { data } = await admin.from('usuarios').select('rol, nombre').eq('auth_user_id', user.id).single()
    return data?.rol === 'administrador' ? { nombre: data.nombre || 'admin' } : null
  } catch { return null }
}

// Columnas editables por tabla (whitelist — nunca escribir fuera de esto)
const CAMPOS: Record<string, string[]> = {
  gastos:      ['categoria', 'monto', 'metodo_pago'],
  ordenes_lab: ['costo_lab', 'laboratorio', 'folio_origen', 'motivo_problema', 'tipo_mica'],
  citas:       ['estado'],
}

// GET ?anio=&mes= → lista de pendientes
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ ok: false, error: 'Solo administrador' }, { status: 403 })
  const anio = parseInt(req.nextUrl.searchParams.get('anio') ?? '', 10)
  const mes  = parseInt(req.nextUrl.searchParams.get('mes') ?? '', 10)
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12)
    return NextResponse.json({ ok: false, error: 'Parámetros inválidos' }, { status: 400 })
  try {
    const data = await fetchMes(anio, mes - 1)
    return NextResponse.json({ ok: true, pendientes: computePendientes(data) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// POST → { action: 'update'|'close'|'reopen', ... }
export async function POST(req: NextRequest) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Solo administrador' }, { status: 403 })
  try {
    const body = await req.json()
    const action = body.action

    if (action === 'update') {
      const { tabla, id, campos } = body as { tabla: string; id: string; campos: Record<string, unknown> }
      const permitidos = CAMPOS[tabla]
      if (!permitidos || !id) return NextResponse.json({ ok: false, error: 'Tabla o id inválido' }, { status: 400 })
      const patch: Record<string, unknown> = {}
      for (const k of Object.keys(campos || {})) if (permitidos.includes(k)) patch[k] = campos[k]
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: 'Sin campos válidos' }, { status: 400 })
      const sb = createAdminClient()
      const { error } = await sb.from(tabla).update(patch).eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'update_armazon') {
      const { sku, costo } = body as { sku: string; costo: number }
      if (!sku || !(costo >= 0)) return NextResponse.json({ ok: false, error: 'SKU o costo inválido' }, { status: 400 })
      const ec = createEcommClient()
      const { error } = await ec.from('armazones').update({ costo }).eq('sku', sku)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'close' || action === 'reopen') {
      const { anio, mes, notas } = body as { anio: number; mes: number; notas?: string }
      if (!Number.isInteger(anio) || !Number.isInteger(mes)) return NextResponse.json({ ok: false, error: 'Periodo inválido' }, { status: 400 })
      const sb = createAdminClient()
      const { error } = await sb.from('cierres_mensuales').upsert({
        anio, mes, estado: action === 'close' ? 'confiable' : 'reabierto',
        cerrado_por: admin.nombre, cerrado_en: new Date().toISOString(), notas: notas ?? null,
      }, { onConflict: 'anio,mes' })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
