'use client'

import { useState, useEffect } from 'react'
import RequireRol from '@/components/RequireRol'
import {
  Search, Plus, AlertTriangle, Filter, ChevronDown,
  X, Save, Edit2, Layers, Tag, Store, Globe, CheckSquare, RefreshCw,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type TipoProducto = 'armazon' | 'consumible' | 'servicio'
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
}

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

const generarSku = (tipo: TipoProducto) => {
  const pref = { armazon: 'ARZ', consumible: 'CON', servicio: 'SRV' }[tipo]
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${pref}-${rand}`
}

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
    return <span className="text-xs text-zinc-300 italic">Sin canales</span>
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
// Page
// ─────────────────────────────────────────
function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoProducto>('todos')
  const [ubicFiltro, setUbicFiltro] = useState('Todas')
  const [soloAlerta, setSoloAlerta] = useState(false)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState<Omit<Producto, 'id'>>(formVacio())
  const [esAdmin, setEsAdmin] = useState(false)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
    setEsAdmin(u.rol === 'administrador' || u.rol === 'gerente')
  }, [])

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

  const guardar = () => {
    // Si se marca vendido, limpiar canales automáticamente
    const canalesFinal = form.estado === 'vendido' ? [] : form.canales
    const data = { ...form, canales: canalesFinal }
    if (editando) {
      setProductos(prev => prev.map(p => p.id === editando.id ? { ...p, ...data } : p))
    } else {
      setProductos(prev => [...prev, { id: Date.now(), ...data }])
    }
    setModal(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Inventario</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Una pieza · múltiples canales de venta · sincronización automática</p>
        </div>
        <button onClick={abrirNuevo}
          className="flex items-center gap-2 bg-[#0B0E14] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#1A1D27] active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Agregar producto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Armazones disponibles</p>
              <p className="text-2xl font-bold text-zinc-800 mt-1">{armazonesDisp} <span className="text-sm font-normal text-zinc-400">/ {armazonesTotal}</span></p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-500" />
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3">{armazonesApart} apartados</p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Listados activos</p>
              <p className="text-2xl font-bold text-zinc-800 mt-1">{totalCanales}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3">en tiendas y web simultáneamente</p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Consumibles con alerta</p>
              <p className="text-2xl font-bold text-zinc-800 mt-1">{consumAlerta}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3">lentes y accesorios por reponer</p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Servicios en catálogo</p>
              <p className="text-2xl font-bold text-zinc-800 mt-1">{productos.filter(p => p.tipo === 'servicio').length}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-zinc-500" />
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3">micas y servicios a pedido</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-zinc-200/80">

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre, SKU o marca..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 placeholder:text-zinc-400" />
          </div>
          <div className="flex items-center border border-zinc-200 rounded overflow-hidden">
            {(['todos','armazon','servicio','consumible'] as const).map((k,i) => (
              <button key={k} onClick={() => setTipoFiltro(k)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-r last:border-r-0 border-zinc-200 ${tipoFiltro === k ? 'bg-[#0B0E14] text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>
                {['Todos','Armazones','Micas/Servicios','Consumibles'][i]}
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={ubicFiltro} onChange={e => setUbicFiltro(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded text-zinc-600 focus:outline-none">
              {sucursales.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
          <button onClick={() => setSoloAlerta(!soloAlerta)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded transition-colors ${soloAlerta ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> Solo alertas
          </button>
          <span className="text-xs text-zinc-400 ml-auto flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> {filtrados.length} registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
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
                  <tr key={p.id} className={`hover:bg-zinc-50 transition-colors group ${opaco ? 'opacity-50' : ''}`}>
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
                    <td className="px-4 py-3.5">
                      <button onClick={() => abrirEditar(p)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-[#0D9488]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <div className="text-center py-16 text-zinc-400 text-sm">No se encontraron productos.</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
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
                      className={`py-2.5 rounded text-xs font-semibold border transition-all ${form.tipo === t ? 'bg-[#0B0E14] border-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
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
                    <button type="button" onClick={() => f('sku', generarSku(form.tipo))}
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
                          className={`flex items-center gap-3 px-4 py-2.5 rounded border text-sm transition-all text-left ${activo ? 'border-[#0D9488] bg-[#0D9488]/5 text-zinc-700' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-50'}`}>
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
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.nombre || !form.sku}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40">
                <Save className="w-4 h-4" />
                {editando ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
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
