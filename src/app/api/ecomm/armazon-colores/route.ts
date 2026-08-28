import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

// GET ?armazon_id= → colores de un modelo.  GET ?all=1 → colores de TODOS los modelos.
export async function GET(req: NextRequest) {
  const armazon_id = req.nextUrl.searchParams.get('armazon_id')
  const all = req.nextUrl.searchParams.get('all')
  const sb = createEcommClient()

  if (all) {
    const { data, error } = await sb
      .from('armazon_colores')
      .select('armazon_id, color, stock_baja, stock_mayo, stock_plaza, stock_online, publicar_gon, publicar_verly, orden')
      .order('armazon_id', { ascending: true })
      .order('orden', { ascending: true })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, colores: data ?? [] })
  }

  if (!armazon_id) return NextResponse.json({ ok: false, error: 'Falta armazon_id' }, { status: 400 })
  const { data, error } = await sb
    .from('armazon_colores')
    .select('*')
    .eq('armazon_id', armazon_id)
    .order('orden', { ascending: true })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, colores: data ?? [] })
}

// PUT → reemplaza TODOS los colores del modelo por la lista enviada.
// Body: { armazon_id, colores: [{ color, stock_baja, stock_mayo, stock_plaza, stock_online }] }
export async function PUT(req: NextRequest) {
  try {
    const b = await req.json() as {
      armazon_id?: number
      colores?: Array<{
        color: string; stock_baja?: number; stock_mayo?: number; stock_plaza?: number; stock_online?: number
        publicar_gon?: boolean; publicar_verly?: boolean; precio?: number | null
        imagen_url?: string | null; imagen2_url?: string | null; imagen3_url?: string | null
      }>
    }
    if (!b.armazon_id) return NextResponse.json({ ok: false, error: 'Falta armazon_id' }, { status: 400 })
    const sb = createEcommClient()

    // Reemplazo limpio: borra los colores actuales y mete los nuevos.
    const del = await sb.from('armazon_colores').delete().eq('armazon_id', b.armazon_id)
    if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 })

    const rows = (b.colores ?? [])
      .filter(c => (c.color ?? '').trim())
      .map((c, i) => ({
        armazon_id: b.armazon_id,
        color: c.color.trim().toUpperCase(),
        stock_baja: Number(c.stock_baja) || 0,
        stock_mayo: Number(c.stock_mayo) || 0,
        stock_plaza: Number(c.stock_plaza) || 0,
        stock_online: Number(c.stock_online) || 0,
        publicar_gon: !!c.publicar_gon,
        publicar_verly: !!c.publicar_verly,
        precio: c.precio ?? null,
        imagen_url: c.imagen_url ?? null,
        imagen2_url: c.imagen2_url ?? null,
        imagen3_url: c.imagen3_url ?? null,
        orden: i,
      }))

    if (rows.length) {
      const ins = await sb.from('armazon_colores').insert(rows)
      if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: rows.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
