import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Dominios de las tiendas (el email vive en cada web, no en OptiOS).
const SITIO: Record<string, string> = {
  verly: process.env.VERLY_SITE_URL || 'https://verlyoptical.com',
  gon: process.env.GON_SITE_URL || 'https://gonmx.com',
}

// estado del pedido → tipo que espera el endpoint /api/emails de la web
const TIPO_POR_ESTADO: Record<string, string> = {
  'en proceso': 'fabricacion',
  'enviado': 'enviado',
  'entregado': 'entregado',
}

// Dispara el correo de actualización de pedido llamando al /api/emails de la web.
// Body: { id, estado, tienda, tracking?, paqueteria? }
export async function POST(req: NextRequest) {
  try {
    const { id, estado, tienda, tracking, paqueteria } = await req.json() as {
      id?: number; estado?: string; tienda?: string; tracking?: string; paqueteria?: string
    }
    if (!id || !estado) return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })
    const tipo = TIPO_POR_ESTADO[estado]
    if (!tipo) return NextResponse.json({ ok: true, sinCorreo: true }) // estado sin correo (ej. pendiente)

    const base = SITIO[tienda === 'gon' ? 'gon' : 'verly']
    const res = await fetch(`${base}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_EMAIL_SECRET || '',
      },
      body: JSON.stringify({ tipo, order_id: id, tracking: tracking ?? '', paqueteria: paqueteria ?? '' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.error || `La web respondió ${res.status}` }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
