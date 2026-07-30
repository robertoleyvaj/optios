import { NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

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
  try {
    const body = await req.json() as {
      sucursal?: string; signo?: number; items?: { sku: string; cantidad: number }[]
    }
    const col = COL[body.sucursal ?? '']
    if (!col) return NextResponse.json({ ok: false, error: 'Sucursal inválida' }, { status: 400 })
    const items = (body.items ?? []).filter(i => i.sku && (i.cantidad ?? 0) > 0)
    if (items.length === 0) return NextResponse.json({ ok: true, actualizados: [] })
    const sg = (body.signo ?? -1) < 0 ? -1 : 1

    const sb = createEcommClient()
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
