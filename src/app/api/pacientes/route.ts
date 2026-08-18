import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Borrar un expediente (solo se llama desde el admin en la UI).
// Bloquea si el paciente tiene ventas u órdenes de laboratorio (historial real).
// Si no, borra sus citas, recetas y consultas, y luego el paciente.
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id?: string }
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })

    const sb = createAdminClient()

    const { count: nVentas } = await sb.from('ventas')
      .select('id', { count: 'exact', head: true }).eq('paciente_id', id)
    if (nVentas && nVentas > 0) {
      return NextResponse.json({ ok: false, error: 'Este paciente tiene ventas o cotizaciones registradas. No se puede borrar su expediente.' }, { status: 409 })
    }

    const { count: nLab } = await sb.from('ordenes_lab')
      .select('id', { count: 'exact', head: true }).eq('paciente_id', id)
    if (nLab && nLab > 0) {
      return NextResponse.json({ ok: false, error: 'Este paciente tiene órdenes de laboratorio. No se puede borrar su expediente.' }, { status: 409 })
    }

    // Dependencias seguras del expediente
    await sb.from('citas').delete().eq('paciente_id', id)
    await sb.from('recetas').delete().eq('paciente_id', id)
    await sb.from('consultas').delete().eq('paciente_id', id)

    const { error } = await sb.from('pacientes').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
