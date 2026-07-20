import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Tipo de cambio USD → MXN, 100% MANUAL.
 * Lo captura el administrador en Ajustes → Pagos y se guarda en la tabla
 * `configuracion` con clave 'tipo_cambio_usd'. Ya NO se usa Banxico/DOF.
 * Si no está configurado, devuelve 404 y la UI muestra "sin tipo de cambio".
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'tipo_cambio_usd')
      .maybeSingle()

    const valor = parseFloat(data?.valor ?? '')
    if (!valor || Number.isNaN(valor) || valor <= 0) {
      return NextResponse.json(
        { error: 'Tipo de cambio no configurado. Captúralo en Ajustes → Pagos.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ tipoCambio: valor, fuente: 'Manual' })
  } catch {
    return NextResponse.json({ error: 'Error al leer el tipo de cambio' }, { status: 500 })
  }
}
