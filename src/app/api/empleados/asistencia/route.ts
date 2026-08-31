import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const TZ = 'America/Tijuana'
const hoyTJ = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

// Listar asistencias.
//  - Estado de hoy:  ?usuario_id=...&fecha=YYYY-MM-DD
//  - Rango (admin):  ?usuario_id=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams
    const usuarioId = p.get('usuario_id')
    if (!usuarioId) return NextResponse.json({ ok: false, error: 'Falta usuario_id' }, { status: 400 })

    const sb = createAdminClient()
    let q = sb.from('asistencias').select('*').eq('usuario_id', usuarioId)
    const fecha = p.get('fecha')
    const desde = p.get('desde')
    const hasta = p.get('hasta')
    if (fecha) q = q.eq('fecha', fecha)
    if (desde) q = q.gte('fecha', desde)
    if (hasta) q = q.lte('fecha', hasta)
    q = q.order('fecha', { ascending: false })

    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, asistencias: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Marcar entrada o salida. Body: { usuario_id, usuario_nombre, sucursal, tipo: 'entrada'|'salida' }
export async function POST(req: NextRequest) {
  try {
    // Candado: el registro de asistencia solo se permite desde computadora, no desde teléfono.
    const ua = req.headers.get('user-agent') || ''
    if (/Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry/i.test(ua)) {
      return NextResponse.json({ ok: false, error: 'El registro de asistencia solo se permite desde la computadora de la óptica.' }, { status: 403 })
    }

    const { usuario_id, usuario_nombre, sucursal, tipo } =
      await req.json() as { usuario_id?: string; usuario_nombre?: string; sucursal?: string; tipo?: string }
    if (!usuario_id || (tipo !== 'entrada' && tipo !== 'salida')) {
      return NextResponse.json({ ok: false, error: 'Faltan datos (usuario_id, tipo)' }, { status: 400 })
    }

    const sb = createAdminClient()
    const fecha = hoyTJ()
    const ahora = new Date().toISOString()

    const { data: existente } = await sb.from('asistencias')
      .select('*').eq('usuario_id', usuario_id).eq('fecha', fecha).maybeSingle()

    if (tipo === 'entrada') {
      if (existente?.entrada) {
        return NextResponse.json({ ok: true, asistencia: existente, yaRegistrado: true })
      }
      if (existente) {
        const { data, error } = await sb.from('asistencias')
          .update({ entrada: ahora, sucursal: sucursal ?? existente.sucursal }).eq('id', existente.id).select().single()
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true, asistencia: data })
      }
      const { data, error } = await sb.from('asistencias')
        .insert({ usuario_id, usuario_nombre, sucursal, fecha, entrada: ahora }).select().single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, asistencia: data })
    }

    // salida
    if (existente) {
      const { data, error } = await sb.from('asistencias')
        .update({ salida: ahora }).eq('id', existente.id).select().single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, asistencia: data })
    }
    // salida sin entrada previa (raro): crea la fila con solo salida
    const { data, error } = await sb.from('asistencias')
      .insert({ usuario_id, usuario_nombre, sucursal, fecha, salida: ahora }).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, asistencia: data, sinEntrada: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
