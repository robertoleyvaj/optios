import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

const CAMPOS_FOTO = ['imagen_url', 'imagen2_url', 'imagen3_url', 'imagen4_url', 'imagen5_url']

// Sube una foto de armazón al Storage de e-commerce (bucket 'armazones') y
// guarda la URL en la columna correspondiente del armazón.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const campo = form.get('campo') as string | null
    const id = form.get('id') as string | null
    if (!file || !campo || !id) {
      return NextResponse.json({ ok: false, error: 'Faltan datos (file, campo, id)' }, { status: 400 })
    }
    if (!CAMPOS_FOTO.includes(campo)) {
      return NextResponse.json({ ok: false, error: 'Campo de foto inválido' }, { status: 400 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const nombre = `armazon-${id}-${campo}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const sb = createEcommClient()
    const up = await sb.storage.from('armazones').upload(nombre, buffer, {
      contentType: file.type || 'image/jpeg', upsert: true,
    })
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 })

    const url = sb.storage.from('armazones').getPublicUrl(nombre).data.publicUrl
    const upd = await sb.from('armazones').update({ [campo]: url }).eq('id', id)
    if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 })

    return NextResponse.json({ ok: true, url, campo })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Borra una foto por completo: elimina el archivo del Storage y limpia la columna.
export async function DELETE(req: NextRequest) {
  try {
    const { id, campo, url } = await req.json() as { id?: string; campo?: string; url?: string }
    if (!id || !campo) return NextResponse.json({ ok: false, error: 'Faltan datos (id, campo)' }, { status: 400 })
    if (!CAMPOS_FOTO.includes(campo)) return NextResponse.json({ ok: false, error: 'Campo de foto inválido' }, { status: 400 })

    const sb = createEcommClient()
    // Borrar el archivo físico del Storage (extrae el nombre del public URL)
    if (typeof url === 'string' && url.includes('/armazones/')) {
      const path = url.split('/armazones/').pop()?.split('?')[0]
      if (path) await sb.storage.from('armazones').remove([decodeURIComponent(path)])
    }
    const upd = await sb.from('armazones').update({ [campo]: null }).eq('id', id)
    if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
