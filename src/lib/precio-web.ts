// ─────────────────────────────────────────────────────────────
// PRECIO WEB de gonmx.com — fuente única de las reglas
//   · Armazones publicados en gonmx.com: −60% sobre el precio de lista
//     (si el armazón trae una promo GON mayor, se usa esa)
//   · Micas y filtros que se venden en la página: −15%
//   · Todo lo demás (lentes de contacto, consumibles, servicios, paquetes,
//     Varilux, Kodak, Transitions, Crizal, Younger…) va a precio normal.
// gonmx.com lee estos mismos precios de /api/public/precios-web y en la óptica
// el código WEB-XXXXX aplica exactamente estos descuentos.
// ─────────────────────────────────────────────────────────────

export const DESC_WEB_ARMAZON = 60
export const DESC_WEB_MICAS = 15

// Micas de la página: visión × material (Bifocal no maneja Ultra Slim Pro)
export const MICAS_WEB = [
  'MON-ESS', 'MON-SHD', 'MON-PPL', 'MON-USL', 'MON-USP',
  'BIF-ESS', 'BIF-SHD', 'BIF-PPL', 'BIF-USL',
  'PRO-ESS', 'PRO-SHD', 'PRO-PPL', 'PRO-USL', 'PRO-USP',
] as const

// Filtros de la página
export const FILTROS_WEB = ['FIL-AR', 'FIL-BL', 'FIL-FC', 'FIL-POL', 'FIL-TIN'] as const

const LENTES_WEB: readonly string[] = [...MICAS_WEB, ...FILTROS_WEB]

// SKU base de un renglón de la venta (el fotocromático puede traer "|mica" pegado)
const base = (sku: string) => String(sku || '').toUpperCase().split('|')[0].trim()

export const esMicaOFiltroWeb = (sku: string) => LENTES_WEB.includes(base(sku))

// % de descuento web de un armazón según su promo GON
export const descWebArmazon = (descuentoGon?: number | null) =>
  Math.min(95, Math.max(DESC_WEB_ARMAZON, Number(descuentoGon) || 0))

// % que le toca a un renglón con código web. `armazones` = { 'VRL-1006': 60, … } (modelos publicados en GON)
export function descuentoWebRenglon(sku: string, armazones: Record<string, number>): number {
  const s = base(sku)
  if (esMicaOFiltroWeb(s)) return DESC_WEB_MICAS
  if (armazones[s] != null) return armazones[s]
  // Armazón por color: VRL-1006-01 → modelo VRL-1006
  const modelo = s.replace(/-\d{2}$/, '')
  if (modelo !== s && armazones[modelo] != null) return armazones[modelo]
  return 0
}
