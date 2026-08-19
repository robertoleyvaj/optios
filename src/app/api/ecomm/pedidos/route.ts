import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

// Listar pedidos de la tienda en línea (base del ecommerce).
// ?tienda=gon → solo pedidos de GON.mx (plataforma='gon')
// ?tienda=verly (o nada) → los de Verly (plataforma nula o distinta de 'gon')
export async function GET(req: NextRequest) {
  try {
    const tienda = req.nextUrl.searchParams.get('tienda') ?? 'verly'
    const sb = createEcommClient()
    let q = sb.from('pedidos').select('*, clientes(*), armazones(*)')
    if (tienda === 'gon') q = q.eq('plataforma', 'gon')
    else q = q.or('plataforma.is.null,plataforma.neq.gon')
    q = q.order('created_at', { ascending: false })
    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, pedidos: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Actualizar un pedido (estado, guía, paquetería, notas del admin).
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json() as {
      id?: number; estado?: string; tracking?: string; paqueteria?: string; notas_admin?: string
    }
    if (!b.id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })
    const sb = createEcommClient()
    const patch: Record<string, unknown> = {}
    if (b.estado !== undefined) patch.estado = b.estado
    if (b.tracking !== undefined) patch.tracking = b.tracking
    if (b.paqueteria !== undefined) patch.paqueteria = b.paqueteria
    if (b.notas_admin !== undefined) patch.notas_admin = b.notas_admin
    const { data, error } = await sb.from('pedidos').update(patch).eq('id', b.id).select('*, clientes(*), armazones(*)').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, pedido: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
