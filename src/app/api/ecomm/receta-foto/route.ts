import { NextRequest, NextResponse } from 'next/server'
import { createEcommClient } from '@/lib/supabase/ecomm'

export const dynamic = 'force-dynamic'

// Devuelve una URL firmada (temporal) para ver la foto de una receta guardada en
// el bucket privado `recetas`. El path se guarda en recetas.imagen_url.
// GET ?path=2026-08/uuid.jpg
export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get('path') ?? ''
    if (!path) return NextResponse.json({ ok: false, error: 'Falta path' }, { status: 400 })

    // Validación: solo rutas relativas dentro del bucket (sin esquema ni traversal)
    if (/^https?:|^blob:|\.\./.test(path)) {
      return NextResponse.json({ ok: false, error: 'Ruta no válida' }, { status: 400 })
    }

    const sb = createEcommClient()
    const { data, error } = await sb.storage.from('recetas').createSignedUrl(path, 600) // 10 min
    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok: false, error: error?.message || 'No se pudo firmar' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, url: data.signedUrl })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
