'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  UserPlus,
  Banknote,
  CreditCard,
  Building2,
  Clock,
  CheckCircle2,
  Package,
  X,
  ChevronDown,
  FileText,
  CalendarDays,
  Phone,
  AlertCircle,
  Printer,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'

// --- Mock data ---
const catalogo = [
  { id: 1, nombre: 'Armazón Ray-Ban RB5154', categoria: 'Armazones', precio: 2800, sku: 'ARZ-001', stock: 5 },
  { id: 2, nombre: 'Armazón Oakley OX8046', categoria: 'Armazones', precio: 3200, sku: 'ARZ-002', stock: 2 },
  { id: 3, nombre: 'Armazón básico acetato', categoria: 'Armazones', precio: 950, sku: 'ARZ-003', stock: 8 },
  { id: 4, nombre: 'Micas monofocales CR-39', categoria: 'Micas', precio: 800, sku: 'MCR39', stock: 999 },
  { id: 5, nombre: 'Micas antirreflejantes', categoria: 'Micas', precio: 1200, sku: 'MIC-002', stock: 999 },
  { id: 6, nombre: 'Micas progresivas Essilor', categoria: 'Micas', precio: 3500, sku: 'MIC-003', stock: 999 },
  { id: 7, nombre: 'Micas transitions', categoria: 'Micas', precio: 2800, sku: 'MIC-004', stock: 999 },
  { id: 8, nombre: 'Lentes contacto Acuvue 1 día', categoria: 'Lentes de contacto', precio: 320, sku: 'LC-001', stock: 24 },
  { id: 9, nombre: 'Lentes contacto Acuvue mensual', categoria: 'Lentes de contacto', precio: 580, sku: 'LC-002', stock: 12 },
  { id: 10, nombre: 'Solución Renu 120ml', categoria: 'Accesorios', precio: 180, sku: 'ACC-001', stock: 3 },
]

const clientesMock = [
  { id: 1, nombre: 'María', apellido: 'González Ruiz', telefono: '686 123 4567' },
  { id: 2, nombre: 'Carlos', apellido: 'Ruiz Soto', telefono: '686 234 5678' },
  { id: 3, nombre: 'Ana', apellido: 'López Mendez', telefono: '686 345 6789' },
  { id: 4, nombre: 'Pedro', apellido: 'Sánchez Torres', telefono: '686 456 7890' },
]

const sucursales = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

const metodosPago = [
  { key: 'efectivo',      label: 'Efectivo',          icon: Banknote  },
  { key: 'debito',        label: 'Tarjeta de débito',  icon: CreditCard },
  { key: 'credito',       label: 'Tarjeta de crédito', icon: CreditCard },
  { key: 'transferencia', label: 'Transferencia',      icon: Building2 },
  { key: 'deposito',      label: 'Depósito bancario',  icon: Building2 },
  { key: 'otros',         label: 'Otros',              icon: Clock     },
]

type Item = { id: number; nombre: string; precio: number; cantidad: number; sku: string; stock: number; descuento: number }
type Cliente = typeof clientesMock[0]

// Comisión es interna (para finanzas), no se traslada al cliente
const COMISION: Record<string, number> = { debito: 0.015, credito: 0.029 }

export default function NuevaVentaPage() {
  const [sucursal, setSucursal] = useState('Baja Visión')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteApellido, setClienteApellido] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [carrito, setCarrito] = useState<Item[]>([])
  const [showModal, setShowModal] = useState(false)
  const [modoPago, setModoPago] = useState<'liquidar' | 'diferir'>('liquidar')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [anticipo, setAnticipo] = useState<number | ''>('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [esCotizacion, setEsCotizacion] = useState(false)
  const [folioGuardado, setFolioGuardado] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [showBuscadorProducto, setShowBuscadorProducto] = useState(false)
  const [showProductoLibre, setShowProductoLibre] = useState(false)
  const [productoLibre, setProductoLibre] = useState({ descripcion: '', precio: '', cantidad: '1' })

  // Búsqueda de clientes — muestra todos al enfocar, filtra al escribir
  const clientesFiltrados = busquedaCliente.length >= 1
    ? clientesMock.filter(c =>
        `${c.nombre} ${c.apellido}`.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
        c.telefono.includes(busquedaCliente)
      )
    : clientesMock

  const productosFiltrados = catalogo.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.sku.toLowerCase().includes(busquedaProducto.toLowerCase())
  )

  const seleccionarCliente = (c: Cliente) => {
    setCliente(c)
    setClienteNombre(c.nombre)
    setClienteApellido(c.apellido)
    setClienteTelefono(c.telefono)
    setBusquedaCliente('')
    setShowClienteDropdown(false)
  }

  const agregar = (p: typeof catalogo[0]) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...p, cantidad: 1, descuento: 0 }]
    })
    setBusquedaProducto('')
    setShowBuscadorProducto(false)
  }

  const cambiarCantidad = (id: number, delta: number) =>
    setCarrito(prev => prev.map(i => i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))

  const cambiarDescuento = (id: number, val: string) => {
    const n = Math.min(100, Math.max(0, parseInt(val) || 0))
    setCarrito(prev => prev.map(i => i.id === id ? { ...i, descuento: n } : i))
  }

  const eliminar = (id: number) => setCarrito(prev => prev.filter(i => i.id !== id))

  const limpiar = () => {
    setCarrito([])
    setCliente(null)
    setClienteNombre('')
    setClienteApellido('')
    setClienteTelefono('')
    setFechaEntrega('')
    setBusquedaCliente('')
  }

  const subtotal = carrito.reduce((s, i) => {
    const desc = i.precio * (i.descuento / 100)
    return s + (i.precio - desc) * i.cantidad
  }, 0)

  // El total al cliente es el subtotal. La comisión bancaria la absorbe la tienda (se registra en finanzas).
  const total = subtotal

  const handleFinalizar = async (cotizacion = false) => {
    setGuardando(true)
    setEsCotizacion(cotizacion)
    setErrorGuardado('')

    try {
      const supabase = createClient()

      // Leer usuario actual
      let atendioPor = ''
      try { atendioPor = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')?.nombre || '' } catch {}

      // ── 1. Obtener folio siguiente ──────────────────────────
      const prefijo = cotizacion ? 'COT' : 'V'
      const { data: folioData } = await supabase.rpc('siguiente_folio', { prefijo })
      const folio: string = folioData ?? `${prefijo}-0001`

      const anticoNum = Number(anticipo || 0)
      const saldoNum  = total - anticoNum

      // ── 2. Insertar venta ───────────────────────────────────
      const { data: ventaRow, error: errVenta } = await supabase
        .from('ventas')
        .insert({
          folio,
          paciente_nombre:   `${clienteNombre} ${clienteApellido}`.trim(),
          paciente_telefono: clienteTelefono,
          sucursal,
          subtotal,
          total,
          anticipo:    anticoNum,
          saldo:       saldoNum,
          metodo_pago: metodoPago,
          estado:      'activa',
          es_cotizacion: cotizacion,
          fecha_entrega: fechaEntrega || null,
          atendido_por:  atendioPor,
        })
        .select('id')
        .single()

      if (errVenta) throw new Error(errVenta.message)

      const ventaId = ventaRow.id

      // ── 3. Insertar items ───────────────────────────────────
      const items = carrito.map(i => {
        const pu = i.precio * (1 - i.descuento / 100)
        return {
          venta_id:        ventaId,
          nombre:          i.nombre,
          sku:             i.sku,
          precio_unitario: i.precio,
          cantidad:        i.cantidad,
          descuento:       i.descuento,
          subtotal:        pu * i.cantidad,
        }
      })
      await supabase.from('ventas_items').insert(items)

      // ── 4. Crear movimiento de caja ─────────────────────────
      if (!cotizacion) {
        const montoIngreso = anticoNum > 0 ? anticoNum : total
        await supabase.from('caja_movimientos').insert({
          tipo:           'ingreso',
          concepto:       `Venta ${folio} — ${`${clienteNombre} ${clienteApellido}`.trim() || 'Sin nombre'}`,
          monto:          montoIngreso,
          sucursal,
          metodo_pago:    metodoPago,
          referencia:     folio,
          registrado_por: atendioPor,
        })
      }

      // ── 5. Crear orden de laboratorio si hay micas ──────────
      const tieneMicas = carrito.some(i =>
        i.nombre.toLowerCase().includes('mica') ||
        i.nombre.toLowerCase().includes('progres') ||
        i.nombre.toLowerCase().includes('bifocal') ||
        i.nombre.toLowerCase().includes('monofocal') ||
        i.nombre.toLowerCase().includes('transitions')
      )

      if (!cotizacion && tieneMicas) {
        const { data: folioLab } = await supabase.rpc('siguiente_folio', { prefijo: 'L' })
        const hoy = new Date().toISOString().split('T')[0]

        await supabase.from('ordenes_lab').insert({
          folio:         folioLab ?? 'L-0001',
          folio_venta:   folio,
          venta_id:      ventaId,
          paciente:      `${clienteNombre} ${clienteApellido}`.trim() || 'Sin nombre',
          telefono:      clienteTelefono,
          sucursal,
          estado:        'recibido',
          fecha_ingreso: hoy,
          fecha_promesa: fechaEntrega || '',
          precio_cliente: total,
          anticipo:       anticoNum,
        })
      }

      setFolioGuardado(folio)
      setShowModal(false)
      setGuardado(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setErrorGuardado(msg)
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  // ── PANTALLA POST-VENTA ──
  if (guardado) {
    const folio = folioGuardado
    const metodoPagoLabel = metodosPago.find(m => m.key === metodoPago)?.label ?? metodoPago
    const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const horaHoy = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

    const handleImprimirTicket = () => {
      // Usuario que atendió
      let atendioPor = ''
      try { atendioPor = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')?.nombre || '' } catch {}

      const fechaFmt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

      // Filas de productos
      const productosRows = carrito.map(item => {
        const precioUnit = item.precio * (1 - item.descuento / 100)
        const subtotalItem = precioUnit * item.cantidad
        const descStr = item.descuento > 0 ? `<br><small>(−${item.descuento}%)</small>` : ''
        return `<tr>
          <td class="cant">${item.cantidad}</td>
          <td class="desc">${item.nombre}${descStr}</td>
          <td class="precio">$${subtotalItem.toLocaleString('es-MX')}</td>
        </tr>`
      }).join('')

      // Sección de pagos realizados (solo si hay anticipo diferido)
      const anticoNum = Number(anticipo || 0)
      const saldo = total - anticoNum
      const pagosHtml = modoPago === 'diferir' ? `
        <div class="section-title">Pagos Realizados</div>
        <table class="pagos">
          <tr><th>#</th><th>Fecha</th><th>Pago</th></tr>
          ${anticoNum > 0 ? `<tr><td>1</td><td>${fechaFmt}</td><td class="r">$${anticoNum.toLocaleString('es-MX')}</td></tr>` : ''}
        </table>
        ${anticoNum > 0 ? `<div class="pagos-total">$${anticoNum.toLocaleString('es-MX')}</div>` : ''}
        <div class="saldo-box">
          Cantidad restante para liquidar el pago:<br>
          <b>$${saldo.toLocaleString('es-MX')}</b>
        </div>` : ''

      const entregaHtml = fechaEntrega
        ? `<div class="entrega">Fecha de entrega: <b>${fechaEntrega}</b></div>`
        : `<div class="entrega">Fecha de entrega de 3 a 5 días hábiles a partir de la compra.</div>`

      const win = window.open('', '_blank', 'width=330,height=900')
      if (!win) return
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${folio}</title>
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 74mm; }
  .hdr { text-align: center; padding-bottom: 7px; border-bottom: 2px solid #000; margin-bottom: 7px; }
  .hdr .store { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; }
  .hdr .branch { font-size: 12px; font-weight: 700; }
  .hdr .date { font-size: 10px; margin-top: 3px; }
  .info { margin-bottom: 7px; padding-bottom: 7px; border-bottom: 1px dashed #000; font-size: 10.5px; }
  .info div { margin: 1.5px 0; }
  .folio { font-size: 12px; font-weight: 900; text-align: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-bottom: 7px; }
  table.prods { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 5px; }
  table.prods th { border-bottom: 1px solid #000; padding: 2px 1px; text-align: left; font-size: 10px; }
  .cant { width: 22px; }
  .desc { padding: 2px 3px; }
  .precio { text-align: right; white-space: nowrap; padding: 2px 0; }
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
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>

<div class="hdr">
  <div class="store">${(SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[sucursal]?.nombreLinea2 ? `<div class="branch">${SUCURSAL_CONFIG[sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="date">${fechaFmt} &nbsp; ${horaHoy}</div>
</div>

<div class="info">
  ${(clienteNombre || clienteApellido) ? `<div><b>Paciente:</b> ${clienteNombre} ${clienteApellido}</div>` : ''}
  ${clienteTelefono ? `<div><b>Teléfono:</b> ${clienteTelefono}</div>` : ''}
</div>

<div class="folio">Folio de venta: ${folio}</div>

<table class="prods">
  <thead><tr><th class="cant">Cant.</th><th class="desc">Desc.</th><th class="precio">Precio</th></tr></thead>
  <tbody>${productosRows}</tbody>
</table>

<div class="total-row"><span>TOTAL:</span><span>$${total.toLocaleString('es-MX')}</span></div>

${pagosHtml}

${entregaHtml}

<div class="conserva">Conserve este ticket para cualquier aclaración o garantía.</div>

<div class="firma"><div class="firma-line">Nombre y firma del comprador</div></div>

<div class="footer">
  <div>Tel. ${SUCURSAL_CONFIG[sucursal]?.telefono ?? '661 612 0316'} &nbsp;|&nbsp; WA ${SUCURSAL_CONFIG[sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[sucursal]?.horario ?? 'Lun–Sáb 10:00–18:00'}</div>
  ${atendioPor ? `<b>Atendió: ${atendioPor}</b>` : ''}
  <div>${SUCURSAL_CONFIG[sucursal]?.web ?? 'gonmx.com'}</div>
</div>

</body></html>`)
      win.document.close()
      setTimeout(() => { win.print() }, 300)
    }

    return (
      <div className="max-w-lg mx-auto py-8 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {esCotizacion ? 'Cotización generada' : 'Venta registrada'}
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">{folio} · {sucursal}</p>
          </div>
        </div>

        {/* Ticket card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {/* Header del ticket */}
          <div className="bg-[#0B1A35] px-5 py-4 text-center">
            <p className="text-white font-bold text-base">{SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal}</p>
            {SUCURSAL_CONFIG[sucursal]?.nombreLinea2 && (
              <p className="text-white/70 text-xs mt-0.5">{SUCURSAL_CONFIG[sucursal].nombreLinea2}</p>
            )}
            <p className="text-white/40 text-xs mt-1">{fechaHoy} · {horaHoy} · {folio}</p>
          </div>

          {/* Cliente */}
          {(clienteNombre || clienteApellido) && (
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">Cliente</span>
              <span className="text-sm font-semibold text-slate-700">{clienteNombre} {clienteApellido}</span>
            </div>
          )}

          {/* Productos */}
          <div className="px-5 py-3 space-y-3">
            {carrito.map(item => {
              const precio = item.precio * (1 - item.descuento / 100)
              const sub = precio * item.cantidad
              return (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.nombre}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.cantidad > 1 ? `${item.cantidad} × $${precio.toLocaleString('es-MX')}` : ''}
                      {item.descuento > 0 ? `${item.cantidad > 1 ? ' · ' : ''}Desc. ${item.descuento}%` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-800 ml-4 flex-shrink-0">${sub.toLocaleString('es-MX')}</span>
                </div>
              )
            })}
          </div>

          {/* Total + método de pago */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400">Método de pago</p>
                <p className="text-sm font-semibold text-slate-600 mt-0.5">{metodoPagoLabel}{modoPago === 'diferir' ? ' · Diferido' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total venta</p>
                <p className="text-2xl font-bold text-[#0B1A35]">${total.toLocaleString('es-MX')}</p>
              </div>
            </div>
            {modoPago === 'diferir' && (
              <div className="border-t border-slate-200 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Anticipo recibido</span>
                  <span className="font-bold text-emerald-700">${Number(anticipo || 0).toLocaleString('es-MX')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 font-semibold">Saldo pendiente</span>
                  <span className="font-bold text-red-600">${(total - Number(anticipo || 0)).toLocaleString('es-MX')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleImprimirTicket}
            className="flex items-center justify-center gap-2 py-3 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <Link
            href="/dashboard/ventas"
            className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors text-center"
          >
            Ver historial
          </Link>
          <button
            onClick={() => { limpiar(); setGuardado(false) }}
            className="flex items-center justify-center gap-2 py-3 bg-[#0B1A35] text-white rounded-lg text-sm font-bold hover:bg-[#0d2145] transition-colors"
          >
            Nueva venta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ventas" className="w-9 h-9 flex items-center justify-center rounded-md bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nueva venta</h1>
          <p className="text-sm text-slate-400">Completa los datos y genera la venta o cotización</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <select
              value={sucursal}
              onChange={e => setSucursal(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-md pl-4 pr-8 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
            >
              {sucursales.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Cliente + Fecha */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Buscar cliente */}
          <div className="col-span-2 relative">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Buscar cliente *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={busquedaCliente}
                onChange={e => setBusquedaCliente(e.target.value)}
                onFocus={() => setShowClienteDropdown(true)}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                placeholder="Busca por nombre o teléfono..."
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400"
              />
              {cliente && (
                <button onClick={() => { setCliente(null); setBusquedaCliente('') }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
            {showClienteDropdown && !cliente && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-md shadow-xl z-20 divide-y divide-slate-50 overflow-hidden">
                {clientesFiltrados.length > 0
                  ? clientesFiltrados.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => seleccionarCliente(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#2BBFB3]/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-[#2BBFB3]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{c.nombre} {c.apellido}</p>
                        <p className="text-xs text-slate-400">{c.telefono}</p>
                      </div>
                    </button>
                  ))
                  : (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">
                      Sin resultados para "{busquedaCliente}"
                    </div>
                  )
                }
                <button
                  onMouseDown={() => setShowClienteDropdown(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#2BBFB3] hover:bg-slate-50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Registrar nuevo cliente
                </button>
              </div>
            )}
          </div>

          {/* Fecha de entrega */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Fecha sugerida de entrega</span>
            </label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={e => setFechaEntrega(e.target.value)}
              className="w-full py-2.5 px-4 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 text-slate-700"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre *</label>
            <input
              value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)}
              placeholder="Nombre"
              className="w-full py-2.5 px-4 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400"
            />
          </div>

          {/* Apellido */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Apellido *</label>
            <input
              value={clienteApellido}
              onChange={e => setClienteApellido(e.target.value)}
              placeholder="Apellido"
              className="w-full py-2.5 px-4 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400"
            />
          </div>

          {/* Teléfono */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Teléfono de contacto</span>
            </label>
            <input
              value={clienteTelefono}
              onChange={e => setClienteTelefono(e.target.value)}
              placeholder="686 000 0000"
              className="w-full py-2.5 px-4 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Productos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs text-slate-400 font-medium px-6 py-3 w-28">Código</th>
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Descripción</th>
                <th className="text-center text-xs text-slate-400 font-medium px-4 py-3 w-32">Cantidad</th>
                <th className="text-center text-xs text-slate-400 font-medium px-4 py-3 w-24">Existencias</th>
                <th className="text-right text-xs text-slate-400 font-medium px-4 py-3 w-32">Precio</th>
                <th className="text-center text-xs text-slate-400 font-medium px-4 py-3 w-28">Desc. %</th>
                <th className="text-right text-xs text-slate-400 font-medium px-4 py-3 w-32">Subtotal</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr>
                <td colSpan={8} className="px-6 py-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={busquedaProducto}
                      onChange={e => { setBusquedaProducto(e.target.value); setShowBuscadorProducto(true) }}
                      onFocus={() => setShowBuscadorProducto(true)}
                      placeholder="Buscar por código o descripción del producto..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400"
                    />
                    {showBuscadorProducto && busquedaProducto && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-md shadow-xl z-20 divide-y divide-slate-50 overflow-hidden max-h-64 overflow-y-auto">
                        {productosFiltrados.slice(0, 8).map(p => (
                          <button
                            key={p.id}
                            onClick={() => agregar(p)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div>
                              <span className="text-xs font-mono text-slate-400 mr-3">{p.sku}</span>
                              <span className="text-sm font-medium text-slate-700">{p.nombre}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-slate-400">Stock: {p.stock === 999 ? '∞' : p.stock}</span>
                              <span className="text-sm font-bold text-slate-800">${p.precio.toLocaleString('es-MX')}</span>
                            </div>
                          </button>
                        ))}
                        {productosFiltrados.length === 0 && (
                          <div className="px-4 py-4 text-sm text-slate-400 text-center">Sin resultados</div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>

              {carrito.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <Package className="w-10 h-10" />
                      <p className="text-sm">Busca y agrega productos arriba</p>
                    </div>
                  </td>
                </tr>
              )}

              {carrito.map(item => {
                const descMonto = item.precio * (item.descuento / 100)
                const precioFinal = item.precio - descMonto
                const subtotalItem = precioFinal * item.cantidad
                const stockBajo = item.stock !== 999 && item.cantidad > item.stock

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 group">
                    <td className="px-6 py-3">
                      <span className="text-xs font-mono text-slate-500">{item.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">{item.nombre}</p>
                      {stockBajo && (
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3" /> Stock insuficiente
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => cambiarCantidad(item.id, -1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                          <Minus className="w-3 h-3 text-slate-600" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-700">{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                          <Plus className="w-3 h-3 text-slate-600" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${item.stock === 999 ? 'text-slate-400' : item.stock < 5 ? 'text-amber-500' : 'text-slate-500'}`}>
                        {item.stock === 999 ? '∞' : item.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-slate-700">${item.precio.toLocaleString('es-MX')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.descuento || ''}
                          onChange={e => cambiarDescuento(item.id, e.target.value)}
                          placeholder="0"
                          className="w-14 text-center text-sm border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-[#2BBFB3] bg-slate-50"
                        />
                        <span className="text-slate-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-slate-800">${subtotalItem.toLocaleString('es-MX')}</span>
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => eliminar(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {carrito.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setBusquedaProducto(''); setShowBuscadorProducto(true) }}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-md px-4 py-2 hover:border-slate-300 transition-all"
              >
                <Plus className="w-4 h-4" /> Agregar producto
              </button>
              <button
                onClick={() => { setProductoLibre({ descripcion: '', precio: '', cantidad: '1' }); setShowProductoLibre(true) }}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-md px-4 py-2 hover:border-slate-300 transition-all"
              >
                <Plus className="w-4 h-4" /> Producto libre
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-sm text-slate-400">Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">$</span>
                  <span className="text-2xl font-bold text-slate-800">{subtotal.toLocaleString('es-MX')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botones finales */}
      <div className="flex items-center justify-between">
        <button
          onClick={limpiar}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition-all"
        >
          <X className="w-4 h-4" /> Limpiar
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEsCotizacion(true); setShowModal(true) }}
            disabled={carrito.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            Generar cotización
          </button>
          <button
            onClick={() => { setEsCotizacion(false); setShowModal(true) }}
            disabled={carrito.length === 0 || !clienteNombre}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0B1A35] text-white rounded-md text-sm font-bold hover:bg-[#0d2145] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            Generar venta
          </button>
        </div>
      </div>

      {/* Modal producto libre */}
      {showProductoLibre && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Agregar producto no inventariado</h3>
              <button onClick={() => setShowProductoLibre(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción del producto o servicio"
                  value={productoLibre.descripcion}
                  onChange={e => setProductoLibre(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={productoLibre.precio}
                      onChange={e => setProductoLibre(p => ({ ...p, precio: e.target.value }))}
                      className="w-full border border-slate-200 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={productoLibre.cantidad}
                    onChange={e => setProductoLibre(p => ({ ...p, cantidad: e.target.value }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setShowProductoLibre(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const precio = parseFloat(productoLibre.precio) || 0
                  const cantidad = parseInt(productoLibre.cantidad) || 1
                  if (!productoLibre.descripcion.trim() || precio <= 0) return
                  const id = Date.now()
                  setCarrito(prev => [...prev, {
                    id,
                    nombre: productoLibre.descripcion.trim(),
                    precio,
                    cantidad,
                    sku: 'LIBRE',
                    stock: 999,
                    descuento: 0,
                  }])
                  setShowProductoLibre(false)
                }}
                className="flex-1 bg-[#2BBFB3] text-white rounded-md py-2 text-sm font-medium hover:bg-[#24a89d] transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {esCotizacion ? 'Confirmar cotización' : 'Opciones de pago'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {!esCotizacion && (
                <>
                  {/* Modo de pago */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">Modo de pago</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setModoPago('liquidar')}
                        className={`py-3 rounded-md text-sm font-semibold border transition-all ${modoPago === 'liquidar' ? 'border-[#0B1A35] bg-[#0B1A35] text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        Liquidar total
                      </button>
                      <button
                        onClick={() => setModoPago('diferir')}
                        className={`py-3 rounded-md text-sm font-semibold border transition-all ${modoPago === 'diferir' ? 'border-[#0B1A35] bg-[#0B1A35] text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        Diferir pagos
                      </button>
                    </div>
                  </div>

                  {/* Método de pago */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">Método de pago</label>
                    <div className="relative">
                      <select
                        value={metodoPago}
                        onChange={e => setMetodoPago(e.target.value)}
                        className="w-full appearance-none border border-slate-200 rounded-md px-4 py-3 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 pr-10"
                      >
                        {metodosPago.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Anticipo — solo cuando se difiere */}
                  {modoPago === 'diferir' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">
                        Anticipo recibido <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          max={total}
                          value={anticipo}
                          onChange={e => setAnticipo(e.target.value === '' ? '' : Math.min(total, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="w-full border-2 border-[#2BBFB3] rounded-md pl-8 pr-4 py-3 text-lg font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                          placeholder="0"
                          autoFocus
                        />
                      </div>
                      {anticipo !== '' && anticipo > 0 && (
                        <p className="text-xs text-slate-500 mt-1.5">
                          Saldo pendiente: <span className="font-bold text-slate-700">${(total - Number(anticipo)).toLocaleString('es-MX')}</span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Total */}
              <div className="bg-slate-50 rounded-lg px-5 py-4">
                {modoPago === 'diferir' && anticipo !== '' && Number(anticipo) > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Total venta</span>
                      <span className="font-semibold">${total.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>Anticipo</span>
                      <span className="font-bold">− ${Number(anticipo).toLocaleString('es-MX')}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between">
                      <span className="text-sm font-semibold text-slate-700">Saldo pendiente</span>
                      <span className="text-xl font-bold text-red-600">${(total - Number(anticipo)).toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">
                      {esCotizacion ? 'Total estimado' : (modoPago === 'diferir' ? 'Total (pendiente de anticipo)' : 'Total a cobrar')}
                    </p>
                    <p className="text-3xl font-bold text-[#0B1A35]">${total.toLocaleString('es-MX')}</p>
                  </div>
                )}
                {clienteNombre && (
                  <p className="text-xs text-slate-400 mt-2 text-center">{clienteNombre} {clienteApellido}</p>
                )}
              </div>
            </div>

            {errorGuardado && (
              <div className="mx-6 mb-3 px-4 py-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
                {errorGuardado}
              </div>
            )}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-md text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => handleFinalizar(esCotizacion)}
                disabled={guardando}
                className="flex-1 py-3 bg-[#2BBFB3] text-white rounded-md text-sm font-bold hover:bg-teal-500 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : esCotizacion ? 'Generar cotización' : 'Finalizar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
