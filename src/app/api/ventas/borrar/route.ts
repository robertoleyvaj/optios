import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRol, ADMIN, TIENDA } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Borrar una venta o cotización DE VERDAD (desde el servidor).
//
// Antes se borraba desde el navegador: la base dejaba borrar los productos de la venta
// pero NO la venta (sus permisos no lo permiten) y no avisaba nada. Quedaba la nota
// "vacía" con su total y sus pagos, alterando reportes y caja.
// Aquí se borra todo con permisos de servidor y se confirma que la venta sí se fue.
//
//   POST { id: uuid }                       → venta real (solo administrador)
//   POST { id: uuid, cotizacion: true }     → cotización (cualquier rol de tienda)
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({})) as { id?: string; cotizacion?: boolean }
  const g = await requireRol(b.cotizacion ? TIENDA : ADMIN); if (!g.ok) return g.res
  const id = String(b.id ?? '').trim()
  if (!id) return NextResponse.json({ ok: false, error: 'Falta la venta' }, { status: 400 })

  try {
    const sb = createAdminClient()
    const { data: v } = await sb.from('ventas').select('id, folio, es_cotizacion').eq('id', id).maybeSingle()
    if (!v) return NextResponse.json({ ok: false, error: 'La venta ya no existe' }, { status: 404 })
    if (b.cotizacion && !v.es_cotizacion) return NextResponse.json({ ok: false, error: 'Esa nota no es una cotización' }, { status: 400 })

    const borrados: Record<string, number> = {}
    const chk = (tabla: string, r: { data: unknown[] | null; error: { message: string } | null }) => {
      if (r.error) throw new Error(`${tabla}: ${r.error.message}`)
      borrados[tabla] = r.data?.length ?? 0
    }

    // Órdenes de laboratorio y su historial
    const { data: ords } = await sb.from('ordenes_lab').select('id').eq('venta_id', id)
    const ordIds = (ords ?? []).map((o: { id: string }) => o.id)
    if (ordIds.length) chk('ordenes_lab_historial', await sb.from('ordenes_lab_historial').delete().in('orden_id', ordIds).select('id'))
    chk('ordenes_lab', await sb.from('ordenes_lab').delete().eq('venta_id', id).select('id'))

    if (!v.es_cotizacion && v.folio) {
      // Comisión de terminal y movimientos de caja generados por esta venta
      chk('gastos', await sb.from('gastos').delete().eq('categoria', 'comision_terminal').ilike('concepto', `%${v.folio}%`).select('id'))
      chk('caja_movimientos', await sb.from('caja_movimientos').delete().eq('referencia', v.folio).select('id'))
    }
    chk('pagos_venta', await sb.from('pagos_venta').delete().eq('venta_id', id).select('id'))
    chk('ventas_items', await sb.from('ventas_items').delete().eq('venta_id', id).select('id'))
    chk('ventas', await sb.from('ventas').delete().eq('id', id).select('id'))

    if (!borrados.ventas) return NextResponse.json({ ok: false, error: 'La base no permitió borrar la venta', borrados }, { status: 500 })
    return NextResponse.json({ ok: true, folio: v.folio, borrados })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
