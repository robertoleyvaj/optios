import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, esGestor, TIENDA, GESTION } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Traspasos entre sucursales
// GET   ?estado=en_camino&destino=baja   → lista (con piezas)
// POST  { origen, destino, notas, items:[{color_id, cantidad}] }   (admin/gerente)
// PATCH { id, accion: 'recibir' | 'cancelar' }   recibir: cualquiera de tienda · cancelar: admin/gerente
// ─────────────────────────────────────────────────────────────

const UBIC = new Set(['baja', 'mayo', 'plaza', 'bodega'])

export async function GET(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const p = req.nextUrl.searchParams
    const sb = createEcommClient()
    let q = sb.from('traspasos')
      .select('id, folio, created_at, origen, destino, estado, enviado_por, recibido_por, recibido_at, notas, traspaso_items(sku, descripcion, cantidad)')
      .order('created_at', { ascending: false }).limit(100)
    const estado = p.get('estado'); const destino = p.get('destino')
    if (estado) q = q.eq('estado', estado)
    if (destino && UBIC.has(destino)) q = q.eq('destino', destino)
    // Las vendedoras solo ven lo que va en camino (para confirmar que llegó)
    if (!esGestor(g.usuario)) q = q.eq('estado', 'en_camino')
    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, traspasos: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  try {
    const b = await req.json() as { origen?: string; destino?: string; notas?: string; items?: { color_id: number; cantidad: number }[] }
    if (!UBIC.has(b.origen ?? '') || !UBIC.has(b.destino ?? '') || b.origen === b.destino) {
      return NextResponse.json({ ok: false, error: 'Elige dos ubicaciones distintas' }, { status: 400 })
    }
    const items = (b.items ?? []).filter(i => Number.isInteger(i.color_id) && Number.isInteger(i.cantidad) && i.cantidad > 0)
    if (!items.length) return NextResponse.json({ ok: false, error: 'Agrega al menos una pieza' }, { status: 400 })

    const { data, error } = await createEcommClient().rpc('inv_traspaso_enviar', {
      p_origen: b.origen, p_destino: b.destino, p_usuario: g.usuario.nombre || 'OptiOS',
      p_notas: b.notas ?? '', p_items: items,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, folio: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const { id, accion } = await req.json() as { id?: number; accion?: string }
    if (!id || (accion !== 'recibir' && accion !== 'cancelar')) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }
    if (accion === 'cancelar' && !esGestor(g.usuario)) {
      return NextResponse.json({ ok: false, error: 'Solo el gerente o el administrador pueden cancelar' }, { status: 403 })
    }
    const fn = accion === 'recibir' ? 'inv_traspaso_recibir' : 'inv_traspaso_cancelar'
    const { data, error } = await createEcommClient().rpc(fn, { p_id: id, p_usuario: g.usuario.nombre || 'OptiOS' })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, folio: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
