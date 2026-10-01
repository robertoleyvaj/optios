import { NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, INVENTARIO } from '@/lib/auth-api'
import { tipoCambioServidor } from '@/lib/tipo-cambio-server'

export const dynamic = 'force-dynamic'

// Listas para capturar armazones sin errores de dedo:
// marcas (con su grupo de precio), gamas de precio, tipo de cambio y nombres de color ya usados.
export async function GET() {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const sb = createEcommClient()
    const [m, ga, c, tc] = await Promise.all([
      sb.from('marcas').select('nombre, grupo').order('nombre'),
      sb.from('precio_gamas').select('grupo, gama, min, max'),
      sb.from('armazon_colores').select('color').like('sku', 'VRL-1___-__').range(0, 9999),
      tipoCambioServidor(),
    ])
    if (m.error) return NextResponse.json({ ok: false, error: m.error.message }, { status: 500 })
    if (ga.error) return NextResponse.json({ ok: false, error: ga.error.message }, { status: 500 })
    // Colores más usados primero
    const cuenta = new Map<string, number>()
    for (const r of c.data ?? []) {
      const k = String(r.color ?? '').trim().toUpperCase()
      if (k) cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
    }
    const colores = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    return NextResponse.json({ ok: true, marcas: m.data, gamas: ga.data, colores, tipoCambio: tc })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
