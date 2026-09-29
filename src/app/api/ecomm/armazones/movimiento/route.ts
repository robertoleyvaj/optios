import { NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, TIENDA } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

const COL: Record<string, 'stock_baja' | 'stock_mayo' | 'stock_plaza'> = {
  'Baja Visión':    'stock_baja',
  '5 de Mayo':      'stock_mayo',
  'Plaza Laureles': 'stock_plaza',
}

// Aplica un movimiento de stock a armazones por SKU, en la sucursal indicada.
// signo = -1 → venta (descuenta) · signo = +1 → cancelación (regresa).
// Body: { sucursal, signo, items: [{ sku, cantidad }] }
export async function POST(req: Request) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const body = await req.json() as {
      sucursal?: string; signo?: number; referencia?: string; items?: { sku: string; cantidad: number }[]
    }
    const col = COL[body.sucursal ?? '']
    if (!col) return NextResponse.json({ ok: false, error: 'Sucursal inválida' }, { status: 400 })
    const todos = (body.items ?? []).filter(i => i.sku && (i.cantidad ?? 0) > 0)
    if (todos.length === 0) return NextResponse.json({ ok: true, actualizados: [] })
    const sg = (body.signo ?? -1) < 0 ? -1 : 1

    const sb = createEcommClient()

    // Inventario nuevo (SKU por color, VRL-1xxx-xx): se mueve el color exacto con inv_mover
    // (descuenta/regresa y deja la bitácora). El resto sigue la lógica anterior.
    const esNuevo = (s: string) => /^VRL-1\d{3}-\d{2}$/i.test(s)
    const ubic = col === 'stock_baja' ? 'baja' : col === 'stock_mayo' ? 'mayo' : 'plaza'
    const erroresNuevo: string[] = []
    for (const it of todos.filter(i => esNuevo(i.sku))) {
      const { data: c } = await sb.from('armazon_colores').select('id').eq('sku', it.sku.toUpperCase()).maybeSingle()
      if (!c) { erroresNuevo.push(`${it.sku}: no existe`); continue }
      const { error: e } = await sb.rpc('inv_mover', {
        p_color_id: c.id, p_ubicacion: ubic, p_cantidad: sg * (Number(it.cantidad) || 1),
        p_tipo: sg < 0 ? 'venta' : 'cancelacion', p_referencia: body.referencia ?? null,
        p_usuario: g.usuario.nombre || null, p_notas: null,
      })
      if (e) erroresNuevo.push(`${it.sku}: ${e.message}`)
    }
    const items = todos.filter(i => !esNuevo(i.sku))
    if (items.length === 0) return NextResponse.json({ ok: erroresNuevo.length === 0, actualizados: [], errores: erroresNuevo })

    const skus = [...new Set(items.map(i => i.sku))]
    const { data: rows, error } = await sb
      .from('armazones')
      .select('id, sku, stock_baja, stock_mayo, stock_plaza, stock_online')
      .in('sku', skus)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const bySku = new Map((rows ?? []).map(r => [r.sku as string, r]))
    const actualizados: { sku: string; antes: number; despues: number }[] = []
    const noEncontrados: string[] = []

    for (const it of items) {
      const r = bySku.get(it.sku) as Record<string, number> | undefined
      if (!r) { noEncontrados.push(it.sku); continue }
      const antes   = Number(r[col] ?? 0)
      const despues = Math.max(0, antes + sg * (Number(it.cantidad) || 1))
      const total   =
        (col === 'stock_baja'  ? despues : Number(r.stock_baja  ?? 0)) +
        (col === 'stock_mayo'  ? despues : Number(r.stock_mayo  ?? 0)) +
        (col === 'stock_plaza' ? despues : Number(r.stock_plaza ?? 0)) +
        Number(r.stock_online ?? 0)
      const { error: eUpd } = await sb.from('armazones')
        .update({ [col]: despues, stock: total }).eq('id', r.id)
      if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 500 })
      actualizados.push({ sku: it.sku, antes, despues })
    }

    return NextResponse.json({ ok: true, actualizados, noEncontrados })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
