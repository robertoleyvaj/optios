// ─────────────────────────────────────────
// Cupones de descuento en ticket
// ─────────────────────────────────────────

/** Tabulador: monto mínimo de compra → descuento fijo en pesos */
const TABULADOR: { min: number; max: number; cupon: number }[] = [
  { min:   500, max:   999, cupon:   50 },
  { min:  1000, max:  1999, cupon:  100 },
  { min:  2000, max:  3999, cupon:  200 },
  { min:  4000, max:  5999, cupon:  300 },
  { min:  6000, max:  7999, cupon:  500 },
  { min:  8000, max:  9999, cupon:  750 },
  { min: 10000, max: Infinity, cupon: 1000 },
]

/** Vigencia del cupón en días */
export const VIGENCIA_CUPON_DIAS = 60

/** Calcula el monto del cupón según el total de la compra. Retorna 0 si no aplica. */
export function calcularCupon(totalCompra: number): number {
  const rango = TABULADOR.find(r => totalCompra >= r.min && totalCompra <= r.max)
  return rango?.cupon ?? 0
}

/** Genera un código alfanumérico corto y legible (ej: GON-A3X9) */
export function generarCodigoCupon(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I para evitar confusión
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `GON-${code}`
}

/** Fecha de vencimiento (ISO string) a partir de hoy */
export function fechaVencimientoCupon(fechaVenta: string): string {
  const d = new Date(fechaVenta)
  d.setDate(d.getDate() + VIGENCIA_CUPON_DIAS)
  return d.toISOString().slice(0, 10)
}

/** HTML del cupón para ticket térmico 58mm */
export function cuponTicketHtml(codigo: string, monto: number, vence: string): string {
  return `
<div class="cupon-sep">✂ - - - - - - - - - - - - - - - - - -</div>
<div class="cupon-box">
  <div class="cupon-titulo">¡CUPÓN DE DESCUENTO!</div>
  <div class="cupon-monto">$${monto.toLocaleString('es-MX')} MXN</div>
  <div class="cupon-codigo">${codigo}</div>
  <div class="cupon-detalle">
    Válido hasta: <b>${vence}</b><br/>
    Aplica en lentes y armazones.<br/>
    No acumulable. Un uso por cupón.
  </div>
</div>`
}

/** CSS del cupón para el ticket térmico */
export const cuponTicketCss = `
  .cupon-sep { text-align: center; font-size: 3.5mm; margin: 4mm 0 1mm; letter-spacing: 0.5mm; }
  .cupon-box { border: 0.5mm dashed #000; padding: 3mm 2mm; text-align: center; margin-bottom: 2mm; }
  .cupon-titulo { font-size: 3.8mm; font-weight: 900; letter-spacing: 0.3mm; margin-bottom: 2mm; }
  .cupon-monto { font-size: 6mm; font-weight: 900; margin-bottom: 1.5mm; }
  .cupon-codigo { font-size: 4.5mm; font-weight: 900; letter-spacing: 1mm; border: 0.4mm solid #000; display: inline-block; padding: 1.5mm 3mm; margin-bottom: 2mm; }
  .cupon-detalle { font-size: 2.8mm; line-height: 1.6; }
`
