'use client'

import { useState } from 'react'
import {
  Search, Plus, AlertTriangle, Filter, ChevronDown,
  X, Save, Edit2, Layers, Tag, Store, Globe, CheckSquare,
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
  ubicacion: string          // dónde está físicamente
  canales?: string[]         // solo armazones: en qué canales aparece
  estado?: EstadoArmazon
  stock?: number             // solo consumibles
  stockMin?: number
  descripcion?: string
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
// Mock data
// ─────────────────────────────────────────
const inicial: Producto[] = [
  // Armazones — una fila = una pieza física, múltiples canales
  { id: 1, sku: 'ARZ-001', nombre: 'Ray-Ban RB5154 Negro',         tipo: 'armazon', categoria: 'Armazones', marca: 'Ray-Ban',      precio: 2800, costo: 1200, ubicacion: 'Baja Visión',   canales: ['baja','gon','verly'], estado: 'disponible' },
  { id: 2, sku: 'ARZ-001', nombre: 'Ray-Ban RB5154 Negro',         tipo: 'armazon', categoria: 'Armazones', marca: 'Ray-Ban',      precio: 2800, costo: 1200, ubicacion: '5 de Mayo',     canales: ['mayo','gon'],         estado: 'disponible' },
  { id: 3, sku: 'ARZ-002', nombre: 'Ray-Ban RB5154 Carey',         tipo: 'armazon', categoria: 'Armazones', marca: 'Ray-Ban',      precio: 2800, costo: 1200, ubicacion: 'Baja Visión',   canales: ['baja','verly'],       estado: 'apartado' },
  { id: 4, sku: 'ARZ-003', nombre: 'Oakley OX8046 Negro Mate',     tipo: 'armazon', categoria: 'Armazones', marca: 'Oakley',       precio: 3200, costo: 1500, ubicacion: 'Plaza Laureles',canales: ['plaza','gon','verly'], estado: 'disponible' },
  { id: 5, sku: 'ARZ-004', nombre: 'Kenneth Cole KC0324 #12',      tipo: 'armazon', categoria: 'Armazones', marca: 'Kenneth Cole', precio: 2400, costo:  980, ubicacion: '5 de Mayo',     canales: [],                     estado: 'vendido' },
  { id: 6, sku: 'ARZ-005', nombre: 'Armazón acetato básico negro', tipo: 'armazon', categoria: 'Armazones', marca: 'Genérico',     precio:  950, costo:  380, ubicacion: 'Plaza Laureles',canales: ['plaza','gon'],         estado: 'disponible' },

  // Servicios
  { id: 10, sku: 'MIC-001', nombre: 'Micas monofocales CR-39',     tipo: 'servicio', categoria: 'Micas', marca: 'Genérico',    precio:  800, costo: 200, ubicacion: 'Todas' },
  { id: 11, sku: 'MIC-002', nombre: 'Micas antirreflejantes',      tipo: 'servicio', categoria: 'Micas', marca: 'Essilor',     precio: 1200, costo: 450, ubicacion: 'Todas' },
  { id: 12, sku: 'MIC-003', nombre: 'Micas progresivas Essilor',   tipo: 'servicio', categoria: 'Micas', marca: 'Essilor',     precio: 3500, costo:1400, ubicacion: 'Todas' },
  { id: 13, sku: 'MIC-004', nombre: 'Micas transitions',           tipo: 'servicio', categoria: 'Micas', marca: 'Transitions', precio: 2800, costo:1100, ubicacion: 'Todas' },

  // Consumibles
  { id: 20, sku: 'LC-001',  nombre: 'Lentes contacto Acuvue 1 día',   tipo: 'consumible', categoria: 'Lentes de contacto', marca: 'Acuvue',  precio: 320, costo:140, stock: 24, stockMin: 20, ubicacion: 'Baja Visión' },
  { id: 21, sku: 'LC-002',  nombre: 'Lentes contacto Acuvue mensual', tipo: 'consumible', categoria: 'Lentes de contacto', marca: 'Acuvue',  precio: 580, costo:250, stock: 12, stockMin: 10, ubicacion: '5 de Mayo' },
  { id: 22, sku: 'ACC-001', nombre: 'Solución Renu 120ml',            tipo: 'consumible', categoria: 'Accesorios', marca: 'Renu',     precio: 180, costo: 70, stock:  3, stockMin: 10, ubicacion: 'Baja Visión' },
  { id: 23, sku: 'ACC-002', nombre: 'Estuche de viaje',               tipo: 'consumible', categoria: 'Accesorios', marca: 'Genérico', precio: 120, costo: 40, stock:  4, stockMin: 15, ubicacion: 'Plaza Laureles' },
  { id: 24, sku: 'ACC-003', nombre: 'Paño de microfibra',             tipo: 'consumible', categoria: 'Accesorios', marca: 'Genérico', precio:  60, costo: 15, stock:  3, stockMin: 20, ubicacion: '5 de Mayo' },
]

const sucursales = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']
const catsPorTipo: Record<TipoProducto, string[]> = {
  armazon:    ['Armazones', 'Lentes de sol'],
  consumible: ['Lentes de contacto', 'Accesorios', 'Soluciones'],
  servicio:   ['Micas', 'Examen visual', 'Servicio'],
}

const formVacio = (): Omit<Producto, 'id'> => ({
  sku: '', nombre: '', tipo: 'armazon', categoria: 'Armazones', marca: '',
  precio: 0, costo: 0, ubicacion: 'Baja Visión',
  canales: ['baja', 'gon', 'verly'], estado: 'disponible',
  stock: 0, stockMin: 0, descripcion: '',
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
export default function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoProducto>('todos')
  const [ubicFiltro, setUbicFiltro] = useState('Todas')
  const [soloAlerta, setSoloAlerta] = useState(false)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState<Omit<Producto, 'id'>>(formVacio())

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
    setForm({ sku: p.sku, nombre: p.nombre, tipo: p.tipo, categoria: p.categoria, marca: p.marca, precio: p.precio, costo: p.costo, ubicacion: p.ubicacion, canales: p.canales ?? [], estado: p.estado ?? 'disponible', stock: p.stock ?? 0, stockMin: p.stockMin ?? 0, descripcion: p.descripcion ?? '' })
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

  const f = (k: keyof typeof form, v: string | number | string[]) =>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">SKU *</label>
                  <input value={form.sku} onChange={e => f('sku', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="ej. ARZ-007" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Marca</label>
                  <input value={form.marca} onChange={e => f('marca', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="ej. Ray-Ban" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Nombre *</label>
                <input value={form.nombre} onChange={e => f('nombre', e.target.value)}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="Nombre completo del producto" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Costo *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-sm">$</span>
                    <input type="number" value={form.costo || ''} onChange={e => f('costo', parseFloat(e.target.value) || 0)}
                      className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Precio de venta *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-sm">$</span>
                    <input type="number" value={form.precio || ''} onChange={e => f('precio', parseFloat(e.target.value) || 0)}
                      className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="0.00" />
                  </div>
                  {form.costo > 0 && form.precio > 0 && (
                    <p className="text-xs text-emerald-500 mt-1">Margen: {Math.round(((form.precio - form.costo) / form.precio) * 100)}%</p>
                  )}
                </div>
              </div>

              {/* Ubicación física */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  {form.tipo === 'armazon' ? 'Ubicación física (dónde está el armazón)' : form.tipo === 'servicio' ? 'Disponible en' : 'Sucursal'}
                </label>
                <div className="relative">
                  <select value={form.ubicacion} onChange={e => f('ubicacion', e.target.value)}
                    className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 pr-8">
                    {(form.tipo === 'servicio' ? ['Todas', ...sucursales.slice(1)] : sucursales.slice(1)).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              {/* ARMAZONES: canales de venta y estado */}
              {form.tipo === 'armazon' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-2">
                      Canales de venta activos
                      <span className="font-normal text-zinc-400 ml-1">— al venderse, se quitan de todos automáticamente</span>
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {CANALES_DISPONIBLES.map(c => {
                        const activo = (form.canales ?? []).includes(c.key)
                        const deshabilitado = form.estado === 'vendido'
                        const esWeb = c.key === 'gon' || c.key === 'verly'
                        return (
                          <button key={c.key} type="button"
                            disabled={deshabilitado}
                            onClick={() => toggleCanal(c.key)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded border text-sm transition-all text-left ${activo && !deshabilitado ? 'border-[#0D9488] bg-[#0D9488]/5 text-zinc-700' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-50'} ${deshabilitado ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            {esWeb ? <Globe className="w-4 h-4 flex-shrink-0 text-blue-400" /> : <Store className="w-4 h-4 flex-shrink-0 text-zinc-400" />}
                            <span className="flex-1">{c.label}</span>
                            {activo && !deshabilitado && <CheckSquare className="w-4 h-4 text-[#0D9488]" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-2">Estado de la pieza</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['disponible','apartado','vendido'] as EstadoArmazon[]).map(e => {
                        const ec = ESTADO[e]
                        return (
                          <button key={e} onClick={() => {
                            f('estado', e)
                            if (e === 'vendido') f('canales', [])
                          }}
                            className={`py-2.5 rounded text-xs font-semibold border transition-all ${form.estado === e ? `${ec.bg} border-current ${ec.text}` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                            {ec.label}
                          </button>
                        )
                      })}
                    </div>
                    {form.estado === 'vendido' && (
                      <p className="text-xs text-zinc-400 mt-1.5">Al marcar como vendido, los canales se desactivan automáticamente.</p>
                    )}
                  </div>
                </>
              )}

              {/* CONSUMIBLES: stock */}
              {form.tipo === 'consumible' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Cantidad actual *</label>
                    <input type="number" value={form.stock || ''} onChange={e => f('stock', parseInt(e.target.value) || 0)}
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Mínimo (alerta)</label>
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
