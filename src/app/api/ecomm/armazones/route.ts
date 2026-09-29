import { NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, sinCosto, GESTION, TIENDA } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

const CAMPOS = 'id, sku, sku_viejo, nombre, marca, modelo, color1, medidas, material, forma, genero, badge, precio, precio_gon, costo, ' +
  'stock_baja, stock_mayo, stock_plaza, stock_online, publicar_gon, publicar_verly, ' +
  'descuento_gon, descuento_verly, activo, imagen_url, imagen2_url, imagen3_url, imagen4_url, imagen5_url'

// Listar todos los armazones del catálogo (base de e-commerce)
export async function GET() {
  const g = await requireRol(TIENDA); if (!g.ok) return g.res
  try {
    const sb = createEcommClient()
    const { data, error } = await sb
      .from('armazones')
      .select(CAMPOS)
      .order('id', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, armazones: sinCosto((data ?? []) as unknown as Record<string, unknown>[], g.usuario) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Crear un armazón nuevo en el catálogo (base de e-commerce). Body: { ...campos }
export async function POST(req: Request) {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  try {
    const body = await req.json()
    const permitidos = new Set([
      'sku', 'sku_viejo', 'nombre', 'marca', 'modelo', 'color1', 'medidas', 'material',
      'precio', 'precio_gon', 'costo', 'stock', 'stock_baja', 'stock_mayo', 'stock_plaza', 'stock_online',
      'publicar_gon', 'publicar_verly', 'descuento_gon', 'descuento_verly', 'activo',
    ])
    const row: Record<string, unknown> = {}
    for (const k of Object.keys(body ?? {})) if (permitidos.has(k)) row[k] = body[k]
    if (g.usuario.rol !== 'administrador') delete row.costo   // solo el admin fija costo
    if (!row.sku) return NextResponse.json({ ok: false, error: 'Falta SKU' }, { status: 400 })

    const sb = createEcommClient()
    const { data, error } = await sb.from('armazones').insert(row).select(CAMPOS).single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, armazon: sinCosto([data as unknown as Record<string, unknown>], g.usuario)[0] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Actualizar un armazón. Body: { id, ...campos a cambiar }
export async function PATCH(req: Request) {
  const g = await requireRol(GESTION); if (!g.ok) return g.res
  try {
    const body = await req.json()
    const { id, ...cambios } = body ?? {}
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })

    // Solo permitimos actualizar campos conocidos (evita escribir columnas raras)
    const permitidos = new Set([
      'nombre', 'marca', 'modelo', 'color1', 'medidas', 'material', 'forma', 'genero', 'badge', 'precio', 'precio_gon',
      'costo', 'stock', 'stock_baja', 'stock_mayo', 'stock_plaza', 'stock_online',
      'publicar_gon', 'publicar_verly', 'descuento_gon', 'descuento_verly', 'activo',
      'imagen_url', 'imagen2_url', 'imagen3_url', 'imagen4_url', 'imagen5_url',
    ])
    const update: Record<string, unknown> = {}
    for (const k of Object.keys(cambios)) if (permitidos.has(k)) update[k] = cambios[k]
    if (g.usuario.rol !== 'administrador') delete update.costo   // solo el admin fija costo
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nada que actualizar' }, { status: 400 })
    }

    const sb = createEcommClient()
    const { data, error } = await sb.from('armazones').update(update).eq('id', id).select(CAMPOS).single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, armazon: sinCosto([data as unknown as Record<string, unknown>], g.usuario)[0] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
