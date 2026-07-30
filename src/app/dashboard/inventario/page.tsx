'use client'

import { useState, useEffect, useCallback } from 'react'
import RequireRol from '@/components/RequireRol'
import { useSession } from '@/hooks/useSession'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, AlertTriangle, Filter, ChevronDown,
  X, Save, Edit2, Layers, Tag, Store, Globe, CheckSquare, RefreshCw,
  ClipboardCheck, ChevronRight, Check, ShoppingCart, Package,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type TipoProducto = 'armazon' | 'consumible' | 'servicio'
type LenteContacto = { id: string; nombre: string; precio_publico: number; activo: boolean }
type EstadoArmazon = 'disponible' | 'apartado' | 'vendido'

const CANALES_DISPONIBLES = [
  { key: 'baja',  label: 'Baja Visión',    icon: '🏪' },
  { key: 'mayo',  label: '5 de Mayo',      icon: '🏪' },
  { key: 'plaza', label: 'Plaza Laureles', icon: '🏪' },
  { key: 'gon',   label: 'GON.mx',         icon: '🌐' },
  { key: 'verly', label: 'Verly Optical',  icon: '🌐' },
]

type Producto = {
  id: number
  sku: string
  nombre: string
  tipo: TipoProducto
  categoria: string
  marca: string
  precio: number
  costo: number
  ubicacion: string
  canales?: string[]
  estado?: EstadoArmazon
  stock?: number
  stockBaja?: number
  stockMayo?: number
  stockPlaza?: number
  stockMin?: number
  descripcion?: string
  color?: string
  medidas?: { ojo?: string; puente?: string; varilla?: string; alto?: string }
  _ecomm?: boolean       // true = armazón que vive en la base de e-commerce (webs)
  _ecommId?: number      // id real del armazón en esa base
}

// Armazón crudo tal cual viene de la base de e-commerce (para su editor propio)
type ArmazonRaw = {
  id: number; nombre: string; marca: string; modelo: string | null; color1: string | null
  medidas: string | null; material: string | null; precio: number | null; precio_gon: number | null
  costo: number | null; stock_baja: number | null; stock_mayo: number | null; stock_plaza: number | null
  stock_online: number | null; publicar_gon: boolean | null; publicar_verly: boolean | null
  descuento_gon: number | null; descuento_verly: number | null; activo: boolean | null
  imagen_url: string | null; imagen2_url?: string | null; imagen3_url?: string | null
  imagen4_url?: string | null; imagen5_url?: string | null
}
const TC_USD = 17
const nEd = (v: unknown) => Number(v ?? 0)

const TIPOS: Record<TipoProducto, { label: string; color: string }> = {
  armazon:    { label: 'Armazón',    color: 'bg-indigo-50 text-indigo-600' },
  consumible: { label: 'Consumible', color: 'bg-teal-50 text-[#0D9488]' },
  servicio:   { label: 'Servicio',   color: 'bg-zinc-100 text-zinc-600' },
}

const ESTADO: Record<EstadoArmazon, { label: string; dot: string; text: string; bg: string }> = {
  disponible: { label: 'Disponible', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  apartado:   { label: 'Apartado',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  vendido:    { label: 'Vendido',    dot: 'bg-zinc-400',   text: 'text-zinc-500',   bg: 'bg-zinc-100' },
}

// ─────────────────────────────────────────
// Catálogo real GON — micas y filtros
// ─────────────────────────────────────────
const inicial: Producto[] = [
  // Micas Monofocal
  { id:  1, sku: 'MON-ESS', nombre: 'Mica Monofocal Essential',         tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio:  749, costo: 0, ubicacion: 'Todas' },
  { id:  2, sku: 'MON-SHD', nombre: 'Mica Monofocal Slim HD 1.60',      tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 1146, costo: 0, ubicacion: 'Todas' },
  { id:  3, sku: 'MON-PPL', nombre: 'Mica Monofocal Poly Plus 1.58',    tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 1746, costo: 0, ubicacion: 'Todas' },
  { id:  4, sku: 'MON-USL', nombre: 'Mica Monofocal Ultra Slim 1.67',   tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 3946, costo: 0, ubicacion: 'Todas' },
  { id:  5, sku: 'MON-USP', nombre: 'Mica Monofocal Ultra Slim Pro 1.74',tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 5446, costo: 0, ubicacion: 'Todas' },
  // Micas Bifocal
  { id:  6, sku: 'BIF-ESS', nombre: 'Mica Bifocal Essential',           tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 1149, costo: 0, ubicacion: 'Todas' },
  { id:  7, sku: 'BIF-SHD', nombre: 'Mica Bifocal Slim HD 1.60',        tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 1546, costo: 0, ubicacion: 'Todas' },
  { id:  8, sku: 'BIF-PPL', nombre: 'Mica Bifocal Poly Plus 1.58',      tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 2146, costo: 0, ubicacion: 'Todas' },
  { id:  9, sku: 'BIF-USL', nombre: 'Mica Bifocal Ultra Slim 1.67',     tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 4346, costo: 0, ubicacion: 'Todas' },
  // Micas Progresivo
  { id: 10, sku: 'PRO-ESS', nombre: 'Mica Progresivo Essential',        tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 1899, costo: 0, ubicacion: 'Todas' },
  { id: 11, sku: 'PRO-SHD', nombre: 'Mica Progresivo Slim HD 1.60',     tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 2296, costo: 0, ubicacion: 'Todas' },
  { id: 12, sku: 'PRO-PPL', nombre: 'Mica Progresivo Poly Plus 1.58',   tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 2896, costo: 0, ubicacion: 'Todas' },
  { id: 13, sku: 'PRO-USL', nombre: 'Mica Progresivo Ultra Slim 1.67',  tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 5096, costo: 0, ubicacion: 'Todas' },
  { id: 14, sku: 'PRO-USP', nombre: 'Mica Progresivo Ultra Slim Pro 1.74',tipo: 'servicio', categoria: 'Micas', marca: 'GON', precio: 6596, costo: 0, ubicacion: 'Todas' },
  // Filtros
  { id: 20, sku: 'FIL-AR',  nombre: 'Filtro Antirreflejo',              tipo: 'servicio', categoria: 'Filtros', marca: 'GON', precio:  279, costo: 0, ubicacion: 'Todas' },
  { id: 21, sku: 'FIL-BL',  nombre: 'Filtro Blue Light',                tipo: 'servicio', categoria: 'Filtros', marca: 'GON', precio:  549, costo: 0, ubicacion: 'Todas' },
  { id: 22, sku: 'FIL-FC',  nombre: 'Filtro Fotocromático',             tipo: 'servicio', categoria: 'Filtros', marca: 'GON', precio:  949, costo: 0, ubicacion: 'Todas' },
  { id: 23, sku: 'FIL-POL', nombre: 'Filtro Polarizado',                tipo: 'servicio', categoria: 'Filtros', marca: 'GON', precio: 1699, costo: 0, ubicacion: 'Todas' },
  { id: 24, sku: 'FIL-TIN', nombre: 'Filtro Tinte',                     tipo: 'servicio', categoria: 'Filtros', marca: 'GON', precio:  549, costo: 0, ubicacion: 'Todas' },
]

const sucursales = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']
const catsPorTipo: Record<TipoProducto, string[]> = {
  armazon:    ['Armazones', 'Lentes de sol'],
  consumible: ['Accesorios'],
  servicio:   ['Micas', 'Examen visual', 'Servicio'],
}

const TODOS_LOS_CANALES = CANALES_DISPONIBLES.map(c => c.key)

const CAPACIDAD_EXHIBICION: Record<string, number> = {
  'Baja Visión':    253,
  '5 de Mayo':      282,
  'Plaza Laureles': 225,
}
const RESERVA_OBJETIVO = 12   // mínimo de reserva en bodega
const RESERVA_ALERTA   = 5    // umbral crítico — alert de compra
const SUCURSALES_FISICAS = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

const generarSku = (_tipo?: TipoProducto) =>
  Math.random().toString(36).slice(2, 9).toUpperCase()

const formVacio = (): Omit<Producto, 'id'> => ({
  sku: '', nombre: '', tipo: 'armazon', categoria: 'Armazones', marca: '',
  precio: 0, costo: 0, ubicacion: 'Baja Visión',
  canales: [...TODOS_LOS_CANALES], estado: 'disponible',
  stock: 0, stockBaja: 0, stockMayo: 0, stockPlaza: 0, stockMin: 0,
  descripcion: '', color: '', medidas: {},
})

// ─────────────────────────────────────────
// Componente canal badge
// ─────────────────────────────────────────
function CanalBadges({ canales }: { canales: string[] }) {
  if (!canales || canales.length === 0)
    return <span className="text-xs text-zinc-400 italic">Sin canales</span>
  return (
    <div className="flex flex-wrap gap-1">
      {canales.map(k => {
        const c = CANALES_DISPONIBLES.find(x => x.key === k)
        if (!c) return null
        const esWeb = k === 'gon' || k === 'verly'
        return (
          <span key={k} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${esWeb ? 'bg-blue-50 text-blue-600' : 'bg-zinc-100 text-zinc-600'}`}>
            {esWeb ? <Globe className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
            {c.label}
          </span>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────
// Mappers Supabase ↔ TypeScript
// ─────────────────────────────────────────
type SupabaseRow = Record<string, unknown>

const rowToProducto = (r: SupabaseRow): Producto => ({
  id:          r.id as number,
  sku:         r.sku as string,
  nombre:      r.nombre as string,
  tipo:        r.tipo as TipoProducto,
  categoria:   r.categoria as string,
  marca:       r.marca as string,
  precio:      Number(r.precio),
  costo:       Number(r.costo),
  ubicacion:   r.ubicacion as string,
  canales:     (r.canales as string[]) ?? [],
  estado:      (r.estado as EstadoArmazon) ?? 'disponible',
  stock:       (r.stock as number) ?? 0,
  stockBaja:   (r.stock_baja as number) ?? 0,
  stockMayo:   (r.stock_mayo as number) ?? 0,
  stockPlaza:  (r.stock_plaza as number) ?? 0,
  stockMin:    (r.stock_min as number) ?? 0,
  descripcion: (r.descripcion as string) ?? '',
  color:       (r.color as string) ?? '',
  medidas:     (r.medidas as Producto['medidas']) ?? {},
})

const productoToRow = (p: Omit<Producto, 'id'>) => ({
  sku:         p.sku,
  nombre:      p.nombre,
  tipo:        p.tipo,
  categoria:   p.categoria,
  marca:       p.marca,
  precio:      p.precio,
  costo:       p.costo,
  ubicacion:   p.ubicacion,
  canales:     p.canales ?? [],
  estado:      p.estado ?? 'disponible',
  stock:       p.stock ?? 0,
  stock_baja:  p.stockBaja ?? 0,
  stock_mayo:  p.stockMayo ?? 0,
  stock_plaza: p.stockPlaza ?? 0,
  stock_min:   p.stockMin ?? 0,
  descripcion: p.descripcion ?? '',
  color:       p.color ?? '',
  medidas:     p.medidas ?? {},
  updated_at:  new Date().toISOString(),
})

// Armazón (base de e-commerce) → Producto, para mostrarlo en esta pantalla
const armazonToProducto = (a: SupabaseRow): Producto => {
  const baja = Number(a.stock_baja ?? 0), mayo = Number(a.stock_mayo ?? 0), plaza = Number(a.stock_plaza ?? 0)
  const canales: string[] = []
  if (baja > 0)  canales.push('baja')
  if (mayo > 0)  canales.push('mayo')
  if (plaza > 0) canales.push('plaza')
  if (a.publicar_gon)   canales.push('gon')
  if (a.publicar_verly) canales.push('verly')
  return {
    id:         -Number(a.id),        // negativo: no choca con ids de productos
    _ecomm:     true,
    _ecommId:   Number(a.id),
    sku:        (a.sku as string) ?? '',
    nombre:     `${a.marca ?? ''} ${a.nombre ?? a.modelo ?? ''}`.trim() + (a.sku_viejo ? ` · #${a.sku_viejo}` : ''),
    tipo:       'armazon',
    categoria:  'Armazones',
    marca:      (a.marca as string) ?? '',
    precio:     Number(a.precio_gon ?? 0),
    costo:      Number(a.costo ?? 0),
    ubicacion:  [baja > 0 && 'Baja Visión', mayo > 0 && '5 de Mayo', plaza > 0 && 'Plaza Laureles'].filter(Boolean).join(', ') || 'Sin stock',
    canales,
    estado:     'disponible',
    stock:      baja + mayo + plaza,
    stockBaja:  baja, stockMayo: mayo, stockPlaza: plaza,
    stockMin:   0,
    descripcion: '',
    color:      (a.color1 as string) ?? '',
    medidas:    {},
  }
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoProducto | 'lc'>('todos')
  // Lentes de contacto (catálogo de precio, sin stock — se piden a laboratorio)
  const [catalogoLC, setCatalogoLC] = useState<LenteContacto[]>([])
  const [lcModal, setLcModal]   = useState(false)
  const [lcEdit, setLcEdit]     = useState<LenteContacto | null>(null)
  const [lcNombre, setLcNombre] = useState('')
  const [lcPrecio, setLcPrecio] = useState('')
  const [lcGuardando, setLcGuardando] = useState(false)
  const [ubicFiltro, setUbicFiltro] = useState('Todas')
  const [soloAlerta, setSoloAlerta] = useState(false)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState<Omit<Producto, 'id'>>(formVacio())
  // Editor propio de armazones (base de e-commerce)
  const [armazonesRaw, setArmazonesRaw] = useState<ArmazonRaw[]>([])
  const [editArm, setEditArm] = useState<ArmazonRaw | null>(null)
  const [guardandoArm, setGuardandoArm] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [sucursalActual, setSucursalActual] = useState('Baja Visión')
  const { usuario: sessionUser } = useSession()

  // Wizard de verificación
  const [wizardAbierto, setWizardAbierto]         = useState(false)
  const [wizardPaso, setWizardPaso]               = useState(0)
  const [verifSucursal, setVerifSucursal]         = useState('Baja Visión')
  const [conteoConsumibles, setConteoConsumibles] = useState<Record<number, string>>({})
  const [spotCheck, setSpotCheck]                 = useState<Producto[]>([])
  const [spotResultados, setSpotResultados]       = useState<Record<number, boolean | null>>({})

  // ── Usuario ──
  useEffect(() => {
    if (sessionUser) {
      setEsAdmin(sessionUser.rol === 'administrador' || sessionUser.rol === 'gerente')
      if (sessionUser.sucursal) setSucursalActual(sessionUser.sucursal)
      return
    }
    // Fallback legacy
    const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
    setEsAdmin(u.rol === 'administrador' || u.rol === 'gerente')
    if (u.sucursal) setSucursalActual(u.sucursal)
  }, [sessionUser])

  // ── Cargar productos desde Supabase ──
  const cargarProductos = useCallback(async () => {
    setCargando(true)
    const [prodRes, armzRes] = await Promise.all([
      createClient().from('productos').select('*').eq('activo', true).order('tipo').order('categoria').order('nombre'),
      fetch('/api/ecomm/armazones', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false })),
    ])
    const servicios: Producto[] = (prodRes.data && !prodRes.error)
      ? prodRes.data.map(r => rowToProducto(r as SupabaseRow))
      : inicial
    const armzList: ArmazonRaw[] = (armzRes && armzRes.ok) ? (armzRes.armazones as ArmazonRaw[]) : []
    setArmazonesRaw(armzList)
    const armazones: Producto[] = armzList.map(a => armazonToProducto(a as unknown as SupabaseRow))
    setProductos([...armazones, ...servicios])
    setCargando(false)
  }, [])

  useEffect(() => { cargarProductos() }, [cargarProductos])

  // ── Cargar lentes de contacto (catálogo) ──
  const cargarLC = useCallback(async () => {
    const { data } = await createClient()
      .from('productos_catalogo')
      .select('id, nombre, precio_publico, activo')
      .eq('tipo', 'lentes_contacto')
      .order('nombre')
    setCatalogoLC((data ?? []) as LenteContacto[])
  }, [])
  useEffect(() => { cargarLC() }, [cargarLC])

  // Guardar / editar un lente de contacto
  const guardarLC = async () => {
    const precio = parseInt(lcPrecio) || 0
    if (!lcNombre.trim() || precio <= 0 || lcGuardando) return
    setLcGuardando(true)
    const sb = createClient()
    const payload = { nombre: lcNombre.trim().toUpperCase(), precio_publico: precio, tipo: 'lentes_contacto', activo: true }
    const { error } = lcEdit
      ? await sb.from('productos_catalogo').update(payload).eq('id', lcEdit.id)
      : await sb.from('productos_catalogo').insert(payload)
    setLcGuardando(false)
    if (error) { alert(`No se pudo guardar: ${error.message}`); return }
    setLcModal(false); setLcEdit(null); setLcNombre(''); setLcPrecio('')
    cargarLC()
  }

  // Activar / desactivar un lente de contacto
  const toggleLC = async (lc: LenteContacto) => {
    await createClient().from('productos_catalogo').update({ activo: !lc.activo }).eq('id', lc.id)
    setCatalogoLC(prev => prev.map(x => x.id === lc.id ? { ...x, activo: !x.activo } : x))
  }

  const abrirNuevoLC = () => { setLcEdit(null); setLcNombre(''); setLcPrecio(''); setLcModal(true) }
  const abrirEditarLC = (lc: LenteContacto) => { setLcEdit(lc); setLcNombre(lc.nombre); setLcPrecio(String(lc.precio_publico)); setLcModal(true) }

  const lcFiltrados = catalogoLC.filter(lc => lc.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const iniciarVerificacion = () => {
    const consumibles = productos.filter(p => p.tipo === 'consumible')
    const conteoInicial: Record<number, string> = {}
    consumibles.forEach(p => { conteoInicial[p.id] = '' })
    setConteoConsumibles(conteoInicial)

    const armazonesSuc = productos.filter(p =>
      p.tipo === 'armazon' && p.ubicacion === verifSucursal && p.estado !== 'vendido'
    )
    const mezclados = [...armazonesSuc].sort(() => Math.random() - 0.5).slice(0, 10)
    const resultadosIniciales: Record<number, boolean | null> = {}
    mezclados.forEach(p => { resultadosIniciales[p.id] = null })
    setSpotCheck(mezclados)
    setSpotResultados(resultadosIniciales)
    setWizardPaso(1)
    setWizardAbierto(true)
  }

  const filtrados = productos.filter(p => {
    const q = busqueda.toLowerCase()
    const matchQ = p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q)
    const matchTipo = tipoFiltro === 'todos' || p.tipo === tipoFiltro
    const matchUbic = ubicFiltro === 'Todas' || p.ubicacion === ubicFiltro || p.ubicacion === 'Todas'
    const esAlerta = p.tipo === 'consumible' && (p.stock ?? 0) <= (p.stockMin ?? 0)
    return matchQ && matchTipo && matchUbic && (!soloAlerta || esAlerta)
  })

  // KPIs
  const armazonesDisp  = productos.filter(p => p.tipo === 'armazon' && p.estado === 'disponible').length
  const armazonesTotal = productos.filter(p => p.tipo === 'armazon').length
  const armazonesApart = productos.filter(p => p.tipo === 'armazon' && p.estado === 'apartado').length
  const consumAlerta   = productos.filter(p => p.tipo === 'consumible' && (p.stock ?? 0) <= (p.stockMin ?? 0)).length
  const totalCanales   = productos.filter(p => p.tipo === 'armazon' && p.estado === 'disponible')
                                  .reduce((s, p) => s + (p.canales?.length ?? 0), 0)

  const abrirNuevo = () => { setEditando(null); setForm(formVacio()); setModal(true) }
  const abrirEditar = (p: Producto) => {
    // Armazón (base de e-commerce) → su editor propio (stock por sucursal, publicar, etc.)
    if (p._ecomm && p._ecommId) {
      const a = armazonesRaw.find(x => x.id === p._ecommId)
      if (a) setEditArm({ ...a })
      return
    }
    setEditando(p)
    setForm({
      sku: p.sku, nombre: p.nombre, tipo: p.tipo, categoria: p.categoria, marca: p.marca,
      precio: p.precio, costo: p.costo, ubicacion: p.ubicacion,
      canales: p.canales ?? [...TODOS_LOS_CANALES], estado: p.estado ?? 'disponible',
      stock: p.stock ?? 0, stockBaja: p.stockBaja ?? 0, stockMayo: p.stockMayo ?? 0,
      stockPlaza: p.stockPlaza ?? 0, stockMin: p.stockMin ?? 0,
      descripcion: p.descripcion ?? '', color: p.color ?? '', medidas: p.medidas ?? {},
    })
    setModal(true)
  }

  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    const canalesFinal = form.estado === 'vendido' ? [] : form.canales
    const row = productoToRow({ ...form, canales: canalesFinal })
    const sb = createClient()

    if (editando && editando._ecomm && editando._ecommId) {
      // Armazón: se guarda en la base de e-commerce vía API (no en productos)
      const cf = canalesFinal ?? []
      const sb2 = (form.stockBaja ?? 0) + (form.stockMayo ?? 0) + (form.stockPlaza ?? 0)
      const payload = {
        id:             editando._ecommId,
        precio_gon:     form.precio,
        precio:         Math.round((form.precio || 0) / 17),
        costo:          form.costo,
        stock_baja:     form.stockBaja ?? 0,
        stock_mayo:     form.stockMayo ?? 0,
        stock_plaza:    form.stockPlaza ?? 0,
        stock:          sb2,
        publicar_gon:   cf.includes('gon'),
        publicar_verly: cf.includes('verly'),
      }
      const res = await fetch('/api/ecomm/armazones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (j.ok) {
        setProductos(prev => prev.map(p => p.id === editando.id ? { ...p, ...form, canales: canalesFinal } : p))
      } else {
        alert('Error al guardar armazón: ' + (j.error || ''))
      }
      setGuardando(false); setModal(false)
      return
    }

    // ARMAZÓN NUEVO → se crea en la base de e-commerce (catálogo real de las webs),
    // NO en la tabla productos de OptiOS. Se coloca 1 pieza en la sucursal elegida.
    if (!editando && form.tipo === 'armazon') {
      const ub = form.ubicacion
      const medidasStr = [form.medidas?.ojo, form.medidas?.puente, form.medidas?.varilla, form.medidas?.alto]
        .filter(Boolean).join('-') || null
      const cf = canalesFinal ?? []
      const payload = {
        sku:            form.sku,
        marca:          form.marca,
        nombre:         form.nombre,
        modelo:         form.nombre,
        color1:         form.color ?? '',
        medidas:        medidasStr,
        precio_gon:     form.precio,
        precio:         Math.round((form.precio || 0) / TC_USD),
        costo:          form.costo,
        stock_baja:     ub === 'Baja Visión'    ? 1 : 0,
        stock_mayo:     ub === '5 de Mayo'       ? 1 : 0,
        stock_plaza:    ub === 'Plaza Laureles'  ? 1 : 0,
        stock_online:   0,
        stock:          1,
        publicar_gon:   cf.includes('gon'),
        publicar_verly: cf.includes('verly'),
        activo:         true,
      }
      const res = await fetch('/api/ecomm/armazones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (j.ok) {
        setArmazonesRaw(prev => [j.armazon as ArmazonRaw, ...prev])
        setProductos(prev => [armazonToProducto(j.armazon as unknown as SupabaseRow), ...prev])
      } else {
        alert('No se pudo crear el armazón: ' + (j.error || ''))
        setGuardando(false)
        return
      }
      setGuardando(false)
      setModal(false)
      return
    }

    if (editando) {
      const { error } = await sb.from('productos').update(row).eq('id', editando.id)
      if (!error) {
        setProductos(prev => prev.map(p =>
          p.id === editando.id ? { ...p, ...form, canales: canalesFinal } : p
        ))
      }
    } else {
      const { data, error } = await sb.from('productos').insert(row).select().single()
      if (!error && data) {
        setProductos(prev => [...prev, rowToProducto(data as SupabaseRow)])
      }
    }
    setGuardando(false)
    setModal(false)
  }

  const setArm = (campo: keyof ArmazonRaw, val: unknown) => setEditArm(prev => prev ? { ...prev, [campo]: val } : prev)

  const [subiendoFoto, setSubiendoFoto] = useState('')
  const subirFoto = async (campo: string, file: File) => {
    if (!editArm) return
    setSubiendoFoto(campo)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('campo', campo); fd.append('id', String(editArm.id))
      const res = await fetch('/api/ecomm/upload-foto', { method: 'POST', body: fd })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setArm(campo as keyof ArmazonRaw, j.url)
      setArmazonesRaw(prev => prev.map(a => a.id === editArm.id ? { ...a, [campo]: j.url } : a))
      setProductos(prev => prev.map(p => p._ecommId === editArm.id ? { ...p } : p))
    } catch (e) {
      alert('No se pudo subir la foto: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setSubiendoFoto('')
    }
  }

  const guardarArm = async () => {
    if (!editArm || guardandoArm) return
    setGuardandoArm(true)
    const pg = nEd(editArm.precio_gon)
    const total = nEd(editArm.stock_baja) + nEd(editArm.stock_mayo) + nEd(editArm.stock_plaza) + nEd(editArm.stock_online)
    const payload = {
      id: editArm.id,
      precio_gon: pg,
      precio: Math.round(pg / TC_USD),
      costo: nEd(editArm.costo),
      stock_baja: nEd(editArm.stock_baja),
      stock_mayo: nEd(editArm.stock_mayo),
      stock_plaza: nEd(editArm.stock_plaza),
      stock_online: nEd(editArm.stock_online),
      stock: total,
      publicar_gon: !!editArm.publicar_gon,
      publicar_verly: !!editArm.publicar_verly,
      descuento_gon: nEd(editArm.descuento_gon),
      descuento_verly: nEd(editArm.descuento_verly),
      color1: editArm.color1 ?? '',
      activo: editArm.activo !== false,
    }
    try {
      const res = await fetch('/api/ecomm/armazones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      const upd = j.armazon as ArmazonRaw
      setArmazonesRaw(prev => prev.map(a => a.id === editArm.id ? upd : a))
      setProductos(prev => prev.map(p => p._ecommId === editArm.id ? armazonToProducto(upd as unknown as SupabaseRow) : p))
      setEditArm(null)
    } catch (e) {
      alert('No se pudo guardar: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setGuardandoArm(false)
    }
  }

  const toggleCanal = (key: string) => {
    const actual = form.canales ?? []
    setForm(prev => ({ ...prev, canales: actual.includes(key) ? actual.filter(k => k !== key) : [...actual, key] }))
  }

  const f = (k: keyof typeof form, v: string | number | string[] | Record<string, string>) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Inventario</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Estado de exhibición y stock por sucursal</p>
        </div>
        <div className="flex items-center gap-2">
          {esAdmin && (
            <button
              onClick={abrirNuevo}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-[#0B0E14] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" /> <span className="whitespace-nowrap">Nuevo producto</span>
            </button>
          )}
          <button
            onClick={() => { setVerifSucursal(sucursalActual); iniciarVerificacion() }}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-[#0D9488] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-teal-600 active:scale-[0.98] transition-all"
          >
            <ClipboardCheck className="w-4 h-4" /> <span className="whitespace-nowrap">Verificar inventario</span>
          </button>
        </div>
      </div>

      {/* Tableros por sucursal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUCURSALES_FISICAS.map(suc => {
          const cap     = CAPACIDAD_EXHIBICION[suc]
          // En piso = suma del stock real de armazones en esa óptica (por sucursal)
          const enPiso  = productos.filter(p => p.tipo === 'armazon').reduce((s, p) =>
            s + (suc === 'Baja Visión' ? (p.stockBaja ?? 0)
               : suc === '5 de Mayo'   ? (p.stockMayo ?? 0)
               : (p.stockPlaza ?? 0)), 0)
          const reserva = enPiso
          const vacios  = Math.max(0, cap - enPiso)
          const pct     = Math.min(100, Math.round((enPiso / cap) * 100))
          const critico = reserva <= RESERVA_ALERTA

          return (
            <div key={suc} className={`bg-white rounded-lg p-5 border ${critico ? 'border-red-200' : 'border-zinc-200/80'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-zinc-800">{suc}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Capacidad exhibición: {cap.toLocaleString()}</p>
                </div>
                {critico && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
              </div>

              {/* Barra de llenado */}
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-xl font-bold text-zinc-800">{enPiso}</p>
                  <p className="text-xs text-zinc-400">En piso</p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${vacios > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{vacios}</p>
                  <p className="text-xs text-zinc-400">Espacios vacíos</p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${critico ? 'text-red-500' : 'text-zinc-800'}`}>{reserva}</p>
                  <p className="text-xs text-zinc-400">Reserva</p>
                </div>
              </div>

              {critico ? (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2">
                  <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                  Reserva crítica — ordenar stock ya
                </div>
              ) : reserva <= RESERVA_OBJETIVO ? (
                <div className="bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 flex-shrink-0" />
                  Reserva baja — considerar reorder
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-medium px-3 py-2 rounded-lg">
                  Stock en orden
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* KPIs compactos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg px-4 py-3 border border-zinc-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Total armazones</p>
            <p className="text-lg font-bold text-zinc-800">{armazonesDisp} <span className="text-xs font-normal text-zinc-400">disp.</span></p>
          </div>
        </div>
        <div className="bg-white rounded-lg px-4 py-3 border border-zinc-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Apartados</p>
            <p className="text-lg font-bold text-zinc-800">{armazonesApart}</p>
          </div>
        </div>
        <div className={`bg-white rounded-lg px-4 py-3 border flex items-center gap-3 ${consumAlerta > 0 ? 'border-amber-200' : 'border-zinc-200/80'}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${consumAlerta > 0 ? 'bg-amber-50' : 'bg-zinc-100'}`}>
            <AlertTriangle className={`w-4 h-4 ${consumAlerta > 0 ? 'text-amber-500' : 'text-zinc-400'}`} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Consumibles en alerta</p>
            <p className={`text-lg font-bold ${consumAlerta > 0 ? 'text-amber-600' : 'text-zinc-800'}`}>{consumAlerta}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg px-4 py-3 border border-zinc-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
            <Tag className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Servicios</p>
            <p className="text-lg font-bold text-zinc-800">{productos.filter(p => p.tipo === 'servicio').length}</p>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-zinc-200/80">

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-zinc-200">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre, SKU o marca..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400" />
          </div>
          <div className="flex items-center border border-zinc-200 rounded overflow-hidden">
            {(['todos','armazon','servicio','consumible','lc'] as const).map((k,i) => (
              <button key={k} onClick={() => setTipoFiltro(k)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-r last:border-r-0 border-zinc-200 ${tipoFiltro === k ? 'bg-[#0B0E14] text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                {['Todos','Armazones','Micas/Servicios','Consumibles','Lentes de contacto'][i]}
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={ubicFiltro} onChange={e => setUbicFiltro(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded text-zinc-600 focus:outline-none">
              {sucursales.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
          <button onClick={() => setSoloAlerta(!soloAlerta)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded transition-colors ${soloAlerta ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> Solo alertas
          </button>
          <span className="text-xs text-zinc-400 ml-auto flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> {tipoFiltro === 'lc' ? lcFiltrados.length : filtrados.length} registros
          </span>
        </div>

        {tipoFiltro === 'lc' ? (
          <div>
            {esAdmin && (
              <div className="flex justify-end px-5 py-3 border-b border-zinc-100">
                <button onClick={abrirNuevoLC}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0B0E14] px-3 py-1.5 rounded hover:bg-[#1A1D27] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nuevo lente de contacto
                </button>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50">
                  <th className="text-left text-xs text-zinc-400 font-semibold px-5 py-3">Lente de contacto</th>
                  <th className="text-right text-xs text-zinc-400 font-semibold px-4 py-3">Precio público</th>
                  <th className="text-center text-xs text-zinc-400 font-semibold px-4 py-3">Estado</th>
                  <th className="w-20 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {lcFiltrados.map(lc => (
                  <tr key={lc.id} className={`hover:bg-zinc-100 transition-colors ${!lc.activo ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5"><p className="font-semibold text-zinc-700">{lc.nombre}</p></td>
                    <td className="px-4 py-3.5 text-right"><span className="text-sm font-semibold text-zinc-800">${lc.precio_publico.toLocaleString('es-MX')}</span></td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => esAdmin && toggleLC(lc)} disabled={!esAdmin}
                        className={`text-xs font-medium px-2 py-1 rounded ${lc.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'} ${esAdmin ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}>
                        {lc.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {esAdmin && <button onClick={() => abrirEditarLC(lc)} className="text-xs font-medium text-zinc-400 hover:text-zinc-700">Editar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lcFiltrados.length === 0 && (
              <div className="text-center py-16 text-zinc-400 text-sm">No hay lentes de contacto en el catálogo.</div>
            )}
          </div>
        ) : (
        <>
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filtrados.map(p => {
            const margen = p.costo > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 100) : 0
            const stockBajo = p.tipo === 'consumible' && (p.stock ?? 0) <= (p.stockMin ?? 0)
            const estadoConfig = p.estado ? ESTADO[p.estado] : null
            const opaco = p.estado === 'vendido'
            return (
              <button key={p.id} onClick={() => esAdmin && abrirEditar(p)}
                className={`w-full text-left px-4 py-3.5 active:bg-zinc-50 transition-colors ${opaco ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-800 text-[15px] leading-snug">{p.nombre}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {p.marca ? `${p.marca} · ` : ''}<span className="font-mono">{p.sku}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-zinc-800">${p.precio.toLocaleString('es-MX')}</p>
                    {margen > 0 && <p className="text-xs text-emerald-500">{margen}%</p>}
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-1.5 mt-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIPOS[p.tipo].color}`}>{TIPOS[p.tipo].label}</span>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Store className="w-3 h-3 text-zinc-400" /> {p.ubicacion}
                  </span>
                  {estadoConfig && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${estadoConfig.bg} ${estadoConfig.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${estadoConfig.dot}`} />{estadoConfig.label}
                    </span>
                  )}
                  {p.tipo === 'consumible' && (
                    <span className={`text-xs font-bold ${stockBajo ? 'text-red-500' : 'text-zinc-600'}`}>
                      {p.stock} uds. <span className="font-normal text-zinc-400">(mín. {p.stockMin})</span>
                    </span>
                  )}
                </div>
                {p.tipo === 'armazon' && (p.canales?.length ?? 0) > 0 && (
                  <div className="mt-2"><CanalBadges canales={p.canales ?? []} /></div>
                )}
              </button>
            )
          })}
          {!cargando && filtrados.length === 0 && (
            <div className="text-center py-16 text-zinc-400 text-sm">No se encontraron productos.</div>
          )}
          {cargando && <div className="text-center py-16 text-zinc-400 text-sm">Cargando inventario...</div>}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="text-left text-xs text-zinc-400 font-semibold px-5 py-3 w-28">SKU</th>
                <th className="text-left text-xs text-zinc-400 font-semibold px-4 py-3">Producto</th>
                <th className="text-left text-xs text-zinc-400 font-semibold px-4 py-3">Tipo</th>
                <th className="text-left text-xs text-zinc-400 font-semibold px-4 py-3">Ubicación física</th>
                <th className="text-left text-xs text-zinc-400 font-semibold px-4 py-3">Canales de venta</th>
                <th className="text-right text-xs text-zinc-400 font-semibold px-4 py-3">Precio</th>
                <th className="text-center text-xs text-zinc-400 font-semibold px-4 py-3">Estado / Stock</th>
                <th className="w-10 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtrados.map(p => {
                const margen = p.costo > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 100) : 0
                const stockBajo = p.tipo === 'consumible' && (p.stock ?? 0) <= (p.stockMin ?? 0)
                const estadoConfig = p.estado ? ESTADO[p.estado] : null
                const opaco = p.estado === 'vendido'

                return (
                  <tr key={p.id} className={`hover:bg-zinc-100 transition-colors group ${opaco ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-semibold text-zinc-400">{p.sku}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-zinc-700">{p.nombre}</p>
                      <p className="text-xs text-zinc-400">{p.marca}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${TIPOS[p.tipo].color}`}>
                        {TIPOS[p.tipo].label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-zinc-600 flex items-center gap-1">
                        <Store className="w-3 h-3 text-zinc-400" /> {p.ubicacion}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {p.tipo === 'armazon'
                        ? <CanalBadges canales={p.canales ?? []} />
                        : <span className="text-xs text-zinc-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-zinc-800">${p.precio.toLocaleString('es-MX')}</span>
                      {margen > 0 && <span className="block text-xs text-emerald-500">{margen}%</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {estadoConfig && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${estadoConfig.bg} ${estadoConfig.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${estadoConfig.dot}`} />
                          {estadoConfig.label}
                        </span>
                      )}
                      {p.tipo === 'consumible' && (
                        <div>
                          <span className={`text-sm font-bold ${stockBajo ? 'text-red-500' : 'text-zinc-700'}`}>{p.stock}</span>
                          <span className="text-xs text-zinc-400 block">mín. {p.stockMin}</span>
                        </div>
                      )}
                      {p.tipo === 'servicio' && <span className="text-xs text-zinc-400">a pedido</span>}
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-3.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEditar(p)}
                          className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {cargando && (
            <div className="text-center py-16 text-zinc-400 text-sm">Cargando inventario...</div>
          )}
          {!cargando && filtrados.length === 0 && (
            <div className="text-center py-16 text-zinc-400 text-sm">No se encontraron productos.</div>
          )}
        </div>
        </>
        )}
      </div>

      {/* ── Wizard de verificación de inventario ── */}
      {wizardAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header wizard */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-bold text-zinc-800">Verificación de inventario</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {wizardPaso === 0 && 'Selecciona la sucursal a verificar'}
                  {wizardPaso === 1 && `Paso 1 de 3 — Consumibles · ${verifSucursal}`}
                  {wizardPaso === 2 && `Paso 2 de 3 — Spot-check armazones · ${verifSucursal}`}
                  {wizardPaso === 3 && 'Paso 3 de 3 — Resumen'}
                </p>
              </div>
              <button onClick={() => setWizardAbierto(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* PASO 0: Seleccionar sucursal */}
              {wizardPaso === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">¿En qué sucursal estás haciendo el conteo?</p>
                  {SUCURSALES_FISICAS.map(suc => (
                    <button key={suc} onClick={() => setVerifSucursal(suc)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-lg border text-sm font-semibold transition-all ${verifSucursal === suc ? 'border-[#0D9488] bg-[#0D9488]/5 text-zinc-800' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      {suc}
                      {verifSucursal === suc && <Check className="w-4 h-4 text-[#0D9488]" />}
                    </button>
                  ))}
                </div>
              )}

              {/* PASO 1: Conteo de consumibles */}
              {wizardPaso === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500">Cuenta físicamente cada producto y escribe la cantidad real.</p>
                  {productos.filter(p => p.tipo === 'consumible').length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 text-sm">No hay consumibles registrados aún.</div>
                  ) : (
                    productos.filter(p => p.tipo === 'consumible').map(p => {
                      const conteo = conteoConsumibles[p.id] ?? ''
                      const sistemaTotal = (p.stockBaja ?? 0) + (p.stockMayo ?? 0) + (p.stockPlaza ?? 0)
                      const real = parseInt(conteo)
                      const diff = isNaN(real) ? null : real - sistemaTotal
                      return (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border ${diff !== null && diff < 0 ? 'border-red-200 bg-red-50' : diff !== null && diff === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-700 truncate">{p.nombre}</p>
                            <p className="text-xs text-zinc-400">Sistema: {sistemaTotal} uds.</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="number" min="0"
                              value={conteo}
                              onChange={e => setConteoConsumibles(prev => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="?"
                              className="w-16 border border-zinc-200 rounded px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                            />
                            {diff !== null && (
                              <span className={`text-xs font-bold w-10 text-right ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                                {diff > 0 ? `+${diff}` : diff === 0 ? '✓' : diff}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* PASO 2: Spot-check armazones */}
              {wizardPaso === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500">Busca físicamente cada armazón y confirma si está en la sucursal.</p>
                  {spotCheck.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 text-sm">
                      No hay armazones registrados para {verifSucursal} aún.
                    </div>
                  ) : (
                    spotCheck.map((p, idx) => {
                      const res = spotResultados[p.id]
                      return (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${res === true ? 'border-emerald-200 bg-emerald-50' : res === false ? 'border-red-200 bg-red-50' : 'border-zinc-200'}`}>
                          <span className="text-xs font-bold text-zinc-400 w-5 text-center">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-700 truncate">{p.nombre}</p>
                            <p className="text-xs text-zinc-400 font-mono">{p.sku} {p.color ? `· ${p.color}` : ''}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => setSpotResultados(prev => ({ ...prev, [p.id]: true }))}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${res === true ? 'bg-emerald-500 text-white' : 'border border-zinc-200 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                              ✓ Sí
                            </button>
                            <button
                              onClick={() => setSpotResultados(prev => ({ ...prev, [p.id]: false }))}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${res === false ? 'bg-red-500 text-white' : 'border border-zinc-200 text-zinc-400 hover:bg-red-50 hover:text-red-600'}`}>
                              ✗ No
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* PASO 3: Resumen */}
              {wizardPaso === 3 && (() => {
                const consumiblesVerif = productos.filter(p => p.tipo === 'consumible')
                const faltanConsumibles = consumiblesVerif.filter(p => {
                  const real = parseInt(conteoConsumibles[p.id] ?? '')
                  const sistemaTotal = (p.stockBaja ?? 0) + (p.stockMayo ?? 0) + (p.stockPlaza ?? 0)
                  return !isNaN(real) && real < sistemaTotal
                })
                const spotFaltantes = spotCheck.filter(p => spotResultados[p.id] === false)
                const spotOk       = spotCheck.filter(p => spotResultados[p.id] === true).length
                const spotPend     = spotCheck.filter(p => spotResultados[p.id] === null).length
                const todoOk       = faltanConsumibles.length === 0 && spotFaltantes.length === 0 && spotPend === 0

                return (
                  <div className="space-y-4">
                    <div className={`text-center py-4 rounded-lg ${todoOk ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                      <p className={`text-2xl font-black ${todoOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {todoOk ? '¡Todo cuadra!' : 'Hay diferencias'}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">{verifSucursal} · {new Date().toLocaleDateString('es-MX')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-50 rounded-lg p-3">
                        <p className="text-xs text-zinc-400 mb-1">Spot-check armazones</p>
                        <p className="text-lg font-bold text-zinc-800">{spotOk} / {spotCheck.length}</p>
                        {spotFaltantes.length > 0 && <p className="text-xs text-red-500 font-semibold mt-1">{spotFaltantes.length} no encontrado{spotFaltantes.length > 1 ? 's' : ''}</p>}
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-3">
                        <p className="text-xs text-zinc-400 mb-1">Consumibles</p>
                        <p className="text-lg font-bold text-zinc-800">{consumiblesVerif.length - faltanConsumibles.length} / {consumiblesVerif.length}</p>
                        {faltanConsumibles.length > 0 && <p className="text-xs text-red-500 font-semibold mt-1">{faltanConsumibles.length} con faltante</p>}
                      </div>
                    </div>

                    {spotFaltantes.length > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-red-600 mb-2">Armazones no encontrados:</p>
                        {spotFaltantes.map(p => (
                          <p key={p.id} className="text-xs text-red-600 font-mono">{p.sku} — {p.nombre}</p>
                        ))}
                      </div>
                    )}

                    {faltanConsumibles.length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-amber-600 mb-2">Consumibles con faltante:</p>
                        {faltanConsumibles.map(p => {
                          const real = parseInt(conteoConsumibles[p.id])
                          const sis  = (p.stockBaja ?? 0) + (p.stockMayo ?? 0) + (p.stockPlaza ?? 0)
                          return (
                            <p key={p.id} className="text-xs text-amber-700">{p.nombre}: real {real} vs sistema {sis} ({real - sis})</p>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer wizard */}
            <div className="px-6 pb-5 flex gap-3">
              {wizardPaso > 0 && (
                <button onClick={() => setWizardPaso(p => p - 1)}
                  className="px-4 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100">
                  Atrás
                </button>
              )}
              <button
                onClick={() => {
                  if (wizardPaso === 0) iniciarVerificacion()
                  else if (wizardPaso < 3) setWizardPaso(p => p + 1)
                  else setWizardAbierto(false)
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-zinc-800 transition-all">
                {wizardPaso === 0 && <><ChevronRight className="w-4 h-4" /> Iniciar verificación</>}
                {wizardPaso === 1 && <><ChevronRight className="w-4 h-4" /> Continuar al spot-check</>}
                {wizardPaso === 2 && <><ChevronRight className="w-4 h-4" /> Ver resumen</>}
                {wizardPaso === 3 && <><Check className="w-4 h-4" /> Finalizar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar / editar producto */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-800">{editando ? 'Editar producto' : 'Agregar producto'}</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-zinc-400 hover:text-zinc-600" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['armazon','consumible','servicio'] as TipoProducto[]).map(t => (
                    <button key={t} onClick={() => f('tipo', t)}
                      className={`py-2.5 rounded text-xs font-semibold border transition-all ${form.tipo === t ? 'bg-[#0B0E14] border-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      {TIPOS[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SKU + Marca */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">SKU *</label>
                  <div className="flex gap-1.5">
                    <input value={form.sku} onChange={e => f('sku', e.target.value)}
                      className="flex-1 border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                      placeholder={form.tipo === 'armazon' ? 'ej. ARZ-007' : form.tipo === 'consumible' ? 'ej. CON-ABC' : 'ej. SRV-001'} />
                    <button type="button" onClick={() => f('sku', generarSku())}
                      title="Generar SKU aleatorio"
                      className="px-2.5 border border-zinc-200 rounded bg-zinc-50 hover:bg-zinc-100 text-zinc-400 hover:text-[#0D9488] transition-colors">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Marca</label>
                  <input value={form.marca} onChange={e => f('marca', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder={form.tipo === 'armazon' ? 'ej. Ray-Ban' : 'ej. Zeiss'} />
                </div>
              </div>

              {/* Nombre / Modelo */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  {form.tipo === 'armazon' ? 'Modelo *' : 'Nombre *'}
                </label>
                <input value={form.nombre} onChange={e => f('nombre', e.target.value)}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  placeholder={form.tipo === 'armazon' ? 'ej. RB3025 Aviator Classic' : 'Nombre completo del producto'} />
              </div>

              {/* ARMAZÓN: Color + Medidas */}
              {form.tipo === 'armazon' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Color</label>
                    <input value={form.color ?? ''} onChange={e => f('color', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                      placeholder="ej. Negro mate, Dorado, Azul tortuga" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-2">
                      Medidas <span className="font-normal text-zinc-400">(mm)</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { key: 'ojo',     label: 'Ojo' },
                        { key: 'puente',  label: 'Puente' },
                        { key: 'varilla', label: 'Varilla' },
                        { key: 'alto',    label: 'Alto' },
                      ] as { key: keyof NonNullable<Producto['medidas']>; label: string }[]).map(({ key, label }) => (
                        <div key={key}>
                          <p className="text-xs text-zinc-400 mb-1 text-center">{label}</p>
                          <input
                            type="number"
                            value={form.medidas?.[key] ?? ''}
                            onChange={e => f('medidas', { ...(form.medidas ?? {}), [key]: e.target.value })}
                            className="w-full border border-zinc-200 rounded px-2 py-2 text-sm bg-zinc-50 text-center focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                            placeholder="—"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1.5">Ojo · Puente · Varilla · Alto del aro</p>
                  </div>
                </>
              )}

              {/* Precio de venta + Costo (costo solo admin) */}
              <div className={`grid gap-4 ${esAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {esAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Costo</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                      <input type="number" value={form.costo || ''} onChange={e => f('costo', parseFloat(e.target.value) || 0)}
                        className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="0.00" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Precio de venta *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                    <input type="number" value={form.precio || ''} onChange={e => f('precio', parseFloat(e.target.value) || 0)}
                      className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="0.00" />
                  </div>
                  {esAdmin && form.costo > 0 && form.precio > 0 && (
                    <p className="text-xs text-emerald-500 mt-1">Margen: {Math.round(((form.precio - form.costo) / form.precio) * 100)}%</p>
                  )}
                </div>
              </div>

              {/* Ubicación física */}
              {form.tipo === 'armazon' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Ubicación física (dónde está el armazón)</label>
                  <div className="relative">
                    <select value={form.ubicacion} onChange={e => f('ubicacion', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 pr-8">
                      {sucursales.slice(1).map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* ARMAZÓN: canales de venta (sin estado) */}
              {form.tipo === 'armazon' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2">
                    Canales de venta activos
                    <span className="font-normal text-zinc-400 ml-1">— al venderse, se quitan de todos automáticamente</span>
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {CANALES_DISPONIBLES.map(c => {
                      const activo = (form.canales ?? []).includes(c.key)
                      const esWeb = c.key === 'gon' || c.key === 'verly'
                      return (
                        <button key={c.key} type="button"
                          onClick={() => toggleCanal(c.key)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded border text-sm transition-all text-left ${activo ? 'border-[#0D9488] bg-[#0D9488]/5 text-zinc-700' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>
                          {esWeb ? <Globe className="w-4 h-4 flex-shrink-0 text-blue-400" /> : <Store className="w-4 h-4 flex-shrink-0 text-zinc-400" />}
                          <span className="flex-1">{c.label}</span>
                          {activo && <CheckSquare className="w-4 h-4 text-[#0D9488]" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* CONSUMIBLE: stock por sucursal */}
              {form.tipo === 'consumible' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2">Cantidad por sucursal</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { key: 'stockBaja',  label: 'Baja Visión' },
                      { key: 'stockMayo',  label: '5 de Mayo' },
                      { key: 'stockPlaza', label: 'Plaza Laureles' },
                    ] as { key: 'stockBaja' | 'stockMayo' | 'stockPlaza'; label: string }[]).map(({ key, label }) => (
                      <div key={key}>
                        <p className="text-xs text-zinc-400 mb-1 text-center">{label}</p>
                        <input type="number"
                          value={(form[key] as number) || ''}
                          onChange={e => f(key, parseInt(e.target.value) || 0)}
                          className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 text-center focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                          placeholder="0" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Mínimo para alerta</label>
                    <input type="number" value={form.stockMin || ''} onChange={e => f('stockMin', parseInt(e.target.value) || 0)}
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="0" />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.nombre || !form.sku || guardando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40">
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal lente de contacto ── */}
      {lcModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h3 className="font-semibold text-zinc-800">{lcEdit ? 'Editar lente de contacto' : 'Nuevo lente de contacto'}</h3>
              <button onClick={() => setLcModal(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Nombre</label>
                <input value={lcNombre} onChange={e => setLcNombre(e.target.value.toUpperCase())}
                  placeholder="EJ. ACUVUE OASYS"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Precio público</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                  <input type="number" value={lcPrecio} onChange={e => setLcPrecio(e.target.value)}
                    placeholder="0"
                    className="w-full border border-zinc-200 rounded-lg pl-7 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setLcModal(false)}
                className="flex-1 border border-zinc-200 text-zinc-600 rounded-lg py-2.5 text-sm hover:bg-zinc-100 transition-colors">Cancelar</button>
              <button onClick={guardarLC} disabled={!lcNombre.trim() || !(parseInt(lcPrecio) > 0) || lcGuardando}
                className="flex-1 bg-[#0B0E14] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#1A1D27] disabled:opacity-40 transition-colors">
                {lcGuardando ? 'Guardando...' : lcEdit ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor de ARMAZÓN (base de e-commerce) ── */}
      {editArm && (() => {
        const total = nEd(editArm.stock_baja) + nEd(editArm.stock_mayo) + nEd(editArm.stock_plaza) + nEd(editArm.stock_online)
        return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !guardandoArm && setEditArm(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <div>
                <h3 className="text-base font-bold text-zinc-900">{editArm.marca} {editArm.nombre}</h3>
                <p className="text-xs text-zinc-500">{editArm.modelo || '—'}{editArm.medidas ? ` · ${editArm.medidas}` : ''}{editArm.color1 ? ` · ${editArm.color1}` : ''}</p>
              </div>
              <button onClick={() => !guardandoArm && setEditArm(null)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">PRECIO</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Precio (MXN)</label>
                    <input type="number" value={nEd(editArm.precio_gon)} onChange={e => setArm('precio_gon', e.target.value)} className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Verly (USD, auto)</label>
                    <div className="w-full border border-zinc-100 bg-zinc-50 rounded px-2.5 py-2 text-zinc-500">USD ${Math.round(nEd(editArm.precio_gon) / TC_USD)}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Costo</label>
                    <input type="number" value={nEd(editArm.costo)} onChange={e => setArm('costo', e.target.value)} className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">EXISTENCIAS POR SUCURSAL</p>
                <div className="grid grid-cols-4 gap-2">
                  {([['stock_baja', 'Baja'], ['stock_mayo', '5 Mayo'], ['stock_plaza', 'Laureles'], ['stock_online', 'Online']] as const).map(([c, l]) => (
                    <div key={c}>
                      <label className="block text-xs text-zinc-500 mb-1">{l}</label>
                      <input type="number" value={nEd(editArm[c])} onChange={e => setArm(c, e.target.value)} className="w-full border border-zinc-200 rounded px-2 py-2 text-center" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 mt-1">Total: {total}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">PUBLICAR EN LÍNEA</p>
                <div className="flex gap-2">
                  <button onClick={() => setArm('publicar_gon', !editArm.publicar_gon)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-sm font-semibold ${editArm.publicar_gon ? 'bg-blue-600 text-white border-blue-600' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}><Globe className="w-4 h-4" /> GON</button>
                  <button onClick={() => setArm('publicar_verly', !editArm.publicar_verly)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-sm font-semibold ${editArm.publicar_verly ? 'bg-violet-600 text-white border-violet-600' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}><Globe className="w-4 h-4" /> Verly</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Descuento GON (%)</label>
                    <input type="number" value={nEd(editArm.descuento_gon)} onChange={e => setArm('descuento_gon', e.target.value)} className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Descuento Verly (%)</label>
                    <input type="number" value={nEd(editArm.descuento_verly)} onChange={e => setArm('descuento_verly', e.target.value)} className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">FOTOS</p>
                <div className="grid grid-cols-5 gap-2">
                  {(['imagen_url', 'imagen2_url', 'imagen3_url', 'imagen4_url', 'imagen5_url'] as const).map((campo, i) => {
                    const url = editArm[campo]
                    return (
                      <label key={campo} className="relative aspect-square rounded border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center cursor-pointer hover:border-teal-400 overflow-hidden">
                        {url ? (
                          <img src={url as string} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-zinc-400 text-center px-1">{subiendoFoto === campo ? '...' : (i === 0 ? 'Principal' : `+ Foto ${i + 1}`)}</span>
                        )}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(campo, f); e.target.value = '' }} />
                      </label>
                    )
                  })}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">La primera es la principal. Toca para subir/cambiar.</p>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editArm.activo !== false} onChange={e => setArm('activo', e.target.checked)} />
                <span className="text-sm text-zinc-600">Activo (visible en las páginas)</span>
              </label>
            </div>
            <div className="border-t border-zinc-200 px-5 py-4 flex gap-2">
              <button onClick={() => setEditArm(null)} disabled={guardandoArm} className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50">Cancelar</button>
              <button onClick={guardarArm} disabled={guardandoArm} className="flex-1 py-2.5 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 disabled:opacity-50">{guardandoArm ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

export default function InventarioPageProtected() {
  return (
    <RequireRol roles={['administrador', 'gerente']}>
      <InventarioPage />
    </RequireRol>
  )
}
