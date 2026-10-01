import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRol, TIENDA } from '@/lib/auth-api'
import { calcularCupon, generarCodigoCupon, fechaVencimientoCupon } from '@/lib/cupones'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Cupones del ticket — todo se hace en el servidor (la tabla está cerrada
// al navegador), así nadie puede inventar ni modificar un cupón.
//   GET  ?codigo=GON-XXXX   → validar un cupón para canjearlo
//   GET  ?folio=V-0312      → cupón que generó esa venta (para reimprimir el ticket)
//   POST { accion: 'generar', venta_id }               → crea el cupón de la venta (monto según su total)
//   POST { accion: 'canjear', codigo, venta_id, folio } → lo marca como usado
// ─────────────────────────────────────────────────────────────

const hoyTJ = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })

export async function GET(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  const sb = createAdminClient()
  const p = req.nextUrl.searchParams
  const folio = p.get('folio')
  if (folio) {
    const { data } = await sb.from('cupones_ticket').select('codigo, monto, fecha_vencimiento')
      .eq('folio_venta', folio).limit(1).maybeSingle()
    return NextResponse.json({ ok: true, cupon: data ? { codigo: data.codigo, monto: Number(data.monto), vence: data.fecha_vencimiento } : null })
  }
  const codigo = (p.get('codigo') ?? '').trim().toUpperCase()
  if (!codigo) return NextResponse.json({ ok: false, error: 'Escribe el código' }, { status: 400 })
  const { data } = await sb.from('cupones_ticket').select('codigo, monto, estado, fecha_vencimiento').eq('codigo', codigo).maybeSingle()
  if (!data) return NextResponse.json({ ok: false, error: 'Cupón no encontrado' })
  if (data.estado === 'canjeado') return NextResponse.json({ ok: false, error: 'Este cupón ya fue canjeado' })
  if (data.estado === 'expirado' || data.fecha_vencimiento < hoyTJ()) return NextResponse.json({ ok: false, error: `Este cupón venció el ${data.fecha_vencimiento}` })
  return NextResponse.json({ ok: true, cupon: { codigo: data.codigo, monto: Number(data.monto) } })
}

export async function POST(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const b = await req.json() as { accion?: string; venta_id?: string; codigo?: string; folio?: string }
    const sb = createAdminClient()

    if (b.accion === 'canjear') {
      const codigo = (b.codigo ?? '').trim().toUpperCase()
      const { data, error } = await sb.from('cupones_ticket')
        .update({ estado: 'canjeado', canjeado_en: new Date().toISOString(), venta_canje_id: b.venta_id ?? null, folio_canje: b.folio ?? null })
        .eq('codigo', codigo).eq('estado', 'activo').gte('fecha_vencimiento', hoyTJ())
        .select('codigo').maybeSingle()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ ok: false, error: 'El cupón ya no está disponible' }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    if (b.accion === 'generar') {
      if (!b.venta_id) return NextResponse.json({ ok: false, error: 'Falta la venta' }, { status: 400 })
      // El monto sale del total REAL de la venta guardada, no de lo que mande el navegador
      const { data: v } = await sb.from('ventas')
        .select('id, folio, total, es_cotizacion, estado, paciente_nombre, sucursal, created_at')
        .eq('id', b.venta_id).maybeSingle()
      if (!v || v.es_cotizacion || v.estado === 'cancelada') return NextResponse.json({ ok: true, cupon: null })
      // Si ya tiene cupón (por ejemplo, al reintentar), se regresa el mismo
      const { data: ya } = await sb.from('cupones_ticket').select('codigo, monto, fecha_vencimiento').eq('venta_id', v.id).maybeSingle()
      if (ya) return NextResponse.json({ ok: true, cupon: { codigo: ya.codigo, monto: Number(ya.monto), vence: ya.fecha_vencimiento } })
      const monto = calcularCupon(Number(v.total) || 0)
      if (monto <= 0) return NextResponse.json({ ok: true, cupon: null })
      const emision = hoyTJ()
      const vence = fechaVencimientoCupon(emision)
      for (let intento = 0; intento < 5; intento++) {
        const codigo = generarCodigoCupon()
        const { error } = await sb.from('cupones_ticket').insert({
          codigo, monto, venta_id: v.id, folio_venta: v.folio, paciente: v.paciente_nombre ?? null,
          sucursal: v.sucursal ?? null, fecha_emision: emision, fecha_vencimiento: vence, estado: 'activo',
        })
        if (!error) return NextResponse.json({ ok: true, cupon: { codigo, monto, vence } })
        if (!/duplicate|unique/i.test(error.message)) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: false, error: 'No se pudo generar un código único' }, { status: 500 })
    }

    return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
