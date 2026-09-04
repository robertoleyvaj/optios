import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function esAdmin(): Promise<boolean> {
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return false
    if (user.user_metadata?.rol === 'administrador') return true
    const admin = createAdminClient()
    const { data } = await admin.from('usuarios').select('rol').eq('auth_user_id', user.id).single()
    return data?.rol === 'administrador'
  } catch { return false }
}

const TIPOS = ['porcentaje', 'monto', 'componente']
const OBJETIVOS = ['armazon', 'ar', 'arprem', 'blue', 'foto', 'pol', 'tinte', 'anti']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function limpiar(b: any) {
  const codigo = String(b.codigo || '').trim().toUpperCase()
  const tipo = String(b.tipo || '')
  if (!codigo) throw new Error('Falta el código')
  if (!TIPOS.includes(tipo)) throw new Error('Tipo no válido')
  if (tipo === 'componente' && !OBJETIVOS.includes(b.objetivo)) throw new Error('Elige el componente objetivo')
  if ((tipo === 'porcentaje' || tipo === 'monto') && !(Number(b.valor) > 0)) throw new Error('Falta el valor del descuento')
  return {
    codigo, tipo,
    valor: tipo === 'componente' ? null : Number(b.valor),
    objetivo: tipo === 'componente' ? b.objetivo : null,
    compra_minima: Number(b.compra_minima) || 0,
    vigencia_desde: b.vigencia_desde || null,
    vigencia_hasta: b.vigencia_hasta || null,
    usos_max: b.usos_max === '' || b.usos_max == null ? null : Number(b.usos_max),
    combinable: !!b.combinable,
    campana: b.campana || null,
    descripcion: b.descripcion || null,
    activo: b.activo !== false,
  }
}

export async function GET() {
  if (!(await esAdmin())) return NextResponse.json({ ok: false, error: 'Solo administrador' }, { status: 403 })
  try {
    const ec = createEcommClient()
    const { data, error } = await ec.from('cupones').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ ok: true, cupones: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin())) return NextResponse.json({ ok: false, error: 'Solo administrador' }, { status: 403 })
  try {
    const body = await req.json()
    const ec = createEcommClient()

    if (body.action === 'crear') {
      const row = limpiar(body)
      const { error } = await ec.from('cupones').insert(row)
      if (error) throw new Error(error.code === '23505' ? 'Ya existe un código con ese nombre' : error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'editar') {
      if (!body.id) throw new Error('Falta id')
      const row = limpiar(body)
      const { error } = await ec.from('cupones').update(row).eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'toggle') {
      if (!body.id) throw new Error('Falta id')
      const { error } = await ec.from('cupones').update({ activo: !!body.activo }).eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
