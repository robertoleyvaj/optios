import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, INVENTARIO } from '@/lib/auth-api'
import { precioInteligente, precioVerlyUSD, enRango } from '@/lib/precio-gama'
import { tipoCambioServidor } from '@/lib/tipo-cambio-server'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Entrada de mercancía (compras / piezas que llegan)
// Body: {
//   ubicacion: 'baja'|'mayo'|'plaza'|'bodega', referencia?: string (factura, opcional),
//   items: [{
//     cantidad: number,
//     color_id?: number,                         // color que ya existe
//     armazon_id?: number, color?: string,       // color nuevo de un modelo existente
//     nuevo?: { marca, modelo, medidas, material, gama, precio_gon?, disenador? }, color?: string  // modelo nuevo
//   }]
// }
// Cada pieza entra con inv_mover (suma stock + bitácora) y se agrega a la cola de etiquetas.
// Precio: lo sugiere la gama de la marca; el encargado no lo inventa. Verly = pesos ÷ TC × 50%.
// ─────────────────────────────────────────────────────────────

const UBIC = new Set(['baja', 'mayo', 'plaza', 'bodega'])
type Nuevo = { marca?: string; modelo?: string; medidas?: string; material?: string; gama?: string; precio_gon?: number; disenador?: boolean }
type Item = { cantidad?: number; color_id?: number; armazon_id?: number; color?: string; nuevo?: Nuevo }
const up = (s?: string) => (s ?? '').trim().toUpperCase().replace(/\s+/g, ' ')

export async function POST(req: NextRequest) {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  const esAdmin = g.usuario.rol === 'administrador'
  try {
    const body = await req.json() as { ubicacion?: string; referencia?: string; items?: Item[] }
    const ubic = body.ubicacion ?? ''
    if (!UBIC.has(ubic)) return NextResponse.json({ ok: false, error: 'Ubicación inválida' }, { status: 400 })
    const items = (body.items ?? []).filter(i => Number.isInteger(i.cantidad) && (i.cantidad ?? 0) > 0 && (i.cantidad ?? 0) <= 500)
    if (items.length === 0) return NextResponse.json({ ok: false, error: 'No hay piezas que registrar' }, { status: 400 })
    const ref = (body.referencia ?? '').trim() || 'Entrada de mercancía'
    const usuario = g.usuario.nombre || 'OptiOS'

    const sb = createEcommClient()
    const tc = await tipoCambioServidor()

    // ¿Ya se hizo el cambio al inventario nuevo? Si sí, los modelos nuevos nacen activos.
    const { count: activos } = await sb.from('armazones').select('id', { count: 'exact', head: true })
      .like('sku', 'VRL-1___').eq('activo', true)
    const nacenActivos = (activos ?? 0) > 0

    const resultado: { sku: string; marca: string; modelo: string; color: string; precio: number; cantidad: number; nuevo: boolean; armazon_id: number | null }[] = []
    const creados = new Map<string, number>()   // marca|modelo → id (varios colores del mismo modelo nuevo)

    for (const it of items) {
      let colorId = it.color_id ?? null
      let modelo: { id: number; sku: string; marca: string; modelo: string; precio_gon: number | null } | null = null
      let esNuevo = false

      // A) Modelo nuevo
      if (!colorId && it.nuevo) {
        const n = it.nuevo
        const marca = up(n.marca), mod = up(n.modelo), color = up(it.color)
        if (!marca || !mod || !color) return NextResponse.json({ ok: false, error: 'Modelo nuevo: falta marca, modelo o color' }, { status: 400 })
        const clave = `${marca}|${mod}`
        // ¿Ya existe con esa marca y modelo? Entonces se trata como color nuevo de ese modelo
        const { data: ex } = creados.has(clave) ? { data: null } : await sb.from('armazones').select('id')
          .like('sku', 'VRL-1___').ilike('marca', marca).ilike('modelo', mod).maybeSingle()
        if (creados.has(clave) || ex) { it.armazon_id = creados.get(clave) ?? ex!.id; it.color = color }
        else {
          // Marca: si no existe en la lista, se agrega (diseñador u otras)
          let { data: mk } = await sb.from('marcas').select('grupo').eq('nombre', marca).maybeSingle()
          if (!mk) {
            const grupo = n.disenador ? 'DISEÑADOR' : 'OTRAS'
            await sb.from('marcas').insert({ nombre: marca, grupo })
            mk = { grupo }
          }
          // Precio según la gama de la marca (admin puede poner otro)
          const gama = ['basico', 'estandar', 'premium'].includes(String(n.gama)) ? String(n.gama) : 'estandar'
          const { data: r } = await sb.from('precio_gamas').select('min, max').eq('grupo', mk.grupo).eq('gama', gama).maybeSingle()
          let precio = Number(n.precio_gon) || 0
          if (!enRango(precio, r) && !(esAdmin && precio > 0)) precio = r ? precioInteligente(r.min, r.max) : precio
          if (!precio) return NextResponse.json({ ok: false, error: `Sin rango de precio para ${marca} (${gama})` }, { status: 400 })

          const { data: ult } = await sb.from('armazones').select('sku').like('sku', 'VRL-1___')
            .order('sku', { ascending: false }).limit(1)
          const sig = ult?.[0]?.sku ? parseInt(String(ult[0].sku).slice(4)) + 1 : 1001
          const { data: nm, error: e1 } = await sb.from('armazones').insert({
            sku: `VRL-${sig}`, nombre: mod, marca, modelo: mod, // sin apodo → la web muestra el modelo
            medidas: (n.medidas ?? '').trim() || null, material: up(n.material) || null,
            precio_gon: precio, precio: precioVerlyUSD(precio, tc), gama,
            tipo: 'optico', activo: nacenActivos, publicar_gon: false, publicar_verly: false,
            stock: 0, stock_baja: 0, stock_mayo: 0, stock_plaza: 0, stock_online: 0,
          }).select('id, sku, marca, modelo, precio_gon').single()
          if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 })
          modelo = nm; it.armazon_id = nm.id; esNuevo = true
          creados.set(clave, nm.id)
        }
      }

      // B) Color nuevo de un modelo existente (o del modelo recién creado)
      if (!colorId && it.armazon_id) {
        const color = up(it.color)
        if (!color) return NextResponse.json({ ok: false, error: 'Falta el color' }, { status: 400 })
        if (!modelo) {
          const { data: m } = await sb.from('armazones').select('id, sku, marca, modelo, precio_gon')
            .eq('id', it.armazon_id).like('sku', 'VRL-1___').maybeSingle()
          if (!m) return NextResponse.json({ ok: false, error: 'Modelo no encontrado' }, { status: 404 })
          modelo = m
        }
        const { data: cols } = await sb.from('armazon_colores').select('id, sku, color').eq('armazon_id', modelo.id)
        const mismo = (cols ?? []).find(c => up(c.color) === color)
        if (mismo) colorId = mismo.id
        else {
          const k = Math.max(0, ...(cols ?? []).map(c => parseInt(String(c.sku ?? '').split('-')[2] ?? '0') || 0)) + 1
          const { data: nc, error: e2 } = await sb.from('armazon_colores').insert({
            armazon_id: modelo.id, sku: `${modelo.sku}-${String(k).padStart(2, '0')}`, color,
            stock_baja: 0, stock_mayo: 0, stock_plaza: 0, stock_online: 0, bodega: 0,
            publicar_gon: false, publicar_verly: false, orden: k - 1,
          }).select('id').single()
          if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 })
          colorId = nc.id; esNuevo = true
        }
      }

      if (!colorId) return NextResponse.json({ ok: false, error: 'Renglón incompleto' }, { status: 400 })

      // Sumar piezas + bitácora
      const { error: e3 } = await sb.rpc('inv_mover', {
        p_color_id: colorId, p_ubicacion: ubic, p_cantidad: it.cantidad, p_tipo: 'entrada',
        p_referencia: ref, p_usuario: usuario, p_notas: null,
      })
      if (e3) return NextResponse.json({ ok: false, error: e3.message }, { status: 500 })

      const { data: info } = await sb.from('armazon_colores')
        .select('sku, color, armazon_id').eq('id', colorId).single()
      const { data: am } = await sb.from('armazones')
        .select('marca, modelo, precio_gon').eq('id', info?.armazon_id ?? 0).maybeSingle()
      const a = (am ?? {}) as { marca?: string; modelo?: string; precio_gon?: number }

      // A la cola de etiquetas (se imprimen todas juntas al terminar la carga)
      await sb.from('etiquetas_cola').insert({ color_id: colorId, sku: info?.sku ?? '', cantidad: it.cantidad, motivo: 'entrada', usuario })

      resultado.push({
        sku: info?.sku ?? '', marca: a.marca ?? '', modelo: a.modelo ?? '', color: info?.color ?? '',
        precio: Number(a.precio_gon) || 0, cantidad: it.cantidad!, nuevo: esNuevo, armazon_id: info?.armazon_id ?? null,
      })
    }

    return NextResponse.json({ ok: true, entradas: resultado })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
