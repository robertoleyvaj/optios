import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { requireRol, INVENTARIO } from '@/lib/auth-api'

export const dynamic = 'force-dynamic'

// tabla 'armazon' (default) → fotos del modelo (5); tabla 'color' → 4 fotos del color + 1 de ambiente (portada_url)
const CAMPOS_FOTO: Record<string, string[]> = {
  armazon: ['imagen_url', 'imagen2_url', 'imagen3_url', 'imagen4_url', 'imagen5_url'],
  color: ['imagen_url', 'imagen2_url', 'imagen3_url', 'imagen4_url', 'portada_url'],
}
const TABLA: Record<string, string> = { armazon: 'armazones', color: 'armazon_colores' }

// Sube una foto de armazón al Storage de e-commerce (bucket 'armazones') y
// guarda la URL en la columna correspondiente del armazón o del color.
export async function POST(req: NextRequest) {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const campo = form.get('campo') as string | null
    const id = form.get('id') as string | null
    const tabla = (form.get('tabla') as string | null) || 'armazon'
    if (!file || !campo || !id) {
      return NextResponse.json({ ok: false, error: 'Faltan datos (file, campo, id)' }, { status: 400 })
    }
    if (!CAMPOS_FOTO[tabla]?.includes(campo)) {
      return NextResponse.json({ ok: false, error: 'Campo de foto inválido' }, { status: 400 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const nombre = `${tabla === 'color' ? 'color' : 'armazon'}-${id}-${campo}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const sb = createEcommClient()
    const up = await sb.storage.from('armazones').upload(nombre, buffer, {
      contentType: file.type || 'image/jpeg', upsert: true,
    })
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 })

    const url = sb.storage.from('armazones').getPublicUrl(nombre).data.publicUrl
    const upd = await sb.from(TABLA[tabla]).update({ [campo]: url }).eq('id', id)
    if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 })

    return NextResponse.json({ ok: true, url, campo })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Borra una foto por completo: elimina el archivo del Storage y limpia la columna.
export async function DELETE(req: NextRequest) {
  const g = await requireRol(INVENTARIO); if (!g.ok) return g.res
  try {
    const { id, campo, url, tabla = 'armazon' } = await req.json() as { id?: string; campo?: string; url?: string; tabla?: string }
    if (!id || !campo) return NextResponse.json({ ok: false, error: 'Faltan datos (id, campo)' }, { status: 400 })
    if (!CAMPOS_FOTO[tabla]?.includes(campo)) return NextResponse.json({ ok: false, error: 'Campo de foto inválido' }, { status: 400 })

    const sb = createEcommClient()
    // Borrar el archivo físico del Storage (extrae el nombre del public URL)
    if (typeof url === 'string' && url.includes('/armazones/')) {
      const path = url.split('/armazones/').pop()?.split('?')[0]
      if (path) await sb.storage.from('armazones').remove([decodeURIComponent(path)])
    }
    const upd = await sb.from(TABLA[tabla]).update({ [campo]: null }).eq('id', id)
    if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
