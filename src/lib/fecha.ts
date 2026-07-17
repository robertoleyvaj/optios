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

/**
 * Rango UTC [inicio, fin] que cubre un día completo en hora local (Tijuana),
 * de 00:00:00 a 23:59:59.999. Para filtrar por `created_at` (timestamptz) sin
 * que se recorra al día equivocado por la diferencia de zona horaria.
 * Correcto todo el año (respeta el horario de verano).
 */
export function rangoDiaLocal(fecha: string): { start: string; end: string } {
  const offsetMin = (d: Date): number => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const p: Record<string, string> = {}
    for (const part of dtf.formatToParts(d)) p[part.type] = part.value
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
    return (asUTC - d.getTime()) / 60000
  }
  const naiveStart = new Date(`${fecha}T00:00:00Z`)
  const off = offsetMin(naiveStart)
  const start = new Date(naiveStart.getTime() - off * 60000)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Devuelve la fecha local de hoy + n días en formato YYYY-MM-DD */
export const hoyMasDias = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}
