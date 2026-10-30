import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRol, TIENDA } from '@/lib/auth-api'
import { descWebArmazon, DESC_WEB_MICAS } from '@/lib/precio-web'
import { UBIC_POR_SUCURSAL, SUCURSAL_POR_UBIC, codigoPedidoGon, hoyTJ, sumarDias } from '@/lib/pedidos-linea'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Pedidos en línea de gonmx.com para las sucursales (todo el equipo de tienda)
//   GET ?sucursal=Baja Visión     → compras de esa sucursal
//   GET ?id=123                   → una compra (todos sus pares) + lo necesario para "Pasar a venta"
//   PATCH { id, accion, ... }     → contactado | mas_dias | liberar | vendido | listo | entregado
// Todo se aplica a la compra completa (todos los pedidos con el mismo pago de Stripe).
// Lo que hace la sucursal se guarda en configuracion.linea; no se toca nada más del pedido.
// ─────────────────────────────────────────────────────────────

const SELECT = 'id, estado, created_at, precio_venta, notas_cliente, notas_admin, paciente, stripe_session_id, cliente_email, armazon_id, configuracion, clientes(nombre, email, telefono)'

const VISION: Record<string, string> = { mono: 'MON', bi: 'BIF', prog: 'PRO' }
const MATERIAL: Record<string, string> = { cr39: 'ESS', hd: 'SHD', poly: 'PPL', hi: 'USL', shi: 'USP' }
const FILTRO: Record<string, string> = { ar: 'FIL-AR', blue: 'FIL-BL', foto: 'FIL-FC', pol: 'FIL-POL', tinte: 'FIL-TIN' }
const NOMBRE_RESPALDO: Record<string, string> = {
  MON: 'Mica Monofocal', BIF: 'Mica Bifocal', PRO: 'Mica Progresiva',
  ESS: 'Essential', SHD: 'Slim HD', PPL: 'Poly Plus', USL: 'Ultra Slim', USP: 'Ultra Slim Pro',
  'FIL-AR': 'Antirreflejante', 'FIL-BL': 'Filtro Blue Light', 'FIL-FC': 'Filtro Fotocromático', 'FIL-POL': 'Filtro Polarizado', 'FIL-TIN': 'Tinte',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

async function grupoDe(sb: ReturnType<typeof createEcommClient>, id: number): Promise<Row[]> {
  const { data: p } = await sb.from('pedidos').select(SELECT).eq('id', id).eq('plataforma', 'gon').maybeSingle()
  if (!p) return []
  if (!p.stripe_session_id) return [p]
  const { data } = await sb.from('pedidos').select(SELECT).eq('stripe_session_id', p.stripe_session_id).eq('plataforma', 'gon').order('id')
  return (data ?? [p]) as Row[]
}

export async function GET(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const sb = createEcommClient()
    const id = Number(req.nextUrl.searchParams.get('id') || 0)

    if (id) {
      const pedidos = await grupoDe(sb, id)
      if (pedidos.length === 0) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
      return NextResponse.json({ ok: true, pedidos, prefill: await armarPrefill(sb, pedidos) })
    }

    const sucursal = req.nextUrl.searchParams.get('sucursal') ?? ''
    const ubic = UBIC_POR_SUCURSAL[sucursal]
    if (!ubic) return NextResponse.json({ ok: false, error: 'Sucursal inválida' }, { status: 400 })
    // Últimos 90 días: lo de antes ya está resuelto o se ve en Tienda en línea
    const desde = new Date(Date.now() - 90 * 86400_000).toISOString()
    const { data, error } = await sb.from('pedidos').select(SELECT)
      .eq('plataforma', 'gon').eq('configuracion->pago->>sucursal', ubic)
      .gte('created_at', desde).order('id', { ascending: false }).limit(300)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, pedidos: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Lo que Nueva venta necesita para precargar la venta
async function armarPrefill(sb: ReturnType<typeof createEcommClient>, pedidos: Row[]) {
  const p0 = pedidos[0]
  const pago = p0.configuracion?.pago ?? null
  const liberado = !!p0.configuracion?.linea?.liberado_at

  // Precios de micas y filtros (base OptiOS)
  const skusLentes = new Set<string>()
  for (const p of pedidos) {
    const c = p.configuracion ?? {}
    if (c.solo_armazon || !c.vision) continue
    if (VISION[c.vision] && MATERIAL[c.material]) skusLentes.add(`${VISION[c.vision]}-${MATERIAL[c.material]}`)
    for (const f of (c.filtros ?? []) as string[]) if (FILTRO[f]) skusLentes.add(FILTRO[f])
  }
  const prod: Record<string, { nombre: string; precio: number }> = {}
  if (skusLentes.size > 0) {
    const { data } = await createAdminClient().from('productos').select('sku, nombre, precio').in('sku', [...skusLentes])
    for (const r of data ?? []) prod[String(r.sku)] = { nombre: String(r.nombre), precio: Number(r.precio) || 0 }
  }

  // Armazones publicados en GON (para que el descuento web aplique igual que con el código WEB)
  const { data: arms } = await sb.from('armazones').select('sku, descuento_gon')
    .eq('activo', true).eq('publicar_gon', true).not('sku', 'is', null)
  const armazonesWeb: Record<string, number> = {}
  for (const a of arms ?? []) armazonesWeb[String(a.sku).toUpperCase()] = descWebArmazon(a.descuento_gon)

  const items: { par: number; sku: string; nombre: string; precio: number; descuento: number; apartado: boolean }[] = []
  const avisos: string[] = []
  let par = 0
  for (const p of pedidos) {
    par++
    const c = p.configuracion ?? {}
    const inv = c.inventario ?? null

    // Armazón: el color que eligió en la página
    const skuColor: string | null = inv?.sku ?? null
    if (liberado) {
      if (par === 1) avisos.push('El armazón se liberó: el cliente trae saldo a favor; agrega el armazón que elija ahora.')
    } else if (skuColor) {
      const { data: col } = await sb.from('armazon_colores').select('sku, color, armazon_id').eq('sku', skuColor).maybeSingle()
      const { data: arm } = col
        ? await sb.from('armazones').select('sku, marca, modelo, precio_gon, descuento_gon').eq('id', col.armazon_id).maybeSingle()
        : { data: null }
      if (col && arm) {
        items.push({
          par, sku: String(col.sku).toUpperCase(), nombre: `${arm.marca} ${arm.modelo} · ${col.color}`,
          precio: Number(arm.precio_gon) || 0, descuento: descWebArmazon(arm.descuento_gon),
          apartado: !!inv?.ok && !inv?.liberado,
        })
        if (inv?.traspaso && inv?.ubicacion) avisos.push(`El armazón ${col.sku} está apartado en ${SUCURSAL_POR_UBIC[inv.ubicacion] ?? inv.ubicacion}: pide el traspaso.`)
      } else avisos.push(`No encontré el armazón ${skuColor}; agrégalo a mano.`)
    } else {
      avisos.push(`Par ${par}: el pedido no trae el color del armazón (${c.armazon_ref || p.notas_cliente || ''}); agrégalo a mano.`)
    }

    // Micas y filtros
    if (!c.solo_armazon && c.vision) {
      const skuMica = VISION[c.vision] && MATERIAL[c.material] ? `${VISION[c.vision]}-${MATERIAL[c.material]}` : null
      if (skuMica) {
        const pr = prod[skuMica]
        items.push({ par, sku: skuMica, nombre: pr?.nombre || `${NOMBRE_RESPALDO[VISION[c.vision]]} ${NOMBRE_RESPALDO[MATERIAL[c.material]]}`, precio: pr?.precio ?? 0, descuento: DESC_WEB_MICAS, apartado: false })
        if (!pr) avisos.push(`No encontré el precio de ${skuMica}; revísalo.`)
      }
      for (const f of (c.filtros ?? []) as string[]) {
        const sku = FILTRO[f]; if (!sku) continue
        const pr = prod[sku]
        const color = c.filtros_colores?.[f]?.es
        items.push({ par, sku, nombre: `${pr?.nombre || NOMBRE_RESPALDO[sku]}${color ? ` · ${color}` : ''}`, precio: pr?.precio ?? 0, descuento: DESC_WEB_MICAS, apartado: false })
      }
    }
  }

  // Graduación capturada en la página (primer par que la traiga)
  const { data: recetas } = await sb.from('recetas').select('pedido_id, metodo, sph_od, cyl_od, axis_od, sph_os, cyl_os, axis_os, add_val, dp')
    .in('pedido_id', pedidos.map(p => p.id))
  const rec = (recetas ?? []).find(r => r.metodo === 'manual' && (r.sph_od != null || r.sph_os != null)) ?? null

  const cli = p0.clientes ?? {}
  return {
    codigo: codigoPedidoGon(p0.id),
    ids: pedidos.map(p => p.id),
    pagado: Number(pago?.pagado) || 0,
    total_web: Number(pago?.total) || 0,
    sucursal_ubic: pago?.sucursal ?? null,
    cliente: { nombre: cli.nombre || '', email: cli.email || p0.cliente_email || '', telefono: cli.telefono || p0.configuracion?.telefono || '' },
    pacientes: pedidos.map(p => p.paciente).filter(Boolean),
    falta_examen: pedidos.some(p => p.configuracion?.falta_examen),
    items, armazonesWeb, avisos,
    receta: rec ? {
      od_esfera: rec.sph_od != null ? String(rec.sph_od) : '', od_cilindro: rec.cyl_od != null ? String(rec.cyl_od) : '', od_eje: rec.axis_od != null ? String(rec.axis_od) : '',
      oi_esfera: rec.sph_os != null ? String(rec.sph_os) : '', oi_cilindro: rec.cyl_os != null ? String(rec.cyl_os) : '', oi_eje: rec.axis_os != null ? String(rec.axis_os) : '',
      od_add: rec.add_val != null ? String(rec.add_val) : '', oi_add: rec.add_val != null ? String(rec.add_val) : '',
      dp: rec.dp != null ? String(rec.dp) : '',
    } : null,
  }
}

const SITIO_GON = process.env.GON_SITE_URL || 'https://gonmx.com'

export async function PATCH(req: NextRequest) {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const b = await req.json() as { id?: number; accion?: string; dias?: number; venta_folio?: string; venta_id?: string }
    if (!b.id || !b.accion) return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })
    const sb = createEcommClient()
    const pedidos = await grupoDe(sb, b.id)
    if (pedidos.length === 0) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    const quien = g.usuario.nombre || g.usuario.rol
    const ahora = new Date().toISOString()

    // Guarda cambios en configuracion (y estado, si aplica) de cada pedido de la compra
    const guardar = async (fn: (p: Row) => { configuracion?: Row; estado?: string } | null) => {
      for (const p of pedidos) {
        const cambio = fn(p); if (!cambio) continue
        const patch: Row = {}
        if (cambio.configuracion) patch.configuracion = cambio.configuracion
        if (cambio.estado) patch.estado = cambio.estado
        const { error } = await sb.from('pedidos').update(patch).eq('id', p.id)
        if (error) throw new Error(error.message)
      }
    }
    const conLinea = (p: Row, extra: Row) => ({ ...(p.configuracion ?? {}), linea: { ...(p.configuracion?.linea ?? {}), ...extra } })

    switch (b.accion) {
      case 'contactado':
        await guardar(p => ({ configuracion: conLinea(p, { contactado_at: ahora, contactado_por: quien }) }))
        break

      case 'mas_dias': {
        const dias = Math.min(30, Math.max(1, Number(b.dias) || 3))
        await guardar(p => {
          const pago = p.configuracion?.pago
          if (!pago || pago.modo !== 'apartar') return null
          const base = pago.apartado_vence && pago.apartado_vence > hoyTJ() ? pago.apartado_vence : hoyTJ()
          return { configuracion: { ...p.configuracion, pago: { ...pago, apartado_vence: sumarDias(base, dias) } } }
        })
        break
      }

      case 'liberar': {
        // Regresa el armazón al inventario y el dinero queda como saldo a favor 30 días
        if (pedidos[0].configuracion?.linea?.venta) return NextResponse.json({ ok: false, error: 'Esta compra ya se pasó a venta' }, { status: 409 })
        const errores: string[] = []
        for (const p of pedidos) {
          const inv = p.configuracion?.inventario
          if (!inv?.ok || inv.liberado || !inv.color_id || !inv.ubicacion) continue
          const { error } = await sb.rpc('inv_mover', {
            p_color_id: inv.color_id, p_ubicacion: inv.ubicacion, p_cantidad: 1, p_tipo: 'cancelacion',
            p_referencia: codigoPedidoGon(p.id), p_usuario: quien, p_notas: 'Apartado en línea liberado',
          })
          if (error) errores.push(`${inv.sku}: ${error.message}`)
          else p.configuracion = { ...p.configuracion, inventario: { ...inv, liberado: true } }
        }
        await guardar(p => ({ configuracion: conLinea(p, { liberado_at: ahora, liberado_por: quien, saldo_vence: sumarDias(hoyTJ(), 30) }) }))
        if (errores.length) return NextResponse.json({ ok: false, error: 'Se liberó, pero no se pudo regresar al inventario: ' + errores.join(', ') + '. Regrésalo a mano.' })
        break
      }

      case 'vendido': {
        if (!b.venta_folio) return NextResponse.json({ ok: false, error: 'Falta el folio de la venta' }, { status: 400 })
        const venta = { folio: b.venta_folio, id: b.venta_id ?? '', fecha: ahora, por: quien }
        await guardar(p => ({
          configuracion: conLinea(p, { venta }),
          // Con micas y graduación ya se mandan a hacer; lo demás se queda como está hasta entregar
          estado: !p.configuracion?.solo_armazon && !p.configuracion?.falta_examen && ['apartado', 'pendiente'].includes(p.estado) ? 'en proceso' : undefined,
        }))
        break
      }

      case 'listo':
      case 'entregado': {
        // Mismo correo que manda Tienda en línea (vive en gonmx.com)
        const res = await fetch(`${SITIO_GON}/api/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_EMAIL_SECRET || '' },
          body: JSON.stringify({ tipo: b.accion, order_id: pedidos[0].id }),
        })
        const j = await res.json().catch(() => ({}))
        await guardar(() => ({ estado: b.accion }))
        if (!res.ok) return NextResponse.json({ ok: false, error: `Se marcó como ${b.accion}, pero el correo no salió: ${j?.error || res.status}` })
        break
      }

      default:
        return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
    }

    const actual = await grupoDe(sb, b.id)
    return NextResponse.json({ ok: true, pedidos: actual })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
