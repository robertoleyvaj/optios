'use client'

import { useEffect, useState } from 'react'
import { Search, Globe, Store, X, RefreshCw } from 'lucide-react'
import RequireRol from '@/components/RequireRol'

// Tipo de cambio de la óptica para convertir MXN → USD (Verly). Ajustable después.
const TC = 17

type Armazon = {
  id: number
  nombre: string
  marca: string
  modelo: string | null
  color1: string | null
  medidas: string | null
  material: string | null
  precio: number | null       // USD (Verly)
  precio_gon: number | null   // MXN (GON)
  costo: number | null
  stock_baja: number | null
  stock_mayo: number | null
  stock_plaza: number | null
  stock_online: number | null
  publicar_gon: boolean | null
  publicar_verly: boolean | null
  descuento_gon: number | null
  descuento_verly: number | null
  activo: boolean | null
  imagen_url: string | null
}

const num = (v: unknown) => Number(v ?? 0)
const stockTotal = (a: Armazon) => num(a.stock_baja) + num(a.stock_mayo) + num(a.stock_plaza) + num(a.stock_online)
const fmtMXN = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')

function ArmazonesPage() {
  const [lista, setLista] = useState<Armazon[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [edit, setEdit] = useState<Armazon | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [filtroPub, setFiltroPub] = useState<'todos' | 'publicados' | 'sin'>('todos')
  const [filtroSuc, setFiltroSuc] = useState<'Todas' | 'baja' | 'mayo' | 'plaza'>('Todas')

  const cargar = async () => {
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/ecomm/armazones', { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error al cargar')
      setLista(j.armazones as Armazon[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    if (!edit || guardando) return
    setGuardando(true)
    try {
      const precio_gon = num(edit.precio_gon)
      const payload = {
        id: edit.id,
        precio_gon,
        precio: Math.round(precio_gon / TC),   // USD (Verly) = MXN ÷ TC, redondeo al más cercano
        costo: num(edit.costo),
        stock_baja: num(edit.stock_baja),
        stock_mayo: num(edit.stock_mayo),
        stock_plaza: num(edit.stock_plaza),
        stock_online: num(edit.stock_online),
        publicar_gon: !!edit.publicar_gon,
        publicar_verly: !!edit.publicar_verly,
        descuento_gon: num(edit.descuento_gon),
        descuento_verly: num(edit.descuento_verly),
        activo: edit.activo !== false,
      }
      const r = await fetch('/api/ecomm/armazones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error al guardar')
      setLista(prev => prev.map(a => a.id === edit.id ? (j.armazon as Armazon) : a))
      setEdit(null)
    } catch (e) {
      alert('No se pudo guardar: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setGuardando(false)
    }
  }

  const q = busqueda.trim().toLowerCase()
  const esPub = (a: Armazon) => !!a.publicar_gon || !!a.publicar_verly
  const stockSuc = (a: Armazon) =>
    filtroSuc === 'baja' ? num(a.stock_baja)
    : filtroSuc === 'mayo' ? num(a.stock_mayo)
    : filtroSuc === 'plaza' ? num(a.stock_plaza)
    : stockTotal(a)
  const filtrada = lista.filter(a => {
    if (q && !`${a.marca} ${a.nombre} ${a.modelo ?? ''}`.toLowerCase().includes(q)) return false
    if (filtroPub === 'publicados' && !esPub(a)) return false
    if (filtroPub === 'sin' && esPub(a)) return false
    if (filtroSuc !== 'Todas' && stockSuc(a) <= 0) return false   // solo los que están en esa óptica
    return true
  })
  const nPub = lista.filter(esPub).length
  const SUC_LBL: Record<string, string> = { Todas: 'Todas', baja: 'Baja Visión', mayo: '5 de Mayo', plaza: 'Plaza Laureles' }

  const set = (campo: keyof Armazon, valor: unknown) =>
    setEdit(prev => prev ? { ...prev, [campo]: valor } : prev)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Armazones</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Inventario de las 3 ópticas · {lista.length} armazones · publica en línea los que quieras</p>
        </div>
        <button onClick={cargar} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-3 py-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200/80">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por marca, nombre o modelo..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
          </div>
          <div className="flex bg-zinc-100 rounded p-0.5 gap-0.5 text-xs">
            {([['todos', `Todos (${lista.length})`], ['publicados', `En línea (${nPub})`], ['sin', 'Sin publicar']] as const).map(([val, lbl]) => (
              <button key={val} onClick={() => setFiltroPub(val)}
                className={`px-3 py-1.5 rounded font-semibold transition-colors ${filtroPub === val ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
                {lbl}
              </button>
            ))}
          </div>
          <select value={filtroSuc} onChange={e => setFiltroSuc(e.target.value as typeof filtroSuc)}
            className="ml-auto text-sm bg-zinc-50 border border-zinc-200 rounded px-3 py-2 text-zinc-600 focus:outline-none">
            <option value="Todas">Todas las ópticas</option>
            <option value="baja">Baja Visión</option>
            <option value="mayo">5 de Mayo</option>
            <option value="plaza">Plaza Laureles</option>
          </select>
        </div>

        {error && <div className="px-5 py-3 text-sm text-red-600 bg-red-50">{error}</div>}

        {cargando ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">Cargando armazones...</div>
        ) : filtrada.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">Sin resultados</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {filtrada.map(a => (
              <button key={a.id} onClick={() => setEdit({ ...a })}
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-zinc-50">
                <div className="w-10 h-10 rounded bg-zinc-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {a.imagen_url ? <img src={a.imagen_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-zinc-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 truncate">{a.marca} {a.nombre}</p>
                  <p className="text-xs text-zinc-400">{a.modelo || '—'} {a.medidas ? `· ${a.medidas}` : ''} {a.color1 ? `· ${a.color1}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-800">{fmtMXN(num(a.precio_gon))}</p>
                  <p className="text-xs text-zinc-400">Stock: {stockTotal(a)}</p>
                </div>
                <div className="flex gap-1 w-24 justify-end">
                  {a.publicar_gon && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium"><Globe className="w-2.5 h-2.5" />GON</span>}
                  {a.publicar_verly && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium"><Globe className="w-2.5 h-2.5" />Verly</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal editar ── */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !guardando && setEdit(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <div>
                <h3 className="text-base font-bold text-zinc-900">{edit.marca} {edit.nombre}</h3>
                <p className="text-xs text-zinc-500">{edit.modelo || '—'} {edit.medidas ? `· ${edit.medidas}` : ''}</p>
              </div>
              <button onClick={() => !guardando && setEdit(null)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
              {/* Precio */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">PRECIO</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Precio (MXN)</label>
                    <input type="number" value={num(edit.precio_gon)} onChange={e => set('precio_gon', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Verly (USD, auto · TC {TC})</label>
                    <div className="w-full border border-zinc-100 bg-zinc-50 rounded px-2.5 py-2 text-zinc-500">
                      USD ${Math.round(num(edit.precio_gon) / TC)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Costo (solo admin)</label>
                    <input type="number" value={num(edit.costo)} onChange={e => set('costo', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                </div>
              </div>

              {/* Stock por sucursal */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">EXISTENCIAS POR SUCURSAL</p>
                <div className="grid grid-cols-4 gap-2">
                  {([['stock_baja', 'Baja'], ['stock_mayo', '5 Mayo'], ['stock_plaza', 'Laureles'], ['stock_online', 'Online']] as const).map(([campo, lbl]) => (
                    <div key={campo}>
                      <label className="block text-xs text-zinc-500 mb-1">{lbl}</label>
                      <input type="number" value={num(edit[campo])} onChange={e => set(campo, e.target.value)}
                        className="w-full border border-zinc-200 rounded px-2 py-2 text-center" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 mt-1">Total: {stockTotal(edit)}</p>
              </div>

              {/* Canales */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">PUBLICAR EN LÍNEA</p>
                <div className="flex gap-2">
                  <button onClick={() => set('publicar_gon', !edit.publicar_gon)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-sm font-semibold ${edit.publicar_gon ? 'bg-blue-600 text-white border-blue-600' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
                    <Globe className="w-4 h-4" /> GON
                  </button>
                  <button onClick={() => set('publicar_verly', !edit.publicar_verly)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-sm font-semibold ${edit.publicar_verly ? 'bg-violet-600 text-white border-violet-600' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
                    <Globe className="w-4 h-4" /> Verly
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Descuento GON (%)</label>
                    <input type="number" value={num(edit.descuento_gon)} onChange={e => set('descuento_gon', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Descuento Verly (%)</label>
                    <input type="number" value={num(edit.descuento_verly)} onChange={e => set('descuento_verly', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-2.5 py-2" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={edit.activo !== false} onChange={e => set('activo', e.target.checked)} />
                <span className="text-sm text-zinc-600">Activo (visible en las páginas)</span>
              </label>
            </div>

            <div className="border-t border-zinc-200 px-5 py-4 flex gap-2">
              <button onClick={() => setEdit(null)} disabled={guardando}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 py-2.5 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArmazonesPageProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <ArmazonesPage />
    </RequireRol>
  )
}
