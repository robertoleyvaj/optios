import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, INVENTARIO } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Cola de etiquetas: las entradas agregan piezas; se imprimen todas juntas en tabloide.
// GET  → pendientes agrupadas por SKU (con modelo, color y precio actuales)
// POST { accion: 'impresas', ids: number[] }                  → marcar como impresas
// POST { accion: 'agregar', color_id, cantidad, motivo? }      → reimprimir / cambio de precio
// POST { accion: 'quitar', ids: number[] }                     → sacar de la cola sin imprimir
// ─────────────────────────────────────────────────────────────

export async function GET() {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const sb = createEcommClient()
    const { data: cola, error } = await sb.from('etiquetas_cola')
      .select('id, color_id, sku, cantidad, motivo, usuario, created_at')
      .is('impresa_at', null).order('sku').limit(5000)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    type C = { id: number; sku: string; color: string; armazon_id: number }
    type M = { id: number; marca: string; modelo: string; precio_gon: number | null }
    const ids = [...new Set((cola ?? []).map(r => Number(r.color_id)))]
    const cols: C[] = ids.length
      ? ((await sb.from('armazon_colores').select('id, sku, color, armazon_id').in('id', ids)).data ?? []) as C[]
      : []
    const mids = [...new Set(cols.map(c => c.armazon_id))]
    const mods: M[] = mids.length
      ? ((await sb.from('armazones').select('id, marca, modelo, precio_gon').in('id', mids)).data ?? []) as M[]
      : []
    const cMap = new Map(cols.map(c => [c.id, c]))
    const mMap = new Map(mods.map(m => [m.id, m]))

    // Agrupar por SKU de color
    const grupos = new Map<string, { sku: string; marca: string; modelo: string; color: string; precio: number; cantidad: number; ids: number[]; motivos: string[] }>()
    for (const r of cola ?? []) {
      const c = cMap.get(Number(r.color_id)); const m = c ? mMap.get(c.armazon_id) : undefined
      const k = c?.sku ?? r.sku
      const gr = grupos.get(k) ?? { sku: k, marca: m?.marca ?? '', modelo: m?.modelo ?? '', color: c?.color ?? '', precio: Number(m?.precio_gon) || 0, cantidad: 0, ids: [] as number[], motivos: [] as string[] }
      gr.cantidad += r.cantidad; gr.ids.push(r.id)
      if (!gr.motivos.includes(r.motivo)) gr.motivos.push(r.motivo)
      grupos.set(k, gr)
    }
    return NextResponse.json({ ok: true, pendientes: [...grupos.values()].sort((a, b) => a.sku.localeCompare(b.sku)) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const b = await req.json() as { accion?: string; ids?: number[]; color_id?: number; cantidad?: number; motivo?: string }
    const sb = createEcommClient()
    if (b.accion === 'impresas' || b.accion === 'quitar') {
      const ids = (b.ids ?? []).filter(n => Number.isInteger(n))
      if (!ids.length) return NextResponse.json({ ok: false, error: 'Sin etiquetas' }, { status: 400 })
      const q = b.accion === 'impresas'
        ? sb.from('etiquetas_cola').update({ impresa_at: new Date().toISOString() }).in('id', ids).is('impresa_at', null)
        : sb.from('etiquetas_cola').delete().in('id', ids).is('impresa_at', null)
      const { error } = await q
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (b.accion === 'agregar') {
      const n = Number(b.cantidad)
      if (!b.color_id || !Number.isInteger(n) || n < 1 || n > 200) return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
      const { data: c } = await sb.from('armazon_colores').select('sku').eq('id', b.color_id).like('sku', 'VRL-1___-__').maybeSingle()
      if (!c) return NextResponse.json({ ok: false, error: 'Color no encontrado' }, { status: 404 })
      const motivo = ['reimpresion', 'cambio_precio'].includes(String(b.motivo)) ? String(b.motivo) : 'reimpresion'
      const { error } = await sb.from('etiquetas_cola').insert({ color_id: b.color_id, sku: c.sku, cantidad: n, motivo, usuario: g.usuario.nombre })
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'Acción no válida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
