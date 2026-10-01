import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, INVENTARIO } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// GET ?sku=VRL-1391  → movimientos de todos los colores de ese modelo (o de un color exacto)
// GET (sin sku)      → últimos 200 movimientos
export async function GET(req: NextRequest) {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const sku = req.nextUrl.searchParams.get('sku')
    const sb = createEcommClient()
    let q = sb.from('inventario_movimientos')
      .select('id, created_at, sku, sucursal, tipo, cantidad, referencia, usuario, notas')
      .order('created_at', { ascending: false })
      .limit(200)
    if (sku) q = q.like('sku', `${sku}%`)
    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, movimientos: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
