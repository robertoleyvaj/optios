import { NextResponse } from 'next/server'

/**
 * Tipo de cambio FIX (DOF) desde el API de Banxico.
 * Serie SF43718 = "Tipo de cambio pesos por dólar (FIX)" — el que publica el DOF.
 * El token vive solo en el servidor (BANXICO_TOKEN), nunca se expone al navegador.
 */
export async function GET() {
  const token = process.env.BANXICO_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Falta BANXICO_TOKEN' }, { status: 500 })
  }

  try {
    const res = await fetch(
      'https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno',
      {
        headers: { 'Bmx-Token': token, Accept: 'application/json' },
        next: { revalidate: 3600 }, // cachear 1 hora
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: `Banxico ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const serie = data?.bmx?.series?.[0]?.datos?.[0]
    const valor = parseFloat(serie?.dato)
    const fecha = serie?.fecha ?? null

    if (!valor || Number.isNaN(valor)) {
      return NextResponse.json({ error: 'Sin dato de Banxico' }, { status: 502 })
    }

    return NextResponse.json({ tipoCambio: valor, fecha, fuente: 'DOF (Banxico FIX)' })
  } catch {
    return NextResponse.json({ error: 'Error al consultar Banxico' }, { status: 502 })
  }
}
