// Datos para la web de un armazón: valores permitidos (una sola lista para OptiOS, Verly y GON).
// Se guardan en minúsculas/claves fijas; cada página los muestra en su idioma.

export const GENEROS = [
  { v: 'hombre', es: 'Hombre', en: 'Men' },
  { v: 'mujer', es: 'Mujer', en: 'Women' },
  { v: 'unisex', es: 'Unisex', en: 'Unisex' },
  { v: 'nino', es: 'Niño', en: 'Kids' },
] as const

export const FORMAS = [
  { v: 'rectangle', es: 'Rectangular', en: 'Rectangle' },
  { v: 'square', es: 'Cuadrado', en: 'Square' },
  { v: 'round', es: 'Redondo', en: 'Round' },
  { v: 'oval', es: 'Ovalado', en: 'Oval' },
  { v: 'aviator', es: 'Aviador', en: 'Aviator' },
  { v: 'cat-eye', es: 'Cat-eye', en: 'Cat-eye' },
  { v: 'hexagonal', es: 'Hexagonal', en: 'Hexagonal' },
] as const

// En México: completo / ranurado (con hilo de nylon abajo) / tres piezas (sin aro, atornillado a la mica)
export const AROS = [
  { v: 'completo', es: 'Completo', en: 'Full-rim' },
  { v: 'ranurado', es: 'Ranurado', en: 'Semi-rimless' },
  { v: 'tres_piezas', es: 'Tres piezas', en: 'Rimless' },
] as const

export const ETIQUETAS = [
  { v: 'nuevo', es: 'Nuevo', en: 'New' },
  { v: 'popular', es: 'Popular', en: 'Popular' },
  { v: 'oferta', es: 'Oferta', en: 'Sale' },
] as const

const vals = (l: readonly { v: string }[]) => new Set(l.map(x => x.v))
export const VALIDOS: Record<string, Set<string>> = {
  genero: vals(GENEROS), forma: vals(FORMAS), aro: vals(AROS), badge: vals(ETIQUETAS),
}

// Talla según el ANCHO TOTAL aproximado del armazón (estándar de ópticas):
//   ancho total ≈ 2 × mica + puente + ~10 mm de los costados
//   S (cara chica) < 130 mm · M 130–139 mm · L 140–145 mm · XL ≥ 146 mm
// Ej. 52-18-145 → 2×52 + 18 + 10 = 132 mm → M
export function tallaDeMedidas(medidas: string | null | undefined): { mica: number; puente: number; total: number; talla: 'S' | 'M' | 'L' | 'XL' } | null {
  const nums = String(medidas ?? '').match(/\d{2,3}/g)?.map(Number) ?? []
  const mica = nums[0], puente = nums[1]
  if (!mica || !puente || mica < 35 || mica > 70 || puente < 10 || puente > 30) return null
  const total = 2 * mica + puente + 10
  const talla = total < 130 ? 'S' : total < 140 ? 'M' : total < 146 ? 'L' : 'XL'
  return { mica, puente, total, talla }
}
