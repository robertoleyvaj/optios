import { createClient } from '@/lib/supabase/client'

// Tasas por defecto si la tabla configuracion no existe o no tiene datos
const DEFAULTS: Record<string, number> = {
  debito:  2.99,
  credito: 2.99,
}

/** Lee las tasas de comisión terminal desde Supabase.
 *  Vuelve a los defaults si la tabla no existe o el registro no está. */
export async function getComisiones(): Promise<Record<string, number>> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['comision_debito', 'comision_credito'])

    const rates = { ...DEFAULTS }
    for (const row of data || []) {
      if (row.clave === 'comision_debito')  rates.debito  = parseFloat(row.valor) || DEFAULTS.debito
      if (row.clave === 'comision_credito') rates.credito = parseFloat(row.valor) || DEFAULTS.credito
    }
    return rates
  } catch {
    return DEFAULTS
  }
}

/** Inserta un gasto de comisión terminal en la tabla gastos.
 *  Solo actúa si metodoPago es 'debito' o 'credito'. */
export async function registrarComisionTerminal({
  metodoPago,
  monto,
  folio,
  sucursal,
}: {
  metodoPago: string
  monto: number
  folio: string
  sucursal: string
}) {
  if (!['debito', 'credito'].includes(metodoPago)) return

  const rates    = await getComisiones()
  const tasa     = metodoPago === 'debito' ? rates.debito : rates.credito
  const comision = Math.round(monto * tasa) / 100   // round to 2 decimals

  if (comision <= 0) return

  const supabase = createClient()
  const fecha    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })

  await supabase.from('gastos').insert({
    fecha,
    categoria:      'comision_terminal',
    concepto:       `Comisión ${metodoPago === 'debito' ? 'débito' : 'crédito'} · ${folio}`,
    monto:          comision,
    metodo_pago:    'banco',
    sucursal,
    registrado_por: 'sistema',
  })
}
