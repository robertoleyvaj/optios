// Utilidades de fecha — siempre en hora local Tijuana (America/Tijuana, UTC-7/UTC-8)
const TZ = 'America/Tijuana'

/** Devuelve la fecha local de hoy en formato YYYY-MM-DD */
export const hoyLocal = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ })

/** Formatea un timestamp ISO a fecha local YYYY-MM-DD */
export const fechaLocal = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })

/** Formatea cualquier objeto Date a YYYY-MM-DD en hora Tijuana */
export const formatFecha = (d: Date): string =>
  d.toLocaleDateString('en-CA', { timeZone: TZ })

/** Devuelve la fecha local de hoy + n días en formato YYYY-MM-DD */
export const hoyMasDias = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}
