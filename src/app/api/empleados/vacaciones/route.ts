import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Listar solicitudes.
//  - De un empleado: ?usuario_id=...
//  - Por estado:     ?estado=pendiente|aprobada|rechazada
//  - Todas (admin):  sin parámetros
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams
    const sb = createAdminClient()
    let q = sb.from('solicitudes_vacaciones').select('*')
    const usuarioId = p.get('usuario_id')
    const estado = p.get('estado')
    if (usuarioId) q = q.eq('usuario_id', usuarioId)
    if (estado) q = q.eq('estado', estado)
    q = q.order('fecha_inicio', { ascending: false })
    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, solicitudes: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Crear solicitud. Body: { usuario_id, usuario_nombre, sucursal, tipo, fecha_inicio, fecha_fin, dias, motivo }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.usuario_id || !b.fecha_inicio || !b.fecha_fin) {
      return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })
    }
    const sb = createAdminClient()
    const { data, error } = await sb.from('solicitudes_vacaciones').insert({
      usuario_id: b.usuario_id,
      usuario_nombre: b.usuario_nombre ?? null,
      sucursal: b.sucursal ?? null,
      tipo: b.tipo === 'sin_goce' ? 'sin_goce' : 'vacaciones',
      fecha_inicio: b.fecha_inicio,
      fecha_fin: b.fecha_fin,
      dias: Number(b.dias) || 0,
      motivo: b.motivo ?? null,
      estado: 'pendiente',
    }).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, solicitud: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Resolver (aprobar/rechazar) o cancelar. Body: { id, estado, resuelto_por }
export async function PATCH(req: NextRequest) {
  try {
    const { id, estado, resuelto_por } = await req.json() as { id?: string; estado?: string; resuelto_por?: string }
    if (!id || !['aprobada', 'rechazada', 'pendiente'].includes(estado ?? '')) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }
    const sb = createAdminClient()
    const { data, error } = await sb.from('solicitudes_vacaciones')
      .update({ estado, resuelto_por: resuelto_por ?? null, resuelto_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, solicitud: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
