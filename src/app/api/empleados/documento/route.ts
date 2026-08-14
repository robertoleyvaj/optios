import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'empleados'

async function asegurarBucket(sb: ReturnType<typeof createAdminClient>) {
  // Idempotente: si ya existe, ignora el error.
  await sb.storage.createBucket(BUCKET, { public: false }).catch(() => {})
}

// Listar documentos de un empleado. Query: ?usuario_id=...
// Se lee con el cliente admin (service role) para no depender de RLS.
export async function GET(req: NextRequest) {
  try {
    const usuarioId = req.nextUrl.searchParams.get('usuario_id')
    if (!usuarioId) return NextResponse.json({ ok: false, error: 'Falta usuario_id' }, { status: 400 })
    const sb = createAdminClient()
    const { data, error } = await sb.from('empleado_documentos')
      .select('*').eq('usuario_id', usuarioId).order('subido_at', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, documentos: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Subir un documento de empleado. FormData: file, usuario_id, categoria
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const usuarioId = form.get('usuario_id') as string | null
    const categoria = (form.get('categoria') as string | null) || 'otro'
    if (!file || !usuarioId) {
      return NextResponse.json({ ok: false, error: 'Faltan datos (file, usuario_id)' }, { status: 400 })
    }

    const sb = createAdminClient()
    await asegurarBucket(sb)

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `${usuarioId}/${Date.now()}-${categoria}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const up = await sb.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type || 'application/octet-stream', upsert: true,
    })
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 })

    // URL firmada (bucket privado) de larga duración
    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365)
    const url = signed.data?.signedUrl || ''

    const { data, error } = await sb.from('empleado_documentos').insert({
      usuario_id: usuarioId,
      nombre: file.name,
      categoria,
      path,
      url,
      tamano: buffer.length,
    }).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, documento: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

// Borrar un documento. Body: { id, path }
export async function DELETE(req: NextRequest) {
  try {
    const { id, path } = await req.json() as { id?: string; path?: string }
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })
    const sb = createAdminClient()
    if (path) await sb.storage.from(BUCKET).remove([path]).catch(() => {})
    const { error } = await sb.from('empleado_documentos').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
