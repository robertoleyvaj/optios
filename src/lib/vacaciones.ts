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

/**
 * Bloque completo de días que le corresponden en el año de servicio actual
 * (sin proporcional). Primer año = 12; de ahí la tabla de ley.
 */
export function bloqueAnual(fechaIngreso: string | null): number {
  if (!fechaIngreso) return 0
  const a = aniosCumplidos(fechaIngreso)
  if (a < 1) return 12
  if (a <= 5) return 10 + a * 2
  return 20 + Math.ceil((a - 5) / 5) * 2
}

/**
 * Días ya "desbloqueados" a la fecha: el bloque anual se libera poco a poco
 * a lo largo del año de servicio (1 día cada ~365/bloque días).
 */
export function diasDesbloqueados(fechaIngreso: string | null): number {
  if (!fechaIngreso) return 0
  const total = bloqueAnual(fechaIngreso)
  if (total <= 0) return 0
  const inicio = new Date(inicioAnioServicio(fechaIngreso) + 'T12:00:00').getTime()
  const hoy = new Date().getTime()
  const dias = Math.max(0, Math.min(365, Math.floor((hoy - inicio) / 86400000)))
  return Math.min(total, Math.floor((total * dias) / 365))
}

/** Días que faltan para que se desbloquee el siguiente día de vacaciones. */
export function diasParaSiguiente(fechaIngreso: string | null): number {
  if (!fechaIngreso) return 0
  const total = bloqueAnual(fechaIngreso)
  if (total <= 0) return 0
  const inicio = new Date(inicioAnioServicio(fechaIngreso) + 'T12:00:00').getTime()
  const hoy = new Date().getTime()
  const dias = Math.max(0, Math.floor((hoy - inicio) / 86400000))
  const desbloq = Math.min(total, Math.floor((total * dias) / 365))
  if (desbloq >= total) return 0
  const diaObjetivo = Math.ceil(((desbloq + 1) * 365) / total)
  return Math.max(0, diaObjetivo - dias)
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

// ── Día de descanso ──
const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}
export const OPCIONES_DESCANSO = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'variable']
function descansoNum(t: string | null): number {
  return t && t in DIAS_SEMANA ? DIAS_SEMANA[t] : -1  // 'variable' o null → no excluye ninguno
}

// ── Festivos oficiales (LFT Art. 74) ──
function nthMonday(year: number, month0: number, n: number): number {
  const d = new Date(year, month0, 1)
  let count = 0
  while (d.getMonth() === month0) {
    if (d.getDay() === 1) { count++; if (count === n) return d.getDate() }
    d.setDate(d.getDate() + 1)
  }
  return -1
}
/** ¿La fecha (YYYY-MM-DD) es festivo (de ley o cierre de la óptica)? */
export function esFestivo(fecha: string): boolean {
  const [y, m, dd] = fecha.split('-').map(Number)
  // Descanso obligatorio de ley (LFT Art. 74)
  if (m === 1 && dd === 1) return true                    // Año nuevo
  if (m === 5 && dd === 1) return true                    // Día del trabajo
  if (m === 9 && dd === 16) return true                   // Independencia
  if (m === 12 && dd === 25) return true                  // Navidad
  if (m === 2 && dd === nthMonday(y, 1, 1)) return true   // 1er lunes de febrero
  if (m === 3 && dd === nthMonday(y, 2, 3)) return true   // 3er lunes de marzo
  if (m === 11 && dd === nthMonday(y, 10, 3)) return true // 3er lunes de noviembre
  // Cierres de la óptica (GON)
  if (m === 12 && dd === 24) return true                  // Nochebuena — óptica cierra
  if (m === 12 && dd === 31) return true                  // Fin de año — óptica cierra
  return false
}

/** 'MM-DD' de una fecha YYYY-MM-DD, o null. */
function mmdd(fecha: string | null): string | null {
  if (!fecha) return null
  const p = fecha.split('-')
  return p.length >= 3 ? `${p[1]}-${p[2].slice(0, 2)}` : null
}

/**
 * Días de vacaciones que consume un rango: días laborables, excluyendo el día
 * de descanso semanal del empleado, los festivos (ley + cierres) y su cumpleaños
 * (descanso pagado de la óptica).
 */
export function diasVacaciones(inicio: string, fin: string, diaDescanso: string | null, fechaNacimiento?: string | null): number {
  const rest = descansoNum(diaDescanso)
  const cumple = mmdd(fechaNacimiento ?? null)
  const d = new Date(inicio + 'T12:00:00')
  const end = new Date(fin + 'T12:00:00')
  if (end < d) return 0
  let n = 0
  while (d <= end) {
    const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const iso = `${d.getFullYear()}-${md}`
    const esCumple = cumple != null && md === cumple
    if (d.getDay() !== rest && !esFestivo(iso) && !esCumple) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}
