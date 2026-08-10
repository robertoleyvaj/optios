'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, Filter,
  CreditCard, Banknote, Building2, X, Printer,
  ChevronDown, Clock, CheckCircle2, AlertCircle, Pencil, Trash2,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'
import { registrarComisionTerminal } from '@/lib/comisiones'
import { getSucursalActual, getUsuarioLocal } from '@/lib/session'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type Pago = { fecha: string; monto: number; metodo: string; pagos_venta_id?: string }
type ItemVenta = { nombre: string; cantidad: number; precio: number; descuento: number; sku?: string }
type Venta = {
  id: string            // folio (V-0001)
  uuid: string          // Supabase id real
  cliente: string
  telefono: string
  sucursal: string
  items: ItemVenta[]
  total: number
  metodo: string
  modoPago: 'liquidada' | 'diferida'
  pagos: Pago[]
  saldo_db: number      // saldo real de la DB (fuente de verdad)
  fecha: string
  hora: string
  vendedor: string
  fechaEntrega: string
}

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────
const metodoBadge: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  efectivo:      { label: 'Efectivo',      icon: Banknote,   cls: 'bg-emerald-50 text-emerald-700' },
  debito:        { label: 'T. Débito',     icon: CreditCard, cls: 'bg-blue-50 text-blue-700' },
  credito:       { label: 'T. Crédito',   icon: CreditCard, cls: 'bg-purple-50 text-purple-700' },
  tarjeta:       { label: 'Tarjeta',       icon: CreditCard, cls: 'bg-blue-50 text-blue-700' },
  transferencia: { label: 'Transferencia', icon: Building2,  cls: 'bg-violet-50 text-violet-700' },
  deposito:      { label: 'Depósito',      icon: Building2,  cls: 'bg-violet-50 text-violet-700' },
  otros:         { label: 'Otros',         icon: Clock,      cls: 'bg-zinc-100 text-zinc-600' },
}

const METODOS_ABONO = ['efectivo', 'debito', 'credito', 'transferencia']
const SUCURSALES = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function saldoPendiente(v: Venta) {
  // Usar saldo_db como fuente de verdad (refleja todos los abonos en DB)
  return v.saldo_db
}

function fmtFecha(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
function imprimirTicket(v: Venta, logo = '', atendioReceta = '') {
  // Usar la fecha/hora originales de la venta
  const fechaFmt = v.fecha
  const horaFmt  = v.hora

  // Quién atendió: "Nombre en receta" si existe; si no, arma "Nombre A."
  const _vp = (v.vendedor || '').trim().split(/\s+/)
  const vendedorCorto = atendioReceta.trim() || (_vp.length >= 2 ? `${_vp[0]} ${_vp[1][0].toUpperCase()}.` : _vp[0] || '')

  const productosRows = v.items.map((item) => {
    const precioUnit = item.precio * (1 - item.descuento / 100)
    const sub = precioUnit * item.cantidad
    const descStr = item.descuento > 0 ? `<br><small>(−${item.descuento}%)</small>` : ''
    return `<tr>
      <td class="tc">${item.cantidad}</td>
      <td>${item.nombre}${descStr}</td>
      <td class="tp">$${sub.toLocaleString('es-MX')}</td>
    </tr>`
  }).join('')

  const saldo = saldoPendiente(v)
  const pagadoTotal = v.pagos.reduce((s, p) => s + p.monto, 0)
  const mAbbr = (m: string) => (({ efectivo: 'Efvo', debito: 'Déb', credito: 'Créd', transferencia: 'Transf', banco: 'Banco' } as Record<string, string>)[m] || m)

  const pagosRows = v.pagos.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${p.fecha}</td><td>${mAbbr(p.metodo)}</td><td class="r">$${p.monto.toLocaleString('es-MX')}</td></tr>`
  ).join('')

  const pagosHtml = v.pagos.length > 0 ? `
    <div class="ph-title"><div class="ph-line"></div><div class="ph-txt">PAGOS REALIZADOS</div><div class="ph-line"></div></div>
    <table class="pagos">
      <tr><th>#</th><th>Fecha</th><th>Método</th><th class="r">Pago</th></tr>
      ${pagosRows}
    </table>
    <div class="pagos-total-row"><span>TOTAL PAGADO:</span><span>$${pagadoTotal.toLocaleString('es-MX')}</span></div>
    ${saldo > 0 ? `<div class="saldo-box">
      <div class="saldo-lbl">Cantidad restante para liquidar el pago:</div>
      <div class="saldo-val">$${saldo.toLocaleString('es-MX')}</div>
    </div>` : ''}
  ` : ''

  const win = window.open('', '_blank', 'width=230,height=900')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${v.id}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 3.3mm;
    font-weight: 600;
    color: #000;
    background: #fff;
    width: 48mm;
    padding: 1mm 1.5mm 4mm 1.5mm;
    overflow: visible;
    -webkit-font-smoothing: none;
  }
  .hdr { text-align: center; padding-bottom: 2mm; border-bottom: 0.5mm solid #000; margin-bottom: 3mm; }
  .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; margin: 4mm auto 0; display: block; }
  .b1  { font-size: 5.2mm; font-weight: 900; line-height: 1.15; }
  .b2  { font-size: 3.8mm; font-weight: 900; line-height: 1.2; }
  .dt  { font-size: 3mm; margin-top: 1.5mm; }
  .info-sec { margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 0.4mm dashed #000; }
  .irow { display: flex; padding: 1mm 0; font-size: 3.5mm; gap: 1mm; }
  .ilbl { font-weight: 700; min-width: 18mm; flex-shrink: 0; }
  .folio { text-align: center; border: 0.5mm solid #000; padding: 2.5mm 1mm; margin-bottom: 3mm; }
  .folio-lbl { font-size: 3mm; }
  .folio-num { font-size: 5.2mm; font-weight: 900; margin-top: 1mm; }
  table.prods { width: 100%; border-collapse: collapse; margin-bottom: 2mm; font-size: 3.2mm; }
  table.prods th { border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 1.5mm 1mm; text-align: left; font-weight: 900; }
  table.prods td { padding: 1.5mm 1mm; vertical-align: top; line-height: 1.4; }
  .tc { width: 6mm; text-align: center; }
  .tp { text-align: right; width: 14mm; }
  .total-row { display: flex; justify-content: space-between; align-items: baseline; font-weight: 900; font-size: 4.6mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2.5mm 0; }
  .pago-line { display: flex; justify-content: space-between; font-weight: 700; font-size: 3.4mm; padding: 2mm 0 0; margin-bottom: 3mm; }
  .ph-title { text-align: center; font-weight: 900; font-size: 3.2mm; border-top: 0.4mm dashed #000; border-bottom: 0.4mm dashed #000; padding: 1.5mm 0; margin: 2.5mm 0 2mm; }
  .ph-line { display: none; }
  table.pagos { width: 100%; border-collapse: collapse; font-size: 2.7mm; }
  table.pagos td, table.pagos th { padding: 0.8mm 0.5mm; }
  table.pagos th { text-align: left; font-weight: 700; padding: 1mm; border-bottom: 0.4mm solid #000; }
  table.pagos td { padding: 1mm; }
  .r { text-align: right; }
  .pagos-total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 3.2mm; border-top: 0.5mm solid #000; padding-top: 1.5mm; margin: 1.5mm 0 3mm; }
  .saldo-box { border: 0.5mm solid #000; padding: 3mm 2mm; text-align: center; margin-bottom: 3mm; }
  .saldo-lbl { font-size: 3mm; line-height: 1.4; }
  .saldo-val { font-size: 5.2mm; font-weight: 900; margin-top: 1.5mm; }
  .icard { padding: 2.5mm 0; border-top: 0.4mm dashed #000; font-size: 3mm; line-height: 1.5; }
  .firma-sec { margin: 6mm 0 3mm; }
  .fline-rule { border-bottom: 0.4mm solid #000; height: 6mm; }
  .flbl { font-size: 3mm; text-align: center; margin-top: 1mm; }
  .footer { border-top: 0.5mm solid #000; padding-top: 3mm; margin-top: 2mm; text-align: center; font-size: 3mm; line-height: 2; }
  .faddr { font-weight: 700; line-height: 1.4; margin-bottom: 1.5mm; }
  .fatendio { font-weight: 900; }
  .fbar { margin-top: 2.5mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2.5mm 0; font-weight: 900; font-size: 3.5mm; }
  * { page-break-inside: avoid; break-inside: avoid; }
  .tip { display: block; background: #fff8e1; border: 1px solid #e5a; padding: 5px 6px; margin-bottom: 8px; font-size: 9px; line-height: 1.5; }
  @media print { .tip { display: none; } }
</style></head><body>

<div class="tip">Configurar impresion: <b>Margenes → Ninguno</b> · Sin encabezados/pies</div>

<div class="hdr">
  <div class="b1">${(SUCURSAL_CONFIG[v.sucursal]?.nombreLinea1 ?? v.sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[v.sucursal]?.nombreLinea2 ? `<div class="b2">${SUCURSAL_CONFIG[v.sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="dt">${fechaFmt} | ${horaFmt}</div>
</div>

<div class="info-sec">
  ${v.cliente ? `<div class="irow"><span class="ilbl">Paciente:</span><span>${v.cliente}</span></div>` : ''}
  ${v.telefono ? `<div class="irow"><span class="ilbl">Tel:</span><span>${v.telefono}</span></div>` : ''}
</div>

<div class="folio">
  <div class="folio-lbl">FOLIO DE VENTA</div>
  <div class="folio-num">${v.id}</div>
</div>

<table class="prods">
  <thead><tr><th class="tc">CANT</th><th>DESCRIPCION</th><th class="tp">PRECIO</th></tr></thead>
  <tbody>${productosRows || '<tr><td colspan="3" style="text-align:center;padding:4mm 1mm">---</td></tr>'}</tbody>
</table>

<div class="total-row"><span>TOTAL:</span><span>$${v.total.toLocaleString('es-MX')}</span></div>
<div class="pago-line"><span>Forma de pago:</span><span>${metodoBadge[v.metodo]?.label ?? v.metodo}</span></div>

${pagosHtml}

<div class="icard">${v.fechaEntrega ? `Fecha de entrega: <b>${v.fechaEntrega}</b>` : 'Fecha de entrega de 3 a 5 dias habiles a partir de la compra.'}</div>
<div class="icard">Conserve este ticket para cualquier aclaracion o garantia.</div>

<div class="firma-sec">
  <div class="fline-rule"></div>
  <div class="flbl">Nombre y firma del comprador</div>
</div>

<div class="footer">
  ${SUCURSAL_CONFIG[v.sucursal]?.direccion ? `<div class="faddr">${SUCURSAL_CONFIG[v.sucursal].direccion}</div>` : ''}
  <div>Tel. ${SUCURSAL_CONFIG[v.sucursal]?.telefono ?? '661 612 0316'} | WA ${SUCURSAL_CONFIG[v.sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[v.sucursal]?.horario ?? 'Lun-Sab 10:00-18:00'}</div>
  ${vendedorCorto ? `<div class="fatendio">Atendio: ${vendedorCorto}</div>` : ''}
  <div>${SUCURSAL_CONFIG[v.sucursal]?.web ?? 'gonmx.com'}</div>
  <div class="fbar">... Gracias por su compra! ...</div>
</div>

${logo ? `<img src="${logo}" class="logo" alt="" />` : ''}

</body></html>`)
  win.document.close()
  setTimeout(() => { win.print() }, 400)
}

// ─────────────────────────────────────────
// Impresión de COTIZACIÓN (ticket térmico 58mm)
// Sin pagos, sin firma, sin "gracias por su compra". Vigencia 15 días.
// ─────────────────────────────────────────
function imprimirCotizacion(v: Venta, logo = '', atendioReceta = '') {
  const fechaFmt = v.fecha
  const horaFmt  = v.hora

  const _vp = (v.vendedor || '').trim().split(/\s+/)
  const vendedorCorto = atendioReceta.trim() || (_vp.length >= 2 ? `${_vp[0]} ${_vp[1][0].toUpperCase()}.` : _vp[0] || '')

  const productosRows = v.items.map((item) => {
    const precioUnit = item.precio * (1 - item.descuento / 100)
    const sub = precioUnit * item.cantidad
    const descStr = item.descuento > 0 ? `<br><small>(−${item.descuento}%)</small>` : ''
    return `<tr>
      <td class="tc">${item.cantidad}</td>
      <td>${item.nombre}${descStr}</td>
      <td class="tp">$${sub.toLocaleString('es-MX')}</td>
    </tr>`
  }).join('')

  const win = window.open('', '_blank', 'width=230,height=900')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Cotización ${v.id}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 3.3mm; font-weight: 600; color: #000; background: #fff;
    width: 48mm; padding: 1mm 1.5mm 4mm 1.5mm; overflow: visible; -webkit-font-smoothing: none;
  }
  .hdr { text-align: center; padding-bottom: 2mm; border-bottom: 0.5mm solid #000; margin-bottom: 3mm; }
  .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; margin: 4mm auto 0; display: block; }
  .b1  { font-size: 5.2mm; font-weight: 900; line-height: 1.15; }
  .b2  { font-size: 3.8mm; font-weight: 900; line-height: 1.2; }
  .dt  { font-size: 3mm; margin-top: 1.5mm; }
  .info-sec { margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 0.4mm dashed #000; }
  .irow { display: flex; padding: 1mm 0; font-size: 3.5mm; gap: 1mm; }
  .ilbl { font-weight: 700; min-width: 18mm; flex-shrink: 0; }
  .folio { text-align: center; border: 0.5mm solid #000; padding: 2.5mm 1mm; margin-bottom: 3mm; }
  .folio-lbl { font-size: 3.4mm; font-weight: 900; letter-spacing: 0.3mm; }
  .folio-num { font-size: 5mm; font-weight: 900; margin-top: 1mm; }
  table.prods { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 2mm; font-size: 3.2mm; }
  table.prods th { border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 1.5mm 0.6mm; text-align: left; font-weight: 900; }
  table.prods td { padding: 1.5mm 0.6mm; vertical-align: top; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere; }
  .tc { width: 5mm; text-align: center; }
  .tp { text-align: right; width: 12mm; white-space: nowrap; }
  .total-row { display: flex; justify-content: space-between; align-items: baseline; font-weight: 900; font-size: 4.4mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2.5mm 0; }
  .vig-box { border: 0.5mm solid #000; padding: 2.5mm 2mm; text-align: center; margin: 3mm 0; font-size: 3mm; line-height: 1.5; }
  .vig-box b { font-size: 3.4mm; }
  .icard { padding: 2.5mm 0; border-top: 0.4mm dashed #000; font-size: 3mm; line-height: 1.5; text-align: center; }
  .footer { border-top: 0.5mm solid #000; padding-top: 3mm; margin-top: 2mm; text-align: center; font-size: 3mm; line-height: 2; }
  .faddr { font-weight: 700; line-height: 1.4; margin-bottom: 1.5mm; }
  .fatendio { font-weight: 900; }
  .fbar { margin-top: 2.5mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2.5mm 0; font-weight: 900; font-size: 3.3mm; }
  * { page-break-inside: avoid; break-inside: avoid; }
  .tip { display: block; background: #fff8e1; border: 1px solid #e5a; padding: 5px 6px; margin-bottom: 8px; font-size: 9px; line-height: 1.5; }
  @media print { .tip { display: none; } }
</style></head><body>

<div class="tip">Configurar impresion: <b>Margenes → Ninguno</b> · Sin encabezados/pies</div>

<div class="hdr">
  <div class="b1">${(SUCURSAL_CONFIG[v.sucursal]?.nombreLinea1 ?? v.sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[v.sucursal]?.nombreLinea2 ? `<div class="b2">${SUCURSAL_CONFIG[v.sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="dt">${fechaFmt} | ${horaFmt}</div>
</div>

<div class="info-sec">
  ${v.cliente ? `<div class="irow"><span class="ilbl">Cliente:</span><span>${v.cliente}</span></div>` : ''}
  ${v.telefono ? `<div class="irow"><span class="ilbl">Tel:</span><span>${v.telefono}</span></div>` : ''}
</div>

<div class="folio">
  <div class="folio-lbl">COTIZACIÓN</div>
  <div class="folio-num">${v.id}</div>
</div>

<table class="prods">
  <thead><tr><th class="tc">CANT</th><th>DESCRIPCION</th><th class="tp">PRECIO</th></tr></thead>
  <tbody>${productosRows || '<tr><td colspan="3" style="text-align:center;padding:4mm 1mm">---</td></tr>'}</tbody>
</table>

<div class="total-row"><span>TOTAL ESTIMADO:</span><span>$${v.total.toLocaleString('es-MX')}</span></div>

<div class="vig-box">
  <b>Cotización válida por 15 días</b><br>
  Precios sujetos a cambio sin previo aviso.
</div>

<div class="icard">Esta cotización NO es un comprobante de pago.</div>

<div class="footer">
  ${SUCURSAL_CONFIG[v.sucursal]?.direccion ? `<div class="faddr">${SUCURSAL_CONFIG[v.sucursal].direccion}</div>` : ''}
  <div>Tel. ${SUCURSAL_CONFIG[v.sucursal]?.telefono ?? '661 612 0316'} | WA ${SUCURSAL_CONFIG[v.sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[v.sucursal]?.horario ?? 'Lun-Sab 10:00-18:00'}</div>
  ${vendedorCorto ? `<div class="fatendio">Atendio: ${vendedorCorto}</div>` : ''}
  <div>${SUCURSAL_CONFIG[v.sucursal]?.web ?? 'gonmx.com'}</div>
  <div class="fbar">... Gracias por su preferencia! ...</div>
</div>

${logo ? `<img src="${logo}" class="logo" alt="" />` : ''}

</body></html>`)
  win.document.close()
  setTimeout(() => { win.print() }, 400)
}

// ─────────────────────────────────────────
// Descargar PDF en formato de hoja carta (legible, para guardar/compartir)
// ─────────────────────────────────────────
function descargarPDFDoc(v: Venta, logo = '', atendioReceta = '') {
  const esCot = v.id.startsWith('COT-')
  const titulo = esCot ? 'COTIZACIÓN' : 'NOTA DE VENTA'
  const _vp = (v.vendedor || '').trim().split(/\s+/)
  const vendedorCorto = atendioReceta.trim() || (_vp.length >= 2 ? `${_vp[0]} ${_vp[1][0].toUpperCase()}.` : _vp[0] || '')
  const cfg = SUCURSAL_CONFIG[v.sucursal]
  const filas = v.items.map(item => {
    const sub = item.precio * (1 - item.descuento / 100) * item.cantidad
    const d = item.descuento > 0 ? ` <small style="color:#888">(−${item.descuento}%)</small>` : ''
    return `<tr><td class="c">${item.cantidad}</td><td>${item.nombre}${d}</td><td class="r">$${sub.toLocaleString('es-MX')}</td></tr>`
  }).join('')
  const pagado = (v.total || 0) - (v.saldo || 0)
  const pagosHTML = (!esCot && (v.saldo || 0) > 0)
    ? `<div class="pay"><span>Pagado</span><b>$${pagado.toLocaleString('es-MX')}</b></div>
       <div class="pay saldo"><span>Saldo pendiente</span><b>$${(v.saldo || 0).toLocaleString('es-MX')}</b></div>`
    : ''
  const win = window.open('', '_blank', 'width=800,height=1000')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo} ${v.id}</title>
<style>
  @page { size: letter; margin: 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
  .wrap { max-width: 700px; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
  .brand img { max-height: 44px; margin-bottom: 6px; display: block; }
  .brand h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
  .brand p { font-size: 11px; color: #666; }
  .fb { text-align: right; }
  .fb .lbl { font-size: 10px; letter-spacing: 1.5px; color: #888; text-transform: uppercase; }
  .fb .num { font-size: 22px; font-weight: 800; }
  .fb .fec { font-size: 11px; color: #666; margin-top: 2px; }
  .cli { background: #f6f6f6; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 34px; }
  .cli span { display: block; font-size: 9.5px; color: #999; text-transform: uppercase; letter-spacing: .6px; }
  .cli b { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { text-align: left; font-size: 9.5px; letter-spacing: .6px; text-transform: uppercase; color: #999; border-bottom: 1.5px solid #ddd; padding: 9px 6px; }
  th.r, td.r { text-align: right; } th.c, td.c { text-align: center; width: 46px; }
  tbody td { padding: 10px 6px; border-bottom: 1px solid #eee; }
  .total { display: flex; justify-content: flex-end; gap: 44px; align-items: baseline; border-top: 2px solid #111; padding-top: 14px; }
  .total .l { font-size: 13px; font-weight: 700; } .total .v { font-size: 24px; font-weight: 800; }
  .pay { display: flex; justify-content: flex-end; gap: 44px; font-size: 13px; margin-top: 8px; color: #444; }
  .pay.saldo b { color: #dc2626; }
  .vig { background: #fff8e1; border: 1px solid #f0d894; border-radius: 8px; padding: 11px 15px; font-size: 12px; margin: 22px 0; }
  .foot { border-top: 1px solid #ddd; margin-top: 26px; padding-top: 14px; font-size: 11px; color: #666; line-height: 1.8; }
</style></head><body>
<div class="wrap">
  <div class="top">
    <div class="brand">
      ${logo ? `<img src="${logo}" alt="" />` : ''}
      <h1>${(cfg?.nombreLinea1 ?? v.sucursal).toUpperCase()}</h1>
      ${cfg?.nombreLinea2 ? `<p>${cfg.nombreLinea2}</p>` : ''}
    </div>
    <div class="fb"><div class="lbl">${titulo}</div><div class="num">${v.id}</div><div class="fec">${v.fecha} · ${v.hora}</div></div>
  </div>
  <div class="cli">
    ${v.cliente ? `<div><span>Cliente</span><b>${v.cliente}</b></div>` : ''}
    ${v.telefono ? `<div><span>Teléfono</span><b>${v.telefono}</b></div>` : ''}
    ${vendedorCorto ? `<div><span>Atendió</span><b>${vendedorCorto}</b></div>` : ''}
  </div>
  <table>
    <thead><tr><th class="c">Cant</th><th>Descripción</th><th class="r">Precio</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="total"><span class="l">TOTAL${esCot ? ' ESTIMADO' : ''}</span><span class="v">$${(v.total || 0).toLocaleString('es-MX')}</span></div>
  ${pagosHTML}
  ${esCot ? '<div class="vig"><b>Cotización válida por 15 días.</b> Precios sujetos a cambio sin previo aviso. No es un comprobante de pago.</div>' : ''}
  <div class="foot">
    ${cfg?.direccion ? `<div>${cfg.direccion}</div>` : ''}
    <div>Tel. ${cfg?.telefono ?? '661 612 0316'} · WhatsApp ${cfg?.whatsapp ?? '664 834 3018'} · ${cfg?.horario ?? 'Lun-Sáb 10:00-18:00'}</div>
    <div>${cfg?.web ?? 'gonmx.com'}</div>
  </div>
</div>
</body></html>`)
  win.document.close()
  setTimeout(() => { win.print() }, 400)
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function VentasPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [ventas, setVentas]         = useState<Venta[]>([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [sucursal, setSucursal]     = useState('Todas')
  const [filtroPago, setFiltroPago] = useState<'todas' | 'pendientes' | 'liquidadas' | 'cotizaciones'>(
    searchParams.get('pendientes') === '1' ? 'pendientes' : 'todas'
  )
  const [detalle, setDetalle]       = useState<Venta | null>(null)
  const [showAbono, setShowAbono]   = useState(false)
  const [ticketLogo, setTicketLogo] = useState('')
  const [recetaMap, setRecetaMap] = useState<Record<string, string>>({})

  // Logo del ticket (configurado en Ajustes)
  useEffect(() => {
    createClient().from('configuracion').select('valor').eq('clave', 'ticket_logo').maybeSingle()
      .then(({ data }) => { if (data?.valor) setTicketLogo(data.valor) })
  }, [])

  // Mapa nombre completo → nombre en receta (para el "Atendió" del ticket)
  useEffect(() => {
    createClient().from('usuarios').select('nombre, nombre_receta')
      .then(({ data }) => {
        const m: Record<string, string> = {}
        for (const u of data ?? []) if (u.nombre_receta) m[u.nombre] = u.nombre_receta
        setRecetaMap(m)
      })
  }, [])
  const [abonoMonto, setAbonoMonto]   = useState('')
  const [abonoMetodo, setAbonoMetodo] = useState('efectivo')
  const [abonoMoneda, setAbonoMoneda] = useState<'MXN' | 'USD'>('MXN')
  const [abonoTC, setAbonoTC]         = useState<number | null>(null)
  const [abonoLoadingTC, setAbonoLoadingTC] = useState(false)
  // ── Modificar venta (solo admin) ──
  const [modificar, setModificar]     = useState(false)
  const [itemsMod, setItemsMod]       = useState<ItemVenta[]>([])
  const [catalogoMod, setCatalogoMod] = useState<{ nombre: string; sku: string; precio: number; categoria: string }[]>([])
  const [buscarProd, setBuscarProd]   = useState('')
  const [guardandoMod, setGuardandoMod] = useState(false)
  const [guardandoAbono, setGuardandoAbono] = useState(false)

  const fetchAbonoTC = async () => {
    setAbonoLoadingTC(true)
    try {
      const res = await fetch('/api/tipo-cambio')
      const data = await res.json()
      if (res.ok && data?.tipoCambio) setAbonoTC(Math.round(data.tipoCambio * 100) / 100)
    } catch { /* noop */ }
    finally { setAbonoLoadingTC(false) }
  }
  const [usuarioNombre, setUsuarioNombre] = useState('')
  const [usuarioId, setUsuarioId]         = useState<string | null>(null)
  const [esAdmin, setEsAdmin]             = useState(false)

  useEffect(() => {
    cargar()
    const u = getUsuarioLocal()
    setUsuarioNombre(u.nombre ?? '')
    setUsuarioId(u.id ?? null)
    setEsAdmin(u.rol === 'administrador')
  }, [])

  // Cerrar modal con Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDetalle(null); setShowAbono(false) }
    }
    if (detalle) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [detalle])

  const cargar = async () => {
    setCargando(true)
    try {
      const supabase = createClient()

      let userSucursal = ''
      let userRol = ''
      try {
        const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
        userSucursal = u.sucursal || ''
        userRol = u.rol || ''
      } catch {}

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('ventas')
        .select(`
          id,
          folio,
          estado,
          paciente_nombre,
          paciente_telefono,
          sucursal,
          total,
          anticipo,
          saldo,
          metodo_pago,
          atendido_por,
          created_at,
          fecha_entrega,
          ventas_items(nombre, sku, cantidad, precio_unitario, descuento),
          pagos_venta(id, monto, metodo_pago, created_at, tipo)
        `)
        .neq('estado', 'cancelada')
        .order('created_at', { ascending: false })

      // Vendedor solo ve su sucursal
      if (userRol === 'vendedor' && userSucursal && userSucursal !== 'Todas') {
        q = q.eq('sucursal', userSucursal)
      }

      const { data, error } = await q
      if (error || !data) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Venta[] = data.map((v: any) => {
        const fecha = fmtFecha(v.created_at)
        const hora  = fmtHora(v.created_at)
        const anticipo = v.anticipo ?? 0
        const saldo    = v.saldo    ?? 0

        // Abonos registrados en pagos_venta (posteriores al anticipo)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pagosVenta: Pago[] = (v.pagos_venta ?? []).map((p: any) => ({
          fecha:           fmtFecha(p.created_at),
          monto:           parseFloat(p.monto) || 0,
          metodo:          p.metodo_pago ?? 'otros',
          pagos_venta_id:  p.id,
        })).sort((a: Pago, b: Pago) => a.fecha.localeCompare(b.fecha))

        // pagos_venta es la fuente de verdad completa (anticipo + abonos).
        // Solo se sintetiza desde el campo anticipo/total si NO hay pagos_venta
        // (ventas viejas antes de que existiera la tabla).
        const pagos: Pago[] = []
        if (pagosVenta.length > 0) {
          pagos.push(...pagosVenta)
        } else if (anticipo > 0) {
          pagos.push({ fecha, monto: anticipo, metodo: v.metodo_pago ?? 'otros' })
        } else if (saldo === 0) {
          pagos.push({ fecha, monto: v.total ?? 0, metodo: v.metodo_pago ?? 'otros' })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: ItemVenta[] = (v.ventas_items ?? []).map((i: any) => ({
          nombre:    i.nombre,
          sku:       i.sku ?? '',
          cantidad:  i.cantidad,
          precio:    i.precio_unitario,
          descuento: i.descuento ?? 0,
        }))

        return {
          uuid:     v.id,
          id:       v.folio ?? v.id,
          cliente:  v.paciente_nombre ?? '',
          telefono: v.paciente_telefono ?? '',
          sucursal: v.sucursal ?? '',
          items,
          total:    v.total ?? 0,
          metodo:   v.metodo_pago ?? 'otros',
          modoPago: saldo > 0 ? 'diferida' : 'liquidada',
          pagos,
          saldo_db: saldo,
          fecha,
          hora,
          vendedor: v.atendido_por ?? '',
          fechaEntrega: v.fecha_entrega ?? '',
        }
      })

      setVentas(mapped)
    } finally {
      setCargando(false)
    }
  }

  // Si venimos de Laboratorio con ?liquidar=folio, abre esa venta y su abono
  const liquidarAbierto = useRef(false)
  useEffect(() => {
    if (liquidarAbierto.current || ventas.length === 0) return
    const folio = searchParams.get('liquidar')
    if (!folio) return
    const v = ventas.find(x => x.id === folio)
    if (v) {
      liquidarAbierto.current = true
      setDetalle(v)
      setShowAbono(true)
      setAbonoMonto(String(saldoPendiente(v)))
    }
  }, [ventas, searchParams])

  const ventasFiltradas = ventas.filter(v => {
    const q = busqueda.toLowerCase()
    const matchQ = v.cliente.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) ||
      v.items.some(i => i.nombre.toLowerCase().includes(q))
    const matchS = sucursal === 'Todas' || v.sucursal === sucursal
    if (!matchQ || !matchS) return false
    const esCot = v.id.startsWith('COT-')
    // La pestaña "Cotizaciones" muestra solo cotizaciones; las demás, solo ventas reales
    if (filtroPago === 'cotizaciones') return esCot
    if (esCot) return false
    const sp = saldoPendiente(v)
    return filtroPago === 'todas'
      || (filtroPago === 'pendientes' && sp > 0)
      || (filtroPago === 'liquidadas' && sp === 0)
  })

  const registrarAbono = async () => {
    const entrada = parseFloat(abonoMonto)
    if (!detalle || isNaN(entrada) || entrada <= 0) return

    const esUSD = abonoMoneda === 'USD'
    if (esUSD && !abonoTC) { alert('No hay tipo de cambio disponible. Reintenta.'); return }

    // Monto en pesos (para saldo/caja). En USD: dólares × tipo de cambio.
    const tc = esUSD ? (abonoTC as number) : null
    const montoOrigen = esUSD ? entrada : null   // los dólares capturados
    let monto = esUSD ? Math.round(entrada * (tc as number)) : entrada

    // Validación: no permitir pagar más de lo que se debe (con tolerancia por redondeo USD)
    const saldoActual = saldoPendiente(detalle)
    const tolerancia = esUSD ? Math.max(tc as number, 20) : 1
    // Snap a liquidación exacta: si el pago cae dentro de la tolerancia del saldo
    // —arriba O abajo— por el redondeo del tipo de cambio, se liquida limpio.
    if (Math.abs(monto - saldoActual) <= tolerancia) monto = saldoActual
    if (monto > saldoActual) {
      alert(`El monto ($${monto.toLocaleString('es-MX')}) supera el saldo pendiente ($${saldoActual.toLocaleString('es-MX')}).`)
      return
    }

    // Prevenir doble clic / doble envío
    if (guardandoAbono) return
    setGuardandoAbono(true)

    const nuevoSaldo = saldoActual - monto
    const esLiquidacion = nuevoSaldo === 0
    const supabase = createClient()

    // 1. Actualizar saldo en ventas
    const { error: errVenta } = await supabase
      .from('ventas')
      .update({ saldo: nuevoSaldo })
      .eq('id', detalle.uuid)

    if (errVenta) {
      alert(`Error al actualizar la venta: ${errVenta.message}`)
      setGuardandoAbono(false)
      return
    }

    // 2. Registrar pago en pagos_venta
    // La sucursal del pago es siempre donde está trabajando hoy el usuario (check-in)
    const sucursalPago = getSucursalActual()
    const { error: errPago } = await supabase.from('pagos_venta').insert({
      venta_id:       detalle.uuid,
      folio_venta:    detalle.id,
      paciente:       detalle.cliente,
      monto,
      metodo_pago:    abonoMetodo,
      tipo:           esLiquidacion ? 'liquidacion' : 'abono',
      sucursal:       sucursalPago,
      registrado_por: usuarioNombre,
      usuario_id:     usuarioId,
      moneda:         abonoMoneda,
      monto_origen:   montoOrigen,
      tipo_cambio:    tc,
    })

    if (errPago) {
      alert(`Error al registrar el pago: ${errPago.message}`)
      setGuardandoAbono(false)
      return
    }

    // 3. Comisión terminal automática si se cobró con tarjeta
    await registrarComisionTerminal({
      metodoPago: abonoMetodo,
      monto,
      folio:      detalle.id,
      sucursal:   detalle.sucursal,
    })

    // 4. Actualizar estado local
    const fechaPago = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const nuevoPago: Pago = { fecha: fechaPago, monto, metodo: abonoMetodo }
    const ventaActualizada: Venta = {
      ...detalle,
      pagos:    [...detalle.pagos, nuevoPago],
      saldo_db: nuevoSaldo,
      modoPago: esLiquidacion ? 'liquidada' : 'diferida',
    }
    setVentas(prev => prev.map(v => v.id === detalle.id ? ventaActualizada : v))
    setDetalle(ventaActualizada)
    setAbonoMonto('')
    setAbonoMoneda('MXN')
    setShowAbono(false)
    setGuardandoAbono(false)
  }

  const eliminarPago = async (pago: Pago) => {
    if (!detalle || !pago.pagos_venta_id) return
    if (!confirm(`¿Eliminar este pago de $${pago.monto.toLocaleString('es-MX')}? El saldo de la venta se restaurará.`)) return

    const supabase = createClient()

    // 1. Borrar el pago
    const { error: errDel } = await supabase
      .from('pagos_venta')
      .delete()
      .eq('id', pago.pagos_venta_id)

    if (errDel) { alert(`Error: ${errDel.message}`); return }

    // 2. Recalcular saldo desde cero: total - SUM(todos los pagos restantes).
    //    El anticipo NO se resta aparte: ya está incluido como un registro en
    //    pagos_venta (al crear la venta se inserta el anticipo ahí). Restarlo
    //    otra vez lo contaba doble y descuadraba el saldo.
    const { data: ventaDB } = await supabase
      .from('ventas')
      .select('total')
      .eq('id', detalle.uuid)
      .single()

    const { data: pagosRestantes } = await supabase
      .from('pagos_venta')
      .select('monto')
      .eq('venta_id', detalle.uuid)

    const totalPagosVenta = (pagosRestantes ?? []).reduce((s, p) => s + Number(p.monto), 0)
    const nuevoSaldo = Math.max(0, (ventaDB?.total ?? detalle.total) - totalPagosVenta)

    const { error: errUpd } = await supabase
      .from('ventas')
      .update({ saldo: nuevoSaldo })
      .eq('id', detalle.uuid)

    if (errUpd) { alert(`Error restaurando saldo: ${errUpd.message}`); return }

    const ventaActualizada: Venta = {
      ...detalle,
      pagos:    detalle.pagos.filter(p => p.pagos_venta_id !== pago.pagos_venta_id),
      saldo_db: nuevoSaldo,
      modoPago: nuevoSaldo > 0 ? 'diferida' : 'liquidada',
    }
    setVentas(prev => prev.map(v => v.id === detalle.id ? ventaActualizada : v))
    setDetalle(ventaActualizada)
  }

  // ── Modificar venta: abrir el editor y cargar catálogo ──
  const abrirModificar = async () => {
    if (!detalle) return
    setItemsMod(detalle.items.map(i => ({ ...i })))
    setBuscarProd('')
    setModificar(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('productos')
      .select('nombre, sku, precio, categoria')
      .eq('activo', true)
      .order('nombre')
    setCatalogoMod((data ?? []) as { nombre: string; sku: string; precio: number; categoria: string }[])
  }

  const totalItemsMod = (items: ItemVenta[]) =>
    items.reduce((s, i) => s + i.precio * i.cantidad * (1 - (i.descuento || 0) / 100), 0)

  const guardarModificacion = async () => {
    if (!detalle || guardandoMod) return
    const totalPagado = Math.round((detalle.total - detalle.saldo_db) * 100) / 100
    const nuevoTotal  = Math.round(totalItemsMod(itemsMod) * 100) / 100
    if (nuevoTotal < totalPagado - 0.01) {
      alert(`El nuevo total ($${nuevoTotal.toLocaleString('es-MX')}) es menor a lo ya pagado ($${totalPagado.toLocaleString('es-MX')}). No se puede dejar la venta pagada de más.`)
      return
    }
    setGuardandoMod(true)
    const supabase = createClient()
    try {
      // 1. Reemplazar los productos de la venta
      await supabase.from('ventas_items').delete().eq('venta_id', detalle.uuid)
      const rows = itemsMod.map(i => ({
        venta_id:        detalle.uuid,
        nombre:          i.nombre,
        sku:             i.sku ?? '',
        precio_unitario: i.precio,
        cantidad:        i.cantidad,
        descuento:       i.descuento ?? 0,
        subtotal:        Math.round(i.precio * i.cantidad * (1 - (i.descuento || 0) / 100) * 100) / 100,
        par:             1,
      }))
      if (rows.length) {
        const { error } = await supabase.from('ventas_items').insert(rows)
        if (error) throw error
      }

      // 2. Actualizar total y saldo (el dinero nunca toca la caja: solo el saldo)
      const nuevoSaldo = Math.max(0, Math.round((nuevoTotal - totalPagado) * 100) / 100)
      const up = await supabase.from('ventas').update({ total: nuevoTotal, saldo: nuevoSaldo }).eq('id', detalle.uuid)
      if (up.error) throw up.error

      // 3. Sincronizar orden de laboratorio
      const isMica   = (n: string) => ['mica','monofocal','progres','bifocal','transitions','rebisel'].some(k => n.toLowerCase().includes(k))
      const isFiltro = (n: string) => ['filtro','antirreflej','blue','fotocrom','polariz','tinte','crizal'].some(k => n.toLowerCase().includes(k))
      const micasFull   = itemsMod.filter(i => isMica(i.nombre)).map(i => i.nombre).join(', ')
      const tratosFull  = itemsMod.filter(i => isFiltro(i.nombre)).map(i => i.nombre).join(', ')
      const origNombres = new Set(detalle.items.map(i => i.nombre))
      const micasNuevos  = itemsMod.filter(i => isMica(i.nombre)   && !origNombres.has(i.nombre)).map(i => i.nombre).join(', ')
      const tratosNuevos = itemsMod.filter(i => isFiltro(i.nombre) && !origNombres.has(i.nombre)).map(i => i.nombre).join(', ')

      const crearOrdenLab = async (mica: string, trato: string) => {
        const { data: ultimoL } = await supabase.from('ordenes_lab').select('folio').ilike('folio', 'L-%').order('folio', { ascending: false }).limit(1)
        const nL = ultimoL?.[0]?.folio ? parseInt(ultimoL[0].folio.replace(/\D/g, '')) + 1 : 1
        const folioLab = `L-${String(nL).padStart(4, '0')}`
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
        await supabase.from('ordenes_lab').insert({
          folio: folioLab, folio_venta: detalle.id, venta_id: detalle.uuid,
          paciente: detalle.cliente, telefono: detalle.telefono, sucursal: detalle.sucursal,
          estado: 'recibido', fecha_ingreso: hoy, fecha_promesa: detalle.fechaEntrega || '',
          precio_cliente: nuevoTotal, anticipo: 0, tipo_mica: mica, tratamiento: trato,
          od: '', oi: '', add_graduacion: '', dp: '',
        })
        return folioLab
      }

      let avisoLab = ''
      const { data: ordArr } = await supabase.from('ordenes_lab').select('id, folio, estado').eq('venta_id', detalle.uuid).order('folio').limit(1)
      const orden = ordArr?.[0]
      if (orden) {
        if (orden.estado === 'recibido') {
          // Todavía en la óptica (Sergio no la recogió): se actualiza la misma orden
          await supabase.from('ordenes_lab').update({ tipo_mica: micasFull, tratamiento: tratosFull }).eq('id', orden.id)
          avisoLab = `Orden de lab ${orden.folio} actualizada con los cambios.`
        } else if (micasNuevos || tratosNuevos) {
          // Ya está en proceso: el material añadido necesita orden NUEVA
          const nueva = await crearOrdenLab(micasNuevos, tratosNuevos)
          avisoLab = `La orden ${orden.folio} ya está en proceso, así que se creó una orden NUEVA (${nueva}) para el material añadido.`
        }
      } else if (micasFull || tratosFull) {
        const nueva = await crearOrdenLab(micasFull, tratosFull)
        avisoLab = `Se creó la orden de lab ${nueva} para el material de esta venta.`
      }

      // 4. Reflejar en pantalla
      const ventaActualizada: Venta = {
        ...detalle,
        items:    itemsMod.map(i => ({ ...i })),
        total:    nuevoTotal,
        saldo_db: nuevoSaldo,
        modoPago: nuevoSaldo > 0 ? 'diferida' : 'liquidada',
      }
      setVentas(prev => prev.map(v => v.id === detalle.id ? ventaActualizada : v))
      setDetalle(ventaActualizada)
      setModificar(false)
      if (avisoLab) alert(avisoLab)
    } catch (e) {
      alert('Error al modificar la venta: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setGuardandoMod(false)
    }
  }

  const cancelarVenta = async () => {
    if (!detalle) return
    const supabase = createClient()
    const esCotizacion = detalle.id.startsWith('COT-')

    // ── Cotizaciones: no son fiscales, se borran de verdad ──────────────
    if (esCotizacion) {
      if (!confirm(`¿Borrar la cotización ${detalle.id} de ${detalle.cliente}?`)) return
      await supabase.from('ventas_items').delete().eq('venta_id', detalle.uuid)
      const rc = await supabase.from('ventas').delete().eq('id', detalle.uuid)
      if (rc.error) { alert(`Error al borrar la cotización: ${rc.error.message}`); return }
      setVentas(prev => prev.filter(v => v.id !== detalle.id))
      setDetalle(null)
      return
    }

    // ── Ventas reales: NO se borran. Se CANCELAN para conservar el folio
    //    y dejar rastro de auditoría (secuencia de folios sin huecos). ───
    const motivo = prompt(
      `Cancelar la venta ${detalle.id} de ${detalle.cliente}.\n\n` +
      `El folio se conserva y queda registrado como CANCELADA (para auditoría).\n` +
      `Se quitarán sus pagos de la caja y su orden de laboratorio.\n\n` +
      `Escribe el MOTIVO de la cancelación:`
    )
    if (motivo === null) return                       // cerró el prompt
    if (!motivo.trim()) { alert('Necesitas escribir un motivo para cancelar la venta.'); return }

    let quien = ''
    try { quien = JSON.parse(localStorage.getItem('optios_demo_user') || '{}').nombre || '' } catch {}

    // 1. Quitar pagos → el dinero sale de la caja
    const r1 = await supabase.from('pagos_venta').delete().eq('venta_id', detalle.uuid)
    if (r1.error) { alert(`Error al quitar pagos: ${r1.error.message}`); return }

    // 2. Quitar orden(es) de laboratorio ligadas a la venta
    const r3 = await supabase.from('ordenes_lab').delete().eq('venta_id', detalle.uuid)
    if (r3.error) { alert(`Error al quitar orden de lab: ${r3.error.message}`); return }

    // 3. Quitar comisión de terminal (gasto ligado por el folio en el concepto)
    const r4 = await supabase.from('gastos').delete()
      .eq('categoria', 'comision_terminal').ilike('concepto', `%${detalle.id}%`)
    if (r4.error) { alert(`Error al quitar comisión: ${r4.error.message}`); return }

    // 4. Marcar la venta como CANCELADA. Conserva folio + productos (para poder
    //    auditar qué contenía) y guarda motivo, quién y cuándo.
    const r5 = await supabase.from('ventas').update({
      estado: 'cancelada',
      motivo_cancelacion: motivo.trim().toUpperCase(),
      cancelada_por: quien,
      cancelada_en: new Date().toISOString(),
    }).eq('id', detalle.uuid)
    if (r5.error) { alert(`Error al cancelar la venta: ${r5.error.message}`); return }

    // 5. Regresar al stock los armazones de la venta cancelada (catálogo e-commerce)
    const armzItems = (detalle.items || [])
      .filter(i => /^(VRL|ARMZ)-/i.test(i.sku || ''))
      .map(i => ({ sku: i.sku as string, cantidad: i.cantidad }))
    if (armzItems.length > 0) {
      fetch('/api/ecomm/armazones/movimiento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucursal: detalle.sucursal, signo: 1, items: armzItems }),
      }).catch(() => { /* no bloquear la cancelación si falla el regreso de stock */ })
    }

    // 6. Regresar al stock los consumibles de la venta cancelada (base OptiOS)
    const colSuc = detalle.sucursal === 'Baja Visión' ? 'stock_baja'
      : detalle.sucursal === '5 de Mayo' ? 'stock_mayo'
      : detalle.sucursal === 'Plaza Laureles' ? 'stock_plaza' : null
    if (colSuc) {
      try {
        const skus = [...new Set((detalle.items || []).map(i => i.sku).filter(Boolean))]
        const { data: consumibles } = await supabase
          .from('productos')
          .select('id, sku, stock, stock_baja, stock_mayo, stock_plaza')
          .in('sku', skus)
          .eq('tipo', 'consumible')
        for (const p of (consumibles ?? []) as Record<string, number | string>[]) {
          const qty = (detalle.items || []).filter(i => i.sku === p.sku).reduce((s, i) => s + i.cantidad, 0)
          if (qty <= 0) continue
          const nuevo = Number(p[colSuc] ?? 0) + qty
          const total = (['stock_baja', 'stock_mayo', 'stock_plaza'] as const)
            .reduce((s, c) => s + (c === colSuc ? nuevo : Number(p[c] ?? 0)), 0)
          await supabase.from('productos').update({ [colSuc]: nuevo, stock: total }).eq('id', p.id)
        }
      } catch { /* no bloquear la cancelación */ }
    }

    setVentas(prev => prev.filter(v => v.id !== detalle.id))
    setDetalle(null)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Ventas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Historial y registro de ventas de todas las sucursales</p>
        </div>
        <Link href="/dashboard/ventas/nueva"
          className="flex items-center gap-2 bg-[#0B0E14] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#1A1D27] active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Nueva venta
        </Link>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-zinc-200/80">
        <div className="flex flex-wrap items-center gap-2 md:gap-3 px-4 md:px-5 py-3 md:py-4 border-b border-zinc-200">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, folio o producto..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400" />
          </div>
          <div className="relative">
            <select value={sucursal} onChange={e => setSucursal(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none text-zinc-600">
              {SUCURSALES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
          <div className="flex flex-wrap bg-zinc-100 rounded p-0.5 gap-0.5 text-xs">
            {(['todas', 'pendientes', 'liquidadas', 'cotizaciones'] as const).map(f => (
              <button key={f} onClick={() => setFiltroPago(f)}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  filtroPago === f ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}>
                {f === 'todas' ? 'Todas' : f === 'pendientes' ? 'Con saldo' : f === 'liquidadas' ? 'Liquidadas' : 'Cotizaciones'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 ml-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>{ventasFiltradas.length} resultados</span>
          </div>
        </div>

        <div>
          {cargando ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <>
            {/* ── MÓVIL: tarjetas (todo apilado, sin scroll horizontal) ── */}
            <div className="md:hidden divide-y divide-zinc-100">
              {ventasFiltradas.map(v => {
                const m = metodoBadge[v.metodo] ?? metodoBadge.otros
                const MIcon = m.icon
                const saldo = saldoPendiente(v)
                const prods = v.items.length > 0 ? v.items.map(i => i.nombre + (i.cantidad > 1 ? ` x${i.cantidad}` : '')).join(' + ') : '—'
                return (
                  <button key={v.uuid} onClick={() => { setDetalle(v); setShowAbono(false); setAbonoMonto('') }}
                    className="w-full text-left px-4 py-3 active:bg-zinc-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-zinc-500">{v.id}</span>
                      <span className="text-base font-bold text-zinc-900">${v.total.toLocaleString('es-MX')}</span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-800 mt-0.5">{v.cliente || '—'}</p>
                    <p className="text-xs text-zinc-400 truncate">{prods}</p>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {v.id.startsWith('COT-') ? (
                          <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Cotización</span>
                        ) : saldo > 0 ? (
                          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">${saldo.toLocaleString('es-MX')} pendiente</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.cls}`}><MIcon className="w-3 h-3" />{m.label}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 whitespace-nowrap">{v.sucursal} · {v.fecha}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── ESCRITORIO: tabla ── */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  {['Folio','Cliente','Productos','Sucursal','Método','Total','Fecha'].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-400 font-medium px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {ventasFiltradas.map(v => {
                  const m = metodoBadge[v.metodo] ?? metodoBadge.otros
                  const MIcon = m.icon
                  const saldo = saldoPendiente(v)
                  const productosStr = v.items.length > 0
                    ? v.items.map(i => i.nombre + (i.cantidad > 1 ? ` x${i.cantidad}` : '')).join(' + ')
                    : '—'
                  return (
                    <tr key={v.uuid} onClick={() => { setDetalle(v); setShowAbono(false); setAbonoMonto('') }}
                      className="hover:bg-zinc-100 transition-colors cursor-pointer group">
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono font-semibold text-zinc-500">{v.id}</span>
                        {v.id.startsWith('COT-') ? (
                          <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            Cotización
                          </span>
                        ) : saldo > 0 && (
                          <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            ${saldo.toLocaleString('es-MX')} pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-zinc-700">{v.cliente}</td>
                      <td className="px-5 py-3.5 max-w-xs">
                        <span className="text-xs text-zinc-500 truncate block">{productosStr}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-500">{v.sucursal}</td>
                      <td className="px-5 py-3.5">
                        {v.id.startsWith('COT-') ? (
                          <span className="text-xs text-zinc-300">—</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${m.cls}`}>
                            <MIcon className="w-3 h-3" />{m.label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-zinc-800">${v.total.toLocaleString('es-MX')}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-xs text-zinc-500">{v.fecha}</div>
                        <div className="text-xs text-zinc-400">{v.hora}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
          )}
          {!cargando && ventasFiltradas.length === 0 && (
            <div className="text-center py-16 text-zinc-400 text-sm">No se encontraron ventas.</div>
          )}
        </div>
      </div>

      {/* ── PANEL DETALLE ── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => { setDetalle(null); setShowAbono(false) }}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-zinc-400">{detalle.id}</span>
                  {saldoPendiente(detalle) > 0
                    ? <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Saldo pendiente
                      </span>
                    : <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Liquidada
                      </span>
                  }
                </div>
                <p className="text-base font-bold text-zinc-800 mt-0.5">{detalle.cliente}</p>
                <p className="text-xs text-zinc-400">{detalle.telefono} · {detalle.sucursal}</p>
              </div>
              <button onClick={() => { setDetalle(null); setShowAbono(false) }}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Productos */}
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-2">Productos</p>
                <div className="bg-zinc-50 rounded-lg divide-y divide-zinc-200 overflow-hidden">
                  {detalle.items.length > 0 ? detalle.items.map((item, i) => {
                    const precio = item.precio * (1 - item.descuento / 100)
                    const sub = precio * item.cantidad
                    return (
                      <div key={i} className="flex items-start justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-700">{item.nombre}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {item.cantidad > 1 ? `${item.cantidad} × $${precio.toLocaleString('es-MX')}` : `$${precio.toLocaleString('es-MX')}`}
                            {item.descuento > 0 ? ` · desc. ${item.descuento}%` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-zinc-800 ml-4 flex-shrink-0">${sub.toLocaleString('es-MX')}</span>
                      </div>
                    )
                  }) : (
                    <div className="px-4 py-3 text-xs text-zinc-400">Sin detalle de productos</div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#0B0E14]">
                    <span className="text-sm font-bold text-white">TOTAL</span>
                    <span className="text-lg font-bold text-[#0D9488]">${detalle.total.toLocaleString('es-MX')}</span>
                  </div>
                </div>
              </div>

              {/* Pagos realizados */}
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-2">Pagos realizados</p>
                <div className="space-y-2">
                  {detalle.pagos.map((p, i) => {
                    const b = metodoBadge[p.metodo] ?? metodoBadge.otros
                    const Icon = b.icon
                    return (
                      <div key={i} className="flex items-center justify-between bg-zinc-50 rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">#{i + 1} · {p.fecha}</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${b.cls}`}>
                            <Icon className="w-3 h-3" />{b.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-700">+${p.monto.toLocaleString('es-MX')}</span>
                          {esAdmin && p.pagos_venta_id && (
                            <button
                              onClick={() => eliminarPago(p)}
                              title="Eliminar este pago"
                              className="w-5 h-5 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Resumen */}
                <div className="mt-3 bg-zinc-50 rounded-lg divide-y divide-zinc-200 overflow-hidden">
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-zinc-500">Pagado</span>
                    <span className="font-semibold text-zinc-700">
                      ${detalle.pagos.reduce((s,p) => s+p.monto, 0).toLocaleString('es-MX')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm font-bold text-zinc-700">Saldo pendiente</span>
                    <span className={`text-lg font-bold ${saldoPendiente(detalle) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ${saldoPendiente(detalle).toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form de abono */}
              {showAbono && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-bold text-zinc-700">Registrar abono</p>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-zinc-500">Monto</label>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setAbonoMoneda('MXN'); setAbonoMonto('') }}
                          className={`text-xs font-bold px-3 py-1 rounded-md border transition-all ${abonoMoneda === 'MXN' ? 'bg-zinc-800 text-white border-zinc-800 shadow-sm ring-2 ring-zinc-300' : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'}`}>🇲🇽 MXN</button>
                        <button onClick={() => { setAbonoMoneda('USD'); setAbonoMonto(''); if (!abonoTC) fetchAbonoTC() }}
                          className={`text-xs font-bold px-3 py-1 rounded-md border transition-all ${abonoMoneda === 'USD' ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-blue-50 hover:text-blue-600'}`}>🇺🇸 USD</button>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-sm">{abonoMoneda === 'USD' ? 'USD $' : '$'}</span>
                      <input type="number" min={1}
                        value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)}
                        className={`w-full border-2 rounded ${abonoMoneda === 'USD' ? 'pl-16 border-blue-500' : 'pl-7 border-[#0D9488]'} pr-3 py-2.5 text-lg font-bold text-zinc-800 bg-white focus:outline-none`}
                        placeholder="0" autoFocus />
                    </div>
                    {abonoMoneda === 'USD' ? (
                      abonoLoadingTC ? (
                        <p className="text-xs text-blue-600 mt-1">Obteniendo tipo de cambio…</p>
                      ) : abonoTC ? (
                        <div className="text-xs mt-1.5 space-y-1">
                          <button type="button"
                            onClick={() => setAbonoMonto(String(Math.round(saldoPendiente(detalle) / abonoTC)))}
                            className="w-full text-left text-blue-700 bg-blue-100/60 hover:bg-blue-200/70 rounded px-2 py-1.5 font-semibold transition-colors">
                            💵 Para liquidar cóbrale ≈ <b>${Math.round(saldoPendiente(detalle) / abonoTC).toLocaleString('en-US')} USD</b> <span className="font-normal text-blue-500">— toca para ponerlo</span>
                          </button>
                          <p className="text-zinc-400">
                            TC ${abonoTC.toFixed(2)} · lo que escribiste ≈ ${Math.round((parseFloat(abonoMonto) || 0) * abonoTC).toLocaleString('es-MX')} MXN · saldo ${saldoPendiente(detalle).toLocaleString('es-MX')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-red-400 mt-1">Sin tipo de cambio · toca USD otra vez</p>
                      )
                    ) : (
                      <p className="text-xs text-zinc-400 mt-1">Máximo: ${saldoPendiente(detalle).toLocaleString('es-MX')}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1">Método</label>
                    <div className="relative">
                      <select value={abonoMetodo} onChange={e => setAbonoMetodo(e.target.value)}
                        className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-white focus:outline-none pr-8">
                        {METODOS_ABONO.map(m => (
                          <option key={m} value={m}>{metodoBadge[m]?.label ?? m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAbono(false)}
                      className="flex-1 py-2 border border-zinc-200 rounded text-sm text-zinc-500 hover:bg-white transition-colors">
                      Cancelar
                    </button>
                    <button onClick={registrarAbono} disabled={!abonoMonto || parseFloat(abonoMonto) <= 0 || guardandoAbono || (abonoMoneda === 'USD' && !abonoTC)}
                      className="flex-1 py-2 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-colors">
                      {guardandoAbono ? 'Guardando...' : 'Registrar abono'}
                    </button>
                  </div>
                </div>
              )}

              {/* Info venta */}
              <div className="text-xs text-zinc-400 space-y-1 border-t border-zinc-200 pt-3">
                <div className="flex justify-between">
                  <span>Sucursal</span><span className="text-zinc-600">{detalle.sucursal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha</span><span className="text-zinc-600">{detalle.fecha} {detalle.hora}</span>
                </div>
                <div className="flex justify-between">
                  <span>Atendió</span><span className="text-zinc-600">{detalle.vendedor}</span>
                </div>
              </div>
            </div>

            {/* Acciones fijas */}
            <div className="px-6 pb-5 pt-3 border-t border-zinc-200 flex-shrink-0 space-y-2">
              {detalle.id.startsWith('COT-') ? (
                <>
                  <button onClick={() => router.push(`/dashboard/ventas/nueva?cotizacion=${detalle.uuid}`)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 transition-colors">
                    <Plus className="w-4 h-4" /> Convertir a venta
                  </button>
                  <button onClick={() => imprimirCotizacion(detalle, ticketLogo, recetaMap[detalle.vendedor] || '')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100 transition-colors">
                    <Printer className="w-4 h-4" /> Imprimir cotización
                  </button>
                </>
              ) : (
                <>
                  {saldoPendiente(detalle) > 0 && !showAbono && (
                    <button onClick={() => setShowAbono(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 transition-colors">
                      <Plus className="w-4 h-4" /> Registrar abono · ${saldoPendiente(detalle).toLocaleString('es-MX')} pendiente
                    </button>
                  )}
                  {saldoPendiente(detalle) === 0 && !showAbono && (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Venta liquidada al 100%
                    </div>
                  )}
                  <button onClick={() => imprimirTicket(detalle, ticketLogo, recetaMap[detalle.vendedor] || '')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100 transition-colors">
                    <Printer className="w-4 h-4" /> Reimprimir ticket
                  </button>
                </>
              )}
              <button onClick={() => descargarPDFDoc(detalle, ticketLogo, recetaMap[detalle.vendedor] || '')}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100 transition-colors">
                <Printer className="w-4 h-4" /> Descargar PDF (hoja)
              </button>
              {esAdmin && !detalle.id.startsWith('COT-') && (
                <button onClick={abrirModificar}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-300 text-zinc-700 rounded text-sm font-semibold hover:bg-zinc-100 transition-colors">
                  <Pencil className="w-4 h-4" /> Modificar venta
                </button>
              )}
              {esAdmin && (
                <button onClick={cancelarVenta}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-400 hover:text-red-600 transition-colors">
                  {detalle.id.startsWith('COT-') ? 'Borrar cotización' : 'Cancelar venta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Modificar venta (solo admin) ── */}
      {modificar && detalle && (() => {
        const totalPagado = Math.round((detalle.total - detalle.saldo_db) * 100) / 100
        const nuevoTotal  = Math.round(totalItemsMod(itemsMod) * 100) / 100
        const nuevoSaldo  = Math.round((nuevoTotal - totalPagado) * 100) / 100
        const q = buscarProd.trim().toLowerCase()
        const sugerencias = q.length >= 2
          ? catalogoMod.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 8)
          : []
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !guardandoMod && setModificar(false)}>
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Modificar venta {detalle.id}</h3>
                  <p className="text-xs text-zinc-500">{detalle.cliente}</p>
                </div>
                <button onClick={() => !guardandoMod && setModificar(false)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-2">PRODUCTOS</p>
                  <div className="space-y-1.5">
                    {itemsMod.map((it, idx) => {
                      const sub = it.precio * it.cantidad * (1 - (it.descuento || 0) / 100)
                      const totalSinEste = totalItemsMod(itemsMod.filter((_, i) => i !== idx))
                      const bloquear = totalSinEste < totalPagado - 0.01
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-zinc-50 rounded px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 truncate">{it.nombre}</p>
                            <p className="text-xs text-zinc-400">{it.cantidad} × ${it.precio.toLocaleString('es-MX')}{it.descuento ? ` · -${it.descuento}%` : ''}</p>
                          </div>
                          <span className="text-sm font-semibold text-zinc-700">${Math.round(sub).toLocaleString('es-MX')}</span>
                          <button
                            onClick={() => {
                              if (bloquear) { alert(`No se puede quitar: dejaría la venta pagada de más. El cliente ya pagó $${totalPagado.toLocaleString('es-MX')}.`); return }
                              setItemsMod(prev => prev.filter((_, i) => i !== idx))
                            }}
                            className={`p-1 rounded ${bloquear ? 'text-zinc-300 cursor-not-allowed' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={bloquear ? 'No se puede quitar (ya pagado)' : 'Quitar'}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                    {itemsMod.length === 0 && <p className="text-xs text-zinc-400 italic">Sin productos</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-2">AÑADIR PRODUCTO</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input value={buscarProd} onChange={e => setBuscarProd(e.target.value)}
                      placeholder="Buscar producto para añadir..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                  </div>
                  {sugerencias.length > 0 && (
                    <div className="mt-1 border border-zinc-200 rounded divide-y divide-zinc-100 max-h-44 overflow-y-auto">
                      {sugerencias.map(p => (
                        <button key={p.sku} onClick={() => { setItemsMod(prev => [...prev, { nombre: p.nombre, sku: p.sku, precio: p.precio, cantidad: 1, descuento: 0 }]); setBuscarProd('') }}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-50">
                          <span className="text-sm text-zinc-700 truncate">{p.nombre}</span>
                          <span className="text-xs font-semibold text-zinc-500 ml-2">${p.precio.toLocaleString('es-MX')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-200 px-5 py-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Nuevo total</span><span className="font-bold text-zinc-900">${nuevoTotal.toLocaleString('es-MX')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Ya pagado</span><span className="text-zinc-600">${totalPagado.toLocaleString('es-MX')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Saldo pendiente</span><span className={`font-bold ${nuevoSaldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>${Math.max(0, nuevoSaldo).toLocaleString('es-MX')}</span></div>
                <p className="text-[11px] text-zinc-400 leading-snug">El cambio solo ajusta el saldo — no cobra nada. El pago se registra aparte con &quot;Registrar abono&quot;.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setModificar(false)} disabled={guardandoMod}
                    className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50">Cancelar</button>
                  <button onClick={guardarModificacion} disabled={guardandoMod}
                    className="flex-1 py-2.5 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 disabled:opacity-50">
                    {guardandoMod ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
