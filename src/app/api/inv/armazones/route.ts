import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Inventario nuevo (SKU por color). Solo modelos con SKU VRL-1xxx.
// El stock vive en armazon_colores; armazones guarda los datos del modelo.
// ─────────────────────────────────────────────────────────────

const CAMPOS_MODELO =
  'id, sku, marca, modelo, nombre, medidas, material, precio_gon, precio, costo, activo, ' +
  'publicar_gon, publicar_verly, descuento_gon, descuento_verly, ' +
  'imagen_url, imagen2_url, imagen3_url, imagen4_url, imagen5_url'

const CAMPOS_COLOR = 'id, armazon_id, sku, color, stock_baja, stock_mayo, stock_plaza, stock_online, orden'

// GET → todos los modelos del inventario nuevo con sus colores
export async function GET() {
  try {
    const sb = createEcommClient()
    const [m, c] = await Promise.all([
      sb.from('armazones').select(CAMPOS_MODELO).like('sku', 'VRL-1___').order('sku').range(0, 4999),
      sb.from('armazon_colores').select(CAMPOS_COLOR).like('sku', 'VRL-1___-__').order('sku').range(0, 9999),
    ])
    if (m.error) return NextResponse.json({ ok: false, error: m.error.message }, { status: 500 })
    if (c.error) return NextResponse.json({ ok: false, error: c.error.message }, { status: 500 })

    const porModelo = new Map<number, unknown[]>()
    for (const col of c.data ?? []) {
      const k = (col as { armazon_id: number }).armazon_id
      if (!porModelo.has(k)) porModelo.set(k, [])
      porModelo.get(k)!.push(col)
    }
    const modelos = ((m.data ?? []) as unknown as { id: number }[])
      .map(x => ({ ...x, colores: porModelo.get(x.id) ?? [] }))
    return NextResponse.json({ ok: true, modelos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// PATCH → editar datos del modelo (no el stock: el stock solo cambia con movimientos)
// Body: { id, ...campos }
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...cambios } = (await req.json()) ?? {}
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })

    const permitidos = new Set([
      'marca', 'modelo', 'nombre', 'medidas', 'material', 'precio_gon', 'precio', 'costo',
      'publicar_gon', 'publicar_verly', 'descuento_gon', 'descuento_verly',
    ])
    const update: Record<string, unknown> = {}
    for (const k of Object.keys(cambios)) if (permitidos.has(k)) update[k] = cambios[k]
    if (Object.keys(update).length === 0) return NextResponse.json({ ok: false, error: 'Nada que actualizar' }, { status: 400 })

    const sb = createEcommClient()
    const { data, error } = await sb.from('armazones').update(update)
      .eq('id', id).like('sku', 'VRL-1___').select(CAMPOS_MODELO).single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, modelo: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
