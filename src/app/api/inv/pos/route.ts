import { NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, TIENDA } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Catálogo de armazones POR COLOR para el POS.
// { activo: true } cuando ya se hizo el cambio al inventario nuevo.
// Antes del cambio solo el administrador recibe los colores (modo prueba).
// ─────────────────────────────────────────────────────────────
export async function GET() {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const sb = createEcommClient()
    const { count } = await sb.from('armazones').select('id', { count: 'exact', head: true })
      .like('sku', 'VRL-1___').eq('activo', true)
    const activo = (count ?? 0) > 0
    if (!activo && g.usuario.rol !== 'administrador') return NextResponse.json({ ok: true, activo, colores: [] })

    const [m, c] = await Promise.all([
      sb.from('armazones').select('id, sku, marca, modelo, medidas, material, precio_gon')
        .like('sku', 'VRL-1___').range(0, 4999),
      sb.from('armazon_colores').select('armazon_id, sku, color, stock_baja, stock_mayo, stock_plaza, bodega')
        .like('sku', 'VRL-1___-__').order('sku').range(0, 9999),
    ])
    if (m.error) return NextResponse.json({ ok: false, error: m.error.message }, { status: 500 })
    if (c.error) return NextResponse.json({ ok: false, error: c.error.message }, { status: 500 })

    const mods = new Map((m.data ?? []).map(x => [x.id as number, x]))
    const colores = (c.data ?? []).flatMap(x => {
      const a = mods.get(x.armazon_id as number)
      if (!a) return []
      return [{
        sku: x.sku as string, color: x.color as string,
        marca: a.marca as string, modelo: a.modelo as string, medidas: a.medidas as string | null,
        precio: Number(a.precio_gon) || 0,
        baja: Number(x.stock_baja) || 0, mayo: Number(x.stock_mayo) || 0,
        plaza: Number(x.stock_plaza) || 0, bodega: Number(x.bodega) || 0,
      }]
    })
    return NextResponse.json({ ok: true, activo, colores })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
