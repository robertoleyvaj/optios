'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/hooks/useSession'
import { registrarComisionTerminal } from '@/lib/comisiones'
import { hoyLocal } from '@/lib/fecha'
import { getSucursalActual, getUsuarioLocal } from '@/lib/session'
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
  FileText,
  CalendarDays,
  Phone,
  AlertCircle,
  Printer,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'

// --- Catálogo GON ---
type CatItem = {
  id: number; nombre: string; categoria: string; precio: number; sku: string; stock: number
  precioFinal?: number; labMica?: string; labTratamiento?: string
}

// Catálogo fijo de respaldo. En runtime se fusiona con la tabla `productos`:
// la base sobrescribe nombre/precio de micas y filtros, y agrega los nuevos
// (Varilux, Kodak). Los servicios y paquetes viven aquí (no están en la tabla).
const CATALOGO_FIJO: CatItem[] = [
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
  { id: 20, nombre: 'Antirreflejante',                     categoria: 'Filtros', precio:  279, sku: 'FIL-AR',  stock: 999 },
  { id: 21, nombre: 'Bluelight',                          categoria: 'Filtros', precio:  549, sku: 'FIL-BL',  stock: 999 },
  { id: 22, nombre: 'Filtro Fotocromático',               categoria: 'Filtros', precio:  949, sku: 'FIL-FC',  stock: 999 },
  { id: 23, nombre: 'Filtro Polarizado',                  categoria: 'Filtros', precio: 1699, sku: 'FIL-POL', stock: 999 },
  { id: 24, nombre: 'Filtro Tinte',                       categoria: 'Filtros', precio:  549, sku: 'FIL-TIN', stock: 999 },
  // ── Servicios ─────────────────────────────────────────────────
  { id: 40, nombre: 'EXAMEN DE LA VISTA',                 categoria: 'Servicios', precio:  200, sku: 'SRV-EXA', stock: 999 },
  { id: 41, nombre: 'AJUSTE DE ARMAZÓN',                  categoria: 'Servicios', precio:   80, sku: 'SRV-AJU', stock: 999 },
  { id: 42, nombre: 'REBISEL',                            categoria: 'Servicios', precio:  200, sku: 'SRV-REB', stock: 999 },
  { id: 43, nombre: 'AJUSTE DE TORNILLO',                 categoria: 'Servicios', precio:  100, sku: 'SRV-TOR', stock: 999 },
  { id: 44, nombre: 'CAMBIO DE PLAQUETAS',                categoria: 'Servicios', precio:  100, sku: 'SRV-PLA', stock: 999 },
  { id: 45, nombre: 'LIMPIEZA DE ARMAZÓN',                categoria: 'Servicios', precio:  100, sku: 'SRV-LIM', stock: 999 },
  { id: 46, nombre: 'CAMBIO DE TORNILLO',                 categoria: 'Servicios', precio:  100, sku: 'SRV-TCR', stock: 999 },
  // ── Paquetes ─────────────────────────────────────────────────
  { id: 100, nombre: 'PAQUETE FOTOCROMÁTICO — MONOFOCAL CR-39 + ARMAZÓN ECO + AR CONV. + FOTOCROMÁTICO GRIS', categoria: 'Paquetes', precio: 3000, precioFinal: 1800, sku: 'PAQ-FC',  stock: 999, labMica: 'MONOFOCAL CR-39',   labTratamiento: 'FOTOCROMÁTICO GRIS + AR CONVENCIONAL' },
  { id: 101, nombre: 'PAQUETE BLUERAY — MONOFOCAL CR-39 + ANTIRREFLEJANTE BLUE + ARMAZÓN ECO',                categoria: 'Paquetes', precio: 2000, precioFinal: 1300, sku: 'PAQ-BL',  stock: 999, labMica: 'MONOFOCAL CR-39',   labTratamiento: 'ANTIRREFLEJANTE BLUE' },
  { id: 102, nombre: 'PAQUETE BIFOCAL — BIFOCAL CR-39 + AR CONVENCIONAL + ARMAZÓN ECO',                       categoria: 'Paquetes', precio: 2400, precioFinal: 1300, sku: 'PAQ-BIF', stock: 999, labMica: 'BIFOCAL CR-39',      labTratamiento: 'AR CONVENCIONAL' },
  { id: 103, nombre: 'PAQUETE PROGRESIVO — PROGRESIVO CR-39 + AR CONVENCIONAL + ARMAZÓN ECO',                 categoria: 'Paquetes', precio: 3000, precioFinal: 2000, sku: 'PAQ-PRO', stock: 999, labMica: 'PROGRESIVO CR-39',   labTratamiento: 'AR CONVENCIONAL' },
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

// Métodos válidos para líneas de pago (los que la caja reconoce)
const METODOS_LINEA = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'debito',        label: 'T. Débito' },
  { key: 'credito',       label: 'T. Crédito' },
  { key: 'transferencia', label: 'Transferencia' },
]

type LineaPago = { metodo: string; moneda: 'MXN' | 'USD'; monto: string }

type Item = { uid: string; id: number; nombre: string; precio: number; cantidad: number; sku: string; stock: number; descuento: number; par: number }
type Cliente = { id: string; nombre: string; apellido: string; telefono: string }

// Colores disponibles por filtro — Polarizado y Tinte siguen igual
const COLORES_FILTRO: Record<string, string[]> = {
  'FIL-POL': ['Gris', 'Café', 'Verde', 'Azul'],
  'FIL-TIN': ['Gris', 'Café', 'Verde', 'Azul', 'Rosado', 'Morado', 'Amarillo'],
}

// Colores fotocromático según la mica en el carrito (SKU de mica → colores)
const COLORES_FC_POR_MICA: Record<string, string[]> = {
  'MON-ESS': ['Gris', 'Café', 'Rosa', 'Morado', 'G-15', 'Azul'],
  'MON-SHD': ['Gris', 'Café', 'Rosa', 'Morado', 'G-15', 'Azul'],
  'MON-PPL': ['Gris', 'Café', 'Rosa', 'Morado', 'Naranja', 'Azul'],
  'MON-USL': ['Gris'],
  'MON-USP': ['Gris'],
  'BIF-ESS': ['Gris'],
  'BIF-SHD': ['Gris'],
  'BIF-PPL': ['Gris'],
  'BIF-USL': ['Gris'],
  'PRO-ESS': ['Gris', 'Café', 'Rosa', 'Morado', 'G-15', 'Azul'],
  'PRO-SHD': ['Gris', 'Café', 'Rosa', 'Morado', 'G-15', 'Azul'],
  'PRO-PPL': ['Gris'],
  'PRO-USL': ['Gris'],
  'PRO-USP': ['Gris'],
}

// Filtro Transition: tipos, colores y sobreprecio sobre el precio base del producto
const TRANSITION_TIPOS: { tipo: string; extra: number; colores: string[] }[] = [
  { tipo: 'Normal',       extra: 0,   colores: ['Gris', 'Café'] },
  { tipo: 'Style Colors', extra: 657, colores: ['Ámbar', 'Amatista', 'Zafiro', 'Esmeralda', 'Verde Granito', 'Rubí'] },
  { tipo: 'Extra-Active', extra: 847, colores: ['Gris'] },
]

// Precio del fotocromático según color + SKU de mica
const precioFC = (color: string, micaSku: string): number => {
  if (color === 'Gris') return 949
  if (micaSku === 'MON-PPL') return 949 + 900  // $1,849
  return 949 + 400                              // $1,349
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
  const { usuario: sessionUser } = useSession()
  const [sucursal, setSucursal] = useState('Baja Visión')
  const [rolUsuario, setRolUsuario] = useState('')
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
  const [parActivo, setParActivo] = useState(1)
  const [cotizacionOrigen, setCotizacionOrigen] = useState<string | null>(null)  // id de cotización a borrar al concretar
  const [numPares, setNumPares] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [modoPago, setModoPago] = useState<'liquidar' | 'diferir'>('liquidar')
  const [lineasPago, setLineasPago] = useState<LineaPago[]>([{ metodo: 'efectivo', moneda: 'MXN', monto: '' }])
  const [anticipoGuardado, setAnticipoGuardado] = useState(0)  // recibido, para ticket post-venta
  const [saldoGuardado, setSaldoGuardado] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [confirmarSinAnticipo, setConfirmarSinAnticipo] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [mostrarTicket, setMostrarTicket] = useState(false)
  // Mostrar animación de éxito por 1.8s antes de revelar el ticket
  useEffect(() => {
    if (guardado) {
      setMostrarTicket(false)
      const t = setTimeout(() => setMostrarTicket(true), 1800)
      return () => clearTimeout(t)
    } else {
      setMostrarTicket(false)
    }
  }, [guardado])
  const [esCotizacion, setEsCotizacion] = useState(false)
  const [folioGuardado, setFolioGuardado] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [folioLabGuardado, setFolioLabGuardado] = useState<string[]>([])
  const [notaImpresa, setNotaImpresa] = useState(false)
  const [ordenLabImpresa, setOrdenLabImpresa] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [showBuscadorProducto, setShowBuscadorProducto] = useState(false)
  const [showProductoLibre, setShowProductoLibre] = useState(false)
  const [productoLibre, setProductoLibre] = useState({ descripcion: '', precio: '', cantidad: '1' })
  // Modal de selección de color para filtros (Fotocromático, Polarizado, Tinte)
  const [pendingFiltro, setPendingFiltro] = useState<CatItem | null>(null)
  // Segundo paso: elegir tratamiento (Antirreflejante o Bluelight) cuando FC no es Gris
  const [pendingTratamiento, setPendingTratamiento] = useState<{ color: string; micaSku: string; precio: number } | null>(null)
  // Aviso cuando intentan agregar FC sin mica
  const [avisoSinMica, setAvisoSinMica] = useState(false)
  // Flujo multi-paso para tinte
  const [pendingTinte, setPendingTinte] = useState<{ step: 'color' | 'tipo' | 'tono'; color: string; tipo: string } | null>(null)
  const [pendingTransition, setPendingTransition] = useState<{ step: 'tipo' | 'color'; tipo: string } | null>(null)

  // Catálogo dinámico de lentes de contacto (desde Supabase productos_catalogo)
  const [catalogoLC, setCatalogoLC] = useState<CatItem[]>([])
  // Productos desde la tabla `productos` (se fusionan con el catálogo fijo)
  const [catalogoDB, setCatalogoDB] = useState<CatItem[]>([])
  useEffect(() => {
    createClient()
      .from('productos_catalogo')
      .select('nombre, precio_publico')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (data) {
          setCatalogoLC(data.map((p, i) => ({
            id: 9000 + i,
            nombre: p.nombre,
            categoria: 'Lentes de Contacto',
            precio: p.precio_publico,
            sku: 'LC',
            stock: 999,
          })))
        }
      })
  }, [])

  // Productos desde la tabla `productos` (micas, filtros, y los nuevos Varilux/Kodak)
  useEffect(() => {
    createClient()
      .from('productos')
      .select('sku, nombre, precio, categoria')
      .eq('activo', true)
      .then(({ data }) => {
        if (data) {
          setCatalogoDB(data.map((p, i) => ({
            id: 20000 + i,
            nombre: p.nombre as string,
            categoria: (p.categoria as string) || 'Micas',
            precio: Number(p.precio),
            sku: p.sku as string,
            stock: 999,
          })))
        }
      })
  }, [])

  // Armazones (base de e-commerce), SOLO los que tienen stock en la sucursal del vendedor
  const [catalogoArmz, setCatalogoArmz] = useState<CatItem[]>([])
  useEffect(() => {
    const stockKey = sucursal === 'Baja Visión' ? 'stock_baja'
      : sucursal === '5 de Mayo' ? 'stock_mayo'
      : 'stock_plaza'
    fetch('/api/ecomm/armazones', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (!j.ok) { setCatalogoArmz([]); return }
        const items: CatItem[] = (j.armazones as Record<string, unknown>[])
          .filter(a => Number(a[stockKey] ?? 0) > 0)   // solo los que están en ESTA óptica
          .map((a, i) => {
            const base = `${a.marca ?? ''} ${a.nombre ?? a.modelo ?? ''}`.trim()
            const viejo = a.sku_viejo ? ` · #${a.sku_viejo}` : ''
            return {
              id: 30000 + i,
              nombre: base + viejo,   // incluye el SKU viejo para reconocer/buscar en la transición
              categoria: 'Armazones',
              precio: Number(a.precio_gon ?? 0),
              sku: (a.sku as string) || `ARMZ-${a.id}`,
              stock: Number(a[stockKey] ?? 0),
            }
          })
        setCatalogoArmz(items)
      })
      .catch(() => setCatalogoArmz([]))
  }, [sucursal])

  // Catálogo efectivo: base fija + lo que llega de la tabla `productos` + armazones de la sucursal.
  // La base de datos SOBRESCRIBE nombre/precio por SKU y AGREGA los nuevos.
  // Nunca se pierde nada del fijo (servicios, paquetes) aunque la BD falle.
  const catalogo: CatItem[] = (() => {
    const bySku = new Map<string, CatItem>(CATALOGO_FIJO.map(p => [p.sku, p]))
    for (const dp of catalogoDB) {
      const ex = bySku.get(dp.sku)
      if (ex) bySku.set(dp.sku, { ...ex, nombre: dp.nombre, precio: dp.precio, categoria: dp.categoria })
      else    bySku.set(dp.sku, dp)
    }
    for (const a of catalogoArmz) bySku.set(a.sku, a)
    return Array.from(bySku.values())
  })()

  // Moneda en efectivo (MXN / USD)
  const [moneda, setMoneda] = useState<'MXN' | 'USD'>('MXN') // moneda de cobro (solo efectivo)
  const [tipoCambio, setTipoCambio] = useState<number | null>(null)
  const [loadingTC, setLoadingTC] = useState(false)
  const [tcError, setTcError] = useState(false)
  const [ticketLogo, setTicketLogo] = useState<string>('')  // logo configurable del ticket

  // Cargar el logo del ticket (configurado en Ajustes)
  useEffect(() => {
    createClient().from('configuracion').select('valor').eq('clave', 'ticket_logo').maybeSingle()
      .then(({ data }) => { if (data?.valor) setTicketLogo(data.valor) })
  }, [])

  // Sucursal y rol: siempre desde getSucursalActual() (check-in del día)
  useEffect(() => {
    setSucursal(getSucursalActual())
    const rol = sessionUser?.rol || getUsuarioLocal().rol || 'vendedor'
    setRolUsuario(rol)
  }, [sessionUser])

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

    // Convertir cotización → venta: precargar paciente + productos de la cotización
    const desdeCotizacion = searchParams.get('cotizacion')
    if (desdeCotizacion) {
      setCotizacionOrigen(desdeCotizacion)
      supabase.from('ventas')
        .select('paciente_id, pacientes(id, nombre, apellido, telefono), ventas_items(nombre, sku, precio_unitario, cantidad, descuento)')
        .eq('id', desdeCotizacion)
        .single()
        .then(({ data }) => {
          if (!data) return
          const p = data.pacientes as unknown as { id: string; nombre: string; apellido: string; telefono: string } | null
          if (p) {
            setCliente({ id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono })
            setClienteNombre(p.nombre); setClienteApellido(p.apellido); setClienteTelefono(p.telefono)
            cargarRecetaPaciente(p.id)
          }
          const its = (data.ventas_items ?? []) as { nombre: string; sku: string | null; precio_unitario: number; cantidad: number; descuento: number }[]
          const nuevo: Item[] = its.map((it, idx) => {
            const cat = catalogo.find(c => c.sku === it.sku)
            return {
              uid: `cot-${idx}-${Date.now()}`,
              id: cat?.id ?? -(idx + 1),
              nombre: it.nombre,
              precio: Number(it.precio_unitario) || (cat?.precio ?? 0),
              cantidad: Number(it.cantidad) || 1,
              sku: it.sku ?? cat?.sku ?? '',
              stock: cat?.stock ?? 999,
              descuento: Number(it.descuento) || 0,
              par: 1,
            }
          })
          if (nuevo.length > 0) setCarrito(nuevo)
        })
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
              itemsAgregar.push({ ...prod, cantidad: 1, descuento: 0, uid: `rec-${id}-${Date.now()}`, par: 1 })
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

  const productosFiltrados = [...catalogo, ...catalogoLC].filter(p =>
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

  const agregarDirecto = (p: CatItem, colorSufijo?: string, precioOverride?: number) => {
    const nombre = colorSufijo ? `${p.nombre} — ${colorSufijo}` : p.nombre
    const idVirtual = colorSufijo ? p.id * 1000 + p.nombre.length + colorSufijo.charCodeAt(0) : p.id
    const precio = precioOverride ?? ('precioFinal' in p && p.precioFinal ? p.precioFinal : p.precio)
    setCarrito(prev => {
      const ex = prev.find(i => i.id === idVirtual && i.par === parActivo)
      if (ex) return prev.map(i => i.uid === ex.uid ? { ...i, cantidad: i.cantidad + 1 } : i)
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      return [...prev, { ...p, id: idVirtual, nombre, precio, cantidad: 1, descuento: 0, par: parActivo, uid }]
    })
    setBusquedaProducto('')
    setShowBuscadorProducto(false)
  }

  const agregar = (p: CatItem) => {
    // Fotocromático: flujo especial con validación de mica
    if (p.sku === 'FIL-FC') {
      const micaEnPar = carrito.find(i => i.par === parActivo && COLORES_FC_POR_MICA[i.sku])
      if (!micaEnPar) {
        setAvisoSinMica(true)
        setBusquedaProducto('')
        setShowBuscadorProducto(false)
        return
      }
      setPendingFiltro({ ...p, sku: p.sku + '|' + micaEnPar.sku }) // guardamos mica SKU en el sku temporalmente
      setBusquedaProducto('')
      setShowBuscadorProducto(false)
      return
    }
    // Tinte: flujo multi-paso
    if (p.sku === 'FIL-TIN') {
      setPendingTinte({ step: 'color', color: '', tipo: '' })
      setBusquedaProducto('')
      setShowBuscadorProducto(false)
      return
    }
    // Filtro Transition: elegir tipo → color (sobreprecio según tipo)
    if (p.sku === 'FIL-TRA') {
      setPendingTransition({ step: 'tipo', tipo: '' })
      setBusquedaProducto('')
      setShowBuscadorProducto(false)
      return
    }
    // Polarizado: selector de color estático
    if (COLORES_FILTRO[p.sku]) {
      setPendingFiltro(p)
      setBusquedaProducto('')
      setShowBuscadorProducto(false)
      return
    }
    agregarDirecto(p)
  }

  const cambiarCantidad = (uid: string, delta: number) =>
    setCarrito(prev => prev.map(i => i.uid === uid ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))

  const cambiarDescuento = (uid: string, val: string) => {
    const n = Math.min(100, Math.max(0, parseInt(val) || 0))
    setCarrito(prev => prev.map(i => i.uid === uid ? { ...i, descuento: n } : i))
  }

  const eliminar = (uid: string) => setCarrito(prev => prev.filter(i => i.uid !== uid))

  const limpiar = () => {
    setCarrito([])
    setParActivo(1)
    setNumPares(1)
    setCliente(null)
    setClienteNombre('')
    setClienteApellido('')
    setClienteTelefono('')
    setFechaEntrega('')
    setBusquedaCliente('')
    setFolioLabGuardado([])
    setNotaImpresa(false)
    setOrdenLabImpresa(false)
    setModoPago('liquidar')
    setLineasPago([{ metodo: 'efectivo', moneda: 'MXN', monto: '' }])
    setConfirmarSinAnticipo(false)
  }

  const subtotal = carrito.reduce((s, i) => {
    const desc = i.precio * (i.descuento / 100)
    return s + (i.precio - desc) * i.cantidad
  }, 0)

  // El total al cliente es el subtotal. La comisión bancaria la absorbe la tienda (se registra en finanzas).
  const total = subtotal

  // ── Líneas de pago (pago dividido: método + moneda por línea) ──
  // El anticipo/recibido SALE de las líneas — no hay campo aparte.
  const lineaEnPesos = (l: LineaPago) =>
    l.moneda === 'USD' ? Number(l.monto || 0) * (tipoCambio || 0) : Number(l.monto || 0)
  const recibidoRaw = Math.round(lineasPago.reduce((s, l) => s + lineaEnPesos(l), 0) * 100) / 100
  const usaDolares = lineasPago.some(l => l.moneda === 'USD')
  // Tolerancia de redondeo: al cobrar en dólares enteros, la conversión casi nunca da
  // exacto. Aceptamos hasta ~1 dólar de diferencia (el TC efectivo absorbe el redondeo).
  const tolerancia = usaDolares && tipoCambio ? tipoCambio + 0.01 : 0.5
  const cubreTotal = recibidoRaw > 0 && Math.abs(recibidoRaw - total) <= tolerancia
  // En liquidar, si el pago cubre el total dentro de la tolerancia, se muestra como el
  // total EXACTO (sin gap ni falso descuento). El redondeo se absorbe en el TC efectivo.
  const recibido = (modoPago === 'liquidar' && cubreTotal) ? total : recibidoRaw
  const sobrepago = recibidoRaw - total > tolerancia
  const saldoCalc = Math.round((total - recibido) * 100) / 100
  const metodosUsados = [...new Set(lineasPago.filter(l => Number(l.monto) > 0).map(l => l.metodo))]
  const metodoVenta = metodosUsados.length === 0 ? 'efectivo'
    : metodosUsados.length === 1 ? metodosUsados[0] : 'mixto'
  // Válido para guardar: en liquidar debe cubrir el total (dentro de la tolerancia).
  const pagoValido = !sobrepago && (modoPago === 'liquidar' ? cubreTotal : recibidoRaw > 0)
  // Firma de la moneda de la única línea, para que el efecto reaccione al cambiar MXN↔USD
  const lineaUnicaMoneda = lineasPago.length === 1 ? lineasPago[0].moneda : 'multi'

  // En modo Liquidar con una sola línea, prellenar el monto que cubre el total:
  // en pesos → el total; en dólares → el equivalente en USD (total / TC).
  useEffect(() => {
    if (modoPago !== 'liquidar') return
    setLineasPago(prev => {
      if (prev.length === 1) {
        if (prev[0].moneda === 'MXN') {
          const t = String(total)
          if (prev[0].monto !== t) return [{ ...prev[0], monto: t }]
        } else if (prev[0].moneda === 'USD' && tipoCambio) {
          const t = String(Math.round(total / tipoCambio))  // dólar entero más cercano
          if (prev[0].monto !== t) return [{ ...prev[0], monto: t }]
        }
      }
      return prev
    })
  }, [total, modoPago, tipoCambio, lineaUnicaMoneda])

  // Si alguna línea es USD y aún no hay tipo de cambio, jalarlo
  useEffect(() => {
    if (usaDolares && !tipoCambio) fetchTipoCambio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usaDolares])

  // Tipo de cambio USD → MXN — DOF oficial (Banxico FIX), con respaldo de mercado
  const fetchTipoCambio = async () => {
    setLoadingTC(true)
    setTcError(false)
    try {
      // Tipo de cambio manual (Ajustes → Pagos), vía nuestra ruta de servidor
      const res = await fetch('/api/tipo-cambio')
      const data = await res.json()
      if (res.ok && data?.tipoCambio) {
        setTipoCambio(Math.round(data.tipoCambio * 100) / 100)
        return
      }
      setTcError(true)
    } catch {
      setTcError(true)
    } finally {
      setLoadingTC(false)
    }
  }

  const handleFinalizar = async (cotizacion = false) => {
    setGuardando(true)
    setEsCotizacion(cotizacion)
    setErrorGuardado('')

    try {
      const supabase = createClient()

      // Leer usuario actual
      const localU = getUsuarioLocal()
      const atendioPor = sessionUser?.nombre || localU.nombre || ''
      // usuario_id: la columna tiene FK a la tabla `usuarios`, y el id de Supabase Auth
      // NO es ese id → mandarlo rompe la venta. Lo dejamos null; quién atendió/cobró
      // queda guardado por nombre en atendido_por / registrado_por.
      const usuarioId: string | null = null

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

      // El anticipo/recibido es la suma de las líneas de pago (en pesos).
      // En liquidar dentro de la tolerancia de redondeo, la venta queda cubierta al 100%
      // (el pequeño desfase por redondear dólares se absorbe: la venta cuenta como el total).
      const liquidadaPorRedondeo = modoPago === 'liquidar' && saldoCalc === 0
      const anticoNum = cotizacion ? 0 : (liquidadaPorRedondeo ? total : recibido)
      const saldoNum  = total - anticoNum
      setAnticipoGuardado(anticoNum)
      setSaldoGuardado(saldoNum)

      // La venta SIEMPRE se guarda en pesos. El dólar es solo traducción visual
      // para el paciente; el rastreo de efectivo en dólares vive en el pago (caja USD).
      const totalDB    = total
      const subtotalDB = subtotal
      const anticoDB   = anticoNum
      const saldoDB    = saldoNum

      // ── 2. Auto-crear paciente si no existe ────────────────
      // Si el cliente ya viene vinculado desde expedientes, usamos su id.
      // Si fue captura libre, buscamos o creamos el registro en pacientes.
      let pacienteId: string | null = cliente?.id || null
      if (!cotizacion && !pacienteId && clienteNombre.trim()) {
        const { data: existing } = await supabase
          .from('pacientes')
          .select('id')
          .ilike('nombre', clienteNombre.trim())
          .ilike('apellido', clienteApellido.trim() || '')
          .maybeSingle()

        if (existing) {
          pacienteId = existing.id
        } else {
          const { data: nuevo } = await supabase
            .from('pacientes')
            .insert({
              nombre:             clienteNombre.trim(),
              apellido:           clienteApellido.trim() || null,
              telefono:           clienteTelefono.trim() || null,
              sucursal_principal: sucursal,
            })
            .select('id')
            .single()
          if (nuevo) pacienteId = nuevo.id
        }
      }

      // ── 3. Insertar venta ───────────────────────────────────
      const { data: ventaRow, error: errVenta } = await supabase
        .from('ventas')
        .insert({
          folio,
          paciente_id:       pacienteId,
          paciente_nombre:   `${clienteNombre} ${clienteApellido}`.trim(),
          paciente_telefono: clienteTelefono,
          sucursal,
          subtotal:    subtotalDB,
          total:       totalDB,
          anticipo:    anticoDB,
          saldo:       saldoDB,
          metodo_pago: metodoVenta,
          estado:      'activa',
          es_cotizacion: cotizacion,
          fecha_entrega: fechaEntrega || null,
          atendido_por:  atendioPor,
          usuario_id:    usuarioId,
          moneda:       'MXN',   // la venta siempre vive en pesos
          tipo_cambio:  null,
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
          par:             i.par,
        }
      })
      await supabase.from('ventas_items').insert(items)

      // ── 3b. Descontar stock de armazones vendidos (catálogo e-commerce) ──
      //     Solo en ventas reales (no cotizaciones). Se descuenta al momento de vender.
      if (!cotizacion) {
        const armzItems = carrito
          .filter(i => /^(VRL|ARMZ)-/i.test(i.sku || ''))
          .map(i => ({ sku: i.sku, cantidad: i.cantidad }))
        if (armzItems.length > 0) {
          fetch('/api/ecomm/armazones/movimiento', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sucursal, signo: -1, items: armzItems }),
          }).catch(() => { /* no bloquear la venta si falla el descuento */ })
        }
      }

      // ── 4. Registrar pagos por línea (método + moneda) ─────────
      if (!cotizacion && anticoDB > 0) {
        const nombrePac = `${clienteNombre} ${clienteApellido}`.trim()
        const tipoPago  = saldoDB === 0 ? 'liquidacion' : 'anticipo'

        // Pesos por línea (dólares → equivalente en pesos)
        const lineasPay = lineasPago
          .map(l => {
            const montoOrigen = Number(l.monto || 0)
            const esUSDLinea = l.moneda === 'USD' && !!tipoCambio
            const montoPesos = esUSDLinea ? Math.round(montoOrigen * tipoCambio! * 100) / 100 : montoOrigen
            return { metodo: l.metodo, moneda: l.moneda, montoOrigen, esUSDLinea, montoPesos }
          })
          .filter(x => x.montoOrigen > 0)

        // Ajustar el residuo del redondeo (dólares enteros) en la última línea, para que
        // los pagos sumen exacto al anticipo registrado (en liquidar = el total).
        const sumaPesos = lineasPay.reduce((s, x) => s + x.montoPesos, 0)
        const diff = Math.round((anticoDB - sumaPesos) * 100) / 100
        if (lineasPay.length > 0 && Math.abs(diff) > 0.001) {
          const last = lineasPay[lineasPay.length - 1]
          last.montoPesos = Math.round((last.montoPesos + diff) * 100) / 100
        }

        for (const x of lineasPay) {
          // TC efectivo de la línea (absorbe el redondeo si se ajustó el residuo)
          const tcLinea = x.esUSDLinea && x.montoOrigen > 0
            ? Math.round((x.montoPesos / x.montoOrigen) * 100) / 100
            : null

          // caja_movimientos (contabilidad general)
          await supabase.from('caja_movimientos').insert({
            tipo:           'ingreso',
            concepto:       `Venta ${folio} — ${nombrePac || 'Sin nombre'}`,
            monto:          x.montoPesos,
            sucursal,
            metodo_pago:    x.metodo,
            referencia:     folio,
            registrado_por: atendioPor,
          })

          // pagos_venta (fuente de verdad de la caja)
          const { error: errPago } = await supabase.from('pagos_venta').insert({
            venta_id:       ventaId,
            folio_venta:    folio,
            paciente:       nombrePac,
            monto:          x.montoPesos,
            metodo_pago:    x.metodo,
            moneda:         x.moneda,
            monto_origen:   x.montoOrigen,
            tipo_cambio:    tcLinea,
            tipo:           tipoPago,
            sucursal,
            registrado_por: atendioPor,
            usuario_id:     usuarioId,
          })
          if (errPago) {
            console.error('pagos_venta insert error:', errPago)
            setErrorGuardado(`⚠️ Venta guardada (${folio}) pero un pago falló: ${errPago.message}. Avisa a Rob.`)
          }

          // comisión terminal por cada línea de tarjeta
          await registrarComisionTerminal({
            metodoPago: x.metodo,
            monto:      x.montoPesos,
            folio,
            sucursal,
          })
        }
      }

      // ── 5. Crear órdenes de laboratorio por par ─────────────
      const isMica = (nombre: string) =>
        ['mica','monofocal','progres','bifocal','transitions','rebisel'].some(k => nombre.toLowerCase().includes(k))
      const isFiltro = (nombre: string) =>
        ['filtro','antirreflej','blue','fotocrom','polariz','tinte','crizal'].some(k => nombre.toLowerCase().includes(k))
      const isLC = (sku: string) => sku === 'LC'

      const parsConMicas = [...new Set(carrito.filter(i => isMica(i.nombre) || isLC(i.sku)).map(i => i.par))].sort()

      if (!cotizacion && parsConMicas.length > 0) {
        const { data: ultimoL } = await supabase
          .from('ordenes_lab')
          .select('folio')
          .ilike('folio', 'L-%')
          .order('folio', { ascending: false })
          .limit(1)
        let nL = ultimoL?.[0]?.folio ? parseInt(ultimoL[0].folio.replace(/\D/g, '')) + 1 : 1
        const hoy = hoyLocal()

        const fmtOjo = (esf: string, cil: string, eje: string) =>
          [esf, cil, eje ? `${eje}°` : ''].filter(Boolean).join(' / ')
        const odTexto = recetaPaciente
          ? fmtOjo(recetaPaciente.od_esfera, recetaPaciente.od_cilindro, recetaPaciente.od_eje)
          : ''
        const oiTexto = recetaPaciente
          ? fmtOjo(recetaPaciente.oi_esfera, recetaPaciente.oi_cilindro, recetaPaciente.oi_eje)
          : ''

        const foliosLab: string[] = []
        // Mapa SKU → info de lab para paquetes
        const todoCatalogo = [...catalogo, ...catalogoLC] as (CatItem & { labMica?: string; labTratamiento?: string })[]
        const catPorSku = Object.fromEntries(todoCatalogo.map(c => [c.sku, c]))

        for (const par of parsConMicas) {
          const itemsPar = carrito.filter(i => i.par === par)

          // Para paquetes: usar el desglose explícito; para micas sueltas: usar el nombre
          const micasPar = itemsPar
            .filter(i => isMica(i.nombre) || isLC(i.sku))
            .map(i => catPorSku[i.sku]?.labMica ?? i.nombre)
            .join(', ')

          // Para paquetes: leer tratamiento del catálogo; para filtros sueltos: usar nombre
          const filtrosSueltos = itemsPar
            .filter(i => !i.sku.startsWith('PAQ-') && isFiltro(i.nombre))
            .map(i => i.nombre)
          const tratamientosPaq = itemsPar
            .filter(i => i.sku.startsWith('PAQ-') && catPorSku[i.sku]?.labTratamiento)
            .map(i => catPorSku[i.sku].labTratamiento!)
          const filtrosPar = [...filtrosSueltos, ...tratamientosPaq].join(', ')
          const subtotalPar = itemsPar.reduce((s, i) => s + i.precio * (1 - i.descuento / 100) * i.cantidad, 0)
          const folioLab = `L-${String(nL).padStart(4, '0')}`
          nL++

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
            precio_cliente:   subtotalPar,
            anticipo:         parsConMicas.length === 1 ? anticoNum : 0,
            od:               odTexto,
            oi:               oiTexto,
            add_graduacion:   recetaPaciente?.od_add || '',
            dp:               recetaPaciente ? `${recetaPaciente.dp_od}/${recetaPaciente.dp_oi}` : '',
            tipo_mica:        micasPar,
            tratamiento:      filtrosPar,
          })
          foliosLab.push(folioLab)
        }
        setFolioLabGuardado(foliosLab)
      }

      // Si esta venta viene de convertir una cotización, borrar la cotización de origen
      if (!cotizacion && cotizacionOrigen) {
        await supabase.from('ventas_items').delete().eq('venta_id', cotizacionOrigen)
        await supabase.from('ventas').delete().eq('id', cotizacionOrigen)
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
    const metodoPagoLabel = metodoVenta === 'mixto'
      ? 'Pago mixto'
      : (metodosPago.find(m => m.key === metodoVenta)?.label ?? metodoVenta)
    const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const horaHoy = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

    const handleImprimirTicket = () => {
      setNotaImpresa(true)
      // Usuario que atendió — usa el "Nombre en receta" configurado; si no, arma "Nombre A."
      let u: { nombre?: string; nombre_receta?: string } = {}
      try { u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}') } catch {}
      const recetaNombre = (u.nombre_receta || '').trim()
      const _ap = (u.nombre || '').trim().split(/\s+/)
      const atendioPor = recetaNombre || (_ap.length >= 2 ? `${_ap[0]} ${_ap[1][0].toUpperCase()}.` : _ap[0] || '')

      const fechaFmt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

      // Filas de productos agrupados por par
      const paresTicket = [...new Set(carrito.map(i => i.par))].sort()
      const productosRows = paresTicket.map(par => {
        const itemsPar = carrito.filter(i => i.par === par)
        const headerRow = paresTicket.length > 1
          ? `<tr><td colspan="3" style="padding:1.5mm 0 0.5mm;font-weight:900;font-size:3mm;border-top:0.3mm dashed #000;">— PAR ${par} —</td></tr>`
          : ''
        const rows = itemsPar.map(item => {
          const precioUnit = item.precio * (1 - item.descuento / 100)
          const subtotalItem = precioUnit * item.cantidad
          const descStr = item.descuento > 0 ? `<br><small>(−${item.descuento}%)</small>` : ''
          return `<tr>
            <td class="cant">${item.cantidad}</td>
            <td class="desc">${item.nombre}${descStr}</td>
            <td class="precio">$${subtotalItem.toLocaleString('es-MX')}</td>
          </tr>`
        }).join('')
        return headerRow + rows
      }).join('')

      // Sección de pagos realizados (solo si quedó saldo diferido)
      const anticoNum = anticipoGuardado
      const saldo = saldoGuardado

      const pagosHtml = saldoGuardado > 0 ? `
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

      const win = window.open('', '_blank', 'width=230,height=900')
      if (!win) return
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${folio}</title>
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
  /* ── Header ── */
  .hdr { text-align: center; padding-bottom: 2mm; border-bottom: 0.5mm solid #000; margin-bottom: 3mm; }
  .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; margin: 4mm auto 0; display: block; }
  .b1  { font-size: 5.2mm; font-weight: 900; line-height: 1.15; }
  .b2  { font-size: 3.8mm; font-weight: 900; line-height: 1.2; }
  .dt  { font-size: 3mm; margin-top: 1.5mm; }
  /* ── Info ── */
  .info-sec { margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 0.4mm dashed #000; }
  .irow { display: flex; padding: 1mm 0; font-size: 3.5mm; gap: 1mm; }
  .ilbl { font-weight: 700; min-width: 18mm; flex-shrink: 0; }
  /* ── Folio ── */
  .folio { text-align: center; border: 0.5mm solid #000; padding: 2.5mm 1mm; margin-bottom: 3mm; }
  .folio-lbl { font-size: 3mm; }
  .folio-num { font-size: 5.2mm; font-weight: 900; margin-top: 1mm; }
  /* ── Productos ── */
  table.prods { width: 100%; border-collapse: collapse; margin-bottom: 2mm; font-size: 3.2mm; }
  table.prods th { border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 1.5mm 1mm; text-align: left; font-weight: 900; }
  table.prods td { padding: 1.5mm 1mm; vertical-align: top; line-height: 1.4; }
  .tc { width: 6mm; text-align: center; }
  .tp { text-align: right; width: 14mm; }
  /* ── Total ── */
  .total-row { display: flex; justify-content: space-between; align-items: baseline; font-weight: 900; font-size: 4.6mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2.5mm 0; }
  .pago-line { display: flex; justify-content: space-between; font-weight: 700; font-size: 3.4mm; padding: 2mm 0 0; margin-bottom: 3mm; }
  /* ── Pagos ── */
  .ph-title { text-align: center; font-weight: 900; font-size: 3.2mm; border-top: 0.4mm dashed #000; border-bottom: 0.4mm dashed #000; padding: 1.5mm 0; margin: 2.5mm 0 2mm; }
  .ph-line { display: none; }
  table.pagos { width: 100%; border-collapse: collapse; font-size: 3mm; }
  table.pagos th { text-align: left; font-weight: 700; padding: 1mm; border-bottom: 0.4mm solid #000; }
  table.pagos td { padding: 1mm; }
  .r { text-align: right; }
  .pagos-total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 3.2mm; border-top: 0.5mm solid #000; padding-top: 1.5mm; margin: 1.5mm 0 3mm; }
  .saldo-box { border: 0.5mm solid #000; padding: 3mm 2mm; text-align: center; margin-bottom: 3mm; }
  .saldo-lbl { font-size: 3mm; line-height: 1.4; }
  .saldo-val { font-size: 5.2mm; font-weight: 900; margin-top: 1.5mm; }
  /* ── Info cards ── */
  .icard { padding: 2.5mm 0; border-top: 0.4mm dashed #000; font-size: 3mm; line-height: 1.5; }
  /* ── Firma ── */
  .firma-sec { margin: 6mm 0 3mm; }
  .fline-rule { border-bottom: 0.4mm solid #000; height: 6mm; }
  .flbl { font-size: 3mm; text-align: center; margin-top: 1mm; }
  /* ── Footer ── */
  .footer { border-top: 0.5mm solid #000; padding-top: 3mm; margin-top: 2mm; text-align: center; font-size: 3mm; line-height: 2; }
  .faddr { font-weight: 700; line-height: 1.4; margin-bottom: 1.5mm; }
  .fatendio { font-weight: 900; }
  .fbar { margin-top: 2.5mm; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2.5mm 0; font-weight: 900; font-size: 3.5mm; }
  /* ── Evitar cortes ── */
  * { page-break-inside: avoid; break-inside: avoid; }
  /* ── Aviso pantalla ── */
  .tip { display: block; background: #fff8e1; border: 1px solid #e5a; padding: 5px 6px; margin-bottom: 8px; font-size: 9px; line-height: 1.5; }
  @media print { .tip { display: none; } }
</style></head><body>

<div class="tip">
  Configurar impresión: <b>Márgenes → Ninguno</b> · Sin encabezados/pies
</div>

<div class="hdr">
  <div class="b1">${(SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[sucursal]?.nombreLinea2 ? `<div class="b2">${SUCURSAL_CONFIG[sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="dt">${fechaFmt} | ${horaHoy}</div>
</div>

<div class="info-sec">
  ${(clienteNombre || clienteApellido) ? `<div class="irow"><span class="ilbl">Paciente:</span><span>${clienteNombre} ${clienteApellido}</span></div>` : ''}
  ${clienteTelefono ? `<div class="irow"><span class="ilbl">Tel:</span><span>${clienteTelefono}</span></div>` : ''}
</div>

<div class="folio">
  <div class="folio-lbl">FOLIO DE VENTA</div>
  <div class="folio-num">${folio}</div>
</div>

<table class="prods">
  <thead><tr><th class="tc">CANT</th><th>DESCRIPCION</th><th class="tp">PRECIO</th></tr></thead>
  <tbody>${productosRows}</tbody>
</table>

<div class="total-row"><span>TOTAL:</span><span>$${total.toLocaleString('es-MX')}</span></div>
<div class="pago-line"><span>Forma de pago:</span><span>${metodoPagoLabel}</span></div>

${pagosHtml}

${entregaHtml}

<div class="icard">Conserve este ticket para cualquier aclaracion o garantia.</div>

<div class="firma-sec">
  <div class="fline-rule"></div>
  <div class="flbl">Nombre y firma del comprador</div>
</div>

<div class="footer">
  ${SUCURSAL_CONFIG[sucursal]?.direccion ? `<div class="faddr">${SUCURSAL_CONFIG[sucursal].direccion}</div>` : ''}
  <div>Tel. ${SUCURSAL_CONFIG[sucursal]?.telefono ?? '661 612 0316'} | WA ${SUCURSAL_CONFIG[sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[sucursal]?.horario ?? 'Lun-Sab 10:00-18:00'}</div>
  ${atendioPor ? `<div class="fatendio">Atendio: ${atendioPor}</div>` : ''}
  <div>${SUCURSAL_CONFIG[sucursal]?.web ?? 'gonmx.com'}</div>
  <div class="fbar">... Gracias por su compra! ...</div>
</div>

${ticketLogo ? `<img src="${ticketLogo}" class="logo" alt="" />` : ''}

</body></html>`)
      win.document.close()
      setTimeout(() => { win.print() }, 400)
    }

    // ── Imprimir COTIZACIÓN (ticket térmico 58mm, sin pagos/firma, vigencia 15 días) ──
    const handleImprimirCotizacion = () => {
      setNotaImpresa(true)
      let u: { nombre?: string; nombre_receta?: string } = {}
      try { u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}') } catch {}
      const recetaNombre = (u.nombre_receta || '').trim()
      const _ap = (u.nombre || '').trim().split(/\s+/)
      const atendioPor = recetaNombre || (_ap.length >= 2 ? `${_ap[0]} ${_ap[1][0].toUpperCase()}.` : _ap[0] || '')
      const fechaFmt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

      const paresC = [...new Set(carrito.map(i => i.par))].sort()
      const productosRows = paresC.map(par => {
        const itemsPar = carrito.filter(i => i.par === par)
        const headerRow = paresC.length > 1
          ? `<tr><td colspan="3" style="padding:1.5mm 0 0.5mm;font-weight:900;font-size:3mm;border-top:0.3mm dashed #000;">— PAR ${par} —</td></tr>`
          : ''
        const rows = itemsPar.map(item => {
          const subtotalItem = item.precio * (1 - item.descuento / 100) * item.cantidad
          const descStr = item.descuento > 0 ? `<br><small>(−${item.descuento}%)</small>` : ''
          return `<tr><td class="tc">${item.cantidad}</td><td>${item.nombre}${descStr}</td><td class="tp">$${subtotalItem.toLocaleString('es-MX')}</td></tr>`
        }).join('')
        return headerRow + rows
      }).join('')

      const win = window.open('', '_blank', 'width=230,height=900')
      if (!win) return
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Cotización ${folio}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 3.3mm; font-weight: 600; color: #000; background: #fff; width: 48mm; padding: 1mm 1.5mm 4mm 1.5mm; overflow: visible; -webkit-font-smoothing: none; }
  .hdr { text-align: center; padding-bottom: 2mm; border-bottom: 0.5mm solid #000; margin-bottom: 3mm; }
  .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; margin: 4mm auto 0; display: block; }
  .b1 { font-size: 5.2mm; font-weight: 900; line-height: 1.15; }
  .b2 { font-size: 3.8mm; font-weight: 900; line-height: 1.2; }
  .dt { font-size: 3mm; margin-top: 1.5mm; }
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

<div class="tip">Configurar impresión: <b>Márgenes → Ninguno</b> · Sin encabezados/pies</div>

<div class="hdr">
  <div class="b1">${(SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal).toUpperCase()}</div>
  ${SUCURSAL_CONFIG[sucursal]?.nombreLinea2 ? `<div class="b2">${SUCURSAL_CONFIG[sucursal].nombreLinea2.toUpperCase()}</div>` : ''}
  <div class="dt">${fechaFmt} | ${horaHoy}</div>
</div>

<div class="info-sec">
  ${(clienteNombre || clienteApellido) ? `<div class="irow"><span class="ilbl">Cliente:</span><span>${clienteNombre} ${clienteApellido}</span></div>` : ''}
  ${clienteTelefono ? `<div class="irow"><span class="ilbl">Tel:</span><span>${clienteTelefono}</span></div>` : ''}
</div>

<div class="folio">
  <div class="folio-lbl">COTIZACIÓN</div>
  <div class="folio-num">${folio}</div>
</div>

<table class="prods">
  <thead><tr><th class="tc">CANT</th><th>DESCRIPCION</th><th class="tp">PRECIO</th></tr></thead>
  <tbody>${productosRows}</tbody>
</table>

<div class="total-row"><span>TOTAL ESTIMADO:</span><span>$${total.toLocaleString('es-MX')}</span></div>

<div class="vig-box"><b>Cotización válida por 15 días</b><br>Precios sujetos a cambio sin previo aviso.</div>

<div class="icard">Esta cotización NO es un comprobante de pago.</div>

<div class="footer">
  ${SUCURSAL_CONFIG[sucursal]?.direccion ? `<div class="faddr">${SUCURSAL_CONFIG[sucursal].direccion}</div>` : ''}
  <div>Tel. ${SUCURSAL_CONFIG[sucursal]?.telefono ?? '661 612 0316'} | WA ${SUCURSAL_CONFIG[sucursal]?.whatsapp ?? '664 834 3018'}</div>
  <div>${SUCURSAL_CONFIG[sucursal]?.horario ?? 'Lun-Sab 10:00-18:00'}</div>
  ${atendioPor ? `<div class="fatendio">Atendio: ${atendioPor}</div>` : ''}
  <div>${SUCURSAL_CONFIG[sucursal]?.web ?? 'gonmx.com'}</div>
  <div class="fbar">... Gracias por su preferencia! ...</div>
</div>

${ticketLogo ? `<img src="${ticketLogo}" class="logo" alt="" />` : ''}

</body></html>`)
      win.document.close()
      setTimeout(() => { win.print() }, 400)
    }

    // ── Imprimir órdenes de laboratorio (una página por par con micas) ──
    const isMicaFn = (nombre: string) =>
      ['mica','monofocal','progres','bifocal','transitions'].some(k => nombre.toLowerCase().includes(k))
    const isFiltroFn = (nombre: string) =>
      ['filtro','antirreflej','blue','fotocrom','tinte','polariz','crizal'].some(k => nombre.toLowerCase().includes(k))
    const isLCFn = (sku: string) => sku === 'LC'
    const parsConMicasGuardado = [...new Set(carrito.filter(i => isMicaFn(i.nombre) || isLCFn(i.sku)).map(i => i.par))].sort()
    const tieneMicasGuardado = parsConMicasGuardado.length > 0

    const handleImprimirOrdenLab = () => {
      setOrdenLabImpresa(true)
      const fechaFmt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const sucursalNombre = SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal
      const sucursalSub    = SUCURSAL_CONFIG[sucursal]?.nombreLinea2 ?? ''
      const nombreCompleto = `${clienteNombre} ${clienteApellido}`.trim()
      const win = window.open('', '_blank', 'width=420,height=640')
      if (!win) return

      const pagesHTML = parsConMicasGuardado.map((par, idx) => {
        const itemsPar = carrito.filter(i => i.par === par)
        const micasPar = itemsPar.filter(i => isMicaFn(i.nombre) || isLCFn(i.sku)).map(i => i.nombre).join(' + ') || '—'
        const filtrosPar = itemsPar.filter(i => isFiltroFn(i.nombre)).map(i => i.nombre).join(' + ')
        const folioLab = folioLabGuardado[idx] ?? '—'
        const parLabel = parsConMicasGuardado.length > 1 ? ` — Par ${par}` : ''
        return `
<div class="page">
<div class="hdr">
  <div class="hdr-left">
    <h1>${sucursalNombre}${parLabel}</h1>
    ${sucursalSub ? `<p style="font-size:9px;color:#aaa">${sucursalSub}</p>` : ''}
    <p style="font-size:9px;color:#aaa">Orden de laboratorio</p>
  </div>
  <div class="hdr-right">
    <div class="folio">${folioLab}</div>
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
  <div class="mica-tipo">${micasPar}</div>
  ${filtrosPar ? `<div class="mica-sub">Tratamiento: <b>${filtrosPar}</b></div>` : ''}
</div>
<div class="field"><span class="fl">Armazón:</span><span class="fv"></span></div>
<div class="meta">
  <span>Ingreso: <b>${new Date().toLocaleDateString('es-MX')}</b></span>
  <span>Entrega: <b>${fechaEntrega || '___________'}</b></span>
</div>
<div class="firma">Recibido por: _________________________</div>
</div>`
      }).join('<div class="page-break"></div>')

      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Órdenes Lab — ${folioLabGuardado.join(', ')}</title>
<style>
  @page { size: 4in 6in; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; width: 100%; }
  .page-break { page-break-after: always; }
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
</style></head><body>${pagesHTML}</body></html>`)
      win.document.close()
      setTimeout(() => { win.print() }, 300)
    }

    // ── Fase animación (1.8s) ──────────────────────────────────────
    if (!mostrarTicket) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <style>{`
            @keyframes spin-ring { to { transform: rotate(360deg) } }
            @keyframes pop-in { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
            .spin-ring { animation: spin-ring 0.8s linear infinite }
            .pop-check { animation: pop-in 0.4s cubic-bezier(.34,1.56,.64,1) forwards }
          `}</style>
          <div className="relative w-24 h-24">
            {/* Anillo giratorio */}
            <div className="spin-ring absolute inset-0 rounded-full border-[5px] border-zinc-100 border-t-[#0D9488]" />
          </div>
          <p className="text-zinc-400 text-sm tracking-wide">Registrando{esCotizacion ? ' cotización' : ' venta'}…</p>
        </div>
      )
    }

    return (
      <div className="max-w-4xl mx-auto py-4">
        <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Columna izquierda: nota de venta */}
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
          {/* Encabezado limpio */}
          <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-zinc-900 truncate">{SUCURSAL_CONFIG[sucursal]?.nombreLinea1 ?? sucursal}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{folio} · {fechaHoy}, {horaHoy}</p>
            </div>
            {!esCotizacion && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                saldoGuardado > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                <CheckCircle2 className="w-3 h-3" />
                {saldoGuardado > 0 ? 'Con saldo' : 'Liquidada'}
              </span>
            )}
          </div>

          {/* Cliente */}
          {(clienteNombre || clienteApellido) && (
            <div className="px-5 py-3 border-b border-zinc-200 flex justify-between items-center">
              <span className="text-xs text-zinc-400">Cliente</span>
              <span className="text-sm font-semibold text-zinc-700">{clienteNombre} {clienteApellido}</span>
            </div>
          )}

          {/* Productos agrupados por par */}
          {(() => {
            const sym = moneda === 'USD' ? 'USD $' : '$'
            const fmt = (n: number) => moneda === 'USD' ? n.toFixed(2) : n.toLocaleString('es-MX')
            const pares = [...new Set(carrito.map(i => i.par))].sort()
            return (
              <div className="px-5 py-3 space-y-4">
                {pares.map(par => {
                  const itemsPar = carrito.filter(i => i.par === par)
                  const subtotalPar = itemsPar.reduce((s, i) => s + i.precio * (1 - i.descuento / 100) * i.cantidad, 0)
                  const subtotalDisplay = moneda === 'USD' && tipoCambio ? subtotalPar / tipoCambio : subtotalPar
                  return (
                    <div key={par}>
                      {pares.length > 1 && (
                        <div className="flex justify-between items-center mb-1.5 border-b border-zinc-200 pb-1">
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Par {par}</span>
                          <span className="text-xs font-bold text-zinc-500">{sym}{fmt(subtotalDisplay)}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {itemsPar.map(item => {
                          const precio = item.precio * (1 - item.descuento / 100)
                          const sub = precio * item.cantidad
                          const precioDisplay = moneda === 'USD' && tipoCambio ? precio / tipoCambio : precio
                          const subDisplay    = moneda === 'USD' && tipoCambio ? sub / tipoCambio : sub
                          return (
                            <div key={item.uid} className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-zinc-700">{item.nombre}</p>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                  {item.cantidad > 1 ? `${item.cantidad} × ${sym}${fmt(precioDisplay)}` : ''}
                                  {item.descuento > 0 ? `${item.cantidad > 1 ? ' · ' : ''}Desc. ${item.descuento}%` : ''}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-zinc-800 ml-4 flex-shrink-0">{sym}{fmt(subDisplay)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Total + método de pago */}
          <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-200 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-400">{saldoGuardado > 0 ? 'Anticipo · ' : 'Pagado · '}{metodoPagoLabel}</p>
                {saldoGuardado > 0 && (
                  <p className="text-sm font-semibold text-emerald-700 mt-0.5">${anticipoGuardado.toLocaleString('es-MX')}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">Total</p>
                <p className="text-2xl font-bold text-zinc-900">${total.toLocaleString('es-MX')}</p>
              </div>
            </div>
            {saldoGuardado > 0 && (
              <div className="border-t border-zinc-200 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Anticipo recibido</span>
                  <span className="font-bold text-emerald-700">${anticipoGuardado.toLocaleString('es-MX')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600 font-semibold">Saldo pendiente</span>
                  <span className="font-bold text-red-600">${saldoGuardado.toLocaleString('es-MX')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: checklist + acciones */}
        <div className="space-y-4">

        <p className="text-sm text-zinc-500">¿Qué sigue?</p>

        {/* Acción principal: la nota de venta (para el paciente) */}
        <button
          onClick={esCotizacion ? handleImprimirCotizacion : handleImprimirTicket}
          className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
            notaImpresa
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-[#0D9488] text-white hover:bg-[#0B7A70]'
          }`}
        >
          <Printer className="w-[18px] h-[18px]" /> {esCotizacion
            ? (notaImpresa ? 'Cotización impresa' : 'Imprimir cotización')
            : (notaImpresa ? 'Nota de venta impresa' : 'Imprimir nota de venta')}
        </button>

        {/* Acción secundaria: orden de laboratorio */}
        {tieneMicasGuardado && (
          <button
            onClick={handleImprimirOrdenLab}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm transition-colors ${
              ordenLabImpresa
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <Printer className="w-[18px] h-[18px] text-zinc-500" />
            {ordenLabImpresa ? 'Órdenes de lab impresas' : 'Imprimir orden de laboratorio'}
            {!ordenLabImpresa && folioLabGuardado.length > 0 && (
              <span className="text-zinc-400 text-xs ml-auto">{folioLabGuardado.join(', ')}</span>
            )}
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/ventas"
            className="flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors text-center"
          >
            Ver historial
          </Link>
          <button
            onClick={() => { limpiar(); setGuardado(false); setMostrarTicket(false) }}
            className="flex items-center justify-center gap-2 py-3 bg-[#0B0E14] text-white rounded-lg text-sm font-bold hover:bg-[#1A1D27] transition-colors"
          >
            Nueva venta
          </button>
        </div>

        </div>{/* fin columna derecha */}
        </div>{/* fin grid dos columnas */}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ventas" className="w-9 h-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-zinc-500" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Nueva venta</h1>
          <p className="text-sm text-zinc-400">Completa los datos y genera la venta o cotización</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-700 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-md">
            {sucursal}
          </span>
        </div>
      </div>

      {/* Cliente + Fecha */}
      <div className="bg-white rounded-lg border border-zinc-200/80 p-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Buscar cliente */}
          <div className="col-span-2 relative">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Buscar cliente *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                value={busquedaCliente}
                onChange={e => setBusquedaCliente(e.target.value)}
                onFocus={() => setShowClienteDropdown(true)}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                placeholder="Busca por nombre o teléfono..."
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
              />
              {cliente && (
                <button onClick={() => { setCliente(null); setBusquedaCliente('') }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
                </button>
              )}
            </div>
            {showClienteDropdown && !cliente && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-xl z-20 divide-y divide-zinc-50 overflow-hidden">
                {clientesSuggestions.length > 0
                  ? clientesSuggestions.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => seleccionarCliente(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 transition-colors text-left"
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
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#0D9488] hover:bg-zinc-100 transition-colors"
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
              onChange={e => setClienteNombre(e.target.value.toUpperCase())}
              placeholder="NOMBRE"
              className="w-full py-2.5 px-4 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
            />
          </div>

          {/* Apellido */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Apellido *</label>
            <input
              value={clienteApellido}
              onChange={e => setClienteApellido(e.target.value.toUpperCase())}
              placeholder="APELLIDO"
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
        {/* Tabs de pares */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-zinc-200">
          {Array.from({ length: numPares }, (_, i) => i + 1).map(par => {
            const subtotalPar = carrito.filter(i => i.par === par).reduce((s, i) => s + (i.precio * (1 - i.descuento / 100) * i.cantidad), 0)
            const esMicaPar   = carrito.some(i => i.par === par && (
              ['mica','monofocal','progres','bifocal','transitions'].some(k => i.nombre.toLowerCase().includes(k)) || i.sku === 'LC'
            ))
            return (
              <button
                key={par}
                onClick={() => setParActivo(par)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t border-b-2 transition-all ${
                  parActivo === par
                    ? 'border-[#0D9488] text-[#0D9488] bg-[#0D9488]/5'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                Par {par}
                {esMicaPar && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded font-bold">LAB</span>}
                {subtotalPar > 0 && (
                  <span className="text-xs opacity-60">${subtotalPar.toLocaleString('es-MX')}</span>
                )}
              </button>
            )
          })}
          {numPares < 5 && (
            <button
              onClick={() => { const n = numPares + 1; setNumPares(n); setParActivo(n) }}
              className="flex items-center gap-1 px-3 py-2.5 text-sm text-zinc-400 hover:text-teal-600 border-b-2 border-transparent hover:border-teal-300 transition-all"
            >
              <span className="text-base leading-none">+</span> Par
            </button>
          )}
          {numPares > 1 && carrito.filter(i => i.par === parActivo).length === 0 && (
            <button
              onClick={() => {
                const n = numPares - 1
                setNumPares(n)
                setParActivo(Math.min(parActivo, n))
              }}
              className="ml-auto text-xs text-red-400 hover:text-red-600 px-2 py-1"
            >
              Eliminar par {parActivo}
            </button>
          )}
        </div>

        {/* Buscador de productos — fuera del overflow-x-auto para que el dropdown no se corte */}
        <div className="px-6 py-2 relative border-b border-zinc-50">
          <Search className="absolute left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={busquedaProducto}
            onChange={e => { setBusquedaProducto(e.target.value); setShowBuscadorProducto(true) }}
            onFocus={() => setShowBuscadorProducto(true)}
            placeholder="Buscar por código o descripción del producto..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400"
          />
          {showBuscadorProducto && busquedaProducto && (
            <div className="absolute top-full left-6 right-6 mt-1 bg-white border border-zinc-200 rounded-md shadow-xl z-20 divide-y divide-zinc-50 overflow-hidden max-h-64 overflow-y-auto">
              {productosFiltrados.slice(0, 50).map(p => (
                <button
                  key={p.id}
                  onClick={() => agregar(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {p.sku === 'LC'
                      ? <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">LC</span>
                      : <span className="text-xs font-mono text-zinc-400">{p.sku}</span>
                    }
                    <span className="text-sm font-medium text-zinc-700">{p.nombre}</span>
                  </div>
                  <div className="text-right">
                    {'precioFinal' in p && p.precioFinal && (
                      <div className="text-xs text-zinc-400 line-through">${p.precio.toLocaleString('es-MX')}</div>
                    )}
                    <span className="text-sm font-bold text-zinc-800">
                      ${'precioFinal' in p && p.precioFinal ? p.precioFinal.toLocaleString('es-MX') : p.precio.toLocaleString('es-MX')}
                    </span>
                  </div>
                </button>
              ))}
              {productosFiltrados.length === 0 && (
                <div className="px-4 py-4 text-sm text-zinc-400 text-center">Sin resultados</div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
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

              {carrito.filter(i => i.par === parActivo).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <Package className="w-10 h-10" />
                      <p className="text-sm">Busca y agrega productos arriba</p>
                    </div>
                  </td>
                </tr>
              )}

              {carrito.filter(i => i.par === parActivo).map(item => {
                const descMonto = item.precio * (item.descuento / 100)
                const precioFinal = item.precio - descMonto
                const subtotalItem = precioFinal * item.cantidad
                const stockBajo = item.stock !== 999 && item.cantidad > item.stock
                // Conversión USD: redondeo al más cercano (igual que el pago), sin decimales
                const esUSDVista = moneda === 'USD' && !!tipoCambio
                const precioDisplay    = esUSDVista ? Math.round(precioFinal / tipoCambio!) : precioFinal
                const subtotalDisplay  = esUSDVista ? Math.round(subtotalItem / tipoCambio!) : subtotalItem
                const fmtPrecio = (n: number) => esUSDVista ? `USD $${n}` : `$${n.toLocaleString('es-MX')}`

                return (
                  <tr key={item.uid} className="hover:bg-zinc-100/50 group">
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
                        <button onClick={() => cambiarCantidad(item.uid, -1)} className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                          <Minus className="w-3 h-3 text-zinc-600" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-zinc-700">{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.uid, 1)} className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
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
                      <span className="text-sm text-zinc-700">{fmtPrecio(precioDisplay)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.descuento || ''}
                          onChange={e => cambiarDescuento(item.uid, e.target.value)}
                          placeholder="0"
                          className="w-14 text-center text-sm border border-zinc-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-[#0D9488] bg-zinc-50"
                        />
                        <span className="text-zinc-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-zinc-800">{fmtPrecio(subtotalDisplay)}</span>
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => eliminar(item.uid)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-400">
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
          <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-end">
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-sm text-zinc-400">Total</span>
                {moneda === 'USD' && tipoCambio ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-blue-400">USD $</span>
                    <span className="text-2xl font-bold text-blue-700">{Math.round(subtotal / tipoCambio)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">$</span>
                    <span className="text-2xl font-bold text-zinc-800">{subtotal.toLocaleString('es-MX')}</span>
                  </div>
                )}
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
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-all"
          >
            <X className="w-4 h-4" /> Limpiar
          </button>
          <button
            onClick={() => setShowProductoLibre(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 border border-dashed border-zinc-300 rounded-md hover:bg-zinc-100 transition-all"
          >
            <Plus className="w-4 h-4" /> Producto libre
          </button>

          {/* Toggle moneda */}
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-zinc-200">
            <button
              onClick={() => setMoneda('MXN')}
              className={`text-xs font-bold px-3 py-2 rounded-md border transition-all ${moneda === 'MXN' ? 'bg-zinc-800 text-white border-zinc-800' : 'border-zinc-200 text-zinc-400 hover:border-zinc-400'}`}
            >
              🇲🇽 MXN
            </button>
            <button
              onClick={() => { setMoneda('USD'); if (!tipoCambio) fetchTipoCambio() }}
              className={`text-xs font-bold px-3 py-2 rounded-md border transition-all ${moneda === 'USD' ? 'bg-blue-600 text-white border-blue-600' : 'border-zinc-200 text-zinc-400 hover:border-blue-300'}`}
            >
              🇺🇸 USD
            </button>
            {moneda === 'USD' && loadingTC && <span className="text-[10px] text-blue-400 ml-1">...</span>}
            {moneda === 'USD' && tipoCambio && !loadingTC && (
              <span className="text-[10px] text-blue-500 font-semibold ml-1">
                1 USD = ${tipoCambio.toFixed(2)}
                <button onClick={fetchTipoCambio} className="ml-1 opacity-60 hover:opacity-100">↻</button>
              </span>
            )}
            {moneda === 'USD' && tcError && !loadingTC && (
              <button onClick={fetchTipoCambio} className="text-[10px] text-red-400 underline ml-1">Error · reintentar</button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEsCotizacion(true); setShowModal(true) }}
            disabled={carrito.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-sm font-semibold hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            Generar cotización
          </button>
          <button
            onClick={() => { setEsCotizacion(false); setShowModal(true) }}
            disabled={carrito.length === 0 || !clienteNombre || !fechaEntrega}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0B0E14] text-white rounded-md text-sm font-bold hover:bg-[#1A1D27] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            Generar venta
          </button>
        </div>
        {carrito.length > 0 && clienteNombre && !fechaEntrega && (
          <p className="text-xs text-amber-600 mt-2 font-medium text-right">
            ⚠️ Falta la <b>fecha de entrega</b> (arriba) para poder generar la venta.
          </p>
        )}
      </div>

      {/* Modal producto libre */}
      {showProductoLibre && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
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
                  placeholder="DESCRIPCIÓN DEL PRODUCTO O SERVICIO"
                  value={productoLibre.descripcion}
                  onChange={e => setProductoLibre(p => ({ ...p, descripcion: e.target.value.toUpperCase() }))}
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
                  <p className="text-[11px] text-zinc-400 mt-1">Puedes dejarlo en $0 — ej. armazón propio del paciente</p>
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
                className="flex-1 border border-zinc-200 text-zinc-600 rounded-md py-2 text-sm hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const precio = parseFloat(productoLibre.precio) || 0
                  const cantidad = parseInt(productoLibre.cantidad) || 1
                  if (!productoLibre.descripcion.trim() || precio < 0) return
                  const uid = `libre-${Date.now()}`
                  setCarrito(prev => [...prev, {
                    uid,
                    id: Date.now(),
                    nombre: productoLibre.descripcion.trim(),
                    precio,
                    cantidad,
                    sku: 'LIBRE',
                    stock: 999,
                    descuento: 0,
                    par: parActivo,
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200">
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
                        onClick={() => { setModoPago('liquidar'); setLineasPago([{ metodo: 'efectivo', moneda: 'MXN', monto: String(total) }]) }}
                        className={`py-3 rounded-md text-sm font-semibold border transition-all ${modoPago === 'liquidar' ? 'border-[#0B0E14] bg-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                      >
                        Liquidar total
                      </button>
                      <button
                        onClick={() => { setModoPago('diferir'); setLineasPago([{ metodo: 'efectivo', moneda: 'MXN', monto: '' }]) }}
                        className={`py-3 rounded-md text-sm font-semibold border transition-all ${modoPago === 'diferir' ? 'border-[#0B0E14] bg-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                      >
                        Diferir pagos
                      </button>
                    </div>
                  </div>

                  {/* Método(s) de pago — pago dividido (el anticipo sale de las líneas) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-zinc-500">
                        {modoPago === 'liquidar' ? '¿Cómo paga el total?' : '¿Cuánto y cómo deja de anticipo?'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setLineasPago(prev => [...prev, { metodo: 'efectivo', moneda: 'MXN', monto: '' }])}
                        className="text-xs font-semibold text-[#0D9488] hover:underline"
                      >
                        + Agregar línea
                      </button>
                    </div>

                    <div className="space-y-2">
                      {lineasPago.map((l, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={l.metodo}
                            onChange={e => setLineasPago(prev => prev.map((x, j) => j === i ? { ...x, metodo: e.target.value } : x))}
                            className="flex-1 min-w-0 border border-zinc-200 rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                          >
                            {METODOS_LINEA.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </select>

                          {/* Moneda: solo tiene sentido en efectivo */}
                          {l.metodo === 'efectivo' ? (
                            <div className="flex rounded-md border border-zinc-200 overflow-hidden flex-shrink-0">
                              <button type="button"
                                onClick={() => setLineasPago(prev => prev.map((x, j) => j === i ? { ...x, moneda: 'MXN', monto: '' } : x))}
                                className={`px-2 py-2 text-xs font-bold ${l.moneda === 'MXN' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>MXN</button>
                              <button type="button"
                                onClick={() => setLineasPago(prev => prev.map((x, j) => j === i ? { ...x, moneda: 'USD', monto: '' } : x))}
                                className={`px-2 py-2 text-xs font-bold ${l.moneda === 'USD' ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>USD</button>
                            </div>
                          ) : null}

                          <div className="relative w-36 flex-shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-semibold">
                              {l.metodo === 'efectivo' && l.moneda === 'USD' ? 'US$' : '$'}
                            </span>
                            <input
                              type="number" min={0} step="any" value={l.monto}
                              onChange={e => setLineasPago(prev => prev.map((x, j) => j === i ? { ...x, monto: e.target.value } : x))}
                              className="w-full border border-zinc-200 rounded-md pl-9 pr-2 py-2.5 text-sm font-semibold text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                              placeholder="0"
                            />
                          </div>

                          {lineasPago.length > 1 && (
                            <button type="button"
                              onClick={() => setLineasPago(prev => prev.filter((_, j) => j !== i))}
                              className="text-zinc-300 hover:text-red-500 flex-shrink-0">✕</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Equivalencia USD → pesos */}
                    {usaDolares && tipoCambio && (
                      <p className="text-[11px] text-blue-500 mt-1.5">
                        TC DOF ${tipoCambio.toFixed(2)} · un pago en dólares abona su equivalente en pesos y va a la caja de dólares
                      </p>
                    )}

                    {/* Resumen: total / recibido / saldo */}
                    <div className="mt-3 border-t border-zinc-200 pt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-zinc-500">
                        <span>Total venta</span><span className="font-semibold">${total.toLocaleString('es-MX')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Recibido ahora</span>
                        <span className="font-bold">${recibido.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 font-semibold">Saldo pendiente</span>
                        <span className={`font-bold ${saldoCalc > 0.01 ? 'text-red-600' : 'text-zinc-700'}`}>
                          ${Math.max(0, saldoCalc).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {sobrepago && (
                        <p className="text-xs text-red-600 font-medium">
                          ⚠️ El pago excede el total por ${(recibido - total).toLocaleString('es-MX', { maximumFractionDigits: 2 })}. Ajusta las líneas.
                        </p>
                      )}
                      {modoPago === 'liquidar' && !sobrepago && Math.abs(recibido - total) >= 0.5 && (
                        <p className="text-xs text-amber-600 font-medium">
                          En &ldquo;Liquidar total&rdquo; los pagos deben cubrir ${total.toLocaleString('es-MX')}.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Total */}
              <div className="bg-zinc-50 rounded-lg px-5 py-4">
                {(() => {
                  const isUSD = !esCotizacion && moneda === 'USD' && tipoCambio
                  const totalUSD = isUSD ? total / tipoCambio! : 0
                  return (
                    <div className="text-center">
                      <p className="text-xs text-zinc-400 mb-1">
                        {esCotizacion ? 'Total estimado' : 'Total venta'}
                      </p>
                      {isUSD ? (
                        <>
                          <p className="text-3xl font-bold text-blue-700">USD ${totalUSD.toFixed(2)}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">${total.toLocaleString('es-MX')} MXN · TC ${tipoCambio!.toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="text-3xl font-bold text-[#0B0E14]">${total.toLocaleString('es-MX')}</p>
                      )}
                    </div>
                  )
                })()}
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
                className="flex-1 py-3 border border-zinc-200 text-zinc-600 rounded-md text-sm font-semibold hover:bg-zinc-100 transition-colors"
              >
                Volver
              </button>
              {confirmarSinAnticipo ? (
                <div className="flex-1 bg-amber-50 border border-amber-300 rounded-md px-4 py-3 space-y-2">
                  <p className="text-xs font-bold text-amber-800">⚠️ ¿Confirmar sin anticipo?</p>
                  <p className="text-xs text-amber-700">La venta quedará con saldo pendiente de <span className="font-bold">${total.toLocaleString('es-MX')}</span>. ¿El cliente no dejó ningún pago hoy?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setConfirmarSinAnticipo(false); handleFinalizar(esCotizacion) }}
                      className="flex-1 py-2 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700"
                    >
                      Sí, sin anticipo
                    </button>
                    <button
                      onClick={() => setConfirmarSinAnticipo(false)}
                      className="flex-1 py-2 border border-amber-300 text-amber-700 rounded text-xs font-bold hover:bg-amber-100"
                    >
                      Capturar anticipo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!esCotizacion && modoPago === 'diferir' && recibido <= 0) {
                      setConfirmarSinAnticipo(true)
                    } else {
                      handleFinalizar(esCotizacion)
                    }
                  }}
                  disabled={guardando || (!esCotizacion && (modoPago === 'liquidar' ? !pagoValido : (recibido > 0 && !pagoValido)))}
                  className="flex-1 py-3 bg-[#0D9488] text-white rounded-md text-sm font-bold hover:bg-teal-500 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : esCotizacion ? 'Generar cotización' : 'Finalizar venta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Aviso: fotocromático sin mica */}
      {avisoSinMica && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl text-center">
            <p className="text-2xl mb-3">🔍</p>
            <h3 className="text-sm font-bold text-zinc-800 mb-2">Primero elige la mica</h3>
            <p className="text-xs text-zinc-400 mb-5">Para agregar el fotocromático necesitas tener una mica en el carrito (Monofocal, Bifocal o Progresivo).</p>
            <button
              onClick={() => setAvisoSinMica(false)}
              className="w-full bg-[#0B0E14] text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Color picker modal para fotocromático y otros filtros */}
      {pendingFiltro && (() => {
        const esFc = pendingFiltro.sku.startsWith('FIL-FC|')
        const micaSku = esFc ? pendingFiltro.sku.split('|')[1] : ''
        const colores = esFc
          ? (COLORES_FC_POR_MICA[micaSku] ?? ['Gris'])
          : (COLORES_FILTRO[pendingFiltro.sku] ?? [])
        const productoBase = esFc ? { ...pendingFiltro, sku: 'FIL-FC' } : pendingFiltro

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="text-sm font-bold text-zinc-800 mb-1">{productoBase.nombre}</h3>
              <p className="text-xs text-zinc-400 mb-4">Selecciona el color</p>
              <div className="flex flex-wrap gap-2">
                {colores.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      if (esFc) {
                        const precio = precioFC(color, micaSku)
                        if (color === 'Gris') {
                          agregarDirecto(productoBase, color, precio)
                          setPendingFiltro(null)
                        } else {
                          setPendingTratamiento({ color, micaSku, precio })
                          setPendingFiltro(null)
                        }
                      } else {
                        agregarDirecto(productoBase, color)
                        setPendingFiltro(null)
                      }
                    }}
                    className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all"
                  >
                    {color}
                    {esFc && color !== 'Gris' && (
                      <span className="ml-1.5 text-xs text-zinc-400">
                        +${micaSku === 'MON-PPL' ? '900' : '400'}
                      </span>
                    )}
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
        )
      })()}

      {/* Segundo paso: elegir tratamiento (Antirreflejante o Bluelight) */}
      {pendingTratamiento && (() => {
        const fcBase = catalogo.find(p => p.sku === 'FIL-FC')!
        const ar     = catalogo.find(p => p.sku === 'FIL-AR')!
        const bl     = catalogo.find(p => p.sku === 'FIL-BL')!

        const confirmar = (tratamiento: typeof ar) => {
          // Agregar fotocromático con precio correcto
          agregarDirecto({ ...fcBase, precio: pendingTratamiento.precio }, pendingTratamiento.color, pendingTratamiento.precio)
          // Agregar tratamiento
          agregarDirecto(tratamiento)
          setPendingTratamiento(null)
        }

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="text-sm font-bold text-zinc-800 mb-1">Fotocromático — {pendingTratamiento.color}</h3>
              <p className="text-xs text-zinc-400 mb-4">Los lentes de color requieren tratamiento. ¿Cuál lleva?</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => confirmar(ar)}
                  className="flex items-center justify-between px-4 py-3 border border-zinc-200 rounded-xl hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all text-left"
                >
                  <div>
                    <p className="text-sm font-bold text-zinc-800">Antirreflejante</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Coating verde</p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-600">${ar.precio}</span>
                </button>
                <button
                  onClick={() => confirmar(bl)}
                  className="flex items-center justify-between px-4 py-3 border border-zinc-200 rounded-xl hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all text-left"
                >
                  <div>
                    <p className="text-sm font-bold text-zinc-800">Bluelight</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Coating azul</p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-600">${bl.precio}</span>
                </button>
              </div>
              <button
                onClick={() => setPendingTratamiento(null)}
                className="mt-4 w-full text-xs text-zinc-400 hover:text-zinc-600 py-1 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* Flujo multi-paso: Tinte */}
      {pendingTinte && (() => {
        const COLORES_TINTE = ['Gris', 'Café', 'Verde', 'Azul', 'Rosado', 'Morado', 'Amarillo']
        const tinteProd = catalogo.find(p => p.sku === 'FIL-TIN')!

        const confirmarTinte = (tono: string) => {
          const sufijo = `${pendingTinte.color} ${pendingTinte.tipo} ${tono}`
          agregarDirecto(tinteProd, sufijo)
          setPendingTinte(null)
        }

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">

              {/* Indicador de pasos */}
              <div className="flex items-center gap-1 mb-5">
                {(['Color', 'Tipo', 'Tono'] as const).map((s, i) => {
                  const stepIdx = pendingTinte.step === 'color' ? 0 : pendingTinte.step === 'tipo' ? 1 : 2
                  return (
                    <div key={s} className="contents">
                      {i > 0 && <div className={`flex-1 h-0.5 ${i <= stepIdx ? 'bg-[#0D9488]' : 'bg-zinc-200'}`} />}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= stepIdx ? 'bg-[#0D9488] text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                        {i + 1}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Paso 1: Color */}
              {pendingTinte.step === 'color' && (
                <>
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">Tinte — Color</h3>
                  <p className="text-xs text-zinc-400 mb-4">¿Qué color lleva el tinte?</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORES_TINTE.map(color => (
                      <button key={color}
                        onClick={() => setPendingTinte({ step: 'tipo', color, tipo: '' })}
                        className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all"
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Paso 2: Tipo */}
              {pendingTinte.step === 'tipo' && (
                <>
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">Tinte {pendingTinte.color} — Tipo</h3>
                  <p className="text-xs text-zinc-400 mb-4">¿Cómo va el tinte?</p>
                  <div className="flex flex-col gap-3">
                    {['Completo', 'Desvanecido'].map(tipo => (
                      <button key={tipo}
                        onClick={() => setPendingTinte(prev => ({ ...prev!, step: 'tono', tipo }))}
                        className="px-4 py-3 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all text-left"
                      >
                        {tipo}
                        <p className="text-xs text-zinc-400 font-normal mt-0.5">
                          {tipo === 'Completo' ? 'Color uniforme en toda la mica' : 'Degradado de oscuro a transparente'}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Paso 3: Tono */}
              {pendingTinte.step === 'tono' && (
                <>
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">Tinte {pendingTinte.color} {pendingTinte.tipo} — Tono</h3>
                  <p className="text-xs text-zinc-400 mb-4">¿Qué intensidad lleva?</p>
                  <div className="flex flex-col gap-3">
                    {['Tono 1', 'Tono 2', 'Tono 3'].map(tono => (
                      <button key={tono}
                        onClick={() => confirmarTinte(tono)}
                        className="px-4 py-3 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all text-left"
                      >
                        {tono}
                        <p className="text-xs text-zinc-400 font-normal mt-0.5">
                          {tono === 'Tono 1' ? 'Ligero — ~25% de opacidad' : tono === 'Tono 2' ? 'Medio — ~50% de opacidad' : 'Oscuro — ~75% de opacidad'}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  if (pendingTinte.step === 'color') setPendingTinte(null)
                  else if (pendingTinte.step === 'tipo') setPendingTinte(prev => ({ ...prev!, step: 'color', color: '' }))
                  else setPendingTinte(prev => ({ ...prev!, step: 'tipo', tipo: '' }))
                }}
                className="mt-5 w-full text-xs text-zinc-400 hover:text-zinc-600 py-1 transition-colors"
              >
                {pendingTinte.step === 'color' ? 'Cancelar' : '← Regresar'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Modal Filtro Transition (tipo → color) ── */}
      {pendingTransition && (() => {
        const transProd = catalogo.find(p => p.sku === 'FIL-TRA')
        if (!transProd) return null
        const tipoDef = TRANSITION_TIPOS.find(t => t.tipo === pendingTransition.tipo)

        const confirmar = (color: string) => {
          const extra = tipoDef?.extra ?? 0
          agregarDirecto(transProd, `${pendingTransition.tipo} · ${color}`, transProd.precio + extra)
          setPendingTransition(null)
        }

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">

              {/* Indicador de pasos */}
              <div className="flex items-center gap-1 mb-5">
                {(['Tipo', 'Color'] as const).map((s, i) => {
                  const stepIdx = pendingTransition.step === 'tipo' ? 0 : 1
                  return (
                    <div key={s} className="contents">
                      {i > 0 && <div className={`flex-1 h-0.5 ${i <= stepIdx ? 'bg-[#0D9488]' : 'bg-zinc-200'}`} />}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= stepIdx ? 'bg-[#0D9488] text-white' : 'bg-zinc-100 text-zinc-400'}`}>{i + 1}</div>
                    </div>
                  )
                })}
              </div>

              {/* Paso 1: Tipo */}
              {pendingTransition.step === 'tipo' && (
                <>
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">Filtro Transition — Tipo</h3>
                  <p className="text-xs text-zinc-400 mb-4">¿Qué tipo de Transition?</p>
                  <div className="flex flex-col gap-3">
                    {TRANSITION_TIPOS.map(t => (
                      <button key={t.tipo}
                        onClick={() => setPendingTransition({ step: 'color', tipo: t.tipo })}
                        className="px-4 py-3 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all text-left flex justify-between items-center">
                        <span>Transitions {t.tipo}</span>
                        <span className="text-xs text-zinc-400 font-normal">{t.extra > 0 ? `+$${t.extra.toLocaleString('es-MX')}` : 'base'}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Paso 2: Color */}
              {pendingTransition.step === 'color' && (
                <>
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">Transitions {pendingTransition.tipo} — Color</h3>
                  <p className="text-xs text-zinc-400 mb-4">¿Qué color lleva?</p>
                  <div className="flex flex-wrap gap-2">
                    {(tipoDef?.colores ?? ['Gris']).map(color => (
                      <button key={color}
                        onClick={() => confirmar(color)}
                        className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all">
                        {color}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  if (pendingTransition.step === 'tipo') setPendingTransition(null)
                  else setPendingTransition({ step: 'tipo', tipo: '' })
                }}
                className="mt-5 w-full text-xs text-zinc-400 hover:text-zinc-600 py-1 transition-colors">
                {pendingTransition.step === 'tipo' ? 'Cancelar' : '← Regresar'}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
