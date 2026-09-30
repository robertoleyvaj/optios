'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Camera, Trash2, Save, Globe, Loader2, ImageOff } from 'lucide-react'
import RequireRol from '@/components/RequireRol'
import { getUsuarioLocal } from '@/lib/session'
import Entradas from './Entradas'
import Traspasos from './Traspasos'
import Catalogo from './Productos'

// ─────────────────────────────────────────────────────────────
// Inventario nuevo · Armazones (SKU por color)
// Vista previa: lee los modelos VRL-1xxx cargados "escondidos".
// El stock NO se edita aquí: cambia solo con entradas, traspasos,
// ventas y ajustes (todo queda en la bitácora).
// ─────────────────────────────────────────────────────────────

type Color = {
  id: number; armazon_id: number; sku: string; color: string
  stock_baja: number; stock_mayo: number; stock_plaza: number; stock_online: number; bodega: number; orden: number
}
type Modelo = {
  id: number; sku: string; sku_viejo?: string | null; marca: string; modelo: string; nombre: string | null
  medidas: string | null; material: string | null; precio_gon: number | null; precio: number | null
  costo: number | null; activo: boolean; publicar_gon: boolean; publicar_verly: boolean
  imagen_url: string | null; imagen2_url: string | null; imagen3_url: string | null
  imagen4_url: string | null; imagen5_url: string | null
  colores: Color[]
}
type Mov = { id: number; created_at: string; sku: string; sucursal: string; tipo: string; cantidad: number; referencia: string | null; usuario: string | null; notas: string | null }

const SUC = [
  { key: 'stock_baja' as const,  label: 'Baja Visión',    corto: 'Baja' },
  { key: 'stock_mayo' as const,  label: '5 de Mayo',      corto: 'Mayo' },
  { key: 'stock_plaza' as const, label: 'Plaza Laureles', corto: 'Plaza' },
  { key: 'bodega' as const,      label: 'Bodega',         corto: 'Bodega' },
]
const FOTOS = ['imagen_url', 'imagen2_url', 'imagen3_url', 'imagen4_url', 'imagen5_url'] as const
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
const fotos = (m: Modelo) => FOTOS.map(f => m[f]).filter(Boolean) as string[]

const SWATCH: [string, string][] = [
  ['NEGRO', '#1d1d1d'], ['BLANC', '#e8e8e8'], ['AZUL', '#2f4a8c'], ['ROJO', '#a83232'], ['ROSA', '#d46a90'],
  ['VERDE', '#3a7d4d'], ['GRIS', '#8a8a8a'], ['CAREY', '#6b4423'], ['CAFE', '#5a3a1e'], ['DORAD', '#c9a227'],
  ['PLATE', '#b8b8b8'], ['MORAD', '#6a3d9a'], ['LILA', '#b39ddb'], ['NARANJ', '#e07b2f'], ['GUINDA', '#722f37'],
  ['AMARIL', '#e6c229'], ['TRANSP', '#d8e4e8'], ['CREMA', '#efe3c8'],
]
const swatch = (n: string) => { const s = (n || '').toUpperCase(); for (const [k, v] of SWATCH) if (s.includes(k)) return v; return '#b0b0b0' }

function InventarioNuevo() {
  const esAdmin = getUsuarioLocal()?.rol === 'administrador'
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [marca, setMarca] = useState('')
  const [suc, setSuc] = useState('')
  const [filtro, setFiltro] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [tab, setTab] = useState<'armazones' | 'micas' | 'lc' | 'consumibles' | 'servicios'>('armazones')
  const [armVista, setArmVista] = useState<'lista' | 'entrada' | 'traspasos'>('lista')

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
      if (filtro === 'sinfoto' && fotos(m).length > 0) return false
      if (filtro === 'web' && !(m.publicar_gon || m.publicar_verly)) return false
      if (!t) return true
      return (`${m.marca} ${m.modelo} ${m.sku} ` + m.colores.map(c => `${c.color} ${c.sku}`).join(' ')).toLowerCase().includes(t)
    })
  }, [modelos, q, marca, suc, filtro])

  const totales = useMemo(() => SUC.map(s => lista.reduce((a, m) => a + totSuc(m, s.key), 0)), [lista])
  const sel = modelos.find(m => m.id === selId) ?? null
  const actualizar = (m: Modelo) => setModelos(prev => prev.map(x => x.id === m.id ? { ...x, ...m, colores: x.colores } : x))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Inventario</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Armazones por color, con SKU y existencias por sucursal.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
            Vista previa · todavía no está en uso
          </span>
          <a href="/dashboard/inventario"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 whitespace-nowrap">
            Inventario actual →
          </a>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {([['armazones', 'Armazones'], ['micas', 'Micas y tratamientos'], ['lc', 'Lentes de contacto'], ['consumibles', 'Consumibles'], ['servicios', 'Servicios']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setArmVista('lista') }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>{l}</button>
        ))}
      </div>

      {(tab === 'micas' || tab === 'lc' || tab === 'consumibles' || tab === 'servicios') && <Catalogo key={tab} seccion={tab} esAdmin={esAdmin} />}

      {tab === 'armazones' && armVista !== 'lista' && <>
        <button onClick={() => setArmVista('lista')} className="text-sm font-semibold text-teal-700 hover:underline">← Volver a armazones</button>
        {armVista === 'entrada' && <Entradas modelos={modelos} esAdmin={esAdmin} onDone={cargar} />}
        {armVista === 'traspasos' && <Traspasos modelos={modelos} puedeEnviar onDone={cargar} />}
      </>}

      {tab === 'armazones' && armVista === 'lista' && <>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setArmVista('entrada')} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50">+ Entrada de armazones</button>
          <button onClick={() => setArmVista('traspasos')} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50">⇄ Traspasos</button>
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
        ) : (
          <table className="w-full text-sm">
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
                const f = fotos(m)[0]; const tot = totModelo(m)
                return (
                  <tr key={m.id} onClick={() => setSelId(m.id)} className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer">
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
                      {!m.publicar_gon && !m.publicar_verly && <span className="text-zinc-300">–</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {lista.length > 300 && <div className="text-xs text-zinc-400 px-3 py-2">Mostrando 300 de {lista.length}. Usa el buscador para afinar.</div>}
      </div>

      </>}

      {sel && <Ficha modelo={sel} esAdmin={esAdmin} onClose={() => setSelId(null)} onChange={actualizar} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Ficha del armazón
// ─────────────────────────────────────────────────────────────
function Ficha({ modelo: m, esAdmin, onClose, onChange }: {
  modelo: Modelo; esAdmin: boolean; onClose: () => void; onChange: (m: Modelo) => void
}) {
  const [datos, setDatos] = useState({
    medidas: m.medidas ?? '', material: m.material ?? '',
    precio_gon: String(m.precio_gon ?? ''), precio: String(m.precio ?? ''), costo: String(m.costo ?? ''),
  })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [movs, setMovs] = useState<Mov[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const campoRef = useRef<string>('imagen_url')

  useEffect(() => {
    fetch(`/api/inv/movimientos?sku=${encodeURIComponent(m.sku)}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => setMovs(j.ok ? j.movimientos : [])).catch(() => setMovs([]))
  }, [m.sku])
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
  }

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      await patch({
        medidas: datos.medidas.trim() || null, material: datos.material.trim().toUpperCase() || null,
        precio_gon: datos.precio_gon ? Number(datos.precio_gon) : null,
        precio: datos.precio ? Number(datos.precio) : null,
        costo: datos.costo ? Number(datos.costo) : null,
      })
      setMsg('Guardado')
    } catch (e) { setMsg('No se pudo guardar: ' + (e instanceof Error ? e.message : '')) }
    finally { setGuardando(false) }
  }

  const togglePub = async (campo: 'publicar_gon' | 'publicar_verly') => {
    if (!m[campo] && fotos(m).length === 0) { setMsg('Sube al menos una foto antes de publicar'); return }
    try { await patch({ [campo]: !m[campo] }) } catch (e) { setMsg('Error: ' + (e instanceof Error ? e.message : '')) }
  }

  const elegirFoto = (campo: string) => { campoRef.current = campo; fileRef.current?.click() }
  const subirFoto = async (file: File) => {
    const campo = campoRef.current
    setSubiendo(campo); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('campo', campo); fd.append('id', String(m.id))
      const j = await fetch('/api/ecomm/upload-foto', { method: 'POST', body: fd }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      onChange({ ...m, [campo]: j.url })
    } catch (e) { setMsg('No se pudo subir: ' + (e instanceof Error ? e.message : '')) }
    finally { setSubiendo(null) }
  }
  const borrarFoto = async (campo: string, url: string) => {
    if (!confirm('¿Borrar esta foto?')) return
    const j = await fetch('/api/ecomm/upload-foto', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(m.id), campo, url }),
    }).then(r => r.json())
    if (j.ok) onChange({ ...m, [campo]: null })
    else setMsg('No se pudo borrar: ' + j.error)
  }

  const tot = totModelo(m)
  const margen = num(m.precio_gon) && num(m.costo) ? Math.round((1 - num(m.costo) / num(m.precio_gon)) * 100) : null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-zinc-50 w-full max-w-2xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-white border-b border-zinc-200 px-5 py-4 sticky top-0 z-10 flex items-start gap-3">
          <div className="flex-1">
            <div className="text-lg font-semibold text-zinc-900">{m.marca} {m.modelo}</div>
            <div className="font-mono text-xs text-zinc-400">{m.sku} · {m.medidas} · {m.material} · {tot} piezas</div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {msg && <div className="text-xs px-3 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600">{msg}</div>}

          {/* Fotos */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Fotos</h3>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = '' }} />
            <div className="grid grid-cols-5 gap-2">
              {FOTOS.map((campo, i) => {
                const url = m[campo]
                return (
                  <div key={campo} className="relative aspect-[4/3] rounded-lg border border-dashed border-zinc-300 bg-zinc-50 overflow-hidden group">
                    {subiendo === campo ? (
                      <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-teal-600 animate-spin" /></div>
                    ) : url ? (
                      <>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => borrarFoto(campo, url)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 text-red-500 hidden group-hover:flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-white/90 text-zinc-600">Portada</span>}
                      </>
                    ) : (
                      <button onClick={() => elegirFoto(campo)} className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-teal-600">
                        <Camera className="w-4 h-4" /><span className="text-[10px]">{i === 0 ? 'Portada' : 'Agregar'}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Colores y existencias */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Colores y existencias</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-zinc-200">
                  <th className="text-left font-semibold py-1.5">Color</th>
                  <th className="text-left font-semibold py-1.5">SKU</th>
                  {SUC.map(s => <th key={s.key} className="text-right font-semibold py-1.5">{s.corto}</th>)}
                  <th className="text-right font-semibold py-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {m.colores.map(c => (
                  <tr key={c.id} className="border-b border-zinc-100">
                    <td className="py-2"><span className="inline-block w-3 h-3 rounded-full border border-zinc-200 mr-2 align-[-1px]" style={{ background: swatch(c.color) }} />{c.color}</td>
                    <td className="py-2 font-mono text-[11px] text-zinc-500">{c.sku}</td>
                    {SUC.map(s => <td key={s.key} className={`py-2 text-right tabular-nums ${num(c[s.key]) ? '' : 'text-zinc-300'}`}>{num(c[s.key]) || '–'}</td>)}
                    <td className="py-2 text-right tabular-nums font-semibold">{totColor(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-zinc-400 mt-2">Las existencias solo cambian con entradas, traspasos, ventas o ajustes, y todo queda registrado.</p>
          </section>

          {/* Datos y precio */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Datos y precio</h3>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Medidas" value={datos.medidas} onChange={v => setDatos(d => ({ ...d, medidas: v }))} disabled={!esAdmin} />
              <Campo label="Material" value={datos.material} onChange={v => setDatos(d => ({ ...d, material: v }))} disabled={!esAdmin} />
              <Campo label="Precio tienda y GON (MXN)" value={datos.precio_gon} onChange={v => setDatos(d => ({ ...d, precio_gon: v }))} disabled={!esAdmin} type="number" />
              <Campo label="Precio Verly (USD)" value={datos.precio} onChange={v => setDatos(d => ({ ...d, precio: v }))} disabled={!esAdmin} type="number" />
              {esAdmin && <Campo label={`Costo${margen != null ? ` · margen ${margen}%` : ''}`} value={datos.costo} onChange={v => setDatos(d => ({ ...d, costo: v }))} type="number" />}
            </div>
            {esAdmin && (
              <button onClick={guardar} disabled={guardando}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-50">
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cambios
              </button>
            )}
          </section>

          {/* Publicar */}
          {esAdmin && (
            <section className="bg-white border border-zinc-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-zinc-400" /> Publicar en línea</h3>
              <div className="space-y-2">
                <Switch label="GON" sub="gonmx.com · precio en pesos" on={m.publicar_gon} onClick={() => togglePub('publicar_gon')} />
                <Switch label="Verly" sub="Precio en dólares" on={m.publicar_verly} onClick={() => togglePub('publicar_verly')} />
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                {m.activo ? 'Si el stock llega a 0 se oculta solo de la web.' : 'Se verá en la web hasta el día del cambio; por ahora solo queda marcado.'}
              </p>
            </section>
          )}

          {/* Movimientos */}
          <section className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Movimientos</h3>
            {movs === null ? <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
              : movs.length === 0 ? <p className="text-xs text-zinc-400">Sin movimientos todavía.</p>
              : (
                <div className="space-y-1.5">
                  {movs.map(v => (
                    <div key={v.id} className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-400 w-28 shrink-0">{new Date(v.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${TIPO[v.tipo]?.cls ?? 'bg-zinc-100'}`}>{TIPO[v.tipo]?.label ?? v.tipo}</span>
                      <span className="text-zinc-600">{v.sucursal}</span>
                      <span className="font-mono text-zinc-400">{v.sku}</span>
                      <span className={`ml-auto font-semibold ${v.cantidad < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{v.cantidad > 0 ? '+' : ''}{v.cantidad}</span>
                      <span className="text-zinc-400 w-28 truncate text-right">{[v.referencia, v.usuario].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              )}
          </section>
        </div>
      </div>
    </div>
  )
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
    <RequireRol roles={['administrador', 'gerente']}>
      <InventarioNuevo />
    </RequireRol>
  )
}
