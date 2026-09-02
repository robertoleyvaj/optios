import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMes } from '@/lib/analisis/queries'
import { computeMetrics } from '@/lib/analisis/metrics'
import { buildWorkbook } from '@/lib/analisis/workbook'
import { buildInstrucciones } from '@/lib/analisis/instrucciones'

// Solo el administrador puede descargar el paquete (datos financieros sensibles).
async function esAdmin(): Promise<boolean> {
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return false
    if (user.user_metadata?.rol === 'administrador') return true
    // Respaldo: consultar la tabla usuarios por auth_user_id
    const admin = createAdminClient()
    const { data } = await admin.from('usuarios').select('rol').eq('auth_user_id', user.id).single()
    return data?.rol === 'administrador'
  } catch { return false }
}

// ExcelJS necesita runtime Node (no Edge). Todo corre en el servidor.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/finanzas/analisis-mensual?anio=2026&mes=8
// Devuelve un .zip con el Excel del mes + INSTRUCCIONES_PARA_IA.md
export async function GET(req: NextRequest) {
  try {
    if (!(await esAdmin()))
      return NextResponse.json({ ok: false, error: 'Solo el administrador puede descargar este análisis.' }, { status: 403 })

    const anio = parseInt(req.nextUrl.searchParams.get('anio') ?? '', 10)
    const mes  = parseInt(req.nextUrl.searchParams.get('mes') ?? '', 10)   // 1-12
    const hoy = new Date()
    if (!Number.isInteger(anio) || anio < 2020 || anio > hoy.getFullYear() + 1)
      return NextResponse.json({ ok: false, error: 'Año no válido' }, { status: 400 })
    if (!Number.isInteger(mes) || mes < 1 || mes > 12)
      return NextResponse.json({ ok: false, error: 'Mes no válido' }, { status: 400 })

    const mes0 = mes - 1
    const data = await fetchMes(anio, mes0)
    const metrics = computeMetrics(data)
    const wb = buildWorkbook(data, metrics)
    const md = buildInstrucciones(data, metrics)

    const xlsxBuf = await wb.xlsx.writeBuffer()

    const mm = String(mes).padStart(2, '0')
    const zip = new JSZip()
    zip.file(`Analisis_${anio}-${mm}.xlsx`, xlsxBuf)
    zip.file('INSTRUCCIONES_PARA_IA.md', md)
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(zipBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Analisis_OptiOS_${anio}-${mm}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('analisis-mensual error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'error desconocido' },
      { status: 500 },
    )
  }
}
