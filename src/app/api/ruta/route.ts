import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRol, GESTION, type Rol } from '@/lib/auth-api'
import { CATEGORIAS_RUTA } from '@/lib/ruta'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// App de Sergio (repartidor)
//   GET                              → encargos (pendientes + últimos comprados) y sus gastos recientes
//   POST { accion: 'gasto', … }      → registra un egreso extra en Finanzas (tabla gastos)
//                                       y, si viene de un encargo, lo marca como comprado
//   POST { accion: 'encargo', … }    → (admin/gerente) nuevo encargo para Sergio
//   POST { accion: 'cancelar', id }  → (admin/gerente) cancela un encargo
// ─────────────────────────────────────────────────────────────

const RUTA: Rol[] = ['administrador', 'gerente', 'repartidor']
const hoyTJ = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
const CATS = new Set<string>(CATEGORIAS_RUTA.map(c => c.key))
const SUCS = new Set(['Baja Visión', '5 de Mayo', 'Plaza Laureles', 'General'])

export async function GET() {
  const g = await requireRol(RUTA); if (!g.ok) return g.res
  try {
    const sb = createAdminClient()
    const [pend, hechos, gastos] = await Promise.all([
      sb.from('encargos').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false }),
      sb.from('encargos').select('*').eq('estado', 'comprado').order('comprado_at', { ascending: false }).limit(10),
      sb.from('gastos').select('id, fecha, concepto, categoria, monto, sucursal, metodo_pago, notas')
        .ilike('notas', `Registrado por ${g.usuario.nombre}%`).order('fecha', { ascending: false }).limit(15),
    ])
    return NextResponse.json({
      ok: true,
      encargos: [...(pend.data ?? []), ...(hechos.data ?? [])],
      sinTabla: !!pend.error,        // si aún no se corre el SQL de encargos
      gastos: gastos.data ?? [],
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const g = await requireRol(RUTA); if (!g.ok) return g.res
  const u = g.usuario
  try {
    const b = await req.json() as Record<string, unknown>
    const sb = createAdminClient()

    if (b.accion === 'gasto') {
      const categoria = String(b.categoria ?? '')
      const descripcion = String(b.descripcion ?? '').trim()
      const monto = Number(b.monto)
      const metodo = b.metodo === 'transferencia' ? 'transferencia' : 'efectivo'
      const folio = String(b.folio ?? '').trim().toUpperCase()
      const encargoId = Number(b.encargo_id) || null
      if (!CATS.has(categoria)) return NextResponse.json({ ok: false, error: 'Escoge qué fue' }, { status: 400 })
      if (!descripcion) return NextResponse.json({ ok: false, error: 'Escribe qué compraste' }, { status: 400 })
      if (!(monto > 0) || monto > 100000) return NextResponse.json({ ok: false, error: 'Escribe el monto' }, { status: 400 })

      let sucursal = SUCS.has(String(b.sucursal)) ? String(b.sucursal) : 'General'
      if (encargoId) {
        const { data: enc } = await sb.from('encargos').select('id, estado, sucursal').eq('id', encargoId).maybeSingle()
        if (!enc || enc.estado !== 'pendiente') return NextResponse.json({ ok: false, error: 'Ese encargo ya no está pendiente' }, { status: 409 })
        sucursal = enc.sucursal || sucursal
      }

      const notas = [`Registrado por ${u.nombre}`, folio ? `Trabajo ${folio}` : '', encargoId ? `Encargo #${encargoId}` : ''].filter(Boolean).join(' · ')
      const { data: gasto, error } = await sb.from('gastos').insert({
        fecha: hoyTJ(), concepto: descripcion, categoria, monto, sucursal,
        metodo_pago: metodo, notas, es_caja: false,   // sale del dinero que da Rob, no de la caja de la óptica
      }).select('id').single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

      if (encargoId) {
        await sb.from('encargos').update({
          estado: 'comprado', monto, metodo_pago: metodo, gasto_id: String(gasto.id),
          comprado_at: new Date().toISOString(), comprado_por: u.nombre,
        }).eq('id', encargoId).eq('estado', 'pendiente')
      }
      return NextResponse.json({ ok: true, id: gasto.id })
    }

    // ── Lo siguiente solo lo hace Rob (o un gerente) ──
    if (!GESTION.includes(u.rol)) return NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 })

    if (b.accion === 'encargo') {
      const descripcion = String(b.descripcion ?? '').trim()
      if (!descripcion) return NextResponse.json({ ok: false, error: 'Escribe qué necesitas' }, { status: 400 })
      const sucursal = SUCS.has(String(b.sucursal)) ? String(b.sucursal) : 'General'
      const nota = String(b.nota ?? '').trim() || null
      const { data, error } = await sb.from('encargos').insert({ descripcion, sucursal, nota, creado_por: u.nombre }).select('*').single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, encargo: data })
    }

    if (b.accion === 'cancelar') {
      const id = Number(b.id)
      await sb.from('encargos').update({ estado: 'cancelado' }).eq('id', id).eq('estado', 'pendiente')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
