'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Camera, Trash2, Save, Globe, Loader2, ImageOff, Star, Tag, AlertTriangle, Pencil, SlidersHorizontal } from 'lucide-react'
import RequireRol from '@/components/RequireRol'
import { getUsuarioLocal } from '@/lib/session'
import Entradas from './Entradas'
import Traspasos from './Traspasos'
import Catalogo from './Productos'
import { GENEROS, FORMAS, AROS, ETIQUETAS, tallaDeMedidas } from '@/lib/armazon-web'
import { GAMAS } from '@/lib/precio-gama'
import Etiquetas from './Etiquetas'

// ─────────────────────────────────────────────────────────────
// Inventario nuevo · Armazones (SKU por color)
// Vista previa: lee los modelos VRL-1xxx cargados "escondidos".
// El stock NO se edita aquí: cambia solo con entradas, traspasos,
// ventas y ajustes (todo queda en la bitácora).
// ─────────────────────────────────────────────────────────────

type Color = {
  id: number; armazon_id: number; sku: string; color: string
  stock_baja: number; stock_mayo: number; stock_plaza: number; stock_online: number; bodega: number; orden: number
  // Para la web: color del circulito, si se muestra y sus fotos
  hex?: string | null; publicar_verly?: boolean | null; publicar_gon?: boolean | null
  imagen_url?: string | null; imagen2_url?: string | null; imagen3_url?: string | null
}
type Modelo = {
  id: number; sku: string; sku_viejo?: string | null; marca: string; modelo: string; nombre: string | null
  medidas: string | null; material: string | null; precio_gon: number | null; precio: number | null
  costo: number | null; activo: boolean; publicar_gon: boolean; publicar_verly: boolean
  imagen_url: string | null; imagen2_url: string | null; imagen3_url: string | null
  imagen4_url: string | null; imagen5_url: string | null
  // Datos para la web
  genero?: string | null; forma?: string | null; aro?: string | null; badge?: string | null
  descripcion_es?: string | null; descripcion_en?: string | null; gama?: string | null
  colores: Color[]
}
type Mov = { id: number; created_at: string; sku: string; sucursal: string; tipo: string; cantidad: number; referencia: string | null; usuario: string | null; notas: string | null }

const SUC = [
  { key: 'stock_baja' as const,  label: 'Baja Visión',    corto: 'Baja' },
  { key: 'stock_mayo' as const,  label: '5 de Mayo',      corto: 'Mayo' },
  { key: 'stock_plaza' as const, label: 'Plaza Laureles', corto: 'Plaza' },
  { key: 'bodega' as const,      label: 'Bodega',         corto: 'Bodega' },
]
const TIPO: Record<string, { label: string; cls: string }> = {
  carga_inicial:    { label: 'Carga inicial',    cls: 'bg-teal-50 text-teal-700' },
  entrada:          { label: 'Entrada',          cls: 'bg-emerald-50 text-emerald-700' },
  venta:            { label: 'Venta',            cls: 'bg-blue-50 text-blue-700' },
  cancelacion:      { label: 'Cancelación',      cls: 'bg-zinc-100 text-zinc-600' },
  traspaso_salida:  { label: 'Traspaso salida',  cls: 'bg-violet-50 text-violet-700' },
  traspaso_entrada: { label: 'Traspaso entrada', cls: 'bg-violet-50 text-violet-700' },
  ajuste:           { label: 'Ajuste',           cls: 'bg-amber-50 text-amber-700' },
  merma:            { label: 'Merma',            cls: 'bg-red-50 text-red-600' },
}

const num = (v: unknown) => Number(v ?? 0) || 0
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')
const totColor = (c: Color) => num(c.stock_baja) + num(c.stock_mayo) + num(c.stock_plaza) + num(c.bodega)
const totSuc = (m: Modelo, k: typeof SUC[number]['key']) => m.colores.reduce((s, c) => s + num(c[k]), 0)
const totModelo = (m: Modelo) => m.colores.reduce((s, c) => s + totColor(c), 0)

const SWATCH: [string, string][] = [
  ['NEGRO', '#1d1d1d'], ['BLANC', '#e8e8e8'], ['AZUL', '#2f4a8c'], ['ROJO', '#a83232'], ['ROSA', '#d46a90'],
  ['VERDE', '#3a7d4d'], ['GRIS', '#8a8a8a'], ['CAREY', '#6b4423'], ['CAFE', '#5a3a1e'], ['DORAD', '#c9a227'],
  ['PLATE', '#b8b8b8'], ['MORAD', '#6a3d9a'], ['LILA', '#b39ddb'], ['NARANJ', '#e07b2f'], ['GUINDA', '#722f37'],
  ['AMARIL', '#e6c229'], ['TRANSP', '#d8e4e8'], ['CREMA', '#efe3c8'],
]
const swatch = (n: string, hex?: string | null) => {
  if (hex && /^#[0-9a-f]{6}$/i.test(hex)) return hex
  const s = (n || '').toUpperCase(); for (const [k, v] of SWATCH) if (s.includes(k)) return v; return '#b0b0b0'
}
const FOTOS_COLOR = ['imagen_url', 'imagen2_url', 'imagen3_url'] as const
const fotosColor = (c: Color) => FOTOS_COLOR.map(f => c[f]).filter(Boolean) as string[]
// Portada del armazón: la marcada con ⭐ o la primera foto de algún color
const portadaModelo = (m: Modelo) => m.imagen_url || m.colores.map(c => fotosColor(c)[0]).find(Boolean) || null
// Regla de la web: 3 o más piezas iguales → va a la web. Pendiente = aún sin fotos o sin publicar.
const PIEZAS_WEB = 3
const pendienteWeb = (m: Modelo) => totModelo(m) >= PIEZAS_WEB && (!(m.publicar_verly || m.publicar_gon) || !portadaModelo(m))

function InventarioNuevo() {
  const rol = getUsuarioLocal()?.rol as string | undefined
  const esAdmin = rol === 'administrador'
  const esWeb = rol === 'web'
  const puedeWeb = esAdmin || esWeb
  const esGestion = esAdmin || rol === 'gerente'
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [marca, setMarca] = useState('')
  const [suc, setSuc] = useState('')
  const [filtro, setFiltro] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [tab, setTab] = useState<'armazones' | 'micas' | 'lc' | 'consumibles' | 'servicios'>('armazones')
  const [armVista, setArmVista] = useState<'lista' | 'entrada' | 'traspasos' | 'etiquetas'>('lista')
  const [etiquetasPend, setEtiquetasPend] = useState<number | null>(null)

  const cargar = async () => {
    setCargando(true); setError('')
    try {
      const j = await fetch('/api/inv/armazones', { cache: 'no-store' }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      setModelos(j.modelos)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])
  // Cuántas etiquetas hay en la cola (para el botón)
  const contarEtiquetas = () => fetch('/api/inv/etiquetas', { cache: 'no-store' }).then(r => r.json())
    .then(j => { if (j.ok) setEtiquetasPend((j.pendientes as { cantidad: number }[]).reduce((s, p) => s + p.cantidad, 0)) }).catch(() => {})
  useEffect(() => { const t = setTimeout(contarEtiquetas, 0); return () => clearTimeout(t) }, [armVista])

  const marcas = useMemo(() => [...new Set(modelos.map(m => m.marca))].sort(), [modelos])

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    const k = SUC.find(s => s.label === suc)?.key
    return modelos.filter(m => {
      if (marca && m.marca !== marca) return false
      if (k && totSuc(m, k) === 0) return false
      const tot = totModelo(m)
      if (filtro === 'agotado' && tot !== 0) return false
      if (filtro === 'ultima' && tot !== 1) return false
      if (filtro === 'sinfoto' && portadaModelo(m)) return false
      if (filtro === 'pendweb' && !pendienteWeb(m)) return false
      if (filtro === 'web' && !(m.publicar_gon || m.publicar_verly)) return false
      if (!t) return true
      return (`${m.marca} ${m.modelo} ${m.sku} ` + m.colores.map(c => `${c.color} ${c.sku}`).join(' ')).toLowerCase().includes(t)
    })
  }, [modelos, q, marca, suc, filtro])

  const pendientesWeb = useMemo(() => modelos.filter(pendienteWeb).length, [modelos])
  const totales = useMemo(() => SUC.map(s => lista.reduce((a, m) => a + totSuc(m, s.key), 0)), [lista])
  const sel = modelos.find(m => m.id === selId) ?? null
  const actualizar = (m: Modelo) => setModelos(prev => prev.map(x => x.id === m.id ? { ...x, ...m, colores: m.colores ?? x.colores } : x))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Inventario</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Armazones por color, con SKU y existencias por sucursal.</p>
        </div>
        <div className="flex items-center gap-2">
          {esGestion && <a href="/dashboard/inventario"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 whitespace-nowrap">
            Inventario actual →
          </a>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {([['armazones', 'Armazones'], ['micas', 'Micas y tratamientos'], ['lc', 'Lentes de contacto'], ['consumibles', 'Consumibles'], ['servicios', 'Servicios']] as const).filter(([k]) => esGestion || k === 'armazones').map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setArmVista('lista') }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>{l}</button>
        ))}
      </div>

      {(tab === 'micas' || tab === 'lc' || tab === 'consumibles' || tab === 'servicios') && <Catalogo key={tab} seccion={tab} esAdmin={esAdmin} />}

      {tab === 'armazones' && armVista !== 'lista' && <>
        <button onClick={() => setArmVista('lista')} className="text-sm font-semibold text-teal-700 hover:underline">← Volver a armazones</button>
        {armVista === 'entrada' && <Entradas modelos={modelos} esAdmin={esAdmin} onDone={cargar} onVerEtiquetas={() => setArmVista('etiquetas')} />}
        {armVista === 'traspasos' && esGestion && <Traspasos modelos={modelos} puedeEnviar onDone={cargar} />}
        {armVista === 'etiquetas' && <Etiquetas onCambio={setEtiquetasPend} />}
      </>}

      {tab === 'armazones' && armVista === 'lista' && <>
        <div className="flex flex-wrap gap-2 justify-end">
          {pendientesWeb > 0 && (
            <button onClick={() => setFiltro(f => f === 'pendweb' ? '' : 'pendweb')}
              className={`mr-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border ${filtro === 'pendweb' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
              <AlertTriangle className="w-4 h-4" /> {pendientesWeb} pendientes de web
              <span className="text-[11px] font-normal opacity-80">({PIEZAS_WEB}+ piezas sin fotos o sin publicar)</span>
            </button>
          )}
          <button onClick={() => setArmVista('entrada')} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50">+ Entrada de armazones</button>
          <button onClick={() => setArmVista('etiquetas')} className="inline-flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50">
            <Tag className="w-4 h-4" /> Etiquetas por imprimir
            {!!etiquetasPend && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-teal-600 text-white">{etiquetasPend}</span>}
          </button>
          {esGestion && <button onClick={() => setArmVista('traspasos')} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50">⇄ Traspasos</button>}
        </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <div className="text-xs text-zinc-500">Piezas</div>
          <div className="text-xl font-semibold text-zinc-900">{totales.reduce((a, b) => a + b, 0)}</div>
          <div className="text-[11px] text-zinc-400">{lista.length} modelos</div>
        </div>
        {SUC.map((s, i) => (
          <div key={s.key} className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
            <div className="text-xs text-zinc-500">{s.label}</div>
            <div className="text-xl font-semibold text-zinc-900">{totales[i]}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-3 py-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar modelo, marca, color o SKU…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-zinc-400" />
          {q && <button onClick={() => setQ('')} className="text-zinc-400 hover:text-zinc-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <select value={marca} onChange={e => setMarca(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todas las marcas</option>
          {marcas.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={suc} onChange={e => setSuc(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todas las sucursales</option>
          {SUC.map(s => <option key={s.key}>{s.label}</option>)}
        </select>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todo</option>
          <option value="ultima">Última pieza</option>
          <option value="agotado">Agotados</option>
          <option value="sinfoto">Sin foto</option>
          <option value="pendweb">Pendientes de web</option>
          <option value="web">Marcados para web</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
        {cargando ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-16 text-sm text-red-500">{error}</div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16 text-sm text-zinc-400">Sin resultados</div>
        ) : (<>
          {/* Celular: tarjetas */}
          <div className="md:hidden divide-y divide-zinc-100">
            {lista.slice(0, 300).map(m => {
              const f = portadaModelo(m); const tot = totModelo(m); const pw = pendienteWeb(m)
              return (
                <button key={m.id} onClick={() => setSelId(m.id)} className={`w-full text-left flex items-center gap-3 px-3 py-3 active:bg-zinc-50 ${pw ? 'bg-red-50/50' : ''}`}>
                  {f ? <img src={f} alt="" className="w-16 h-12 object-cover rounded-lg border border-zinc-200 shrink-0" />
                     : <div className="w-16 h-12 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center shrink-0"><ImageOff className="w-4 h-4 text-zinc-300" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-800 truncate">{m.marca} {m.modelo}</div>
                    <div className="font-mono text-[11px] text-zinc-400 truncate">{m.sku} · {m.medidas}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {m.colores.slice(0, 6).map(c => <span key={c.id} className="w-3 h-3 rounded-full border border-zinc-200" style={{ background: swatch(c.color, c.hex) }} />)}
                      {pw && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold ml-1">Pendiente web</span>}
                      {!pw && (m.publicar_verly || m.publicar_gon) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold ml-1">En web</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm tabular-nums">{$(num(m.precio_gon))}</div>
                    <div className={`text-xs tabular-nums ${tot ? 'text-zinc-500' : 'text-red-600 font-semibold'}`}>{tot ? `${tot} pzas` : 'Agotado'}</div>
                  </div>
                </button>
              )
            })}
          </div>
          {/* Computadora: tabla */}
          <table className="w-full text-sm hidden md:table">
            <thead>
              <tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                <th className="text-left font-semibold px-3 py-2 w-14"></th>
                <th className="text-left font-semibold px-3 py-2">Modelo</th>
                <th className="text-left font-semibold px-3 py-2">Colores</th>
                <th className="text-right font-semibold px-3 py-2">Precio</th>
                {SUC.map(s => <th key={s.key} className="text-right font-semibold px-3 py-2">{s.corto}</th>)}
                <th className="text-right font-semibold px-3 py-2">Total</th>
                <th className="text-left font-semibold px-3 py-2">Web</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 300).map(m => {
                const f = portadaModelo(m); const tot = totModelo(m); const pw = pendienteWeb(m)
                return (
                  <tr key={m.id} onClick={() => setSelId(m.id)} className={`border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer ${pw ? 'bg-red-50/40' : ''}`}>
                    <td className="px-3 py-2">
                      {f ? <img src={f} alt="" className="w-11 h-8 object-cover rounded-md border border-zinc-200" />
                         : <div className="w-11 h-8 rounded-md border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center"><ImageOff className="w-3.5 h-3.5 text-zinc-300" /></div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-800">{m.marca} {m.modelo}</div>
                      <div className="font-mono text-[11px] text-zinc-400">{m.sku} · {m.medidas} · {m.material}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {m.colores.slice(0, 6).map(c => <span key={c.id} title={c.color} className="w-3 h-3 rounded-full border border-zinc-200" style={{ background: swatch(c.color) }} />)}
                        <span className="text-[11px] text-zinc-400 ml-1">{m.colores.length}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{$(num(m.precio_gon))}</td>
                    {SUC.map(s => { const v = totSuc(m, s.key); return <td key={s.key} className={`px-3 py-2 text-right tabular-nums ${v ? 'text-zinc-700' : 'text-zinc-300'}`}>{v || '–'}</td> })}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {tot || <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">Agotado</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.publicar_gon && <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold mr-1">GON</span>}
                      {m.publicar_verly && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold">Verly</span>}
                      {!m.publicar_gon && !m.publicar_verly && !pw && <span className="text-zinc-300">–</span>}
                      {pw && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Pendiente</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>)}
        {lista.length > 300 && <div className="text-xs text-zinc-400 px-3 py-2">Mostrando 300 de {lista.length}. Usa el buscador para afinar.</div>}
      </div>

      </>}

      {sel && <Ficha modelo={sel} esAdmin={esAdmin} esGestion={esGestion} puedeWeb={puedeWeb} onClose={() => setSelId(null)} onChange={actualizar} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Ficha del armazón
// ─────────────────────────────────────────────────────────────
function Ficha({ modelo: m, esAdmin, esGestion, puedeWeb, onClose, onChange }: {
  modelo: Modelo; esAdmin: boolean; esGestion: boolean; puedeWeb: boolean; onClose: () => void; onChange: (m: Modelo) => void
}) {
  const [datos, setDatos] = useState({ marca: m.marca ?? '', modelo: m.modelo ?? '', medidas: m.medidas ?? '', material: m.material ?? '', precio_gon: String(m.precio_gon ?? '') })
  const [ajusteDe, setAjusteDe] = useState<number | null>(null)   // color que se está ajustando
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [movs, setMovs] = useState<Mov[] | null>(null)

  const cargarMovs = () => fetch(`/api/inv/movimientos?sku=${encodeURIComponent(m.sku)}`, { cache: 'no-store' })
    .then(r => r.json()).then(j => setMovs(j.ok ? j.movimientos : [])).catch(() => setMovs([]))
  useEffect(() => { cargarMovs() }, [m.sku]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const patch = async (cambios: Record<string, unknown>) => {
    const j = await fetch('/api/inv/armazones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, ...cambios }),
    }).then(r => r.json())
    if (!j.ok) throw new Error(j.error)
    onChange({ ...m, ...j.modelo })
    return j.modelo as Modelo
  }

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      const n = await patch({
        marca: datos.marca.trim().toUpperCase() || m.marca, modelo: datos.modelo.trim().toUpperCase() || m.modelo,
        medidas: datos.medidas.trim() || null, material: datos.material.trim().toUpperCase() || null,
        precio_gon: datos.precio_gon ? Number(datos.precio_gon) : null,
      })
      setDatos(d => ({ ...d, precio_gon: String(n.precio_gon ?? '') }))
      setMsg('Guardado. El precio de Verly se recalculó solo.')
    } catch (e) { setMsg('No se pudo guardar: ' + (e instanceof Error ? e.message : '')) }
    finally { setGuardando(false) }
  }

  const cambiarGama = async (gama: string) => {
    if (gama === m.gama) return
    if (!confirm('Al cambiar la gama se pone un precio nuevo dentro de su rango. ¿Seguro?')) return
    try { const n = await patch({ gama }); setDatos(d => ({ ...d, precio_gon: String(n.precio_gon ?? '') })); setMsg('Gama y precio actualizados. Reimprime sus etiquetas si ya estaban puestas.') }
    catch (e) { setMsg('Error: ' + (e instanceof Error ? e.message : '')) }
  }

  const portadaDe = (mm: Modelo) => mm.imagen_url || mm.colores.map(c => fotosColor(c)[0]).find(Boolean) || null
  const togglePub = async (campo: 'publicar_gon' | 'publicar_verly') => {
    const portada = portadaDe(m)
    if (!m[campo] && !portada) { setMsg('Sube al menos una foto de algún color antes de publicar'); return }
    try { await patch({ [campo]: !m[campo], ...(!m.imagen_url && portada ? { imagen_url: portada } : {}) }) }
    catch (e) { setMsg('Error: ' + (e instanceof Error ? e.message : '')) }
  }

  const reimprimir = async (c: Color) => {
    const n = parseInt(prompt(`¿Cuántas etiquetas de ${c.sku} (${c.color}) agregar a la cola?`, String(totColor(c) || 1)) ?? '')
    if (!n || n < 1) return
    const j = await fetch('/api/inv/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'agregar', color_id: c.id, cantidad: n }) }).then(r => r.json())
    setMsg(j.ok ? `${n} etiquetas de ${c.sku} agregadas a la cola.` : 'Error: ' + j.error)
  }

  const renombrarColor = async (c: Color) => {
    const nuevo = prompt(`Nombre correcto del color ${c.sku}:`, c.color)?.trim()
    if (!nuevo || nuevo.toUpperCase() === c.color) return
    const j = await fetch('/api/inv/armazones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color_id: c.id, color: nuevo }) }).then(r => r.json())
    if (j.ok) { onChange({ ...m, colores: m.colores.map(x => x.id === c.id ? { ...x, ...j.color } : x) }); setMsg(`Color corregido: ${j.color.color}`) }
    else setMsg('Error: ' + j.error)
  }

  const tot = totModelo(m)
  const portada = portadaDe(m)
  const talla = tallaDeMedidas(m.medidas)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-zinc-50 w-full max-w-2xl h-full overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        <div className="bg-white border-b border-zinc-200 px-5 py-4 sticky top-0 z-10 flex items-center gap-3">
          {portada ? <img src={portada} alt="" className="w-16 h-12 object-cover rounded-lg border border-zinc-200" />
            : <div className="w-16 h-12 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center"><ImageOff className="w-4 h-4 text-zinc-300" /></div>}
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold text-zinc-900 truncate">{m.marca} {m.modelo}{m.nombre && m.nombre !== m.modelo && <span className="text-zinc-400 font-normal"> · “{m.nombre}”</span>}</div>
            <div className="font-mono text-xs text-zinc-400">{m.sku} · {m.medidas}{talla && ` (${talla.talla})`} · {m.material} · {tot} piezas</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 sm:p-5 space-y-4">
          {msg && <div className="text-xs px-3 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600">{msg}</div>}

          {/* Colores y existencias */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Colores y existencias</h3>
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[440px]">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-zinc-200">
                  <th className="text-left font-semibold py-1.5">Color</th>
                  <th className="text-left font-semibold py-1.5">SKU</th>
                  {SUC.map(s => <th key={s.key} className="text-right font-semibold py-1.5">{s.corto}</th>)}
                  <th className="text-right font-semibold py-1.5">Total</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {m.colores.map(c => (<Fragment key={c.id}>
                  <tr className="border-b border-zinc-100">
                    <td className="py-2"><span className="inline-block w-3 h-3 rounded-full border border-zinc-200 mr-2 align-[-1px]" style={{ background: swatch(c.color, c.hex) }} />{c.color}</td>
                    <td className="py-2 font-mono text-[11px] text-zinc-500">{c.sku}</td>
                    {SUC.map(s => <td key={s.key} className={`py-2 text-right tabular-nums ${num(c[s.key]) ? '' : 'text-zinc-300'}`}>{num(c[s.key]) || '–'}</td>)}
                    <td className="py-2 text-right tabular-nums font-semibold">{totColor(c)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {esAdmin && <button onClick={() => renombrarColor(c)} title="Corregir nombre del color" className="text-zinc-300 hover:text-teal-600 mr-2"><Pencil className="w-3.5 h-3.5" /></button>}
                      {esGestion && <button onClick={() => setAjusteDe(ajusteDe === c.id ? null : c.id)} title="Ajustar existencias" className={`mr-2 ${ajusteDe === c.id ? 'text-teal-600' : 'text-zinc-300 hover:text-teal-600'}`}><SlidersHorizontal className="w-3.5 h-3.5" /></button>}
                      <button onClick={() => reimprimir(c)} title="Reimprimir etiquetas" className="text-zinc-300 hover:text-teal-600"><Tag className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                  {ajusteDe === c.id && (
                    <tr><td colSpan={SUC.length + 4} className="py-2">
                      <AjusteColor color={c} onListo={col => { onChange({ ...m, colores: m.colores.map(x => x.id === c.id ? { ...x, ...col } : x) }); setAjusteDe(null); cargarMovs(); setMsg(`Ajuste guardado en ${c.sku}.`) }} onCancelar={() => setAjusteDe(null)} />
                    </td></tr>
                  )}
                </Fragment>))}
              </tbody>
            </table>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">Las existencias solo cambian con entradas, traspasos, ventas o ajustes, y todo queda registrado.</p>
          </section>

          {/* Datos y precio */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Datos y precio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {esAdmin && <Campo label="Marca (corregir error de dedo)" value={datos.marca} onChange={v => setDatos(d => ({ ...d, marca: v }))} />}
              {esAdmin && <Campo label="Modelo (corregir error de dedo)" value={datos.modelo} onChange={v => setDatos(d => ({ ...d, modelo: v }))} />}
              <Campo label="Medidas (mica-puente-varilla)" value={datos.medidas} onChange={v => setDatos(d => ({ ...d, medidas: v }))} disabled={!esAdmin} />
              <Campo label="Material" value={datos.material} onChange={v => setDatos(d => ({ ...d, material: v }))} disabled={!esAdmin} />
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-zinc-500">Gama</span>
              <div className="flex gap-1.5 mt-1">
                {GAMAS.map(g => (
                  <button key={g.v} disabled={!puedeWeb} onClick={() => cambiarGama(g.v)}
                    className={`px-3 py-1.5 rounded-full text-xs border disabled:cursor-default ${m.gama === g.v ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-zinc-200 text-zinc-700 enabled:hover:border-zinc-400'}`}>{g.label}</button>
                ))}
                {!m.gama && <span className="text-[11px] text-amber-600 self-center ml-1">sin gama</span>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Campo label="Precio ópticas y GON (MXN)" value={datos.precio_gon} onChange={v => setDatos(d => ({ ...d, precio_gon: v }))} disabled={!esAdmin} type="number" />
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">Precio Verly (USD) · automático</span>
                <div className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 text-zinc-600">{m.precio ? `$${m.precio}` : '—'} <span className="text-[11px] text-zinc-400">pesos ÷ tipo de cambio × 50%</span></div>
              </label>
            </div>
            {esAdmin && (
              <button onClick={guardar} disabled={guardando}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-50">
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cambios
              </button>
            )}
          </section>

          {/* Movimientos */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Movimientos</h3>
            {movs === null ? <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
              : movs.length === 0 ? <p className="text-xs text-zinc-400">Sin movimientos todavía.</p>
              : (
                <div className="space-y-1.5">
                  {movs.map(v => (
                    <div key={v.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs border-b border-zinc-50 pb-1.5 sm:border-0 sm:pb-0">
                      <span className="text-zinc-400 sm:w-28 shrink-0">{new Date(v.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${TIPO[v.tipo]?.cls ?? 'bg-zinc-100'}`}>{TIPO[v.tipo]?.label ?? v.tipo}</span>
                      <span className="text-zinc-600">{v.sucursal}</span>
                      <span className="font-mono text-zinc-400">{v.sku}</span>
                      <span className={`ml-auto font-semibold ${v.cantidad < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{v.cantidad > 0 ? '+' : ''}{v.cantidad}</span>
                      <span className="text-zinc-400 w-full sm:w-28 truncate sm:text-right">{[v.referencia, v.usuario].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              )}
          </section>

          {/* ───────── PARA LA WEB (admin y encargado de web) ───────── */}
          {puedeWeb && (
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pt-1">
                <Globe className="w-4 h-4 text-violet-600" />
                <div className="text-sm font-semibold text-violet-900">Para la web</div>
                <div className="text-[11px] text-violet-500">Lo que ven los clientes en Verly y GON</div>
                {pendienteWeb(m) && <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Pendiente de web</span>}
              </div>

              <ColoresWeb modelo={m} esAdmin={puedeWeb} onChange={onChange} setMsg={setMsg}
                portada={m.imagen_url ?? null} onPortada={async url => { try { await patch({ imagen_url: url }) } catch (e) { setMsg('Error: ' + (e instanceof Error ? e.message : '')) } }} />

              <DatosWeb modelo={m} onChange={onChange} />

              <section className="bg-white border border-zinc-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-zinc-800 mb-3">Publicar en línea</h3>
                <div className="space-y-2">
                  <Switch label="GON" sub="gonmx.com · precio en pesos" on={m.publicar_gon} onClick={() => togglePub('publicar_gon')} />
                  <Switch label="Verly" sub={`Precio en dólares${m.precio ? ` · $${m.precio}` : ''}`} on={m.publicar_verly} onClick={() => togglePub('publicar_verly')} />
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">
                  {m.activo ? 'Si el stock llega a 0 se oculta solo de la web.' : 'Se verá en la web hasta el día del cambio; por ahora solo queda marcado.'}
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ajuste de existencias de un color ─────────────────────────
// Para conteos físicos y errores de captura (ej. pieza capturada en el modelo equivocado:
// −1 en el equivocado y +1 en el correcto). Queda en la bitácora.
const UBIC_AJ = [
  { v: 'baja', label: 'Baja Visión', k: 'stock_baja' }, { v: 'mayo', label: '5 de Mayo', k: 'stock_mayo' },
  { v: 'plaza', label: 'Plaza Laureles', k: 'stock_plaza' }, { v: 'bodega', label: 'Bodega', k: 'bodega' },
] as const
function AjusteColor({ color: c, onListo, onCancelar }: { color: Color; onListo: (col: Partial<Color>) => void; onCancelar: () => void }) {
  const [ubic, setUbic] = useState<typeof UBIC_AJ[number]['v']>('mayo')
  const actual = num(c[UBIC_AJ.find(u => u.v === ubic)!.k])
  const [real, setReal] = useState('')
  const [motivo, setMotivo] = useState('captura')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')
  const delta = real === '' ? 0 : Number(real) - actual

  const guardar = async () => {
    if (real === '' || Number(real) < 0 || !Number.isInteger(Number(real))) { setErr('Pon cuántas piezas hay de verdad'); return }
    if (delta === 0) { setErr('No hay diferencia'); return }
    setGuardando(true); setErr('')
    try {
      const j = await fetch('/api/inv/ajustes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color_id: c.id, ubicacion: ubic, cantidad: delta, motivo, nota }) }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      onListo(j.color)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setGuardando(false) }
  }

  return (
    <div className="bg-teal-50/60 border border-teal-100 rounded-lg p-3 space-y-2">
      <div className="text-xs font-semibold text-teal-800">Ajustar {c.sku} · {c.color}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block"><span className="text-[11px] text-zinc-500">¿Dónde?</span>
          <select value={ubic} onChange={e => { setUbic(e.target.value as typeof ubic); setReal('') }} className="mt-0.5 w-full border border-zinc-200 rounded-md px-2 py-1.5 text-sm bg-white">
            {UBIC_AJ.map(u => <option key={u.v} value={u.v}>{u.label}</option>)}
          </select></label>
        <div><span className="text-[11px] text-zinc-500">Dice el sistema</span><div className="mt-0.5 px-2 py-1.5 text-sm font-semibold">{actual}</div></div>
        <label className="block"><span className="text-[11px] text-zinc-500">Hay de verdad</span>
          <input type="number" inputMode="numeric" min={0} value={real} onChange={e => setReal(e.target.value)} className="mt-0.5 w-full border border-zinc-200 rounded-md px-2 py-1.5 text-sm bg-white" /></label>
        <label className="block"><span className="text-[11px] text-zinc-500">Motivo</span>
          <select value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-0.5 w-full border border-zinc-200 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="captura">Error de captura</option><option value="conteo">Conteo físico</option>
            <option value="merma">Dañado o perdido</option><option value="otro">Otro</option>
          </select></label>
      </div>
      <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (ej. se capturó como ZB2084, es ZB2094)" className="w-full border border-zinc-200 rounded-md px-2 py-1.5 text-sm bg-white" />
      {delta !== 0 && <div className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{delta > 0 ? `+${delta}` : delta} pieza{Math.abs(delta) === 1 ? '' : 's'} en {UBIC_AJ.find(u => u.v === ubic)!.label}</div>}
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={guardando} className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar ajuste'}</button>
        <button onClick={onCancelar} className="px-3 py-1.5 border border-zinc-200 bg-white rounded-md text-xs font-semibold">Cancelar</button>
      </div>
    </div>
  )
}

// ── Datos para la web ─────────────────────────────────────────
// Todo lo que la web dice del armazón sale de aquí. Lo edita el admin
// (más adelante, también el rol de encargado de páginas).
function DatosWeb({ modelo: m, onChange }: { modelo: Modelo; onChange: (m: Modelo) => void }) {
  const inicial = () => ({
    nombre: m.nombre && m.nombre !== m.modelo ? m.nombre : '', genero: m.genero ?? '', forma: m.forma ?? '', aro: m.aro ?? '', badge: m.badge ?? '',
    descripcion_es: m.descripcion_es ?? '', descripcion_en: m.descripcion_en ?? '',
  })
  const [d, setD] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const cambio = JSON.stringify(d) !== JSON.stringify(inicial())
  const talla = tallaDeMedidas(m.medidas)
  // Si la forma guardada es de antes (texto libre), se muestra para que la corrijan
  const formaVieja = d.forma && !FORMAS.some(f => f.v === d.forma) ? d.forma : ''

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      const j = await fetch('/api/inv/armazones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, ...d, forma: formaVieja ? null : d.forma }),
      }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      onChange({ ...m, ...j.modelo })
      setMsg('Guardado')
    } catch (e) { setMsg('No se pudo guardar: ' + (e instanceof Error ? e.message : '')) }
    finally { setGuardando(false) }
  }

  const opciones = (campo: 'genero' | 'forma' | 'aro' | 'badge', lista: readonly { v: string; es: string }[], opcional = false) => (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {opcional && (
        <button type="button" onClick={() => setD(v => ({ ...v, [campo]: '' }))}
          className={`px-3 py-1.5 rounded-full text-xs border ${!d[campo] ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-white border-zinc-200 text-zinc-500'}`}>Ninguna</button>
      )}
      {lista.map(o => (
        <button key={o.v} type="button" onClick={() => setD(v => ({ ...v, [campo]: o.v }))}
          className={`px-3 py-1.5 rounded-full text-xs border ${d[campo] === o.v ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400'}`}>{o.es}</button>
      ))}
    </div>
  )

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-2"><Globe className="w-4 h-4 text-zinc-400" /> Datos para la web</h3>
      <p className="text-[11px] text-zinc-400 mb-3">Lo que ven los clientes en Verly y GON. En las ópticas el armazón sigue apareciendo como {m.marca} {m.modelo}.</p>
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-zinc-500">Nombre en la web (apodo)</span>
          <input value={d.nombre} onChange={e => setD(v => ({ ...v, nombre: e.target.value }))} maxLength={60} placeholder={`Ej. Natura · si se deja vacío sale "${m.modelo}"`}
            className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
        </label>
        <div><span className="text-[11px] font-semibold text-zinc-500">Para</span>{opciones('genero', GENEROS)}</div>
        <div>
          <span className="text-[11px] font-semibold text-zinc-500">Forma</span>
          {formaVieja && <span className="ml-2 text-[11px] text-amber-600">antes decía “{formaVieja}”: elige una de la lista</span>}
          {opciones('forma', FORMAS)}
        </div>
        <div><span className="text-[11px] font-semibold text-zinc-500">Tipo de armazón</span>{opciones('aro', AROS)}</div>
        <div><span className="text-[11px] font-semibold text-zinc-500">Etiqueta</span>{opciones('badge', ETIQUETAS, true)}</div>
        <div className="text-xs text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2">
          Talla: {talla ? <><b className="text-zinc-800">{talla.talla}</b> · mica {talla.mica} mm + puente {talla.puente} mm ≈ {talla.total} mm de ancho total (se calcula sola)</> : <span className="text-amber-600">pon las medidas (ej. 52-18-145) en Datos y precio para calcularla</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['descripcion_es', 'descripcion_en'] as const).map(k => (
            <label key={k} className="block">
              <span className="text-[11px] font-semibold text-zinc-500">Descripción {k.endsWith('es') ? 'en español' : 'en inglés'}</span>
              <textarea value={d[k]} onChange={e => setD(v => ({ ...v, [k]: e.target.value }))} maxLength={280} rows={3}
                placeholder={k.endsWith('es') ? 'Ligero y clásico, ideal para diario.' : 'Light and classic, made for every day.'}
                className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </label>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={guardar} disabled={guardando || !cambio}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-40">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar datos web
        </button>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>
    </section>
  )
}

// Las fotos del celular pesan 3–5 MB: se reducen a 1600 px y JPEG antes de subir (≈200–400 KB)
async function comprimirFoto(file: File, max = 1600, calidad = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith('image/') || file.size < 400_000) return file
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', calidad))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// ── Colores en la web ─────────────────────────────────────────
// Cada color puede tener su circulito (hex), hasta 3 fotos y mostrarse o no en la web.
// "Mostrar" aplica a Verly y GON; el switch del modelo (abajo) decide en qué página sale.
function ColoresWeb({ modelo: m, esAdmin, onChange, setMsg, portada, onPortada }: {
  modelo: Modelo; esAdmin: boolean; onChange: (m: Modelo) => void; setMsg: (s: string) => void
  portada: string | null; onPortada: (url: string | null) => void
}) {
  // Varias fotos pueden subirse al mismo tiempo: se lleva la cuenta de cada casilla que está subiendo
  const [subiendo, setSubiendo] = useState<Set<string>>(new Set())
  const marcar = (key: string, on: boolean) => setSubiendo(prev => { const n = new Set(prev); if (on) n.add(key); else n.delete(key); return n })
  const fileRef = useRef<HTMLInputElement>(null)
  const destino = useRef<{ colorId: number; campos: string[] } | null>(null)
  // Siempre la versión más reciente del modelo, para que una subida no borre la de otra que terminó antes
  const mRef = useRef(m); mRef.current = m

  const aplicar = (colorId: number, cambios: Record<string, unknown>) => {
    const cur = mRef.current
    const nuevo = { ...cur, colores: cur.colores.map(x => x.id === colorId ? { ...x, ...cambios } as Color : x) }
    mRef.current = nuevo
    onChange(nuevo)
  }

  const patchColor = async (c: Color, cambios: Record<string, unknown>) => {
    try {
      const j = await fetch('/api/inv/armazones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color_id: c.id, ...cambios }),
      }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      aplicar(c.id, j.color)
    } catch (e) { setMsg('No se pudo guardar el color: ' + (e instanceof Error ? e.message : '')) }
  }

  // Al tocar una casilla se pueden escoger VARIAS fotos: la primera va a esa casilla y las demás a las vacías que siguen
  const elegir = (color: Color, campo: string) => {
    const i = FOTOS_COLOR.indexOf(campo as typeof FOTOS_COLOR[number])
    const siguientes = FOTOS_COLOR.filter((f, k) => k > i && !color[f] && !subiendo.has(`${color.id}-${f}`))
    destino.current = { colorId: color.id, campos: [campo, ...siguientes] }
    fileRef.current?.click()
  }
  const subirUno = async (colorId: number, campo: string, file: File) => {
    const key = `${colorId}-${campo}`
    marcar(key, true)
    try {
      const fd = new FormData()
      fd.append('file', await comprimirFoto(file)); fd.append('campo', campo); fd.append('id', String(colorId)); fd.append('tabla', 'color')
      const j = await fetch('/api/ecomm/upload-foto', { method: 'POST', body: fd }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      aplicar(colorId, { [campo]: j.url })
    } catch (e) { setMsg('No se pudo subir: ' + (e instanceof Error ? e.message : '')) }
    finally { marcar(key, false) }
  }
  const subir = (files: File[]) => {
    const d = destino.current; if (!d) return
    setMsg('')
    files.slice(0, d.campos.length).forEach((f, k) => { void subirUno(d.colorId, d.campos[k], f) })
    if (files.length > d.campos.length) setMsg(`Solo caben ${d.campos.length} foto(s) más en ese color; las demás no se subieron.`)
  }
  const borrar = async (c: Color, campo: string, url: string) => {
    if (!confirm('¿Borrar esta foto?')) return
    const j = await fetch('/api/ecomm/upload-foto', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(c.id), campo, url, tabla: 'color' }),
    }).then(r => r.json())
    if (j.ok) { aplicar(c.id, { [campo]: null }); if (url === portada) onPortada(null) }
    else setMsg('No se pudo borrar: ' + j.error)
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-800 mb-1">Fotos por color</h3>
      <p className="text-[11px] text-zinc-400 mb-3">Sube las fotos de cada color (frente, lado, puesto). Puedes escoger las 3 de una vez y se suben al mismo tiempo. Marca con ⭐ la que sale de portada en el catálogo. El cliente ve un circulito por cada color visible.</p>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) subir(fs); e.target.value = '' }} />
      <div className="space-y-3">
        {m.colores.map(c => {
          const visible = !!(c.publicar_verly || c.publicar_gon)
          return (
            <div key={c.id} className={`border rounded-lg p-3 ${visible ? 'border-zinc-200' : 'border-dashed border-zinc-200 bg-zinc-50/60'}`}>
              <div className="flex items-center gap-3 mb-2">
                <label className={`relative w-7 h-7 rounded-full border border-zinc-300 shrink-0 overflow-hidden ${esAdmin ? 'cursor-pointer' : ''}`}
                  style={{ background: swatch(c.color, c.hex) }} title={esAdmin ? 'Elegir el color del circulito' : ''}>
                  {esAdmin && <SelectorHex valor={swatch(c.color, c.hex)} onElegir={hex => patchColor(c, { hex })} />}
                </label>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-800">{c.color}</div>
                  <div className="font-mono text-[11px] text-zinc-400">{c.sku} · {totColor(c)} pzas{!c.hex && ' · circulito automático'}</div>
                </div>
                {esAdmin && (
                  <button onClick={() => patchColor(c, { web: !visible })}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${visible ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-zinc-200 text-zinc-500'}`}>
                    {visible ? 'Visible en web' : 'Oculto'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FOTOS_COLOR.map((campo, i) => {
                  const url = c[campo]
                  const key = `${c.id}-${campo}`
                  return (
                    <div key={campo} className="relative aspect-[4/3] rounded-md border border-dashed border-zinc-300 bg-zinc-50 overflow-hidden group">
                      {subiendo.has(key) ? (
                        <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-4 h-4 text-teal-600 animate-spin" /></div>
                      ) : url ? (
                        <>
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => borrar(c, campo, url)}
                            className="absolute top-1 right-1 w-7 h-7 rounded-md bg-white/90 text-red-500 flex md:hidden md:group-hover:flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onPortada(url)} title="Usar como portada"
                            className={`absolute bottom-1 left-1 h-6 px-1.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${url === portada ? 'bg-amber-400 text-white' : 'bg-white/90 text-zinc-500 md:hidden md:group-hover:flex'}`}>
                            <Star className="w-3 h-3" fill={url === portada ? 'currentColor' : 'none'} />{url === portada ? 'Portada' : ''}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => elegir(c, campo)} className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-teal-600">
                          <Camera className="w-4 h-4" /><span className="text-[10px]">{i === 0 ? 'Foto principal' : 'Agregar'}</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {!portada && <p className="text-[11px] text-amber-600 mt-2">Sin portada: al publicar se usa la primera foto que haya.</p>}
    </section>
  )
}

// Selector de color nativo: guarda solo al cerrar el selector (evento 'change'), no mientras se arrastra
function SelectorHex({ valor, onElegir }: { valor: string; onElegir: (hex: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const cb = useRef(onElegir)
  useEffect(() => { cb.current = onElegir }, [onElegir])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const h = () => cb.current(el.value)
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [])
  return <input ref={ref} type="color" defaultValue={valor} className="absolute inset-0 opacity-0 cursor-pointer" />
}

function Campo({ label, value, onChange, disabled, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-zinc-500">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
    </label>
  )
}

function Switch({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between border border-zinc-200 rounded-lg px-3 py-2.5">
      <div><div className="text-sm font-semibold text-zinc-800">{label}</div><div className="text-[11px] text-zinc-400">{sub}</div></div>
      <button onClick={onClick} className={`w-10 h-6 rounded-full relative transition-colors ${on ? 'bg-teal-600' : 'bg-zinc-300'}`} aria-label={`Publicar en ${label}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

export default function Page() {
  return (
    <RequireRol roles={['administrador', 'gerente', 'web']}>
      <InventarioNuevo />
    </RequireRol>
  )
}
