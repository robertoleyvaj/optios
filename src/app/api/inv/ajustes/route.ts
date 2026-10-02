import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, GESTION } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Ajuste de existencias (corregir conteos, errores de captura, mermas).
// Body: { color_id, ubicacion: 'baja'|'mayo'|'plaza'|'bodega', cantidad: ±n, motivo, nota? }
// Queda en la bitácora como 'ajuste' (o 'merma' si es dañado/perdido). Nunca deja negativo.
// Para "mover" piezas de un modelo mal capturado a otro: un ajuste −n en uno y +n en el otro.
// ─────────────────────────────────────────────────────────────

const UBIC = new Set(['baja', 'mayo', 'plaza', 'bodega'])
const MOTIVOS: Record<string, string> = {
  conteo: 'Conteo físico',
  captura: 'Error de captura',
  merma: 'Dañado o perdido',
  otro: 'Otro',
}

export async function POST(req: NextRequest) {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  try {
    const b = await req.json() as { color_id?: number; ubicacion?: string; cantidad?: number; motivo?: string; nota?: string }
    const n = Number(b.cantidad)
    if (!b.color_id || !UBIC.has(String(b.ubicacion)) || !Number.isInteger(n) || n === 0 || Math.abs(n) > 200) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }
    const motivo = MOTIVOS[String(b.motivo)] ? String(b.motivo) : 'otro'
    const sb = createEcommClient()
    const { data: c } = await sb.from('armazon_colores').select('id').eq('id', b.color_id).like('sku', 'VRL-1___-__').maybeSingle()
    if (!c) return NextResponse.json({ ok: false, error: 'Color no encontrado' }, { status: 404 })

    const { error } = await sb.rpc('inv_mover', {
      p_color_id: b.color_id, p_ubicacion: b.ubicacion, p_cantidad: n,
      p_tipo: motivo === 'merma' ? 'merma' : 'ajuste',
      p_referencia: MOTIVOS[motivo], p_usuario: g.usuario.nombre || 'OptiOS',
      p_notas: (b.nota ?? '').trim().slice(0, 200) || null,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const { data: col } = await sb.from('armazon_colores')
      .select('id, stock_baja, stock_mayo, stock_plaza, bodega').eq('id', b.color_id).single()
    return NextResponse.json({ ok: true, color: col })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
