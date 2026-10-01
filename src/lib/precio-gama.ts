// Gamas de precio y precio de Verly.
// - El encargado elige la gama (básico/estándar/premium); el sistema pone un precio
//   "inteligente" dentro del rango de la marca (nunca cerrado: 879, 1189, 1467…).
// - Precio Verly (USD) = precio en pesos ÷ tipo de cambio × 50%, redondeado sin centavos.

export const GAMAS = [
  { v: 'basico', label: 'Básico' },
  { v: 'estandar', label: 'Estándar' },
  { v: 'premium', label: 'Premium' },
] as const
export type Gama = typeof GAMAS[number]['v']
export type Rango = { grupo: string; gama: Gama; min: number; max: number }

// Precio dentro del rango que no termine en 0 ni en 5 (no se ve "cerrado")
export function precioInteligente(min: number, max: number, azar = Math.random()): number {
  let p = Math.round(min + azar * (max - min))
  if (p % 10 === 0 || p % 10 === 5) p += p + 4 <= max ? 4 : -2
  if (p % 100 < 10) p += p + 13 <= max ? 13 : -11   // evita 1,003 / 1,207
  return Math.min(max, Math.max(min, p))
}

export function precioVerlyUSD(mxn: number | null | undefined, tc: number | null | undefined): number | null {
  const p = Number(mxn), t = Number(tc)
  if (!p || !t || t <= 0) return null
  return Math.round((p / t) * 0.5)
}

export const enRango = (p: number, r?: { min: number; max: number } | null) => !!r && p >= r.min && p <= r.max
