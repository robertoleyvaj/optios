// OptiOS · Cálculo de vacaciones conforme LFT "Vacaciones Dignas" (2023)
// Tabla: 1er año 12, 2° 14, 3° 16, 4° 18, 5° 20, luego +2 cada 5 años.
const TZ = 'America/Tijuana'

/** Años completos de antigüedad desde la fecha de ingreso. */
export function aniosCumplidos(fechaIngreso: string): number {
  const ini = new Date(fechaIngreso + 'T12:00:00')
  const hoy = new Date()
  let a = hoy.getFullYear() - ini.getFullYear()
  const m = hoy.getMonth() - ini.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < ini.getDate())) a--
  return Math.max(0, a)
}

/** Días de vacaciones que le corresponden por ley según su antigüedad. */
export function diasPorLey(fechaIngreso: string | null): number {
  if (!fechaIngreso) return 0
  const a = aniosCumplidos(fechaIngreso)
  if (a < 1) {
    // Primer año: proporcional a los meses trabajados (máx 12).
    const ini = new Date(fechaIngreso + 'T12:00:00')
    const hoy = new Date()
    let meses = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth())
    if (hoy.getDate() < ini.getDate()) meses--
    return Math.max(0, Math.min(12, meses))
  }
  if (a <= 5) return 10 + a * 2                 // 1→12, 2→14, 3→16, 4→18, 5→20
  return 20 + Math.ceil((a - 5) / 5) * 2        // 6-10→22, 11-15→24, 16-20→26…
}

/** Fecha (YYYY-MM-DD) del inicio del año de servicio actual (último aniversario). */
export function inicioAnioServicio(fechaIngreso: string): string {
  const ini = new Date(fechaIngreso + 'T12:00:00')
  const a = aniosCumplidos(fechaIngreso)
  const aniv = new Date(ini)
  aniv.setFullYear(ini.getFullYear() + a)
  return aniv.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Días naturales (inclusivos) entre dos fechas YYYY-MM-DD. */
export function diasEntre(inicio: string, fin: string): number {
  const a = new Date(inicio + 'T12:00:00').getTime()
  const b = new Date(fin + 'T12:00:00').getTime()
  if (b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}
