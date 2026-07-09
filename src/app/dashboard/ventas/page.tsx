'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, Filter, ShoppingCart, TrendingUp,
  CreditCard, Banknote, Building2, X, Printer,
  ChevronDown, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type Pago = { fecha: string; monto: number; metodo: string }
type ItemVenta = { nombre: string; cantidad: number; precio: number; descuento: number }
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
  fecha: string
  hora: string
  vendedor: string
}

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────
const metodoBadge: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  efectivo:      { label: 'Efectivo',      icon: Banknote,   cls: 'bg-emerald-50 text-emerald-700' },
  tarjeta:       { label: 'Tarjeta',       icon: CreditCard, cls: 'bg-blue-50 text-blue-700' },
  transferencia: { label: 'Transferencia', icon: Building2,  cls: 'bg-violet-50 text-violet-700' },
  deposito:      { label: 'Depósito',      icon: Building2,  cls: 'bg-violet-50 text-violet-700' },
  otros:         { label: 'Otros',         icon: Clock,      cls: 'bg-zinc-100 text-zinc-600' },
}

const METODOS_ABONO = ['efectivo', 'tarjeta', 'transferencia', 'deposito']
const SUCURSALES = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function saldoPendiente(v: Venta) {
  const pagado = v.pagos.reduce((s, p) => s + p.monto, 0)
  return Math.max(0, v.total - pagado)
}

function fmtFecha(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
function fechaHoy() {
  return new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function imprimirTicket(v: Venta) {
  // Usar la fecha/hora originales de la venta
  const fechaFmt = v.fecha
  const horaFmt  = v.hora

  // Vendedor: "Nombre A."
  const _vp = (v.vendedor || '').trim().split(/\s+/)
  const vendedorCorto = _vp.length >= 2 ? `${_vp[0]} ${_vp[1][0].toUpperCase()}.` : _vp[0] || ''

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

  const pagosRows = v.pagos.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${p.fecha}</td><td class="r">$${p.monto.toLocaleString('es-MX')}</td></tr>`
  ).join('')

  const pagosHtml = v.modoPago === 'diferida' ? `
    <div class="ph-title"><div class="ph-line"></div><div class="ph-txt">PAGOS REALIZADOS</div><div class="ph-line"></div></div>
    <table class="pagos">
      <tr><th>#</th><th>Fecha</th><th class="r">Pago</th></tr>
      ${pagosRows}
    </table>
    <div class="pagos-total-row"><span>TOTAL PAGADO:</span><span>$${pagadoTotal.toLocaleString('es-MX')}</span></div>
    <div class="saldo-box">
      <div class="saldo-lbl">Cantidad restante para liquidar el pago:</div>
      <div class="saldo-val">$${saldo.toLocaleString('es-MX')}</div>
    </div>` : ''

  const win = window.open('', '_blank', 'width=230,height=900')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${v.id}</title>
<style>
  @page { size: 55mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 3mm;
    color: #000;
    background: #fff;
    width: 51mm;
    padding: 2.5mm 2mm;
    overflow: visible;
  }
  .hdr { text-align: center; padding-bottom: 2mm; border-bottom: 0.4mm solid #000; margin-bottom: 2.5mm; }
  .b1  { font-size: 5mm; font-weight: 900; line-height: 1.2; }
  .b2  { font-size: 4mm; font-weight: 900; line-height: 1.2; }
  .dt  { font-size: 2.5mm; margin-top: 1.5mm; }
  .info-sec { margin-bottom: 2.5mm; padding-bottom: 2mm; border-bottom: 0.3mm dashed #000; }
  .irow { display: flex; padding: 0.8mm 0; font-size: 3mm; gap: 1mm; }
  .ilbl { font-weight: 700; min-width: 17mm; flex-shrink: 0; }
  .folio { text-align: center; border: 0.4mm solid #000; padding: 2mm 1mm; margin-bottom: 2.5mm; }
  .folio-lbl { font-size: 2.5mm; }
  .folio-num { font-size: 5mm; font-weight: 900; margin-top: 0.5mm; }
  table.prods { width: 100%; border-collapse: collapse; margin-bottom: 1.5mm; font-size: 2.8mm; }
  table.prods th { border-top: 0.4mm solid #000; border-bottom: 0.4mm solid #000; padding: 1.5mm 1mm; text-align: left; font-weight: 700; }
  table.prods td { padding: 1.5mm 1mm; vertical-align: top; line-height: 1.35; }
  .tc { width: 7mm; }
  .tp { text-align: right; }
  .total-row { display: flex; justify-content: space-between; align-items: baseline; font-weight: 900; font-size: 4.5mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2mm 0; margin-bottom: 2.5mm; }
  .ph-title { text-align: center; font-weight: 900; font-size: 3mm; border-top: 0.3mm dashed #000; border-bottom: 0.3mm dashed #000; padding: 1.5mm 0; margin: 2mm 0 1.5mm; }
  .ph-line { display: none; }
  table.pagos { width: 100%; border-collapse: collapse; font-size: 2.8mm; }
  table.pagos th { text-align: left; font-weight: 700; padding: 1mm 1mm; border-bottom: 0.3mm solid #000; }
  table.pagos td { padding: 1mm 1mm; }
  .r { text-align: right; }
  .pagos-total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 3mm; border-top: 0.4mm solid #000; padding-top: 1.5mm; margin: 1.5mm 0 2.5mm; }
  .saldo-box { border: 0.5mm solid #000; padding: 2.5mm 2mm; text-align: center; margin-bottom: 2.5mm; }
  .saldo-lbl { font-size: 2.8mm; line-height: 1.4; }
  .saldo-val { font-size: 5mm; font-weight: 900; margin-top: 1.5mm; }
  .icard { padding: 2mm 0; border-top: 0.3mm dashed #000; font-size: 2.8mm; line-height: 1.4; }
  .firma-sec { margin: 5mm 0 2.5mm; }
  .fline-rule { border-bottom: 0.3mm solid #000; height: 5mm; }
  .flbl { font-size: 2.5mm; text-align: center; margin-top: 1mm; }
  .footer { border-top: 0.5mm solid #000; padding-top: 2.5mm; margin-top: 2mm; text-align: center; font-size: 2.8mm; line-height: 1.8; }
  .fatendio { font-weight: 700; }
  .fbar { margin-top: 2mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2mm 0; font-weight: 900; font-size: 3mm; }
  * { page-break-inside: avoid; break-inside: avoid; }
  .tip { display: block; background: #fff8e1; border: 1px solid #e5a; padding: 5px 6px; margin-bottom: 8px; font-size: 8px; line-height: 1.5; }
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

${pagosHtml}

<div class="icard">Fecha de entrega de 3 a 5 dias habiles a partir de la compra.</div>
<div class="icard">Conserve este ticket para cualquier aclaracion o garantia.</div>

<div class="firma-sec">
  <div class="fline-rule"></div>
  <div class="flbl">Nombre y firma del comprador</div>
</div>

<div class="footer">
  <div>Tel. ${SUCURSAL_CONFIG[v.sucursal]?.telefono ?? '661 612 0316'} | WA ${SUCURSAL_CONFIG[v.sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[v.sucursal]?.horario ?? 'Lun-Sab 10:00-18:00'}</div>
  ${vendedorCorto ? `<div class="fatendio">Atendio: ${vendedorCorto}</div>` : ''}
  <div>${SUCURSAL_CONFIG[v.sucursal]?.web ?? 'gonmx.com'}</div>
  <div class="fbar">... Gracias por su compra! ...</div>
</div>

</body></html>`)
  win.document.close()
  setTimeout(() => { win.print() }, 400)
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function VentasPage() {
  const [ventas, setVentas]         = useState<Venta[]>([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [sucursal, setSucursal]     = useState('Todas')
  const [detalle, setDetalle]       = useState<Venta | null>(null)
  const [showAbono, setShowAbono]   = useState(false)
  const [abonoMonto, setAbonoMonto]   = useState('')
  const [abonoMetodo, setAbonoMetodo] = useState('efectivo')

  useEffect(() => { cargar() }, [])

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
          paciente_nombre,
          paciente_telefono,
          sucursal,
          total,
          anticipo,
          saldo,
          metodo_pago,
          atendido_por,
          created_at,
          ventas_items(nombre, cantidad, precio_unitario, descuento)
        `)
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

        const pagos: Pago[] = []
        if (anticipo > 0) {
          pagos.push({ fecha, monto: anticipo, metodo: v.metodo_pago ?? 'otros' })
        } else {
          // Liquidada de contado: el pago fue el total completo
          pagos.push({ fecha, monto: v.total ?? 0, metodo: v.metodo_pago ?? 'otros' })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: ItemVenta[] = (v.ventas_items ?? []).map((i: any) => ({
          nombre:    i.nombre,
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
          fecha,
          hora,
          vendedor: v.atendido_por ?? '',
        }
      })

      setVentas(mapped)
    } finally {
      setCargando(false)
    }
  }

  const ventasFiltradas = ventas.filter(v => {
    const q = busqueda.toLowerCase()
    const matchQ = v.cliente.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) ||
      v.items.some(i => i.nombre.toLowerCase().includes(q))
    const matchS = sucursal === 'Todas' || v.sucursal === sucursal
    return matchQ && matchS
  })

  const hoy = fechaHoy()
  const totalHoy = ventas.filter(v => v.fecha === hoy).reduce((s, v) => s + v.total, 0)
  const transHoy = ventas.filter(v => v.fecha === hoy).length

  const registrarAbono = async () => {
    const monto = parseFloat(abonoMonto)
    if (!detalle || isNaN(monto) || monto <= 0) return

    // Actualizar saldo en Supabase
    const nuevoSaldo = Math.max(0, saldoPendiente(detalle) - monto)
    const supabase = createClient()
    await supabase
      .from('ventas')
      .update({ saldo: nuevoSaldo })
      .eq('id', detalle.uuid)

    const nuevoPago: Pago = {
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      monto,
      metodo: abonoMetodo,
    }
    const ventaActualizada: Venta = {
      ...detalle,
      pagos:    [...detalle.pagos, nuevoPago],
      modoPago: nuevoSaldo === 0 ? 'liquidada' : 'diferida',
    }
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
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Ventas</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Historial y registro de ventas de todas las sucursales</p>
        </div>
        <Link href="/dashboard/ventas/nueva"
          className="flex items-center gap-2 bg-[#0B0E14] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#1A1D27] active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Nueva venta
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Ventas de hoy</p>
              <p className="text-2xl font-bold text-zinc-800 mt-1">${totalHoy.toLocaleString('es-MX')}</p>
            </div>
            <div className="w-11 h-11 rounded-md bg-[#0D9488]/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#0D9488]" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">{transHoy} transacciones hoy</span>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Promedio por venta</p>
              <p className="text-2xl font-bold text-zinc-800 mt-1">
                {ventas.length > 0
                  ? `$${Math.round(ventas.reduce((s,v) => s+v.total,0) / ventas.length).toLocaleString('es-MX')}`
                  : '$0'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-md bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs text-zinc-400">Últimas {ventas.length} ventas registradas</span>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <p className="text-sm text-zinc-500 font-medium mb-2">Por método de pago</p>
          {['efectivo','tarjeta','transferencia'].map(m => {
            const count = ventas.filter(v => v.metodo === m).length
            const b = metodoBadge[m]
            const Icon = b.icon
            return (
              <div key={m} className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs text-zinc-500">{b.label}</span>
                <span className="text-xs font-semibold text-zinc-700 ml-auto">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-zinc-200/80">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="relative flex-1 max-w-xs">
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
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 ml-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>{ventasFiltradas.length} resultados</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
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
                    <tr key={v.id} onClick={() => { setDetalle(v); setShowAbono(false); setAbonoMonto('') }}
                      className="hover:bg-zinc-50 transition-colors cursor-pointer group">
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono font-semibold text-zinc-500">{v.id}</span>
                        {saldo > 0 && (
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
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${m.cls}`}>
                          <MIcon className="w-3 h-3" />{m.label}
                        </span>
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 flex-shrink-0">
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
                        <span className="text-sm font-bold text-emerald-700">+${p.monto.toLocaleString('es-MX')}</span>
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
                    <label className="block text-xs font-semibold text-zinc-500 mb-1">Monto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-sm">$</span>
                      <input type="number" min={1} max={saldoPendiente(detalle)}
                        value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)}
                        className="w-full border-2 border-[#0D9488] rounded pl-7 pr-3 py-2.5 text-lg font-bold text-zinc-800 bg-white focus:outline-none"
                        placeholder="0" autoFocus />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Máximo: ${saldoPendiente(detalle).toLocaleString('es-MX')}</p>
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
                    <button onClick={registrarAbono} disabled={!abonoMonto || parseFloat(abonoMonto) <= 0}
                      className="flex-1 py-2 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-colors">
                      Registrar abono
                    </button>
                  </div>
                </div>
              )}

              {/* Info venta */}
              <div className="text-xs text-zinc-400 space-y-1 border-t border-zinc-100 pt-3">
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
            <div className="px-6 pb-5 pt-3 border-t border-zinc-100 flex-shrink-0 space-y-2">
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
              <button onClick={() => imprimirTicket(detalle)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50 transition-colors">
                <Printer className="w-4 h-4" /> Reimprimir ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
