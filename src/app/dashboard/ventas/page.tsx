'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus, Search, Filter, ShoppingCart, TrendingUp,
  CreditCard, Banknote, Building2, X, Printer,
  ChevronDown, Clock, CheckCircle2, AlertCircle, ArrowRight,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type Pago = { fecha: string; monto: number; metodo: string }
type ItemVenta = { nombre: string; cantidad: number; precio: number; descuento: number }
type Venta = {
  id: string
  cliente: string
  telefono: string
  sucursal: string
  items: ItemVenta[]
  total: number
  metodo: string
  modoPago: 'liquidada' | 'diferida'
  pagos: Pago[]
  fecha: string
  hora: string
  vendedor: string
}

// ─────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────
const ventasMock: Venta[] = [
  {
    id: 'V-0041', cliente: 'María González', telefono: '686 123 4567',
    sucursal: 'Baja Visión', metodo: 'tarjeta', modoPago: 'diferida',
    items: [
      { nombre: 'Armazón Ray-Ban RB5154', cantidad: 1, precio: 2800, descuento: 0 },
      { nombre: 'Micas antirreflejantes', cantidad: 1, precio: 1200, descuento: 0 },
      { nombre: 'Adaptación', cantidad: 1, precio: 800, descuento: 0 },
    ],
    pagos: [{ fecha: '25/06/2026', monto: 1500, metodo: 'tarjeta' }],
    total: 4800, fecha: '25/06/2026', hora: '11:32', vendedor: 'Karina López',
  },
  {
    id: 'V-0040', cliente: 'Carlos Ruiz', telefono: '686 234 5678',
    sucursal: '5 de Mayo', metodo: 'efectivo', modoPago: 'liquidada',
    items: [
      { nombre: 'Lentes de contacto Acuvue mensual', cantidad: 2, precio: 580, descuento: 0 },
      { nombre: 'Solución Renu 120ml', cantidad: 1, precio: 180, descuento: 0 },
    ],
    pagos: [{ fecha: '25/06/2026', monto: 1340, metodo: 'efectivo' }],
    total: 1340, fecha: '25/06/2026', hora: '10:15', vendedor: 'Ana Castillo',
  },
  {
    id: 'V-0039', cliente: 'Ana López', telefono: '686 345 6789',
    sucursal: 'Plaza Laureles', metodo: 'transferencia', modoPago: 'diferida',
    items: [
      { nombre: 'Armazón Oakley OX8046', cantidad: 1, precio: 3200, descuento: 0 },
      { nombre: 'Micas transitions', cantidad: 1, precio: 2800, descuento: 10 },
    ],
    pagos: [
      { fecha: '25/06/2026', monto: 2000, metodo: 'transferencia' },
      { fecha: '26/06/2026', monto: 1200, metodo: 'efectivo' },
    ],
    total: 5720, fecha: '25/06/2026', hora: '09:48', vendedor: 'Sandra Ríos',
  },
  {
    id: 'V-0038', cliente: 'Pedro Sánchez', telefono: '686 456 7890',
    sucursal: 'Baja Visión', metodo: 'efectivo', modoPago: 'liquidada',
    items: [
      { nombre: 'Armazón básico acetato', cantidad: 1, precio: 950, descuento: 0 },
      { nombre: 'Micas monofocales CR-39', cantidad: 1, precio: 800, descuento: 0 },
      { nombre: 'Adaptación', cantidad: 1, precio: 350, descuento: 0 },
    ],
    pagos: [{ fecha: '24/06/2026', monto: 2100, metodo: 'efectivo' }],
    total: 2100, fecha: '24/06/2026', hora: '17:20', vendedor: 'Karina López',
  },
  {
    id: 'V-0037', cliente: 'Laura Martínez', telefono: '686 567 8901',
    sucursal: '5 de Mayo', metodo: 'efectivo', modoPago: 'liquidada',
    items: [{ nombre: 'Solución para lentes Renu', cantidad: 3, precio: 150, descuento: 0 }],
    pagos: [{ fecha: '24/06/2026', monto: 450, metodo: 'efectivo' }],
    total: 450, fecha: '24/06/2026', hora: '16:05', vendedor: 'Ana Castillo',
  },
  {
    id: 'V-0036', cliente: 'Jorge Herrera', telefono: '686 678 9012',
    sucursal: 'Plaza Laureles', metodo: 'tarjeta', modoPago: 'diferida',
    items: [
      { nombre: 'Armazón Ray-Ban RB5154', cantidad: 1, precio: 2800, descuento: 0 },
      { nombre: 'Micas progresivas Essilor', cantidad: 1, precio: 3500, descuento: 0 },
      { nombre: 'Antirreflejante premium', cantidad: 1, precio: 1100, descuento: 0 },
    ],
    pagos: [{ fecha: '24/06/2026', monto: 2000, metodo: 'tarjeta' }],
    total: 7400, fecha: '24/06/2026', hora: '14:33', vendedor: 'Sandra Ríos',
  },
  {
    id: 'V-0035', cliente: 'Sofía Ramos', telefono: '686 789 0123',
    sucursal: 'Baja Visión', metodo: 'tarjeta', modoPago: 'liquidada',
    items: [{ nombre: 'Lentes de sol Ray-Ban polarizados', cantidad: 1, precio: 3200, descuento: 0 }],
    pagos: [{ fecha: '24/06/2026', monto: 3200, metodo: 'tarjeta' }],
    total: 3200, fecha: '24/06/2026', hora: '12:10', vendedor: 'Karina López',
  },
  {
    id: 'V-0034', cliente: 'Miguel Torres', telefono: '686 890 1234',
    sucursal: '5 de Mayo', metodo: 'transferencia', modoPago: 'liquidada',
    items: [{ nombre: 'Micas antirreflejantes', cantidad: 1, precio: 1800, descuento: 0 }],
    pagos: [{ fecha: '23/06/2026', monto: 1800, metodo: 'transferencia' }],
    total: 1800, fecha: '23/06/2026', hora: '11:00', vendedor: 'Ana Castillo',
  },
]

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────
const metodoBadge: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  efectivo:      { label: 'Efectivo',      icon: Banknote,   cls: 'bg-emerald-50 text-emerald-700' },
  tarjeta:       { label: 'Tarjeta',       icon: CreditCard, cls: 'bg-blue-50 text-blue-700' },
  transferencia: { label: 'Transferencia', icon: Building2,  cls: 'bg-violet-50 text-violet-700' },
  deposito:      { label: 'Depósito',      icon: Building2,  cls: 'bg-violet-50 text-violet-700' },
  otros:         { label: 'Otros',         icon: Clock,      cls: 'bg-slate-100 text-slate-600' },
}

const METODOS_ABONO = ['efectivo', 'tarjeta', 'transferencia', 'deposito']
const SUCURSALES = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function saldoPendiente(v: Venta) {
  const pagado = v.pagos.reduce((s, p) => s + p.monto, 0)
  return v.total - pagado
}

function imprimirTicket(v: Venta) {
  const fechaFmt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaFmt  = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  const productosRows = v.items.map(item => {
    const precioUnit = item.precio * (1 - item.descuento / 100)
    const sub = precioUnit * item.cantidad
    const descStr = item.descuento > 0 ? ` (−${item.descuento}%)` : ''
    return `<tr>
      <td class="cant">${item.cantidad}</td>
      <td class="desc">${item.nombre}${descStr}</td>
      <td class="precio">$${sub.toLocaleString('es-MX')}</td>
    </tr>`
  }).join('')

  const saldo = saldoPendiente(v)
  const pagadoTotal = v.pagos.reduce((s, p) => s + p.monto, 0)

  const pagosRows = v.pagos.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${p.fecha}</td><td class="r">$${p.monto.toLocaleString('es-MX')}</td></tr>`
  ).join('')

  const pagosHtml = v.modoPago === 'diferida' ? `
    <div class="section-title">Pagos Realizados</div>
    <table class="pagos">
      <tr><th>#</th><th>Fecha</th><th>Pago</th></tr>
      ${pagosRows}
    </table>
    <div class="pagos-total">$${pagadoTotal.toLocaleString('es-MX')}</div>
    <div class="saldo-box">Cantidad restante para liquidar el pago:<br><b>$${saldo.toLocaleString('es-MX')}</b></div>` : ''

  const win = window.open('', '_blank', 'width=330,height=900')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${v.id}</title>
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 74mm; }
  .hdr { text-align: center; padding-bottom: 7px; border-bottom: 2px solid #000; margin-bottom: 7px; }
  .store { font-size: 16px; font-weight: 900; }
  .branch { font-size: 12px; font-weight: 700; }
  .date { font-size: 10px; margin-top: 3px; }
  .info { margin-bottom: 7px; padding-bottom: 7px; border-bottom: 1px dashed #000; }
  .info div { margin: 1.5px 0; }
  .folio { font-size: 12px; font-weight: 900; text-align: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-bottom: 7px; }
  table.prods { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 5px; }
  table.prods th { border-bottom: 1px solid #000; padding: 2px 1px; text-align: left; }
  .cant { width: 22px; } .desc { padding: 2px 3px; } .precio { text-align: right; white-space: nowrap; }
  table.prods td { vertical-align: top; padding: 2px 1px; }
  .total-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-bottom: 8px; }
  .section-title { font-weight: 900; text-align: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 6px 0; }
  table.pagos { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.pagos th { text-align: left; font-weight: 700; padding: 1px 0; }
  table.pagos .r { text-align: right; }
  .pagos-total { text-align: right; font-weight: 900; border-top: 1px solid #000; padding-top: 2px; margin: 3px 0 6px; }
  .saldo-box { border: 1px solid #000; padding: 5px; text-align: center; font-size: 11px; margin-bottom: 8px; }
  .saldo-box b { font-size: 14px; }
  .entrega { font-size: 10px; text-align: center; margin: 6px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; }
  .conserva { font-size: 10px; text-align: center; margin: 6px 0; }
  .firma { margin: 14px 0 6px; text-align: center; }
  .firma-line { display: inline-block; border-top: 1px solid #000; width: 160px; padding-top: 3px; font-size: 10px; }
  .footer { text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
  .footer b { display: block; font-size: 11px; }
</style></head><body>
<div class="hdr">
  <div class="store">${(SUCURSAL_CONFIG[v.sucursal]?.nombreLinea1 ?? v.sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[v.sucursal]?.nombreLinea2 ? `<div class="branch">${SUCURSAL_CONFIG[v.sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="date">${fechaFmt} &nbsp; ${horaFmt}</div>
</div>
<div class="info">
  <div><b>Paciente:</b> ${v.cliente}</div>
  ${v.telefono ? `<div><b>Teléfono:</b> ${v.telefono}</div>` : ''}
</div>
<div class="folio">Folio de venta: ${v.id}</div>
<table class="prods">
  <thead><tr><th class="cant">Cant.</th><th class="desc">Desc.</th><th class="precio">Precio</th></tr></thead>
  <tbody>${productosRows}</tbody>
</table>
<div class="total-row"><span>TOTAL:</span><span>$${v.total.toLocaleString('es-MX')}</span></div>
${pagosHtml}
<div class="entrega">Fecha de entrega de 3 a 5 días hábiles a partir de la compra.</div>
<div class="conserva">Conserve este ticket para cualquier aclaración o garantía.</div>
<div class="firma"><div class="firma-line">Nombre y firma del comprador</div></div>
<div class="footer">
  <div>Tel. ${SUCURSAL_CONFIG[v.sucursal]?.telefono ?? '661 612 0316'} &nbsp;|&nbsp; WA ${SUCURSAL_CONFIG[v.sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[v.sucursal]?.horario ?? 'Lun–Sáb 10:00–18:00'}</div>
  <b>Atendió: ${v.vendedor}</b>
  <div>${SUCURSAL_CONFIG[v.sucursal]?.web ?? 'gonmx.com'}</div>
</div>
</body></html>`)
  win.document.close()
  setTimeout(() => { win.print() }, 300)
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function VentasPage() {
  const [ventas, setVentas]       = useState<Venta[]>(ventasMock)
  const [busqueda, setBusqueda]   = useState('')
  const [sucursal, setSucursal]   = useState('Todas')
  const [detalle, setDetalle]     = useState<Venta | null>(null)
  const [showAbono, setShowAbono] = useState(false)
  const [abonoMonto, setAbonoMonto]   = useState('')
  const [abonoMetodo, setAbonoMetodo] = useState('efectivo')

  const ventasFiltradas = ventas.filter(v => {
    const q = busqueda.toLowerCase()
    const matchQ = v.cliente.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) ||
      v.items.some(i => i.nombre.toLowerCase().includes(q))
    const matchS = sucursal === 'Todas' || v.sucursal === sucursal
    return matchQ && matchS
  })

  const totalHoy = ventas.filter(v => v.fecha === '25/06/2026').reduce((s, v) => s + v.total, 0)

  const registrarAbono = () => {
    const monto = parseFloat(abonoMonto)
    if (!detalle || isNaN(monto) || monto <= 0) return
    const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const nuevoPago: Pago = { fecha: hoy, monto, metodo: abonoMetodo }
    const ventaActualizada = { ...detalle, pagos: [...detalle.pagos, nuevoPago] }
    setVentas(prev => prev.map(v => v.id === detalle.id ? ventaActualizada : v))
    setDetalle(ventaActualizada)
    setAbonoMonto('')
    setShowAbono(false)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ventas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Historial y registro de ventas de todas las sucursales</p>
        </div>
        <Link href="/dashboard/ventas/nueva"
          className="flex items-center gap-2 bg-[#0B1A35] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#0d2145] active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Nueva venta
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Ventas de hoy</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">${totalHoy.toLocaleString('es-MX')}</p>
            </div>
            <div className="w-11 h-11 rounded-md bg-[#2BBFB3]/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#2BBFB3]" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">{ventas.filter(v => v.fecha === '25/06/2026').length} transacciones hoy</span>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Promedio por venta</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                ${Math.round(ventas.reduce((s,v) => s+v.total,0) / ventas.length).toLocaleString('es-MX')}
              </p>
            </div>
            <div className="w-11 h-11 rounded-md bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400">Últimas {ventas.length} ventas registradas</span>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium mb-2">Por método de pago</p>
          {['efectivo','tarjeta','transferencia'].map(m => {
            const count = ventas.filter(v => v.metodo === m).length
            const b = metodoBadge[m]
            const Icon = b.icon
            return (
              <div key={m} className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">{b.label}</span>
                <span className="text-xs font-semibold text-slate-700 ml-auto">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, folio o producto..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400" />
          </div>
          <div className="relative">
            <select value={sucursal} onChange={e => setSucursal(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:outline-none text-slate-600">
              {SUCURSALES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>{ventasFiltradas.length} resultados</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Folio','Cliente','Productos','Sucursal','Método','Total','Fecha'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ventasFiltradas.map(v => {
                const m = metodoBadge[v.metodo] ?? metodoBadge.otros
                const MIcon = m.icon
                const saldo = saldoPendiente(v)
                const productosStr = v.items.map(i => i.nombre + (i.cantidad > 1 ? ` x${i.cantidad}` : '')).join(' + ')
                return (
                  <tr key={v.id} onClick={() => { setDetalle(v); setShowAbono(false); setAbonoMonto('') }}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-semibold text-slate-500">{v.id}</span>
                      {saldo > 0 && (
                        <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          ${saldo.toLocaleString('es-MX')} pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{v.cliente}</td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <span className="text-xs text-slate-500 truncate block">{productosStr}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{v.sucursal}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${m.cls}`}>
                        <MIcon className="w-3 h-3" />{m.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">${v.total.toLocaleString('es-MX')}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs text-slate-500">{v.fecha}</div>
                      <div className="text-xs text-slate-400">{v.hora}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {ventasFiltradas.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">No se encontraron ventas.</div>
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400">{detalle.id}</span>
                  {saldoPendiente(detalle) > 0
                    ? <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Saldo pendiente
                      </span>
                    : <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Liquidada
                      </span>
                  }
                </div>
                <p className="text-base font-bold text-slate-800 mt-0.5">{detalle.cliente}</p>
                <p className="text-xs text-slate-400">{detalle.telefono} · {detalle.sucursal}</p>
              </div>
              <button onClick={() => { setDetalle(null); setShowAbono(false) }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Productos */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Productos</p>
                <div className="bg-slate-50 rounded-lg divide-y divide-slate-200 overflow-hidden">
                  {detalle.items.map((item, i) => {
                    const precio = item.precio * (1 - item.descuento / 100)
                    const sub = precio * item.cantidad
                    return (
                      <div key={i} className="flex items-start justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{item.nombre}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.cantidad > 1 ? `${item.cantidad} × $${precio.toLocaleString('es-MX')}` : `$${precio.toLocaleString('es-MX')}`}
                            {item.descuento > 0 ? ` · desc. ${item.descuento}%` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-slate-800 ml-4 flex-shrink-0">${sub.toLocaleString('es-MX')}</span>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#0B1A35]">
                    <span className="text-sm font-bold text-white">TOTAL</span>
                    <span className="text-lg font-bold text-[#2BBFB3]">${detalle.total.toLocaleString('es-MX')}</span>
                  </div>
                </div>
              </div>

              {/* Pagos realizados */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Pagos realizados</p>
                <div className="space-y-2">
                  {detalle.pagos.map((p, i) => {
                    const b = metodoBadge[p.metodo] ?? metodoBadge.otros
                    const Icon = b.icon
                    return (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">#{i + 1} · {p.fecha}</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${b.cls}`}>
                            <Icon className="w-3 h-3" />{b.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-emerald-700">+${p.monto.toLocaleString('es-MX')}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Resumen */}
                <div className="mt-3 bg-slate-50 rounded-lg divide-y divide-slate-200 overflow-hidden">
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-500">Pagado</span>
                    <span className="font-semibold text-slate-700">
                      ${detalle.pagos.reduce((s,p) => s+p.monto, 0).toLocaleString('es-MX')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm font-bold text-slate-700">Saldo pendiente</span>
                    <span className={`text-lg font-bold ${saldoPendiente(detalle) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ${saldoPendiente(detalle).toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form de abono */}
              {showAbono && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-bold text-slate-700">Registrar abono</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Monto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</span>
                      <input type="number" min={1} max={saldoPendiente(detalle)}
                        value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)}
                        className="w-full border-2 border-[#2BBFB3] rounded pl-7 pr-3 py-2.5 text-lg font-bold text-slate-800 bg-white focus:outline-none"
                        placeholder="0" autoFocus />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Máximo: ${saldoPendiente(detalle).toLocaleString('es-MX')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Método</label>
                    <div className="relative">
                      <select value={abonoMetodo} onChange={e => setAbonoMetodo(e.target.value)}
                        className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-white focus:outline-none pr-8">
                        {METODOS_ABONO.map(m => (
                          <option key={m} value={m}>{metodoBadge[m]?.label ?? m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAbono(false)}
                      className="flex-1 py-2 border border-slate-200 rounded text-sm text-slate-500 hover:bg-white transition-colors">
                      Cancelar
                    </button>
                    <button onClick={registrarAbono} disabled={!abonoMonto || parseFloat(abonoMonto) <= 0}
                      className="flex-1 py-2 bg-[#0B1A35] text-white rounded text-sm font-bold hover:bg-[#0d2145] disabled:opacity-40 transition-colors">
                      Registrar abono
                    </button>
                  </div>
                </div>
              )}

              {/* Info venta */}
              <div className="text-xs text-slate-400 space-y-1 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span>Sucursal</span><span className="text-slate-600">{detalle.sucursal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha</span><span className="text-slate-600">{detalle.fecha} {detalle.hora}</span>
                </div>
                <div className="flex justify-between">
                  <span>Atendió</span><span className="text-slate-600">{detalle.vendedor}</span>
                </div>
              </div>
            </div>

            {/* Acciones fijas */}
            <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex-shrink-0 space-y-2">
              {saldoPendiente(detalle) > 0 && !showAbono && (
                <button onClick={() => setShowAbono(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#2BBFB3] text-white rounded text-sm font-bold hover:bg-teal-500 transition-colors">
                  <Plus className="w-4 h-4" /> Registrar abono · ${saldoPendiente(detalle).toLocaleString('es-MX')} pendiente
                </button>
              )}
              {saldoPendiente(detalle) === 0 && !showAbono && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Venta liquidada al 100%
                </div>
              )}
              <button onClick={() => imprimirTicket(detalle)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">
                <Printer className="w-4 h-4" /> Reimprimir ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
