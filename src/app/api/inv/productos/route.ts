import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRol, GESTION } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Catálogo de productos (base de OptiOS, tabla `productos`)
//   grupo: mica · tratamiento · paquete · servicio · consumible · lc (lente en stock) · lc_grad (graduación)
//   Lentes de contacto sobre pedido → tabla `productos_catalogo`
// Admin y gerente pueden agregar, editar, dar entrada y traspasar.
// El COSTO solo lo ve y lo cambia el administrador.
// ─────────────────────────────────────────────────────────────

const CAMPOS = 'id, sku, nombre, tipo, categoria, marca, precio, costo, activo, grupo, vision, control_stock, genera_lab, ' +
  'opciones, extra_mica, paquete, padre, stock_baja, stock_mayo, stock_plaza, stock_bodega, stock_min'
const GRUPOS = ['mica', 'tratamiento', 'paquete', 'servicio', 'consumible', 'lc', 'lc_grad'] as const
type Grupo = typeof GRUPOS[number]
const PREFIJO: Record<Grupo, string> = { mica: 'MON', tratamiento: 'FIL', paquete: 'PAQ', servicio: 'SRV', consumible: 'CON', lc: 'LC', lc_grad: 'LCG' }
const CATEGORIA: Record<Grupo, string> = { mica: 'Micas', tratamiento: 'Filtros', paquete: 'Paquetes', servicio: 'Servicios', consumible: 'Consumibles', lc: 'Lentes de contacto', lc_grad: 'Lentes de contacto' }
const UBIC: Record<string, 'stock_baja' | 'stock_mayo' | 'stock_plaza' | 'stock_bodega'> = { baja: 'stock_baja', mayo: 'stock_mayo', plaza: 'stock_plaza', bodega: 'stock_bodega' }
const limpia = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ')
const num = (v: unknown) => Number(v ?? 0) || 0

export async function GET() {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  try {
    const sb = createAdminClient()
    const [p, lc] = await Promise.all([
      sb.from('productos').select(CAMPOS).not('grupo', 'is', null).order('nombre').range(0, 4999),
      sb.from('productos_catalogo').select('id, nombre, precio_publico, activo').eq('tipo', 'lentes_contacto').order('nombre'),
    ])
    if (p.error) return NextResponse.json({ ok: false, error: p.error.message }, { status: 500 })
    const admin = g.usuario.rol === 'administrador'
    const productos = (p.data ?? []).map(r => admin ? r : { ...(r as object), costo: null })
    return NextResponse.json({ ok: true, productos, lentesPedido: lc.data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// POST { accion: 'crear', grupo, ... }  ·  POST { accion: 'mover', id, desde?, hacia?, cantidad }
export async function POST(req: NextRequest) {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  const admin = g.usuario.rol === 'administrador'
  try {
    const b = await req.json() as Record<string, unknown>
    const sb = createAdminClient()

    // ── Entrada (hacia) o traspaso (desde → hacia) de piezas ──
    if (b.accion === 'mover') {
      const cant = Math.floor(num(b.cantidad))
      const desde = b.desde ? UBIC[String(b.desde)] : null
      const hacia = b.hacia ? UBIC[String(b.hacia)] : null
      if (!b.id || cant <= 0 || (!desde && !hacia) || (b.desde && !desde) || (b.hacia && !hacia) || desde === hacia) {
        return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
      }
      const { data: r } = await sb.from('productos').select('id, grupo, stock_baja, stock_mayo, stock_plaza, stock_bodega').eq('id', b.id).maybeSingle()
      if (!r || !['consumible', 'lc_grad'].includes(String(r.grupo))) return NextResponse.json({ ok: false, error: 'Este producto no lleva stock' }, { status: 400 })
      const s = { stock_baja: num(r.stock_baja), stock_mayo: num(r.stock_mayo), stock_plaza: num(r.stock_plaza), stock_bodega: num(r.stock_bodega) }
      if (desde) { if (s[desde] < cant) return NextResponse.json({ ok: false, error: `Solo hay ${s[desde]} en el origen` }, { status: 400 }); s[desde] -= cant }
      if (hacia) s[hacia] += cant
      const { data, error } = await sb.from('productos')
        .update({ ...s, stock: s.stock_baja + s.stock_mayo + s.stock_plaza + s.stock_bodega }).eq('id', b.id).select(CAMPOS).single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, producto: admin ? data : { ...(data as object), costo: null } })
    }

    // ── Alta ──
    const grupo = String(b.grupo) as Grupo | 'lc_pedido'
    const nombre = limpia(b.nombre)
    const precio = num(b.precio)
    if (!nombre) return NextResponse.json({ ok: false, error: 'Falta el nombre' }, { status: 400 })

    if (grupo === 'lc_pedido') {
      const { data, error } = await sb.from('productos_catalogo')
        .insert({ nombre: nombre.toUpperCase(), precio_publico: precio, tipo: 'lentes_contacto', activo: true }).select().single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, lente: data })
    }
    if (!GRUPOS.includes(grupo as Grupo)) return NextResponse.json({ ok: false, error: 'Tipo inválido' }, { status: 400 })
    const gr = grupo as Grupo

    let pref = PREFIJO[gr]
    let nombreFinal = nombre
    const vision = gr === 'mica' ? (['Monofocal', 'Bifocal', 'Progresivo'].includes(String(b.vision)) ? String(b.vision) : 'Monofocal') : null
    if (gr === 'mica') {
      pref = vision === 'Bifocal' ? 'BIF' : vision === 'Progresivo' ? 'PRO' : 'MON'
      // Se guarda como "Mica <visión> <nombre>" para que la orden de laboratorio la reconozca
      if (!/\bmica\b/i.test(nombreFinal)) nombreFinal = `Mica ${vision} ${nombreFinal}`
    }
    let padre: string | null = null
    if (gr === 'lc_grad') {
      padre = limpia(b.padre)
      const { data: pa } = await sb.from('productos').select('sku, nombre, precio, costo').eq('sku', padre).eq('grupo', 'lc').maybeSingle()
      if (!pa) return NextResponse.json({ ok: false, error: 'Lente de contacto no encontrado' }, { status: 404 })
      nombreFinal = `${pa.nombre} ${nombre}`
    }
    const { data: prev } = await sb.from('productos').select('sku').like('sku', `${pref}-N%`)
    const n = Math.max(0, ...(prev ?? []).map(r => parseInt(String(r.sku).split('-N')[1]) || 0)) + 1
    const sku = `${pref}-N${String(n).padStart(3, '0')}`

    const conStock = gr === 'consumible' || gr === 'lc_grad'
    const s = conStock ? {
      stock_baja: Math.max(0, num(b.stock_baja)), stock_mayo: Math.max(0, num(b.stock_mayo)),
      stock_plaza: Math.max(0, num(b.stock_plaza)), stock_bodega: Math.max(0, num(b.stock_bodega)),
    } : { stock_baja: 0, stock_mayo: 0, stock_plaza: 0, stock_bodega: 0 }

    const row: Record<string, unknown> = {
      sku, nombre: nombreFinal, grupo: gr, vision,
      tipo: gr === 'consumible' || gr === 'lc' || gr === 'lc_grad' ? 'consumible' : 'servicio',
      categoria: CATEGORIA[gr], marca: gr === 'lc_grad' ? (limpia(b.marca) || null) : (limpia(b.marca) || 'GON'),
      precio, costo: admin ? num(b.costo) : 0, ubicacion: 'Todas', activo: true,
      ...s, stock: conStock ? s.stock_baja + s.stock_mayo + s.stock_plaza + s.stock_bodega : 999,
      stock_min: gr === 'consumible' ? Math.max(0, num(b.stock_min)) : 0,
      control_stock: gr === 'consumible' ? b.control_stock !== false : true,
      genera_lab: gr === 'servicio' ? !!b.genera_lab : false,
      opciones: gr === 'tratamiento' && Array.isArray(b.opciones) && b.opciones.length ? b.opciones : null,
      extra_mica: gr === 'tratamiento' && b.extra_mica && typeof b.extra_mica === 'object' ? b.extra_mica : null,
      paquete: gr === 'paquete' ? b.paquete ?? null : null,
      padre,
    }
    // Las graduaciones heredan precio y costo del lente si no traen propios
    if (gr === 'lc_grad' && !precio) {
      const { data: pa } = await sb.from('productos').select('precio, costo').eq('sku', padre).maybeSingle()
      row.precio = num(pa?.precio); if (admin && !num(b.costo)) row.costo = num(pa?.costo)
    }
    const { data, error } = await sb.from('productos').insert(row).select(CAMPOS).single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, producto: admin ? data : { ...(data as object), costo: null } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// PATCH { id, tabla?: 'lc_pedido', ...cambios }
export async function PATCH(req: NextRequest) {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  const admin = g.usuario.rol === 'administrador'
  try {
    const { id, tabla, ...c } = await req.json() as Record<string, unknown>
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })
    const sb = createAdminClient()

    if (tabla === 'lc_pedido') {
      const upd: Record<string, unknown> = {}
      if (c.nombre !== undefined) upd.nombre = limpia(c.nombre).toUpperCase()
      if (c.precio !== undefined) upd.precio_publico = num(c.precio)
      if (c.activo !== undefined) upd.activo = !!c.activo
      const { data, error } = await sb.from('productos_catalogo').update(upd).eq('id', id).select().single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, lente: data })
    }

    const { data: actual } = await sb.from('productos').select('grupo, sku').eq('id', id).maybeSingle()
    if (!actual?.grupo) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })

    const upd: Record<string, unknown> = {}
    const texto = ['nombre', 'marca', 'vision']
    const numeros = ['precio', 'stock_min']
    const bools = ['activo', 'control_stock', 'genera_lab']
    const json = ['opciones', 'extra_mica', 'paquete']
    for (const k of texto) if (c[k] !== undefined) upd[k] = limpia(c[k]) || null
    for (const k of numeros) if (c[k] !== undefined) upd[k] = num(c[k])
    for (const k of bools) if (c[k] !== undefined) upd[k] = !!c[k]
    for (const k of json) if (c[k] !== undefined) upd[k] = c[k]
    if (admin && c.costo !== undefined) upd.costo = num(c.costo)
    if (Object.keys(upd).length === 0) return NextResponse.json({ ok: false, error: 'Nada que cambiar' }, { status: 400 })

    const { data, error } = await sb.from('productos').update(upd).eq('id', id).select(CAMPOS).single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    // Cambios de precio/costo/activo del lente de contacto se aplican a sus graduaciones
    if (actual.grupo === 'lc') {
      const hijos: Record<string, unknown> = {}
      if (upd.precio !== undefined) hijos.precio = upd.precio
      if (upd.costo !== undefined) hijos.costo = upd.costo
      if (upd.activo !== undefined) hijos.activo = upd.activo
      if (Object.keys(hijos).length) await sb.from('productos').update(hijos).eq('grupo', 'lc_grad').eq('padre', actual.sku)
    }
    return NextResponse.json({ ok: true, producto: admin ? data : { ...(data as object), costo: null } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
