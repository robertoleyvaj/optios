import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, TIENDA } from '@/lib/auth-api'
import { descWebArmazon } from '@/lib/precio-web'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Códigos WEB-XXXXX de gonmx.com (tabla `codigos_web` en la base ecomm)
//   GET  ?codigo=WEB-XXXXX → valida y regresa los armazones publicados en GON con su % web
//   POST { accion: 'canjear', codigo, folio, sucursal } → lo marca como usado
// Las reglas de qué se descuenta viven en lib/precio-web.ts
// ─────────────────────────────────────────────────────────────

const hoyTJ = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })

export async function GET(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  const codigo = (req.nextUrl.searchParams.get('codigo') ?? '').trim().toUpperCase()
  if (!codigo) return NextResponse.json({ ok: false, error: 'Escribe el código' }, { status: 400 })
  try {
    const sb = createEcommClient()
    const { data: c } = await sb.from('codigos_web').select('codigo, nombre, estado, vence, folio_canje').eq('codigo', codigo).maybeSingle()
    if (!c) return NextResponse.json({ ok: false, error: 'Código no encontrado' })
    if (c.estado === 'canjeado') return NextResponse.json({ ok: false, error: `Este código ya se usó${c.folio_canje ? ` en la venta ${c.folio_canje}` : ''}` })
    if (c.vence < hoyTJ()) return NextResponse.json({ ok: false, error: `Este código venció el ${c.vence}` })

    const { data: arms } = await sb.from('armazones').select('sku, descuento_gon')
      .eq('activo', true).eq('publicar_gon', true).not('sku', 'is', null)
    const armazones: Record<string, number> = {}
    for (const a of arms ?? []) armazones[String(a.sku).toUpperCase()] = descWebArmazon(a.descuento_gon)

    return NextResponse.json({ ok: true, codigo: c.codigo, nombre: c.nombre, vence: c.vence, armazones })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const b = await req.json() as { accion?: string; codigo?: string; folio?: string; sucursal?: string }
    if (b.accion !== 'canjear') return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
    const codigo = (b.codigo ?? '').trim().toUpperCase()
    const sb = createEcommClient()
    const { data, error } = await sb.from('codigos_web')
      .update({ estado: 'canjeado', canjeado_at: new Date().toISOString(), folio_canje: b.folio ?? null, sucursal_canje: b.sucursal ?? null })
      .eq('codigo', codigo).eq('estado', 'activo').gte('vence', hoyTJ())
      .select('codigo').maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: 'El código ya no está disponible' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
