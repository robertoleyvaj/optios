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
