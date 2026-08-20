import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

// Listar códigos de descuento.
export async function GET() {
  try {
    const sb = createEcommClient()
    const { data, error } = await sb.from('codigos_descuento').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, promos: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Crear un código.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.codigo?.trim()) return NextResponse.json({ ok: false, error: 'El código es requerido' }, { status: 400 })
    if (!b.valor || Number(b.valor) <= 0) return NextResponse.json({ ok: false, error: 'Valor inválido' }, { status: 400 })
    if (b.tipo === 'porcentaje' && Number(b.valor) > 100) return NextResponse.json({ ok: false, error: 'El porcentaje no puede pasar de 100' }, { status: 400 })
    const sb = createEcommClient()
    const payload = {
      codigo: String(b.codigo).toUpperCase().trim(),
      tipo: b.tipo === 'fijo' ? 'fijo' : 'porcentaje',
      valor: Number(b.valor),
      minimo_compra: b.minimo_compra ? Number(b.minimo_compra) : 0,
      usos_maximos: b.usos_maximos ? Number(b.usos_maximos) : null,
      expires_at: b.expires_at || null,
      descripcion: (b.descripcion ?? '').trim(),
      activo: b.activo ?? true,
    }
    const { data, error } = await sb.from('codigos_descuento').insert([payload]).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message.includes('unique') ? 'Ya existe un código con ese nombre' : error.message }, { status: 500 })
    return NextResponse.json({ ok: true, promo: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Activar / desactivar (u otros cambios). Body: { id, activo }
export async function PATCH(req: NextRequest) {
  try {
    const { id, activo } = await req.json() as { id?: number; activo?: boolean }
    if (id == null) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })
    const sb = createEcommClient()
    const { data, error } = await sb.from('codigos_descuento').update({ activo }).eq('id', id).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, promo: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Borrar un código. Body: { id }
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id?: number }
    if (id == null) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })
    const sb = createEcommClient()
    const { error } = await sb.from('codigos_descuento').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
