import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MICAS_WEB, FILTROS_WEB, DESC_WEB_MICAS } from '@/lib/precio-web'

// GET /api/public/precios-web — PÚBLICO (lo lee gonmx.com)
// Precio de lista de las micas y filtros que se venden en la página.
// Solo expone esos SKUs y su precio al público; nada de costos ni inventario.
export const revalidate = 300

export async function GET() {
  try {
    const sb = createAdminClient()
    const skus = [...MICAS_WEB, ...FILTROS_WEB]
    const { data, error } = await sb.from('productos').select('sku, precio, activo').in('sku', skus)
    if (error) return NextResponse.json({ ok: false }, { status: 500 })
    const precios: Record<string, number> = {}
    for (const p of data ?? []) if (p.activo !== false && Number(p.precio) > 0) precios[String(p.sku)] = Number(p.precio)
    return NextResponse.json(
      { ok: true, descuento: DESC_WEB_MICAS, precios },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600', 'Access-Control-Allow-Origin': '*' } },
    )
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
