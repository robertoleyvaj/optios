// Ticket de venta (impresora térmica 58 mm), versión compacta.
// Lo usan Nueva venta (al guardar) y el Historial (reimprimir), para que siempre salgan iguales.
// Términos y garantías completos viven en gonmx.com/terminos (el ticket solo remite ahí).
import { SUCURSAL_CONFIG } from '@/lib/sucursales'
import { cuponTicketCss } from '@/lib/cupones'

export type DatosTicketVenta = {
  sucursal: string
  fecha: string
  hora: string
  folio: string
  atendio?: string
  paciente?: string
  telefono?: string
  productosRows: string          // <tr><td class="tc">…</td><td class="td">…</td><td class="tp">…</td></tr>
  subtotal?: number
  descuentoCupon?: number
  cuponCodigo?: string
  total: number
  pagado: number
  metodo: string                 // etiqueta de forma de pago (Efectivo, Tarjeta…)
  saldo: number
  fechaEntrega?: string
  logo?: string
  cuponHtml?: string             // cupón de descuento generado (va al final)
}

const $$ = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`

export function ticketVentaHtml(d: DatosTicketVenta): string {
  const cfg = SUCURSAL_CONFIG[d.sucursal]
  const nombre = (cfg?.nombreLinea1 ?? d.sucursal).toUpperCase()
  const nombre2 = cfg?.nombreLinea2 ? cfg.nombreLinea2.toUpperCase() : ''
  const conCupon = (d.descuentoCupon ?? 0) > 0

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${d.folio}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 3.2mm; font-weight: 600; color: #000; background: #fff;
         width: 48mm; padding: 1mm 1.5mm 4mm 1.5mm; overflow: visible; -webkit-font-smoothing: none; }
  ${cuponTicketCss}
  .hdr { text-align: center; padding-bottom: 1.5mm; border-bottom: 0.5mm solid #000; margin-bottom: 1.5mm; }
  .logo { max-width: 34mm; max-height: 14mm; object-fit: contain; margin: 1mm auto 1mm; display: block; }
  .b1 { font-size: 4.4mm; font-weight: 900; line-height: 1.15; }
  .b2 { font-size: 3.4mm; font-weight: 900; line-height: 1.2; }
  .dt { font-size: 2.9mm; margin-top: 0.8mm; }
  .row { display: flex; justify-content: space-between; gap: 1mm; line-height: 1.45; }
  .info { padding-bottom: 1.5mm; border-bottom: 0.4mm dashed #000; margin-bottom: 1mm; font-size: 3mm; }
  .info b { font-weight: 900; }
  table.prods { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 1mm; font-size: 3mm; }
  table.prods th { border-bottom: 0.4mm solid #000; padding: 1mm 0.6mm; text-align: left; font-weight: 900; font-size: 2.8mm; }
  table.prods td { padding: 0.8mm 0.6mm; vertical-align: top; line-height: 1.3; word-break: break-word; overflow-wrap: anywhere; }
  table.prods th.tp, table.prods td.tp { text-align: right; }
  .tc { width: 5mm; text-align: center; }
  .tp { text-align: right; width: 13mm; white-space: nowrap; }
  .totales { border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 1.2mm 0; font-size: 3.2mm; }
  .tot { font-size: 4.4mm; font-weight: 900; }
  .resta { font-size: 4mm; font-weight: 900; }
  .nota { font-size: 2.9mm; line-height: 1.4; padding: 1.5mm 0; border-bottom: 0.4mm dashed #000; text-align: center; }
  .firma { margin: 5mm 0 1.5mm; font-size: 2.9mm; }
  .firma .ln { border-bottom: 0.4mm solid #000; height: 5mm; }
  .firma .lb { text-align: center; margin-top: 0.8mm; }
  .pie { border-top: 0.5mm solid #000; padding-top: 1.5mm; text-align: center; font-size: 2.9mm; line-height: 1.5; }
  .gracias { font-weight: 900; font-size: 3.3mm; margin-top: 1mm; }
  * { page-break-inside: avoid; break-inside: avoid; }
  .tip { display: block; background: #fff8e1; border: 1px solid #e5a; padding: 5px 6px; margin-bottom: 8px; font-size: 9px; line-height: 1.5; }
  @media print { .tip { display: none; } }
</style></head><body>

<div class="tip">Configurar impresión: <b>Márgenes → Ninguno</b> · Sin encabezados/pies</div>

<div class="hdr">
  ${d.logo ? `<img src="${d.logo}" class="logo" alt="" />` : ''}
  <div class="b1">${nombre}</div>
  ${nombre2 ? `<div class="b2">${nombre2}</div>` : ''}
  <div class="dt">${d.fecha} · ${d.hora}</div>
</div>

<div class="info">
  <div class="row"><span>Folio: <b>${d.folio}</b></span>${d.atendio ? `<span>Atendió: ${d.atendio}</span>` : ''}</div>
  ${d.paciente ? `<div>Paciente: ${d.paciente}</div>` : ''}
  ${d.telefono ? `<div>Tel: ${d.telefono}</div>` : ''}
</div>

<table class="prods">
  <thead><tr><th class="tc">#</th><th>DESCRIPCIÓN</th><th class="tp">PRECIO</th></tr></thead>
  <tbody>${d.productosRows || '<tr><td colspan="3" style="text-align:center;padding:3mm 1mm">---</td></tr>'}</tbody>
</table>

<div class="totales">
  ${conCupon ? `<div class="row"><span>Subtotal</span><span>${$$(d.subtotal ?? 0)}</span></div>
  <div class="row"><span>Cupón ${d.cuponCodigo ?? ''}</span><span>−${$$(d.descuentoCupon ?? 0)}</span></div>` : ''}
  <div class="row tot"><span>TOTAL</span><span>${$$(d.total)}</span></div>
  <div class="row"><span>Pagó (${d.metodo})</span><span>${$$(d.pagado)}</span></div>
  ${d.saldo > 0 ? `<div class="row resta"><span>RESTA</span><span>${$$(d.saldo)}</span></div>` : ''}
</div>

<div class="nota">
  Entrega: ${d.fechaEntrega ? `<b>${d.fechaEntrega}</b>` : '3 a 5 días hábiles'}<br>
  Conserve este ticket. Términos y garantías en<br><b>gonmx.com/terminos</b>
</div>

<div class="firma"><div class="ln"></div><div class="lb">Nombre y firma del comprador</div></div>

<div class="pie">
  ${cfg?.direccion ? `<div>${cfg.direccion}</div>` : ''}
  <div>Tel ${cfg?.telefono ?? '661 612 0316'} · WA ${cfg?.whatsapp ?? '664 834 3018'}</div>
  <div class="gracias">¡Gracias por su compra!</div>
</div>

${d.cuponHtml ?? ''}

</body></html>`
}
