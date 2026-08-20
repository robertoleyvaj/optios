import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

// Clientes de la tienda en línea con su historial de pedidos.
export async function GET(_req: NextRequest) {
  try {
    const sb = createEcommClient()
    const { data, error } = await sb
      .from('clientes')
      .select('*, pedidos(id, precio_venta, estado, plataforma, created_at)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, clientes: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
