import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, sinCosto, INVENTARIO, WEB } from '@/lib/auth-api'
import { VALIDOS } from '@/lib/armazon-web'
import { precioInteligente, precioVerlyUSD } from '@/lib/precio-gama'
import { tipoCambioServidor } from '@/lib/tipo-cambio-server'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Inventario nuevo (SKU por color). Solo modelos con SKU VRL-1xxx.
// El stock vive en armazon_colores; armazones guarda los datos del modelo.
// ─────────────────────────────────────────────────────────────

const CAMPOS_MODELO =
  'id, sku, sku_viejo, marca, modelo, nombre, medidas, material, precio_gon, precio, costo, activo, publicar_gon, publicar_verly, descuento_gon, descuento_verly, imagen_url, imagen2_url, imagen3_url, imagen4_url, imagen5_url, genero, forma, aro, badge, descripcion_es, descripcion_en, gama'

const CAMPOS_COLOR = 'id, armazon_id, sku, color, stock_baja, stock_mayo, stock_plaza, stock_online, bodega, orden, hex, publicar_verly, publicar_gon, imagen_url, imagen2_url, imagen3_url, imagen4_url, portada_url'

// Qué puede cambiar cada quien
const CAMPOS_ADMIN = new Set(['marca', 'modelo', 'medidas', 'material', 'precio_gon', 'costo', 'descuento_gon', 'descuento_verly'])
const CAMPOS_WEB = new Set(['nombre', 'genero', 'forma', 'aro', 'badge', 'descripcion_es', 'descripcion_en',
  'publicar_gon', 'publicar_verly', 'imagen_url', 'gama'])

// GET → todos los modelos del inventario nuevo con sus colores
export async function GET() {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const sb = createEcommClient()
    const [m, c] = await Promise.all([
      sb.from('armazones').select(CAMPOS_MODELO).like('sku', 'VRL-1___').order('sku').range(0, 4999),
      sb.from('armazon_colores').select(CAMPOS_COLOR).like('sku', 'VRL-1___-__').order('sku').range(0, 9999),
    ])
    if (m.error) return NextResponse.json({ ok: false, error: m.error.message }, { status: 500 })
    if (c.error) return NextResponse.json({ ok: false, error: c.error.message }, { status: 500 })

    const porModelo = new Map<number, unknown[]>()
    for (const col of c.data ?? []) {
      const k = (col as { armazon_id: number }).armazon_id
      if (!porModelo.has(k)) porModelo.set(k, [])
      porModelo.get(k)!.push(col)
    }
    const modelos = sinCosto((m.data ?? []) as unknown as { id: number; costo?: unknown }[], g.usuario)
      .map(x => ({ ...x, colores: porModelo.get(x.id) ?? [] }))
    return NextResponse.json({ ok: true, modelos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// PATCH → editar datos del modelo (no el stock: el stock solo cambia con movimientos)
// Body: { id, ...campos }  ó  { color_id, hex?, web? }
export async function PATCH(req: NextRequest) {
  const g = await requireRol(WEB); if (!g.ok) return g.res
  const esAdmin = g.usuario.rol === 'administrador'
  try {
    const { id, color_id, ...cambios } = (await req.json()) ?? {}
    const sb = createEcommClient()

    // Cambios de UN color: circulito (hex) y si se muestra en la web. El stock no se toca aquí.
    if (color_id) {
      const upd: Record<string, unknown> = {}
      if ('hex' in cambios) {
        const h = cambios.hex
        if (h !== null && !/^#[0-9a-fA-F]{6}$/.test(String(h))) return NextResponse.json({ ok: false, error: 'Color inválido' }, { status: 400 })
        upd.hex = h
      }
      if ('web' in cambios) { upd.publicar_verly = !!cambios.web; upd.publicar_gon = !!cambios.web }
      // Corregir el nombre del color (error de dedo) — solo administrador
      if ('color' in cambios) {
        if (!esAdmin) return NextResponse.json({ ok: false, error: 'Solo el administrador cambia nombres' }, { status: 403 })
        const nombre = String(cambios.color ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
        if (!nombre) return NextResponse.json({ ok: false, error: 'Nombre vacío' }, { status: 400 })
        upd.color = nombre
      }
      if (Object.keys(upd).length === 0) return NextResponse.json({ ok: false, error: 'Nada que actualizar' }, { status: 400 })
      const { data, error } = await sb.from('armazon_colores').update(upd)
        .eq('id', color_id).like('sku', 'VRL-1___-__').select(CAMPOS_COLOR).single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, color: data })
    }

    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })

    const update: Record<string, unknown> = {}
    for (const k of Object.keys(cambios)) {
      if (CAMPOS_WEB.has(k) || (esAdmin && CAMPOS_ADMIN.has(k))) update[k] = cambios[k]
    }
    // Datos para la web: solo valores de la lista; texto vacío → null
    for (const k of ['nombre', 'descripcion_es', 'descripcion_en']) {
      if (k in update) { const v = String(update[k] ?? '').trim(); update[k] = v ? v.slice(0, k === 'nombre' ? 60 : 280) : null }
    }
    // El apodo no puede quedar vacío en la base: sin apodo, la web muestra el modelo
    if ('nombre' in update && update.nombre === null) {
      const { data: a } = await sb.from('armazones').select('modelo').eq('id', id).maybeSingle()
      update.nombre = a?.modelo ?? ''
    }
    for (const k of Object.keys(VALIDOS)) {
      if (!(k in update)) continue
      const v = update[k] == null || update[k] === '' ? null : String(update[k])
      if (v !== null && !VALIDOS[k].has(v)) return NextResponse.json({ ok: false, error: `Valor no válido en ${k}` }, { status: 400 })
      update[k] = v
    }
    if ('imagen_url' in update && update.imagen_url !== null && !/^https:\/\//.test(String(update.imagen_url))) {
      return NextResponse.json({ ok: false, error: 'Portada inválida' }, { status: 400 })
    }

    // Cambio de gama → el precio se vuelve a sugerir dentro del rango de la marca
    if ('gama' in update) {
      if (!['basico', 'estandar', 'premium'].includes(String(update.gama))) return NextResponse.json({ ok: false, error: 'Gama inválida' }, { status: 400 })
      if (!('precio_gon' in update)) {
        const { data: a } = await sb.from('armazones').select('marca').eq('id', id).maybeSingle()
        const { data: mk } = await sb.from('marcas').select('grupo').eq('nombre', String(a?.marca ?? '').toUpperCase()).maybeSingle()
        const { data: r } = await sb.from('precio_gamas').select('min, max').eq('grupo', mk?.grupo ?? 'OTRAS').eq('gama', update.gama).maybeSingle()
        if (r) update.precio_gon = precioInteligente(r.min, r.max)
      }
    }
    // Precio Verly siempre = pesos ÷ tipo de cambio × 50%
    if ('precio_gon' in update) {
      const tc = await tipoCambioServidor()
      const usd = precioVerlyUSD(Number(update.precio_gon), tc)
      if (usd) update.precio = usd
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ ok: false, error: 'Nada que actualizar (o sin permiso para esos datos)' }, { status: 400 })

    const { data, error } = await sb.from('armazones').update(update)
      .eq('id', id).like('sku', 'VRL-1___').select(CAMPOS_MODELO).single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const [modelo] = sinCosto([data as unknown as Record<string, unknown>], g.usuario)
    return NextResponse.json({ ok: true, modelo })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
