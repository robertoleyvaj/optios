'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Trash2, Loader2, CheckCircle2, PackagePlus, RefreshCw, Tag, AlertTriangle, X } from 'lucide-react'
import { GAMAS, precioInteligente, precioVerlyUSD, type Gama, type Rango } from '@/lib/precio-gama'

// ─────────────────────────────────────────────────────────────
// Entrada de armazones
// 1) Busca el modelo. Si existe: pones cuántas piezas llegaron de cada color (o agregas colores).
//    Si no existe: lo das de alta (marca de la lista, modelo, medidas, material, gama) con todos sus colores.
// 2) Todo entra a Bodega (se puede cambiar) y las etiquetas se van a la cola para imprimir juntas.
// El precio lo pone la gama de la marca; nadie lo inventa.
// ─────────────────────────────────────────────────────────────

type Color = { id: number; sku: string; color: string }
type Modelo = { id: number; sku: string; marca: string; modelo: string; medidas: string | null; material: string | null; precio_gon: number | null; colores: Color[] }
type Linea = {
  key: string; texto: string; sku: string; cantidad: number
  item: { cantidad: number; color_id?: number; armazon_id?: number; color?: string; nuevo?: Record<string, unknown> }
}
type Resultado = { sku: string; marca: string; modelo: string; color: string; precio: number; cantidad: number; nuevo: boolean }
type Catalogos = { marcas: { nombre: string; grupo: string }[]; gamas: Rango[]; colores: string[]; tipoCambio: number | null }
type FilaColor = { key: string; nombre: string; cant: string }

const UBIC = [
  { v: 'bodega', label: 'Bodega' }, { v: 'baja', label: 'Baja Visión' },
  { v: 'mayo', label: '5 de Mayo' }, { v: 'plaza', label: 'Plaza Laureles' },
]
const MATERIALES = ['METAL', 'TR90', 'ACETATO', 'B-ULTEM', 'ACETATO/METAL', 'TITANIO']
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
const up = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')
const fila = (): FilaColor => ({ key: crypto.randomUUID(), nombre: '', cant: '1' })
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')

// Distancia de edición corta (para avisar de modelos casi iguales: SM2501 vs SM-2501 vs SM2510)
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

export default function Entradas({ modelos, esAdmin, onDone, onVerEtiquetas }: {
  modelos: Modelo[]; esAdmin: boolean; onDone: () => void; onVerEtiquetas: () => void
}) {
  const [cat, setCat] = useState<Catalogos | null>(null)
  const [ubic, setUbic] = useState('bodega')
  const [ref, setRef] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Modelo | null>(null)
  const [cantExist, setCantExist] = useState<Record<number, string>>({})
  const [filasNuevas, setFilasNuevas] = useState<FilaColor[]>([])
  const [modoNuevo, setModoNuevo] = useState(false)
  const [nm, setNm] = useState({ marca: '', modelo: '', mica: '', puente: '', varilla: '', material: 'METAL', gama: 'estandar' as Gama, disenador: false })
  const [semilla, setSemilla] = useState(0)                        // "Otro precio" cambia la semilla
  const [precioManual, setPrecioManual] = useState<number | null>(null)  // solo admin
  const [coloresNm, setColoresNm] = useState<FilaColor[]>([fila()])
  const [confirmaParecido, setConfirmaParecido] = useState(false)
  const [err, setErr] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState<Resultado[] | null>(null)

  useEffect(() => {
    fetch('/api/inv/catalogos', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (j.ok) setCat({ marcas: j.marcas, gamas: j.gamas, colores: j.colores, tipoCambio: j.tipoCambio }) })
      .catch(() => {})
  }, [])

  // ── Búsqueda de modelos existentes
  const sugerencias = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    const tn = norm(t)
    return modelos.filter(m => (`${m.marca} ${m.modelo} ${m.sku} ` + m.colores.map(c => c.sku).join(' ')).toLowerCase().includes(t)
      || norm(`${m.marca}${m.modelo}`).includes(tn) || norm(m.modelo).includes(tn)).slice(0, 8)
  }, [q, modelos])

  const elegir = (m: Modelo) => {
    setSel(m); setQ(''); setErr(''); setModoNuevo(false)
    const exacto = m.colores.find(c => c.sku.toLowerCase() === q.trim().toLowerCase())
    setCantExist(exacto ? { [exacto.id]: '1' } : m.colores.length === 1 ? { [m.colores[0].id]: '1' } : {})
    setFilasNuevas([])
  }

  // ── Modelo nuevo: marca, grupo y rango de precio
  const marcaUp = up(nm.marca)
  const marcaLista = cat?.marcas.find(m => m.nombre === marcaUp)
  const grupo = marcaLista?.grupo ?? (nm.disenador ? 'DISEÑADOR' : 'OTRAS')
  const rango = cat?.gamas.find(r => r.grupo === grupo && r.gama === nm.gama) ?? null
  // Precio sugerido dentro del rango: estable mientras no cambie modelo/gama/semilla
  const azar = (() => { let h = 7 + semilla * 131; for (const ch of `${up(nm.modelo)}|${grupo}|${nm.gama}`) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h / 100003 })()
  const precio = precioManual ?? (rango ? precioInteligente(rango.min, rango.max, azar) : null)
  const usd = precioVerlyUSD(precio, cat?.tipoCambio)

  // ¿Ya existe o se parece a otro?
  const modeloUp = up(nm.modelo)
  const igual = modelos.find(m => norm(m.marca) === norm(marcaUp) && norm(m.modelo) === norm(modeloUp))
  const parecido = !igual && modeloUp.length >= 3
    ? modelos.find(m => norm(m.marca) === norm(marcaUp) && distancia(norm(m.modelo), norm(modeloUp)) <= 1)
    : undefined

  const nuevoModelo = (texto = '') => {
    setModoNuevo(true); setSel(null); setErr(''); setConfirmaParecido(false)
    setNm(v => ({ ...v, modelo: texto.toUpperCase(), marca: '', mica: '', puente: '', varilla: '', disenador: false }))
    setColoresNm([fila()])
  }

  const agregar = () => {
    setErr('')
    if (modoNuevo) {
      if (!marcaUp || !modeloUp) { setErr('Falta marca o modelo'); return }
      if (igual) { setErr(`${igual.marca} ${igual.modelo} ya existe (${igual.sku}). Búscalo arriba y suma piezas.`); return }
      if (parecido && !confirmaParecido) { setErr(`Se parece a ${parecido.marca} ${parecido.modelo} (${parecido.sku}). Revisa si es el mismo.`); return }
      if (!nm.mica || !nm.puente) { setErr('Pon las medidas: mica y puente (están impresas en la varilla)'); return }
      if (!precio) { setErr('Elige la gama para poner el precio'); return }
      const cols = coloresNm.map(c => ({ ...c, nombre: up(c.nombre), n: parseInt(c.cant) })).filter(c => c.nombre)
      if (!cols.length) { setErr('Agrega al menos un color'); return }
      if (cols.some(c => !c.n || c.n < 1)) { setErr('Pon cuántas piezas llegaron de cada color'); return }
      if (new Set(cols.map(c => c.nombre)).size !== cols.length) { setErr('Hay un color repetido'); return }
      const medidas = [nm.mica, nm.puente, nm.varilla].filter(Boolean).join('-')
      const nuevo = { marca: marcaUp, modelo: modeloUp, medidas, material: nm.material, gama: nm.gama, precio_gon: precio, disenador: !marcaLista && nm.disenador }
      setLineas(l => [...l, ...cols.map(c => ({
        key: crypto.randomUUID(), texto: `${marcaUp} ${modeloUp} · ${c.nombre}`, sku: `Nuevo · ${$(precio)}`, cantidad: c.n,
        item: { cantidad: c.n, color: c.nombre, nuevo },
      }))])
      setModoNuevo(false); setColoresNm([fila()]); setNm(v => ({ ...v, marca: '', modelo: '', mica: '', puente: '', varilla: '' }))
      return
    }
    if (!sel) { setErr('Busca y elige el modelo'); return }
    const nuevas: Linea[] = []
    for (const c of sel.colores) {
      const n = parseInt(cantExist[c.id] ?? '')
      if (n > 0) nuevas.push({ key: crypto.randomUUID(), texto: `${sel.marca} ${sel.modelo} · ${c.color}`, sku: c.sku, cantidad: n, item: { cantidad: n, color_id: c.id } })
    }
    for (const f of filasNuevas) {
      const nombre = up(f.nombre), n = parseInt(f.cant)
      if (!nombre) continue
      if (!n || n < 1) { setErr(`Pon las piezas de ${nombre}`); return }
      if (sel.colores.some(c => up(c.color) === nombre)) { setErr(`${nombre} ya existe en este modelo: pon las piezas en su renglón`); return }
      nuevas.push({ key: crypto.randomUUID(), texto: `${sel.marca} ${sel.modelo} · ${nombre}`, sku: 'Color nuevo', cantidad: n, item: { cantidad: n, armazon_id: sel.id, color: nombre } })
    }
    if (!nuevas.length) { setErr('Pon cuántas piezas llegaron de al menos un color'); return }
    setLineas(l => [...l, ...nuevas])
    setSel(null); setCantExist({}); setFilasNuevas([])
  }

  const guardar = async () => {
    if (!lineas.length) { setErr('Agrega al menos un armazón'); return }
    setGuardando(true); setErr('')
    try {
      const j = await fetch('/api/inv/entradas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ubicacion: ubic, referencia: ref, items: lineas.map(l => l.item) }),
      }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      setHecho(j.entradas); setLineas([]); setRef(''); onDone()
    } catch (e) { setErr('No se pudo guardar: ' + (e instanceof Error ? e.message : '')) }
    finally { setGuardando(false) }
  }

  const totalPzas = lineas.reduce((s, l) => s + l.cantidad, 0)
  const ubicLabel = UBIC.find(u => u.v === ubic)?.label

  if (hecho) {
    const pzas = hecho.reduce((s, r) => s + r.cantidad, 0)
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6 max-w-2xl">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="w-5 h-5" /> Entrada guardada en {ubicLabel}</div>
        <p className="text-sm text-zinc-500 mt-1">{pzas} piezas. Ya están en el inventario y en la bitácora. Sus {pzas} etiquetas se agregaron a la cola para imprimir.</p>
        <table className="w-full text-sm mt-4">
          <tbody>
            {hecho.map((r, i) => (
              <tr key={r.sku + i} className="border-b border-zinc-100">
                <td className="py-2 font-mono text-xs text-zinc-500">{r.sku}</td>
                <td className="py-2">{r.marca} {r.modelo} · {r.color} {r.nuevo && <span className="text-[11px] ml-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">nuevo</span>}</td>
                <td className="py-2 text-right text-zinc-500">{$(r.precio)}</td>
                <td className="py-2 text-right">{r.cantidad} pzas</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 mt-5">
          <button onClick={() => setHecho(null)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27]">
            <Plus className="w-4 h-4" /> Otra entrada
          </button>
          <button onClick={onVerEtiquetas} className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50">
            <Tag className="w-4 h-4" /> Ver etiquetas por imprimir
          </button>
        </div>
      </div>
    )
  }

  const inputCls = 'mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
      <datalist id="lista-colores">{cat?.colores.slice(0, 300).map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="lista-marcas">{cat?.marcas.map(m => <option key={m.nombre} value={m.nombre} />)}</datalist>

      <div className="space-y-4">
        {/* Buscar */}
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">¿Qué armazón llegó?</h3>
          {!sel && !modoNuevo && (
            <div className="relative">
              <div className="flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2.5">
                <Search className="w-4 h-4 text-zinc-400" />
                <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Escribe marca o modelo (ej. SEIMA 2501)…" className="flex-1 text-sm focus:outline-none" />
              </div>
              {sugerencias.length > 0 && (
                <div className="mt-1 bg-white border border-zinc-200 rounded-lg overflow-hidden">
                  {sugerencias.map(m => (
                    <button key={m.id} onClick={() => elegir(m)} className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-zinc-800">{m.marca} {m.modelo}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">{m.sku} · {m.medidas} · {m.colores.length} colores</div>
                      </div>
                      <span className="text-xs font-semibold text-teal-700">Ya existe · sumar piezas</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                {q.trim().length >= 2 && sugerencias.length === 0 && <span>No existe todavía.</span>}
                <button onClick={() => nuevoModelo(q.trim())} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Dar de alta un modelo nuevo
                </button>
              </div>
            </div>
          )}

          {/* Modelo existente: piezas por color */}
          {sel && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                <div><div className="text-sm font-semibold">{sel.marca} {sel.modelo}</div><div className="text-[11px] text-zinc-400 font-mono">{sel.sku} · {sel.medidas} · {sel.material} · {$(Number(sel.precio_gon) || 0)}</div></div>
                <button onClick={() => setSel(null)} className="text-xs text-zinc-500 hover:underline">Cambiar</button>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-500 mb-1">¿Cuántas piezas llegaron de cada color?</div>
                <div className="space-y-1.5">
                  {sel.colores.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="flex-1 text-sm">{c.color} <span className="font-mono text-[11px] text-zinc-400">{c.sku}</span></div>
                      <input type="number" min={0} value={cantExist[c.id] ?? ''} placeholder="0" onChange={e => setCantExist(v => ({ ...v, [c.id]: e.target.value }))}
                        className="w-20 border border-zinc-200 rounded-lg px-2 py-1.5 text-sm text-right" aria-label={`Piezas ${c.color}`} />
                    </div>
                  ))}
                  {filasNuevas.map(f => (
                    <div key={f.key} className="flex items-center gap-2">
                      <input list="lista-colores" value={f.nombre} onChange={e => setFilasNuevas(v => v.map(x => x.key === f.key ? { ...x, nombre: e.target.value } : x))}
                        placeholder="Color nuevo, ej. NEGRO MATE" className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm" />
                      <input type="number" min={1} value={f.cant} onChange={e => setFilasNuevas(v => v.map(x => x.key === f.key ? { ...x, cant: e.target.value } : x))}
                        className="w-20 border border-zinc-200 rounded-lg px-2 py-1.5 text-sm text-right" aria-label="Piezas" />
                      <button onClick={() => setFilasNuevas(v => v.filter(x => x.key !== f.key))} className="text-zinc-300 hover:text-red-500" aria-label="Quitar"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFilasNuevas(v => [...v, fila()])} className="mt-2 text-xs font-semibold text-teal-700 hover:underline">+ Llegó un color que no está</button>
              </div>
            </div>
          )}

          {/* Modelo nuevo */}
          {modoNuevo && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Modelo nuevo</span>
                <button onClick={() => setModoNuevo(false)} className="text-xs text-zinc-500 hover:underline">← Buscar uno que ya existe</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Marca</span>
                  <input list="lista-marcas" value={nm.marca} onChange={e => setNm(v => ({ ...v, marca: e.target.value }))} placeholder="Elige de la lista" className={inputCls} />
                  {marcaUp && !marcaLista && (
                    <label className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-700">
                      <input type="checkbox" checked={nm.disenador} onChange={e => setNm(v => ({ ...v, disenador: e.target.checked }))} />
                      Marca nueva · ¿es de diseñador (Guess, Ray-Ban…)?
                    </label>
                  )}
                </label>
                <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Modelo</span>
                  <input value={nm.modelo} onChange={e => { setNm(v => ({ ...v, modelo: e.target.value })); setConfirmaParecido(false) }} placeholder="SM2501" className={inputCls} />
                </label>
              </div>

              {igual && (
                <div className="flex items-center justify-between gap-2 text-xs bg-red-50 text-red-700 rounded-lg px-3 py-2">
                  <span><AlertTriangle className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{igual.marca} {igual.modelo} ya existe ({igual.sku}).</span>
                  <button onClick={() => elegir(igual)} className="font-semibold underline">Sumar piezas a ese</button>
                </div>
              )}
              {parecido && (
                <div className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 space-y-1">
                  <div><AlertTriangle className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Se parece a <b>{parecido.marca} {parecido.modelo}</b> ({parecido.sku}). ¿Es el mismo?</div>
                  <div className="flex gap-3">
                    <button onClick={() => elegir(parecido)} className="font-semibold underline">Sí, usar ese</button>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={confirmaParecido} onChange={e => setConfirmaParecido(e.target.checked)} /> No, es otro modelo</label>
                  </div>
                </div>
              )}

              <div>
                <span className="text-[11px] font-semibold text-zinc-500">Medidas (vienen impresas en la varilla)</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([['mica', 'Mica', '52'], ['puente', 'Puente', '18'], ['varilla', 'Varilla', '145']] as const).map(([k, l, ph]) => (
                    <label key={k} className="block">
                      <input type="number" value={nm[k]} onChange={e => setNm(v => ({ ...v, [k]: e.target.value }))} placeholder={ph} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm text-center" />
                      <span className="block text-center text-[10px] text-zinc-400 mt-0.5">{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-zinc-500">Material</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {MATERIALES.map(m => (
                    <button key={m} type="button" onClick={() => setNm(v => ({ ...v, material: m }))}
                      className={`px-3 py-1.5 rounded-full text-xs border ${nm.material === m ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400'}`}>{m}</button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-zinc-500">Gama · ¿qué tan bonito/fino está?</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {GAMAS.map(gm => {
                    const r = cat?.gamas.find(x => x.grupo === grupo && x.gama === gm.v)
                    return (
                      <button key={gm.v} type="button" onClick={() => { setNm(v => ({ ...v, gama: gm.v })); setPrecioManual(null) }}
                        className={`rounded-lg border px-3 py-2 text-left ${nm.gama === gm.v ? 'border-teal-600 bg-teal-50' : 'border-zinc-200 bg-white hover:border-zinc-400'}`}>
                        <div className="text-sm font-semibold text-zinc-800">{gm.label}</div>
                        <div className="text-[11px] text-zinc-500">{r ? `${$(r.min)} – ${$(r.max)}` : '—'}</div>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2 bg-zinc-50 rounded-lg px-3 py-2">
                  <div className="text-sm">
                    Precio: {esAdmin
                      ? <input type="number" value={precio ?? ''} onChange={e => setPrecioManual(Number(e.target.value) || null)} className="w-24 border border-zinc-200 rounded-md px-2 py-0.5 text-sm font-semibold" />
                      : <b>{precio ? $(precio) : '—'}</b>}
                    <span className="text-zinc-400 mx-2">·</span>Verly <b>{usd ? `$${usd} USD` : '—'}</b>
                  </div>
                  <button type="button" onClick={() => { setPrecioManual(null); setSemilla(x => x + 1) }} className="ml-auto text-xs font-semibold text-teal-700 inline-flex items-center gap-1 hover:underline">
                    <RefreshCw className="w-3.5 h-3.5" /> Otro precio
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">Grupo de precio: {grupo}{!cat?.tipoCambio && ' · sin tipo de cambio en Ajustes, Verly se calcula después'}</p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-zinc-500">Colores que llegaron</span>
                <div className="space-y-1.5 mt-1">
                  {coloresNm.map(f => (
                    <div key={f.key} className="flex items-center gap-2">
                      <input list="lista-colores" value={f.nombre} onChange={e => setColoresNm(v => v.map(x => x.key === f.key ? { ...x, nombre: e.target.value } : x))}
                        placeholder="Ej. NEGRO MATE" className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm" />
                      <input type="number" min={1} value={f.cant} onChange={e => setColoresNm(v => v.map(x => x.key === f.key ? { ...x, cant: e.target.value } : x))}
                        className="w-20 border border-zinc-200 rounded-lg px-2 py-1.5 text-sm text-right" aria-label="Piezas" />
                      <span className="text-[11px] text-zinc-400 w-8">pzas</span>
                      {coloresNm.length > 1 && <button onClick={() => setColoresNm(v => v.filter(x => x.key !== f.key))} className="text-zinc-300 hover:text-red-500" aria-label="Quitar"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setColoresNm(v => [...v, fila()])} className="mt-2 text-xs font-semibold text-teal-700 hover:underline">+ Otro color</button>
              </div>
            </div>
          )}

          {err && <p className="text-xs text-red-500 mt-3">{err}</p>}
          {(sel || modoNuevo) && (
            <button onClick={agregar} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Agregar a la entrada
            </button>
          )}
        </section>
      </div>

      {/* Resumen de la entrada */}
      <section className="bg-white border border-zinc-200 rounded-xl p-4 lg:sticky lg:top-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2"><PackagePlus className="w-4 h-4 text-zinc-400" /> Esta entrada</h3>
        <label className="block">
          <span className="text-[11px] font-semibold text-zinc-500">Entra a</span>
          <select value={ubic} onChange={e => setUbic(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
            {UBIC.map(u => <option key={u.v} value={u.v}>{u.label}</option>)}
          </select>
        </label>
        {lineas.length === 0 ? (
          <p className="text-xs text-zinc-400 py-6 text-center">Agrega los armazones que llegaron</p>
        ) : (
          <div className="space-y-1.5">
            {lineas.map(l => (
              <div key={l.key} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0"><div className="truncate">{l.texto}</div><div className="text-[11px] font-mono text-zinc-400">{l.sku}</div></div>
                <span className="font-semibold">{l.cantidad}</span>
                <button onClick={() => setLineas(x => x.filter(y => y.key !== l.key))} className="text-zinc-300 hover:text-red-500" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-zinc-200 pt-2 mt-2"><span>Total</span><span>{totalPzas} piezas</span></div>
          </div>
        )}
        <label className="block">
          <span className="text-[11px] font-semibold text-zinc-500">Factura (opcional)</span>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Ej. 8812" className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
        </label>
        <button onClick={guardar} disabled={guardando || !lineas.length}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-40">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar entrada ({totalPzas} pzas)
        </button>
        <p className="text-[11px] text-zinc-400">Las etiquetas se agregan a la cola para imprimir todas juntas.</p>
      </section>
    </div>
  )
}

// Etiquetas 20 × 25 mm (banda azul) — una por pieza. Hoja tabloide (11 × 17 in).
export function imprimirEtiquetas(items: { sku: string; modelo: string; color: string; precio: number; cantidad: number }[]) {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const piezas = items.flatMap(i => Array.from({ length: i.cantidad }, () => i))
  const html = piezas.map(i => `
    <div class="e"><div class="b">g<span>o</span>n</div>
      <div class="m">${esc(i.modelo)}</div><div class="k">${esc(i.sku)}</div>
      <div class="c">${esc(i.color.split(' VARILLA')[0])}</div>
      <div class="p">$${Math.round(i.precio).toLocaleString('es-MX')}</div></div>`).join('')
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas (${piezas.length})</title><style>
    @page { size: 11in 17in; margin: 8mm; } body { margin: 0; font-family: 'Poppins','Helvetica Neue',Arial,sans-serif; }
    .g { display: flex; flex-wrap: wrap; gap: 2.5mm; }
    .e { width: 20mm; height: 25mm; border: 0.2mm solid #C7CCD3; border-radius: 1.2mm; overflow: hidden; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; break-inside: avoid; }
    .b { width: 100%; height: 8.5mm; background: #0D2F52; color: #fff; font-weight: 800; font-size: 5mm; display: flex; align-items: center; justify-content: center; letter-spacing: -0.2mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .b span { color: #06B2A6; }
    .m { font-weight: 800; color: #0D2F52; font-size: 2.5mm; margin-top: 1.4mm; max-width: 18mm; text-align: center; white-space: nowrap; overflow: hidden; }
    .k { font-family: monospace; color: #6B7280; font-size: 1.7mm; margin-top: 0.4mm; }
    .c { color: #6B7280; font-size: 1.3mm; margin-top: 0.3mm; max-width: 18mm; text-align: center; white-space: nowrap; overflow: hidden; }
    .p { color: #06B2A6; font-weight: 800; font-size: 4mm; margin-top: auto; margin-bottom: 1.2mm; }
  </style></head><body><div class="g">${html}</div></body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 400)
}
