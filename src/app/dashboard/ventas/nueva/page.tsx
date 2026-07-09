'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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

// --- Catálogo GON ---
const catalogo = [
  // ── Micas Monofocal ──────────────────────────────────────────
  { id:  1, nombre: 'Mica Monofocal Essential',      categoria: 'Micas', precio:  749, sku: 'MON-ESS',  stock: 999 },
  { id:  2, nombre: 'Mica Monofocal Slim HD 1.60',        categoria: 'Micas', precio: 1146, sku: 'MON-SHD',  stock: 999 },
  { id:  3, nombre: 'Mica Monofocal Poly Plus 1.58',      categoria: 'Micas', precio: 1746, sku: 'MON-PPL',  stock: 999 },
  { id:  4, nombre: 'Mica Monofocal Ultra Slim 1.67',     categoria: 'Micas', precio: 3946, sku: 'MON-USL',  stock: 999 },
  { id:  5, nombre: 'Mica Monofocal Ultra Slim Pro 1.74', categoria: 'Micas', precio: 5446, sku: 'MON-USP',  stock: 999 },
  // ── Micas Bifocal ────────────────────────────────────────────
  { id:  6, nombre: 'Mica Bifocal Essential',        categoria: 'Micas', precio: 1149, sku: 'BIF-ESS',  stock: 999 },
  { id:  7, nombre: 'Mica Bifocal Slim HD 1.60',          categoria: 'Micas', precio: 1546, sku: 'BIF-SHD',  stock: 999 },
  { id:  8, nombre: 'Mica Bifocal Poly Plus 1.58',        categoria: 'Micas', precio: 2146, sku: 'BIF-PPL',  stock: 999 },
  { id:  9, nombre: 'Mica Bifocal Ultra Slim 1.67',       categoria: 'Micas', precio: 4346, sku: 'BIF-USL',  stock: 999 },
  // ── Micas Progresivo ─────────────────────────────────────────
  { id: 10, nombre: 'Mica Progresivo Essential',     categoria: 'Micas', precio: 1899, sku: 'PRO-ESS',  stock: 999 },
  { id: 11, nombre: 'Mica Progresivo Slim HD 1.60',       categoria: 'Micas', precio: 2296, sku: 'PRO-SHD',  stock: 999 },
  { id: 12, nombre: 'Mica Progresivo Poly Plus 1.58',     categoria: 'Micas', precio: 2896, sku: 'PRO-PPL',  stock: 999 },
  { id: 13, nombre: 'Mica Progresivo Ultra Slim 1.67',    categoria: 'Micas', precio: 5096, sku: 'PRO-USL',  stock: 999 },
  { id: 14, nombre: 'Mica Progresivo Ultra Slim Pro 1.74',categoria: 'Micas', precio: 6596, sku: 'PRO-USP',  stock: 999 },
  // ── Filtros ──────────────────────────────────────────────────
  { id: 20, nombre: 'Filtro Antirreflejo',                categoria: 'Filtros', precio:  279, sku: 'FIL-AR',  stock: 999 },
  { id: 21, nombre: 'Filtro Blue Light',                  categoria: 'Filtros', precio:  549, sku: 'FIL-BL',  stock: 999 },
  { id: 22, nombre: 'Filtro Fotocromático',               categoria: 'Filtros', precio:  949, sku: 'FIL-FC',  stock: 999 },
  { id: 23, nombre: 'Filtro Polarizado',                  categoria: 'Filtros', precio: 1699, sku: 'FIL-POL', stock: 999 },
  { id: 24, nombre: 'Filtro Tinte',                       categoria: 'Filtros', precio:  549, sku: 'FIL-TIN', stock: 999 },
  // ── Servicios ─────────────────────────────────────────────────
  { id: 40, nombre: 'Examen de la vista',                 categoria: 'Servicios', precio:  200, sku: 'SRV-EXA', stock: 999 },
  { id: 41, nombre: 'Ajuste de armazón',                  categoria: 'Servicios', precio:   80, sku: 'SRV-AJU', stock: 999 },
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
type Cliente = { id: string; nombre: string; apellido: string; telefono: string }

// Colores disponibles por filtro (Fotocromático, Polarizado y Tinte piden color)
const COLORES_FILTRO: Record<string, string[]> = {
  'FIL-FC':  ['Gris', 'Café', 'Verde'],                                            // Fotocromático
  'FIL-POL': ['Gris', 'Café', 'Verde', 'Azul'],                                    // Polarizado
  'FIL-TIN': ['Gris', 'Café', 'Verde', 'Azul', 'Rosado', 'Morado', 'Amarillo'],   // Tinte
}

// Comisión es interna (para finanzas), no se traslada al cliente
const COMISION: Record<string, number> = { debito: 0.015, credito: 0.029 }

// Mapeo de recomendaciones comerciales del wizard → IDs del catálogo
const REC_A_CATALOGO: Record<string, number[]> = {
  'Antirreflejante premium':              [20],
  'Filtro para luz azul':                 [21],
  'Fotocromático (transitions)':          [22],
  'Lente progresivo':                     [10],  // progresivo essential 1.50 — vendedor ajusta
  'Material índice alto (1.60 o 1.67)':   [2],   // slim 1.60 — vendedor ajusta a 1.67 si necesario
  'Diseño ocupacional':                   [],    // no hay en catálogo, se agrega libre
}

export default function NuevaVentaPage() {
  const searchParams = useSearchParams()
  const [sucursal, setSucursal] = useState('Baja Visión')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteApellido, setClienteApellido] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clientesSuggestions, setClientesSuggestions] = useState<Cliente[]>([])
  const [recetaPaciente, setRecetaPaciente] = useState<{
    od_esfera: string; od_cilindro: string; od_eje: string; od_add: string
    oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_add: string
    dp_od: string; dp_oi: string
  } | null>(null)
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
  const [folioLabGuardado, setFolioLabGuardado] = useState('')
  const [notaImpresa, setNotaImpresa] = useState(false)
  const [ordenLabImpresa, setOrdenLabImpresa] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [showBuscadorProducto, setShowBuscadorProducto] = useState(false)
  const [showProductoLibre, setShowProductoLibre] = useState(false)
  const [productoLibre, setProductoLibre] = useState({ descripcion: '', precio: '', cantidad: '1' })
  // Modal de selección de color para filtros (Fotocromático, Polarizado, Tinte)
  const [pendingFiltro, setPendingFiltro] = useState<typeof catalogo[0] | null>(null)

  // Auto-populate desde URL params (pacienteId desde expedientes, desde_consulta desde wizard)
  useEffect(() => {
    const pacienteId    = searchParams.get('pacienteId') || searchParams.get('paciente_id')
    const desdeConsulta = searchParams.get('desde_consulta')
    const nombreParam   = searchParams.get('nombre')
    const supabase      = createClient()

    // Si viene pacienteId, cargarlo y auto-seleccionarlo
    if (pacienteId) {
      supabase.from('pacientes')
        .select('id, nombre, apellido, telefono')
        .eq('id', pacienteId)
        .single()
        .then(({ data }) => {
          if (data) {
            setCliente({ id: data.id, nombre: data.nombre, apellido: data.apellido, telefono: data.telefono })
            setClienteNombre(data.nombre)
            setClienteApellido(data.apellido)
            setClienteTelefono(data.telefono)
            cargarRecetaPaciente(data.id)
          }
        })
    } else if (nombreParam) {
      const partes = decodeURIComponent(nombreParam).split(' ')
      setClienteNombre(partes[0] || '')
      setClienteApellido(partes.slice(1).join(' ') || '')
    }

    if (!desdeConsulta) return

    supabase.from('consultas')
      .select('rec_comerciales, diagnosticos')
      .eq('id', desdeConsulta)
      .single()
      .then(({ data }) => {
        if (!data?.rec_comerciales) return
        const recs: { producto: string; prioridad: string }[] = Array.isArray(data.rec_comerciales)
          ? data.rec_comerciales : []
        const itemsAgregar: Item[] = []
        for (const rec of recs) {
          const ids = REC_A_CATALOGO[rec.producto]
          if (!ids || ids.length === 0) continue
          for (const id of ids) {
            const prod = catalogo.find(p => p.id === id)
            if (prod && !itemsAgregar.find(i => i.id === id)) {
              itemsAgregar.push({ ...prod, cantidad: 1, descuento: 0 })
            }
          }
        }
        if (itemsAgregar.length > 0) setCarrito(itemsAgregar)
      })
  }, []) // eslint-disable-line

  // Búsqueda de clientes en Supabase
  useEffect(() => {
    if (!showClienteDropdown) return
    const supabase = createClient()
    const q = busquedaCliente.trim()
    const query = supabase.from('pacientes')
      .select('id, nombre, apellido, telefono')
      .order('nombre', { ascending: true })
      .limit(8)

    const fetch = q.length >= 1
      ? query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%`)
      : query

    fetch.then(({ data }) => {
      setClientesSuggestions((data ?? []).map(p => ({
        id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono
      })))
    })
  }, [busquedaCliente, showClienteDropdown])

  const productosFiltrados = catalogo.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.sku.toLowerCase().includes(busquedaProducto.toLowerCase())
  )

  const cargarRecetaPaciente = async (pacienteId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('recetas')
      .select('od_esfera,od_cilindro,od_eje,od_add,oi_esfera,oi_cilindro,oi_eje,oi_add,dp_od,dp_oi')
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRecetaPaciente(data ?? null)
  }

  const seleccionarCliente = (c: Cliente) => {
    setCliente(c)
    setClienteNombre(c.nombre)
    setClienteApellido(c.apellido)
    setClienteTelefono(c.telefono)
    setBusquedaCliente('')
    setShowClienteDropdown(false)
    if (c.id) cargarRecetaPaciente(c.id)
  }

  const agregarDirecto = (p: typeof catalogo[0], colorSufijo?: string) => {
    const nombre = colorSufijo ? `${p.nombre} — ${colorSufijo}` : p.nombre
    // Usar id único por color para permitir el mismo filtro en distintos colores
    const idVirtual = colorSufijo ? p.id * 1000 + p.nombre.length + colorSufijo.charCodeAt(0) : p.id
    setCarrito(prev => {
      const ex = prev.find(i => i.id === idVirtual)
      if (ex) return prev.map(i => i.id === idVirtual ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...p, id: idVirtual, nombre, cantidad: 1, descuento: 0 }]
    })
    setBusquedaProducto('')
    setShowBuscadorProducto(false)
  }

  const agregar = (p: typeof catalogo[0]) => {
    // Si el filtro requiere selección de color, abrimos el selector
    if (COLORES_FILTRO[p.sku]) {
      setPendingFiltro(p)
      setBusquedaProducto('')
      setShowBuscadorProducto(false)
      return
    }
    agregarDirecto(p)
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
    setFolioLabGuardado('')
    setNotaImpresa(false)
    setOrdenLabImpresa(false)
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
      const { data: ultimoV } = await supabase
        .from('ventas')
        .select('folio')
        .ilike('folio', `${prefijo}-%`)
        .order('folio', { ascending: false })
        .limit(1)
      const nV = ultimoV?.[0]?.folio ? parseInt(ultimoV[0].folio.replace(/\D/g, '')) + 1 : 1
      const folio: string = `${prefijo}-${String(nV).padStart(4, '0')}`

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
        const { data: ultimoL } = await supabase
          .from('ordenes_lab')
          .select('folio')
          .ilike('folio', 'L-%')
          .order('folio', { ascending: false })
          .limit(1)
        const nL = ultimoL?.[0]?.folio ? parseInt(ultimoL[0].folio.replace(/\D/g, '')) + 1 : 1
        const folioLab: string = `L-${String(nL).padStart(4, '0')}`
        const hoy = new Date().toISOString().split('T')[0]

        // Armar texto de tipo mica y tratamientos desde carrito
        const micasCarrito = carrito.filter(i =>
          i.nombre.toLowerCase().includes('mica') ||
          i.nombre.toLowerCase().includes('progres') ||
          i.nombre.toLowerCase().includes('bifocal') ||
          i.nombre.toLowerCase().includes('monofocal') ||
          i.nombre.toLowerCase().includes('transitions')
        ).map(i => i.nombre).join(', ')

        const filtrosCarrito = carrito.filter(i =>
          i.nombre.toLowerCase().includes('filtro') ||
          i.nombre.toLowerCase().includes('antirreflejo') ||
          i.nombre.toLowerCase().includes('blue light') ||
          i.nombre.toLowerCase().includes('fotocrom') ||
          i.nombre.toLowerCase().includes('polariz') ||
          i.nombre.toLowerCase().includes('tinte')
        ).map(i => i.nombre).join(', ')

        // Formatear graduación OD/OI como texto para ordenes_lab
        const fmtOjo = (esf: string, cil: string, eje: string) =>
          [esf, cil, eje ? `${eje}°` : ''].filter(Boolean).join(' / ')

        const odTexto = recetaPaciente
          ? fmtOjo(recetaPaciente.od_esfera, recetaPaciente.od_cilindro, recetaPaciente.od_eje)
          : ''
        const oiTexto = recetaPaciente
          ? fmtOjo(recetaPaciente.oi_esfera, recetaPaciente.oi_cilindro, recetaPaciente.oi_eje)
          : ''

        await supabase.from('ordenes_lab').insert({
          folio:            folioLab,
          folio_venta:      folio,
          venta_id:         ventaId,
          paciente:         `${clienteNombre} ${clienteApellido}`.trim() || 'Sin nombre',
          telefono:         clienteTelefono,
          sucursal,
          estado:           'recibido',
          fecha_ingreso:    hoy,
          fecha_promesa:    fechaEntrega || '',
          precio_cliente:   total,
          anticipo:         anticoNum,
          od:               odTexto,
          oi:               oiTexto,
          add_graduacion:   recetaPaciente?.od_add || '',
          dp:               recetaPaciente ? `${recetaPaciente.dp_od}/${recetaPaciente.dp_oi}` : '',
          tipo_mica:        micasCarrito,
          tratamiento:      filtrosCarrito,
        })
        setFolioLabGuardado(folioLab)
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
      setNotaImpresa(true)
      // Usuario que atendió — formato "Nombre A."
      let atendioPorRaw = ''
      try { atendioPorRaw = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')?.nombre || '' } catch {}
      const _ap = atendioPorRaw.trim().split(/\s+/)
      const atendioPor = _ap.length >= 2 ? `${_ap[0]} ${_ap[1][0].toUpperCase()}.` : _ap[0] || ''

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
        <div class="ph-title"><div class="ph-line"></div><div class="ph-txt">PAGOS REALIZADOS</div><div class="ph-line"></div></div>
        <table class="pagos">
          <tr><th>#</th><th>Fecha</th><th class="r">Pago</th></tr>
          ${anticoNum > 0 ? `<tr><td>1</td><td>${fechaFmt}</td><td class="r">$${anticoNum.toLocaleString('es-MX')}</td></tr>` : ''}
        </table>
        <div class="pagos-total-row"><span>TOTAL PAGADO:</span><span>$${anticoNum.toLocaleString('es-MX')}</span></div>
        <div class="saldo-box">
          <div class="saldo-lbl">Cantidad restante para liquidar el pago:</div>
          <div class="saldo-val">$${saldo.toLocaleString('es-MX')}</div>
        </div>` : ''

      const entregaHtml = fechaEntrega
        ? `<div class="icard"><div>Fecha de entrega: <b>${fechaEntrega}</b></div></div>`
        : `<div class="icard"><div>Fecha de entrega de <b>3 a 5</b> días hábiles a partir de la compra.</div></div>`

      const win = window.open('', '_blank', 'width=250,height=900')
      if (!win) return
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${folio}</title>
<style>
  @page { size: 55mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; width: 51mm; padding: 3mm 2mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible; }

  /* ── Header ── */
  .hdr { text-align: center; padding: 6px 0 10px; border-bottom: 2.5px solid #006868; margin-bottom: 9px; }
  .hdr .b1 { font-size: 22px; font-weight: 900; color: #006868; letter-spacing: 1px; line-height: 1.1; }
  .hdr .b2 { font-size: 16px; font-weight: 900; color: #006868; line-height: 1.2; }
  .hdr .dt { font-size: 10px; color: #555; margin-top: 7px; }

  /* ── Info section ── */
  .info-sec { margin-bottom: 9px; padding-bottom: 9px; border-bottom: 1.5px dashed #bbb; }
  .irow { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 11px; }
  .ilbl { font-weight: 700; color: #333; min-width: 56px; font-size: 10.5px; }

  /* ── Folio box ── */
  .folio-box { display: flex; align-items: stretch; border: 1.5px solid #006868; border-radius: 5px; overflow: hidden; margin-bottom: 10px; }
  .folio-accent { background: #006868; color: white; padding: 6px 9px; display: flex; align-items: center; justify-content: center; font-size: 17px; }
  .folio-text { flex: 1; text-align: center; padding: 5px 4px; background: #f0fafa; }
  .folio-lbl { font-size: 8.5px; font-weight: 700; color: #006868; letter-spacing: 0.5px; }
  .folio-num { font-size: 18px; font-weight: 900; color: #006868; }

  /* ── Products table ── */
  table.prods { width: 100%; border-collapse: collapse; margin-bottom: 7px; font-size: 10.5px; }
  table.prods thead { background: #006868; color: white; }
  table.prods th { padding: 4px 3px; text-align: left; font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; }
  table.prods td { padding: 4px 3px; border-bottom: 1px solid #eee; vertical-align: top; line-height: 1.35; }
  .tc { width: 22px; text-align: center; }
  .tp { text-align: right; white-space: nowrap; }

  /* ── Total ── */
  .total-row { display: flex; align-items: center; justify-content: space-between; margin: 7px 0 11px; }
  .tlbl { font-size: 15px; font-weight: 900; color: #222; }
  .tval { background: #006868; color: white; font-size: 16px; font-weight: 900; padding: 5px 10px; border-radius: 5px; }

  /* ── Pagos realizados ── */
  .ph-title { display: flex; align-items: center; gap: 5px; margin: 9px 0 6px; }
  .ph-line { flex: 1; height: 1px; background: #bbb; }
  .ph-txt { font-size: 9.5px; font-weight: 700; color: #006868; white-space: nowrap; }
  table.pagos { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.pagos th { text-align: left; font-weight: 700; padding: 2px 2px; border-bottom: 1px solid #bbb; font-size: 9.5px; }
  table.pagos td { padding: 3px 2px; border-bottom: 1px dotted #ddd; }
  .r { text-align: right; }
  .pagos-total-row { display: flex; justify-content: space-between; font-weight: 700; color: #006868; font-size: 11px; margin: 5px 0 9px; border-top: 1.5px solid #006868; padding-top: 4px; }
  .saldo-box { border: 1.5px solid #006868; border-radius: 5px; padding: 8px 6px; text-align: center; margin-bottom: 10px; }
  .saldo-lbl { font-size: 10px; color: #444; line-height: 1.3; }
  .saldo-val { font-size: 19px; font-weight: 900; color: #006868; margin-top: 4px; }

  /* ── Info cards (entrega / conserva) ── */
  .icard { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1.5px dashed #ccc; font-size: 10px; line-height: 1.4; }
  .ic { width: 28px; height: 28px; border-radius: 50%; background: #e3f4f4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; line-height: 28px; text-align: center; }

  /* ── Firma ── */
  .firma-sec { display: flex; align-items: center; gap: 8px; margin: 14px 0 10px; }
  .fic { width: 30px; height: 30px; border-radius: 50%; background: #e3f4f4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 15px; }
  .fblock { flex: 1; }
  .fline-rule { border-bottom: 1px solid #aaa; margin-bottom: 4px; height: 20px; }
  .flbl { font-size: 9px; color: #666; text-align: center; }

  /* ── Footer ── */
  .footer { border-top: 2px solid #006868; padding-top: 8px; font-size: 9.5px; color: #333; margin-top: 4px; }
  .frow { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 2.5px 0; text-align: center; }
  .fatendio { font-weight: 700; color: #006868; display: block; text-align: center; margin: 3px 0; font-size: 10px; }
  .fbar { background: #006868; color: white; text-align: center; padding: 8px 0; margin-top: 9px; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; }

  /* ── Evitar cortes de página en bloques ── */
  .hdr, .info-sec, .folio-box, table.prods, .total-row,
  .ph-title, table.pagos, .pagos-total-row, .saldo-box,
  .icard, .firma-sec, .footer { page-break-inside: avoid; break-inside: avoid; }
  /* ── Aviso solo en pantalla ── */
  .tip { display: block; background: #fff8e1; border: 1px solid #f59e0b; border-radius: 4px; padding: 7px 8px; margin-bottom: 10px; font-size: 9.5px; line-height: 1.5; color: #78350f; }
  @media print { .tip { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>

<div class="tip">
  En el diálogo de impresión:<br>
  &bull; <b>Márgenes → Ninguno</b><br>
  &bull; Desactivar <b>encabezados y pies de página</b><br>
  &bull; Tamaño de papel: <b>personalizado 55&nbsp;×&nbsp;auto mm</b>
</div>

<div class="hdr">
  <div class="b1">${(SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[sucursal]?.nombreLinea2 ? `<div class="b2">${SUCURSAL_CONFIG[sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="dt">${fechaFmt} &nbsp;|&nbsp; ${horaHoy}</div>
</div>

<div class="info-sec">
  ${(clienteNombre || clienteApellido) ? `<div class="irow"><span class="ilbl">Paciente:</span><span>${clienteNombre} ${clienteApellido}</span></div>` : ''}
  ${clienteTelefono ? `<div class="irow"><span class="ilbl">Teléfono:</span><span>${clienteTelefono}</span></div>` : ''}
</div>

<div class="folio-box">
  <div class="folio-accent"></div>
  <div class="folio-text">
    <div class="folio-lbl">FOLIO DE VENTA</div>
    <div class="folio-num">${folio}</div>
  </div>
</div>

<table class="prods">
  <thead><tr><th class="tc">CANT.</th><th>DESCRIPCIÓN</th><th class="tp">PRECIO</th></tr></thead>
  <tbody>${productosRows}</tbody>
</table>

<div class="total-row">
  <span class="tlbl">TOTAL:</span>
  <span class="tval">$${total.toLocaleString('es-MX')}</span>
</div>

${pagosHtml}

${entregaHtml}

<div class="icard">
  <div>Conserve este ticket para cualquier <b>aclaración o garantía.</b></div>
</div>

<div class="firma-sec">
  <div class="fblock">
    <div class="fline-rule"></div>
    <div class="flbl">Nombre y firma del comprador</div>
  </div>
</div>

<div class="footer">
  <div class="frow">Tel. ${SUCURSAL_CONFIG[sucursal]?.telefono ?? '661 612 0316'} &nbsp;|&nbsp; WA ${SUCURSAL_CONFIG[sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div class="frow">${SUCURSAL_CONFIG[sucursal]?.horario ?? 'Lun–Sáb 10:00–18:00'}</div>
  ${atendioPor ? `<div class="frow"><span class="fatendio">Atendió: ${atendioPor}</span></div>` : ''}
  <div class="frow">${SUCURSAL_CONFIG[sucursal]?.web ?? 'gonmx.com'}</div>
  <div class="fbar">· · · ¡Gracias por su compra! · · ·</div>
</div>

</body></html>`)
      win.document.close()
      setTimeout(() => { win.print() }, 300)
    }

    // ── Imprimir orden de laboratorio (placeholder — sin graduación) ──
    const tieneMicasGuardado = carrito.some(i =>
      i.nombre.toLowerCase().includes('mica') ||
      i.nombre.toLowerCase().includes('progres') ||
      i.nombre.toLowerCase().includes('bifocal') ||
      i.nombre.toLowerCase().includes('monofocal') ||
      i.nombre.toLowerCase().includes('transitions')
    )

    const handleImprimirOrdenLab = () => {
      setOrdenLabImpresa(true)
      const fechaFmt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const sucursalNombre = SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal
      const sucursalSub    = SUCURSAL_CONFIG[sucursal]?.nombreLinea2 ?? ''
      const nombreCompleto = `${clienteNombre} ${clienteApellido}`.trim()
      const win = window.open('', '_blank', 'width=420,height=640')
      if (!win) return
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${folioLabGuardado}</title>
<style>
  @page { size: 4in 6in; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; width: 100%; }
  .hdr { display: flex; justify-content: space-between; align-items: center; background: #111; color: #fff; padding: 8px 10px; border-radius: 4px; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hdr-left h1 { font-size: 14px; font-weight: 900; letter-spacing: -0.3px; color: #fff; }
  .hdr-left p { font-size: 9px; color: #aaa; }
  .hdr-right { text-align: right; }
  .folio { font-size: 15px; font-weight: 900; font-family: monospace; color: #4DB6AC; }
  .paciente { font-size: 14px; font-weight: 900; margin: 4px 0 1px; }
  .sep { border: none; border-top: 1px dashed #bbb; margin: 7px 0; }
  .grad-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .grad-table th { background: #f0f0f0; font-size: 9px; font-weight: 700; text-align: center; padding: 4px 3px; border: 1px solid #ccc; }
  .grad-table th:first-child { text-align: left; }
  .grad-table td { border: 1px solid #ddd; padding: 5px 3px; font-family: monospace; font-size: 10px; }
  .lbl { font-weight: 700; font-family: sans-serif; font-size: 9px; background: #f8f8f8; }
  .val { text-align: center; }
  .mica-box { background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px; padding: 5px 7px; margin-bottom: 6px; }
  .mica-tipo { font-size: 12px; font-weight: 900; }
  .mica-sub  { font-size: 9px; color: #444; margin-top: 1px; }
  .field { font-size: 10px; margin: 5px 0; display: flex; gap: 4px; align-items: flex-end; }
  .fl { font-weight: 700; flex-shrink: 0; }
  .fv { border-bottom: 1px solid #aaa; flex: 1; min-width: 80px; }
  .meta { display: flex; justify-content: space-between; font-size: 9px; color: #555; margin: 6px 0; }
  .firma { border-top: 1px solid #000; margin-top: 10px; padding-top: 4px; text-align: right; font-size: 9px; color: #777; }
</style></head><body>
<div class="hdr">
  <div class="hdr-left">
    <h1>${sucursalNombre}</h1>
    ${sucursalSub ? `<p style="font-size:9px;color:#888">${sucursalSub}</p>` : ''}
    <p style="font-size:9px;color:#888">Orden de laboratorio</p>
  </div>
  <div class="hdr-right">
    <div class="folio">${folioLabGuardado}</div>
    <div style="font-size:9px;color:#888">${fechaFmt}</div>
  </div>
</div>

<div class="paciente">${nombreCompleto || 'Sin nombre'}</div>
<div style="font-size:9px;color:#888;margin-bottom:8px">${sucursal}</div>
<hr class="sep">

<table class="grad-table">
  <thead><tr><th></th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>ADD</th></tr></thead>
  <tbody>
    <tr>
      <td class="lbl">OD</td>
      <td class="val">${recetaPaciente?.od_esfera || '—'}</td>
      <td class="val">${recetaPaciente?.od_cilindro || '—'}</td>
      <td class="val">${recetaPaciente?.od_eje ? recetaPaciente.od_eje + '°' : '—'}</td>
      <td class="val">${recetaPaciente?.od_add || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">OI</td>
      <td class="val">${recetaPaciente?.oi_esfera || '—'}</td>
      <td class="val">${recetaPaciente?.oi_cilindro || '—'}</td>
      <td class="val">${recetaPaciente?.oi_eje ? recetaPaciente.oi_eje + '°' : '—'}</td>
      <td class="val">${recetaPaciente?.oi_add || '—'}</td>
    </tr>
    <tr><td class="lbl">D.P.</td><td class="val" colspan="4">${recetaPaciente?.dp_od ? recetaPaciente.dp_od + ' / ' + recetaPaciente.dp_oi + ' mm' : '—'}</td></tr>
  </tbody>
</table>

<hr class="sep">

<div class="mica-box">
  <div class="mica-tipo">${carrito.filter(i => ['mica','monofocal','progres','bifocal','transitions'].some(k => i.nombre.toLowerCase().includes(k))).map(i => i.nombre).join(' + ') || '—'}</div>
  ${carrito.filter(i => ['filtro','antirreflejo','blue','fotocrom','tinte','polariz'].some(k => i.nombre.toLowerCase().includes(k))).length > 0
    ? `<div class="mica-sub">Tratamiento: <b>${carrito.filter(i => ['filtro','antirreflejo','blue','fotocrom','tinte','polariz'].some(k => i.nombre.toLowerCase().includes(k))).map(i => i.nombre).join(' + ')}</b></div>`
    : ''}
</div>

<div class="field"><span class="fl">Armazón:</span><span class="fv"></span></div>
<div class="meta">
  <span>Ingreso: <b>${new Date().toLocaleDateString('es-MX')}</b></span>
  <span>Entrega: <b>${fechaEntrega || '___________'}</b></span>
</div>
<div class="firma">Recibido por: _________________________</div>
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
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
              {esCotizacion ? 'Cotización generada' : 'Venta registrada'}
            </h2>
            <p className="text-zinc-400 text-sm mt-0.5">{folio} · {sucursal}</p>
          </div>
        </div>

        {/* Ticket card */}
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
          {/* Header del ticket */}
          <div className="bg-[#0B0E14] px-5 py-4 text-center">
            <p className="text-white font-bold text-base">{SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal}</p>
            {SUCURSAL_CONFIG[sucursal]?.nombreLinea2 && (
              <p className="text-white/70 text-xs mt-0.5">{SUCURSAL_CONFIG[sucursal].nombreLinea2}</p>
            )}
            <p className="text-white/40 text-xs mt-1">{fechaHoy} · {horaHoy} · {folio}</p>
          </div>

          {/* Cliente */}
          {(clienteNombre || clienteApellido) && (
            <div className="px-5 py-3 border-b border-zinc-100 flex justify-between items-center">
              <span className="text-xs text-zinc-400">Cliente</span>
              <span className="text-sm font-semibold text-zinc-700">{clienteNombre} {clienteApellido}</span>
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
                    <p className="text-sm font-medium text-zinc-700">{item.nombre}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {item.cantidad > 1 ? `${item.cantidad} × $${precio.toLocaleString('es-MX')}` : ''}
                      {item.descuento > 0 ? `${item.cantidad > 1 ? ' · ' : ''}Desc. ${item.descuento}%` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-zinc-800 ml-4 flex-shrink-0">${sub.toLocaleString('es-MX')}</span>
                </div>
              )
            })}
          </div>

          {/* Total + método de pago */}
          <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-200 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-400">Método de pago</p>
                <p className="text-sm font-semibold text-zinc-600 mt-0.5">{metodoPagoLabel}{modoPago === 'diferir' ? ' · Diferido' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">Total venta</p>
                <p className="text-2xl font-bold text-[#0B0E14]">${total.toLocaleString('es-MX')}</p>
              </div>
            </div>
            {modoPago === 'diferir' && (
              <div className="border-t border-zinc-200 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Anticipo recibido</span>
                  <span className="font-bold text-emerald-700">${Number(anticipo || 0).toLocaleString('es-MX')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600 font-semibold">Saldo pendiente</span>
                  <span className="font-bold text-red-600">${(total - Number(anticipo || 0)).toLocaleString('es-MX')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Checklist de proceso (solo cuando hay micas) */}
        {tieneMicasGuardado && (
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Checklist de orden</p>
            </div>
            <div className="divide-y divide-zinc-50">
              {[
                { done: true,              label: 'Venta registrada',        sub: folio },
                { done: !!folioLabGuardado,label: 'Orden de lab creada',     sub: folioLabGuardado },
                { done: notaImpresa,       label: 'Nota de venta impresa',   sub: '' },
                { done: ordenLabImpresa,   label: 'Orden de lab impresa',    sub: '' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-emerald-500' : 'border-2 border-zinc-200'}`}>
                    {step.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm ${step.done ? 'text-zinc-700' : 'text-zinc-400'}`}>{step.label}</span>
                  {step.sub && <span className="ml-auto text-xs font-mono text-zinc-400">{step.sub}</span>}
                </div>
              ))}
              <div className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-zinc-200" />
                <span className="text-sm text-zinc-400">Completar y enviar al laboratorio</span>
                <Link href="/dashboard/laboratorio" className="ml-auto text-xs text-[#0D9488] font-semibold hover:underline whitespace-nowrap">
                  Ir al lab →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        {tieneMicasGuardado && (
          <button
            onClick={handleImprimirOrdenLab}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
              ordenLabImpresa
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-[#0D9488] text-white hover:bg-[#0B7A70]'
            }`}
          >
            <Printer className="w-4 h-4" />
            {ordenLabImpresa ? '✓ Orden de lab impresa' : `Imprimir orden de laboratorio (${folioLabGuardado})`}
          </button>
        )}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleImprimirTicket}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm transition-colors ${
              notaImpresa
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Printer className="w-4 h-4" /> {notaImpresa ? '✓ Nota' : 'Nota de venta'}
          </button>
          <Link
            href="/dashboard/ventas"
            className="flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors text-center"
          >
            Ver historial
          </Link>
          <button
            onClick={() => { limpiar(); setGuardado(false) }}
            className="flex items-center justify-center gap-2 py-3 bg-[#0B0E14] text-white rounded-lg text-sm font-bold hover:bg-[#1A1D27] transition-colors"
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
        <Link href="/dashboard/ventas" className="w-9 h-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-zinc-500" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Nueva venta</h1>
          <p className="text-sm text-zinc-400">Completa los datos y genera la venta o cotización</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <select
              value={sucursal}
              onChange={e => setSucursal(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded-md pl-4 pr-8 py-2.5 text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
            >
              {sucursales.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Cliente + Fecha */}
      <div className="bg-white rounded-lg border border-zinc-200/80 p-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Buscar cliente */}
          <div className="col-span-2 relative">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Buscar cliente *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                value={busquedaCliente}
                onChange={e => setBusquedaCliente(e.target.value)}
                onFocus={() => setShowClienteDropdown(true)}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                placeholder="Busca por nombre o teléfono..."
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
              />
              {cliente && (
                <button onClick={() => { setCliente(null); setBusquedaCliente('') }} className="absolute right-3 top-1/2 -tranzinc-y-1/2">
                  <X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
                </button>
              )}
            </div>
            {showClienteDropdown && !cliente && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-100 rounded-md shadow-xl z-20 divide-y divide-zinc-50 overflow-hidden">
                {clientesSuggestions.length > 0
                  ? clientesSuggestions.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => seleccionarCliente(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0D9488]/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-[#0D9488]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-700">{c.nombre} {c.apellido}</p>
                        <p className="text-xs text-zinc-400">{c.telefono}</p>
                      </div>
                    </button>
                  ))
                  : (
                    <div className="px-4 py-3 text-sm text-zinc-400 text-center">
                      Sin resultados para "{busquedaCliente}"
                    </div>
                  )
                }
                <button
                  onMouseDown={() => setShowClienteDropdown(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#0D9488] hover:bg-zinc-50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Registrar nuevo cliente
                </button>
              </div>
            )}
          </div>

          {/* Fecha de entrega */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Fecha sugerida de entrega</span>
            </label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={e => setFechaEntrega(e.target.value)}
              className="w-full py-2.5 px-4 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 text-zinc-700"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre *</label>
            <input
              value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)}
              placeholder="Nombre"
              className="w-full py-2.5 px-4 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
            />
          </div>

          {/* Apellido */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Apellido *</label>
            <input
              value={clienteApellido}
              onChange={e => setClienteApellido(e.target.value)}
              placeholder="Apellido"
              className="w-full py-2.5 px-4 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
            />
          </div>

          {/* Teléfono */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Teléfono de contacto</span>
            </label>
            <input
              value={clienteTelefono}
              onChange={e => setClienteTelefono(e.target.value)}
              placeholder="686 000 0000"
              className="w-full py-2.5 px-4 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="bg-white rounded-lg border border-zinc-200/80">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-800">Productos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left text-xs text-zinc-400 font-medium px-6 py-3 w-28">Código</th>
                <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Descripción</th>
                <th className="text-center text-xs text-zinc-400 font-medium px-4 py-3 w-32">Cantidad</th>
                <th className="text-center text-xs text-zinc-400 font-medium px-4 py-3 w-24">Existencias</th>
                <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3 w-32">Precio</th>
                <th className="text-center text-xs text-zinc-400 font-medium px-4 py-3 w-28">Desc. %</th>
                <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3 w-32">Subtotal</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              <tr>
                <td colSpan={8} className="px-6 py-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      value={busquedaProducto}
                      onChange={e => { setBusquedaProducto(e.target.value); setShowBuscadorProducto(true) }}
                      onFocus={() => setShowBuscadorProducto(true)}
                      placeholder="Buscar por código o descripción del producto..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
                    />
                    {showBuscadorProducto && busquedaProducto && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-100 rounded-md shadow-xl z-20 divide-y divide-zinc-50 overflow-hidden max-h-64 overflow-y-auto">
                        {productosFiltrados.slice(0, 8).map(p => (
                          <button
                            key={p.id}
                            onClick={() => agregar(p)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                          >
                            <div>
                              <span className="text-xs font-mono text-zinc-400 mr-3">{p.sku}</span>
                              <span className="text-sm font-medium text-zinc-700">{p.nombre}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-zinc-400">Stock: {p.stock === 999 ? '∞' : p.stock}</span>
                              <span className="text-sm font-bold text-zinc-800">${p.precio.toLocaleString('es-MX')}</span>
                            </div>
                          </button>
                        ))}
                        {productosFiltrados.length === 0 && (
                          <div className="px-4 py-4 text-sm text-zinc-400 text-center">Sin resultados</div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>

              {carrito.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-300">
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
                  <tr key={item.id} className="hover:bg-zinc-50/50 group">
                    <td className="px-6 py-3">
                      <span className="text-xs font-mono text-zinc-500">{item.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-zinc-700">{item.nombre}</p>
                      {stockBajo && (
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3" /> Stock insuficiente
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => cambiarCantidad(item.id, -1)} className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                          <Minus className="w-3 h-3 text-zinc-600" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-zinc-700">{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)} className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                          <Plus className="w-3 h-3 text-zinc-600" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${item.stock === 999 ? 'text-zinc-400' : item.stock < 5 ? 'text-amber-500' : 'text-zinc-500'}`}>
                        {item.stock === 999 ? '∞' : item.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-zinc-700">${item.precio.toLocaleString('es-MX')}</span>
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
                          className="w-14 text-center text-sm border border-zinc-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-[#0D9488] bg-zinc-50"
                        />
                        <span className="text-zinc-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-zinc-800">${subtotalItem.toLocaleString('es-MX')}</span>
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => eliminar(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-400">
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
          <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setBusquedaProducto(''); setShowBuscadorProducto(true) }}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 border border-dashed border-zinc-200 rounded-md px-4 py-2 hover:border-zinc-300 transition-all"
              >
                <Plus className="w-4 h-4" /> Agregar producto
              </button>
              <button
                onClick={() => { setProductoLibre({ descripcion: '', precio: '', cantidad: '1' }); setShowProductoLibre(true) }}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 border border-dashed border-zinc-200 rounded-md px-4 py-2 hover:border-zinc-300 transition-all"
              >
                <Plus className="w-4 h-4" /> Producto libre
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-sm text-zinc-400">Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">$</span>
                  <span className="text-2xl font-bold text-zinc-800">{subtotal.toLocaleString('es-MX')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botones finales */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={limpiar}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-50 transition-all"
          >
            <X className="w-4 h-4" /> Limpiar
          </button>
          <button
            onClick={() => setShowProductoLibre(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 border border-dashed border-zinc-300 rounded-md hover:bg-zinc-50 transition-all"
          >
            <Plus className="w-4 h-4" /> Producto libre
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEsCotizacion(true); setShowModal(true) }}
            disabled={carrito.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-sm font-semibold hover:bg-zinc-50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            Generar cotización
          </button>
          <button
            onClick={() => { setEsCotizacion(false); setShowModal(true) }}
            disabled={carrito.length === 0 || !clienteNombre}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0B0E14] text-white rounded-md text-sm font-bold hover:bg-[#1A1D27] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-800">Agregar producto no inventariado</h3>
              <button onClick={() => setShowProductoLibre(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción del producto o servicio"
                  value={productoLibre.descripcion}
                  onChange={e => setProductoLibre(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Precio</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-zinc-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={productoLibre.precio}
                      onChange={e => setProductoLibre(p => ({ ...p, precio: e.target.value }))}
                      className="w-full border border-zinc-200 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={productoLibre.cantidad}
                    onChange={e => setProductoLibre(p => ({ ...p, cantidad: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setShowProductoLibre(false)}
                className="flex-1 border border-zinc-200 text-zinc-600 rounded-md py-2 text-sm hover:bg-zinc-50 transition-colors"
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
                className="flex-1 bg-[#0D9488] text-white rounded-md py-2 text-sm font-medium hover:bg-[#24a89d] transition-colors"
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-800">
                {esCotizacion ? 'Confirmar cotización' : 'Opciones de pago'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {!esCotizacion && (
                <>
                  {/* Modo de pago */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-2">Modo de pago</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setModoPago('liquidar')}
                        className={`py-3 rounded-md text-sm font-semibold border transition-all ${modoPago === 'liquidar' ? 'border-[#0B0E14] bg-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                      >
                        Liquidar total
                      </button>
                      <button
                        onClick={() => setModoPago('diferir')}
                        className={`py-3 rounded-md text-sm font-semibold border transition-all ${modoPago === 'diferir' ? 'border-[#0B0E14] bg-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                      >
                        Diferir pagos
                      </button>
                    </div>
                  </div>

                  {/* Método de pago */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-2">Método de pago</label>
                    <div className="relative">
                      <select
                        value={metodoPago}
                        onChange={e => setMetodoPago(e.target.value)}
                        className="w-full appearance-none border border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-700 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 pr-10"
                      >
                        {metodosPago.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Anticipo — solo cuando se difiere */}
                  {modoPago === 'diferir' && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-2">
                        Anticipo recibido <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -tranzinc-y-1/2 text-zinc-400 font-semibold text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          max={total}
                          value={anticipo}
                          onChange={e => setAnticipo(e.target.value === '' ? '' : Math.min(total, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="w-full border-2 border-[#0D9488] rounded-md pl-8 pr-4 py-3 text-lg font-bold text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                          placeholder="0"
                          autoFocus
                        />
                      </div>
                      {anticipo !== '' && anticipo > 0 && (
                        <p className="text-xs text-zinc-500 mt-1.5">
                          Saldo pendiente: <span className="font-bold text-zinc-700">${(total - Number(anticipo)).toLocaleString('es-MX')}</span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Total */}
              <div className="bg-zinc-50 rounded-lg px-5 py-4">
                {modoPago === 'diferir' && anticipo !== '' && Number(anticipo) > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-zinc-500">
                      <span>Total venta</span>
                      <span className="font-semibold">${total.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>Anticipo</span>
                      <span className="font-bold">− ${Number(anticipo).toLocaleString('es-MX')}</span>
                    </div>
                    <div className="border-t border-zinc-200 pt-2 flex justify-between">
                      <span className="text-sm font-semibold text-zinc-700">Saldo pendiente</span>
                      <span className="text-xl font-bold text-red-600">${(total - Number(anticipo)).toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-zinc-400 mb-1">
                      {esCotizacion ? 'Total estimado' : (modoPago === 'diferir' ? 'Total (pendiente de anticipo)' : 'Total a cobrar')}
                    </p>
                    <p className="text-3xl font-bold text-[#0B0E14]">${total.toLocaleString('es-MX')}</p>
                  </div>
                )}
                {clienteNombre && (
                  <p className="text-xs text-zinc-400 mt-2 text-center">{clienteNombre} {clienteApellido}</p>
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
                className="flex-1 py-3 border border-zinc-200 text-zinc-600 rounded-md text-sm font-semibold hover:bg-zinc-50 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => handleFinalizar(esCotizacion)}
                disabled={guardando}
                className="flex-1 py-3 bg-[#0D9488] text-white rounded-md text-sm font-bold hover:bg-teal-500 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : esCotizacion ? 'Generar cotización' : 'Finalizar venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color picker modal for filtros */}
      {pendingFiltro && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-zinc-800 mb-1">{pendingFiltro.nombre}</h3>
            <p className="text-xs text-zinc-400 mb-4">Selecciona el color</p>
            <div className="flex flex-wrap gap-2">
              {COLORES_FILTRO[pendingFiltro.sku].map(color => (
                <button
                  key={color}
                  onClick={() => { agregarDirecto(pendingFiltro, color); setPendingFiltro(null) }}
                  className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all"
                >
                  {color}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingFiltro(null)}
              className="mt-4 w-full text-xs text-zinc-400 hover:text-zinc-600 py-1 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
