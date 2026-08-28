'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Globe, Check, Plus, Minus, X, Save } from 'lucide-react'
import RequireRol from '@/components/RequireRol'

const TC = 17
const num = (v: unknown) => Number(v ?? 0)

type Armazon = {
  id: number; sku: string | null; nombre: string; marca: string; modelo: string | null
  medidas: string | null; material: string | null; precio_gon: number | null; costo: number | null
}
type Color = {
  id?: number; armazon_id?: number; color: string
  stock_baja: number; stock_mayo: number; stock_plaza: number; stock_online: number
  publicar_gon: boolean; publicar_verly: boolean
}

const tot = (c: Color) => num(c.stock_baja) + num(c.stock_mayo) + num(c.stock_plaza) + num(c.stock_online)
const totM = (cs: Color[]) => cs.reduce((s, c) => s + tot(c), 0)
const enWeb = (cs: Color[]) => cs.some(c => c.publicar_gon || c.publicar_verly)

// Color de muestra a partir del nombre (para el puntito)
const swatch = (n: string): string => {
  const s = (n || '').toUpperCase()
  const map: [string, string][] = [
    ['NEGRO', '#1d1d1d'], ['BLANC', '#e8e8e8'], ['AZUL', '#2f4a8c'], ['ROJO', '#a83232'],
    ['ROSA', '#d46a90'], ['VERDE', '#3a7d4d'], ['GRIS', '#8a8a8a'], ['CAFE', '#5a3a1e'],
    ['CAREY', '#6b4423'], ['DORAD', '#c9a227'], ['PLATE', '#b8b8b8'], ['MORAD', '#6a3d9a'],
    ['LILA', '#b39ddb'], ['NARANJ', '#e07b2f'], ['VINO', '#722f37'], ['AMARIL', '#e6c229'],
    ['TRANSP', '#d8e4e8'], ['CRISTAL', '#d8e4e8'], ['BRONCE', '#8c6239'], ['GUINDA', '#722f37'],
  ]
  for (const [k, v] of map) if (s.includes(k)) return v
  return '#b0b0b0'
}

function ArmazonesInventario() {
  const [lista, setLista] = useState<Armazon[]>([])
  const [colores, setColores] = useState<Record<number, Color[]>>({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [colorSel, setColorSel] = useState(0)
  const [edit, setEdit] = useState<Color[]>([])
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    const [aRes, cRes] = await Promise.all([
      fetch('/api/ecomm/armazones', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false })),
      fetch('/api/ecomm/armazon-colores?all=1', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false })),
    ])
    const arms: Armazon[] = (aRes?.ok ? aRes.armazones : []).filter((a: Armazon) => a.sku)
    const map: Record<number, Color[]> = {}
    if (cRes?.ok) for (const c of cRes.colores as Color[]) {
      const id = c.armazon_id as number
      ;(map[id] ??= []).push({
        color: c.color, stock_baja: num(c.stock_baja), stock_mayo: num(c.stock_mayo),
        stock_plaza: num(c.stock_plaza), stock_online: num(c.stock_online),
        publicar_gon: !!c.publicar_gon, publicar_verly: !!c.publicar_verly,
      })
    }
    setLista(arms); setColores(map); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const abrir = (a: Armazon) => {
    setSelId(a.id); setColorSel(0)
    setEdit((colores[a.id] ?? []).map(c => ({ ...c })))
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(a =>
      (a.marca + ' ' + a.modelo + ' ' + a.nombre + ' ' + a.sku).toLowerCase().includes(q))
  }, [lista, busqueda])

  const sel = lista.find(a => a.id === selId) || null

  const setColor = (i: number, campo: 'color', val: string) =>
    setEdit(prev => prev.map((c, idx) => idx === i ? { ...c, color: val.toUpperCase() } : c))
  const bump = (i: number, campo: 'stock_baja' | 'stock_mayo' | 'stock_plaza', d: number) =>
    setEdit(prev => prev.map((c, idx) => idx === i ? { ...c, [campo]: Math.max(0, num(c[campo]) + d) } : c))
  const togglePub = (i: number, campo: 'publicar_gon' | 'publicar_verly') =>
    setEdit(prev => prev.map((c, idx) => idx === i ? { ...c, [campo]: !c[campo] } : c))
  const addColor = () => { setEdit(prev => [...prev, { color: '', stock_baja: 0, stock_mayo: 0, stock_plaza: 0, stock_online: 0, publicar_gon: false, publicar_verly: false }]); setColorSel(edit.length) }
  const delColor = (i: number) => { setEdit(prev => prev.filter((_, idx) => idx !== i)); setColorSel(s => Math.max(0, s > i ? s - 1 : s)) }

  const guardar = async () => {
    if (!sel || guardando) return
    setGuardando(true)
    try {
      const sb = edit.reduce((s, c) => s + num(c.stock_baja), 0)
      const sm = edit.reduce((s, c) => s + num(c.stock_mayo), 0)
      const sp = edit.reduce((s, c) => s + num(c.stock_plaza), 0)
      const so = edit.reduce((s, c) => s + num(c.stock_online), 0)
      await fetch('/api/ecomm/armazones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sel.id, stock_baja: sb, stock_mayo: sm, stock_plaza: sp, stock_online: so, stock: sb + sm + sp + so }),
      })
      const rc = await fetch('/api/ecomm/armazon-colores', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ armazon_id: sel.id, colores: edit }),
      })
      const jc = await rc.json()
      if (!jc.ok) throw new Error(jc.error || 'Error')
      setColores(prev => ({ ...prev, [sel.id]: edit.map(c => ({ ...c })) }))
      setSelId(null)
    } catch (e) {
      alert('No se pudo guardar: ' + (e instanceof Error ? e.message : ''))
    } finally { setGuardando(false) }
  }

  const c = edit[colorSel]

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Armazones</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Cada modelo con sus colores, existencias por sucursal y publicación.</p>
      </div>

      <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-3 py-2.5">
        <Search className="w-4 h-4 text-zinc-400" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar modelo, SKU o marca…"
          className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-zinc-400" />
        <span className="text-xs text-zinc-400">{filtradas.length}</span>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Sin resultados.</div>
        ) : filtradas.slice(0, 300).map(a => {
          const cs = colores[a.id] ?? []
          return (
            <button key={a.id} onClick={() => abrir(a)}
              className="w-full flex items-center gap-4 px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 text-left transition-colors">
              <span className="font-mono text-xs text-zinc-400 w-20 shrink-0">{a.sku}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-800 truncate">{a.marca} {a.modelo || a.nombre}</div>
                <div className="text-xs text-zinc-400">{a.medidas || '—'}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {cs.slice(0, 6).map((x, i) => (
                  <span key={i} title={x.color} className="w-3 h-3 rounded-full border border-zinc-200" style={{ background: swatch(x.color) }} />
                ))}
              </div>
              <span className="text-xs text-zinc-500 w-16 text-right shrink-0">{totM(cs)} pzas</span>
              <span className="w-16 text-right shrink-0">
                {enWeb(cs)
                  ? <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">En web</span>
                  : <span className="text-[11px] text-zinc-300">—</span>}
              </span>
            </button>
          )
        })}
      </div>

      {sel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !guardando && setSelId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold text-zinc-900">{sel.marca} {sel.modelo}</span>
                  <span className="font-mono text-xs text-zinc-400">{sel.sku}</span>
                </div>
                <div className="text-xs text-zinc-500">{sel.medidas} · {totM(edit)} piezas · ${num(sel.precio_gon).toLocaleString('es-MX')} MXN</div>
              </div>
              <button onClick={() => setSelId(null)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {edit.map((x, i) => (
                  <button key={i} onClick={() => setColorSel(i)}
                    className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors ${i === colorSel ? 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/40' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}>
                    <span className="w-3 h-3 rounded-full border border-zinc-200" style={{ background: swatch(x.color) }} />
                    {x.color || 'Nuevo'} <span className="opacity-60">{tot(x)}</span>
                  </button>
                ))}
                <button onClick={addColor} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border border-dashed border-zinc-300 text-zinc-500 hover:bg-zinc-50">
                  <Plus className="w-3.5 h-3.5" /> Color
                </button>
              </div>

              {c ? (
                <div className="bg-zinc-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <input value={c.color} onChange={e => setColor(colorSel, 'color', e.target.value)} placeholder="NOMBRE DEL COLOR"
                      className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm uppercase bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                    <button onClick={() => delColor(colorSel)} className="text-xs text-red-500 hover:underline px-2">Quitar</button>
                  </div>

                  <p className="text-xs text-zinc-500 mb-2">Existencias por sucursal</p>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {([['stock_baja', 'Baja Visión'], ['stock_mayo', '5 de Mayo'], ['stock_plaza', 'Plaza Laureles']] as const).map(([campo, lbl]) => (
                      <div key={campo} className="text-center">
                        <div className="text-[11px] text-zinc-500 mb-1.5">{lbl}</div>
                        <div className="flex items-center justify-center gap-2 bg-white border border-zinc-200 rounded-lg py-1.5">
                          <button onClick={() => bump(colorSel, campo, -1)} className="text-zinc-400 hover:text-zinc-700"><Minus className="w-4 h-4" /></button>
                          <span className="text-base font-semibold text-zinc-800 min-w-[20px]">{num(c[campo])}</span>
                          <button onClick={() => bump(colorSel, campo, 1)} className="text-zinc-400 hover:text-zinc-700"><Plus className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-zinc-500 mb-2">Publicar este color</p>
                  <div className="flex gap-2 mb-1">
                    <button onClick={() => togglePub(colorSel, 'publicar_verly')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium ${c.publicar_verly ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                      <Globe className="w-4 h-4" /> Verly {c.publicar_verly && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => togglePub(colorSel, 'publicar_gon')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium ${c.publicar_gon ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                      <Globe className="w-4 h-4" /> GON {c.publicar_gon && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-3">Las fotos por color se agregan en el siguiente paso.</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-6">Agrega un color para empezar.</p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-zinc-100 flex gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setSelId(null)} className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-semibold hover:bg-zinc-100">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0D9488] text-white rounded-lg text-sm font-bold hover:bg-teal-600 disabled:opacity-50">
                <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArmazonesInventarioProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <ArmazonesInventario />
    </RequireRol>
  )
}
