// Texto de graduación por ojo para órdenes de laboratorio: "ESF / CIL / EJE°"
// Regla: si hay cilindro o eje, SIEMPRE van las tres posiciones. Una esfera vacía se escribe 0.00
// para que el cilindro nunca se lea como esfera (antes se recorría y el laboratorio se confundía).
export function textoOjo(esf?: string | number | null, cil?: string | number | null, eje?: string | number | null): string {
  const v = (x: unknown) => (x == null ? '' : String(x).trim())
  const e = v(esf), c = v(cil), x = v(eje)
  if (!e && !c && !x) return ''
  if (!c && !x) return e
  return `${e || '0.00'} / ${c || '0.00'}${x ? ` / ${x}°` : ''}`
}

// ─────────────────────────────────────────────────────────────
// Monofocal con receta que trae adición: ¿para qué visión es?
//   lejos         → esfera tal cual, sin adición
//   cerca         → esfera + adición de cada ojo, sin adición
//   personalizada → esfera + el valor que se capture (p. ej. intermedio), sin adición
// El cilindro y el eje no cambian. Al laboratorio solo le llega la graduación final.
// ─────────────────────────────────────────────────────────────
export type UsoMonofocal = 'lejos' | 'cerca' | 'personalizada'
export type RecetaLab = {
  od_esfera?: string | null; od_cilindro?: string | null; od_eje?: string | null; od_add?: string | null
  oi_esfera?: string | null; oi_cilindro?: string | null; oi_eje?: string | null; oi_add?: string | null
}
export type OjoLab = { esf: string; cil: string; eje: string }

const num = (x: unknown) => { const n = parseFloat(String(x ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
const s = (x: unknown) => (x == null ? '' : String(x).trim())

// Suma a la esfera y la deja con signo y dos decimales ("+1.25", "-0.50", "0.00")
export function sumarEsfera(esf: string | null | undefined, delta: number): string {
  const r = Math.round((num(esf) + delta) * 100) / 100
  if (Math.abs(r) < 0.001) return '0.00'
  return r > 0 ? `+${r.toFixed(2)}` : r.toFixed(2)
}

export const tieneAdicion = (r?: RecetaLab | null) => !!r && (num(r.od_add) !== 0 || num(r.oi_add) !== 0)

// ¿El par es monofocal? (nombre de mica o paquete con "monofocal" y sin progresivo/bifocal)
export function esParMonofocal(nombresMica: string[]): boolean {
  const t = nombresMica.join(' ').toUpperCase()
  return /MONOFOCAL/.test(t) && !/PROGRES|BIFOCAL/.test(t)
}

// Graduación que va al laboratorio, por ojo, según el uso del monofocal
export function graduacionLab(r: RecetaLab | null | undefined, uso?: UsoMonofocal | null, personal?: number | null):
  { od: OjoLab; oi: OjoLab; add: string } {
  const ojo = (e: unknown, c: unknown, x: unknown): OjoLab => ({ esf: s(e), cil: s(c), eje: s(x) })
  if (!r) return { od: ojo('', '', ''), oi: ojo('', '', ''), add: '' }
  const addOd = num(r.od_add) || num(r.oi_add), addOi = num(r.oi_add) || num(r.od_add)
  if (!uso) return { od: ojo(r.od_esfera, r.od_cilindro, r.od_eje), oi: ojo(r.oi_esfera, r.oi_cilindro, r.oi_eje), add: s(r.od_add) || s(r.oi_add) }
  if (uso === 'lejos') return { od: ojo(r.od_esfera, r.od_cilindro, r.od_eje), oi: ojo(r.oi_esfera, r.oi_cilindro, r.oi_eje), add: '' }
  const dOd = uso === 'cerca' ? addOd : (personal ?? 0)
  const dOi = uso === 'cerca' ? addOi : (personal ?? 0)
  return {
    od: ojo(sumarEsfera(r.od_esfera, dOd), r.od_cilindro, r.od_eje),
    oi: ojo(sumarEsfera(r.oi_esfera, dOi), r.oi_cilindro, r.oi_eje),
    add: '',
  }
}
