'use client'

import { useMemo, useState } from 'react'
import { Search, Plus, Trash2, Loader2, CheckCircle2, Printer, PackagePlus } from 'lucide-react'
import { getSucursalActual } from '@/lib/session'

// ─────────────────────────────────────────────────────────────
// Entradas de mercancía
// 1) Elige a dónde entra (sucursal o bodega) y la referencia (proveedor/factura)
// 2) Busca el modelo: si existe eliges color (o agregas color nuevo); si no, alta de modelo nuevo
// 3) Guardar → suma stock, queda en bitácora y salen las etiquetas para imprimir
// ─────────────────────────────────────────────────────────────

type Color = { id: number; sku: string; color: string }
type Modelo = { id: number; sku: string; marca: string; modelo: string; medidas: string | null; material: string | null; precio_gon: number | null; colores: Color[] }
type Linea = {
  key: string; texto: string; sku: string; cantidad: number
  item: { cantidad: number; color_id?: number; armazon_id?: number; color?: string; nuevo?: Record<string, unknown> }
}
type Resultado = { sku: string; marca: string; modelo: string; color: string; precio: number; cantidad: number; nuevo: boolean }

const UBIC = [
  { v: 'baja', label: 'Baja Visión' }, { v: 'mayo', label: '5 de Mayo' },
  { v: 'plaza', label: 'Plaza Laureles' }, { v: 'bodega', label: 'Bodega' },
]
const MATERIALES = ['METAL', 'TR90', 'ACETATO', 'B-ULTEM', 'ACETATO/METAL', 'TITANIO']
const inicialUbic = () => {
  const s = getSucursalActual()
  return s === '5 de Mayo' ? 'mayo' : s === 'Plaza Laureles' ? 'plaza' : 'baja'
}

export default function Entradas({ modelos, esAdmin, onDone }: { modelos: Modelo[]; esAdmin: boolean; onDone: () => void }) {
  const [ubic, setUbic] = useState(inicialUbic)
  const [ref, setRef] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Modelo | null>(null)
  const [colorId, setColorId] = useState<string>('')      // id o 'nuevo'
  const [colorNuevo, setColorNuevo] = useState('')
  const [cant, setCant] = useState('1')
  const [modoNuevo, setModoNuevo] = useState(false)
  const [nm, setNm] = useState({ marca: '', modelo: '', medidas: '', material: 'METAL', precio_gon: '', costo: '', color: '' })
  const [err, setErr] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState<Resultado[] | null>(null)

  const sugerencias = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return modelos.filter(m => (`${m.marca} ${m.modelo} ${m.sku} ` + m.colores.map(c => c.sku).join(' ')).toLowerCase().includes(t)).slice(0, 8)
  }, [q, modelos])

  const elegir = (m: Modelo) => {
    setSel(m); setQ(''); setErr('')
    // si buscó un SKU de color exacto, lo preselecciona
    const exacto = m.colores.find(c => c.sku.toLowerCase() === q.trim().toLowerCase())
    setColorId(exacto ? String(exacto.id) : m.colores.length === 1 ? String(m.colores[0].id) : '')
  }

  const agregar = () => {
    setErr('')
    const n = parseInt(cant)
    if (!n || n < 1) { setErr('Pon cuántas piezas llegaron'); return }
    if (modoNuevo) {
      const marca = nm.marca.trim().toUpperCase(), modelo = nm.modelo.trim().toUpperCase(), color = nm.color.trim().toUpperCase()
      if (!marca || !modelo || !color || !nm.precio_gon) { setErr('Falta marca, modelo, color o precio'); return }
      const ya = modelos.find(m => m.marca.toUpperCase() === marca && m.modelo.toUpperCase() === modelo)
      if (ya) { setErr(`${marca} ${modelo} ya existe (${ya.sku}). Búscalo arriba y agrega el color.`); return }
      setLineas(l => [...l, {
        key: crypto.randomUUID(), texto: `${marca} ${modelo} · ${color}`, sku: 'Modelo nuevo', cantidad: n,
        item: { cantidad: n, color, nuevo: { marca, modelo, medidas: nm.medidas, material: nm.material, precio_gon: Number(nm.precio_gon), costo: esAdmin ? Number(nm.costo) || null : null } },
      }])
      setNm({ marca: '', modelo: '', medidas: '', material: 'METAL', precio_gon: '', costo: '', color: '' })
      setModoNuevo(false); setCant('1')
      return
    }
    if (!sel) { setErr('Busca y elige el modelo'); return }
    if (!colorId) { setErr('Elige el color'); return }
    if (colorId === 'nuevo') {
      const color = colorNuevo.trim().toUpperCase()
      if (!color) { setErr('Escribe el color nuevo'); return }
      if (sel.colores.some(c => c.color.toUpperCase() === color)) { setErr('Ese color ya existe, elígelo de la lista'); return }
      setLineas(l => [...l, { key: crypto.randomUUID(), texto: `${sel.marca} ${sel.modelo} · ${color}`, sku: 'Color nuevo', cantidad: n, item: { cantidad: n, armazon_id: sel.id, color } }])
    } else {
      const c = sel.colores.find(x => String(x.id) === colorId)!
      setLineas(l => [...l, { key: crypto.randomUUID(), texto: `${sel.marca} ${sel.modelo} · ${c.color}`, sku: c.sku, cantidad: n, item: { cantidad: n, color_id: c.id } }])
    }
    setSel(null); setColorId(''); setColorNuevo(''); setCant('1')
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

  if (hecho) return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 max-w-2xl">
      <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="w-5 h-5" /> Entrada guardada en {ubicLabel}</div>
      <p className="text-sm text-zinc-500 mt-1">{hecho.reduce((s, r) => s + r.cantidad, 0)} piezas. Ya están en el inventario y en la bitácora.</p>
      <table className="w-full text-sm mt-4">
        <tbody>
          {hecho.map(r => (
            <tr key={r.sku} className="border-b border-zinc-100">
              <td className="py-2 font-mono text-xs text-zinc-500">{r.sku}</td>
              <td className="py-2">{r.marca} {r.modelo} · {r.color} {r.nuevo && <span className="text-[11px] ml-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">nuevo</span>}</td>
              <td className="py-2 text-right">{r.cantidad} pzas</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-5">
        <button onClick={() => imprimirEtiquetas(hecho)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27]">
          <Printer className="w-4 h-4" /> Imprimir etiquetas
        </button>
        <button onClick={() => setHecho(null)} className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50">Otra entrada</button>
      </div>
    </div>
  )

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
      <div className="space-y-4">
        <section className="bg-white border border-zinc-200 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-500">¿A dónde entra?</span>
            <select value={ubic} onChange={e => setUbic(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
              {UBIC.map(u => <option key={u.v} value={u.v}>{u.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-500">Proveedor / factura</span>
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="SEIMA factura 8812"
              className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
          </label>
        </section>

        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-800">{modoNuevo ? 'Modelo nuevo' : 'Agregar armazón'}</h3>
            <button onClick={() => { setModoNuevo(v => !v); setSel(null); setErr('') }} className="text-xs font-semibold text-teal-700 hover:underline">
              {modoNuevo ? '← Buscar uno que ya existe' : '+ Es un modelo que no existe'}
            </button>
          </div>

          {!modoNuevo ? (
            <>
              {!sel ? (
                <div className="relative">
                  <div className="flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2">
                    <Search className="w-4 h-4 text-zinc-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Marca, modelo o SKU…" className="flex-1 text-sm focus:outline-none" />
                  </div>
                  {sugerencias.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden">
                      {sugerencias.map(m => (
                        <button key={m.id} onClick={() => elegir(m)} className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                          <div className="text-sm font-medium text-zinc-800">{m.marca} {m.modelo}</div>
                          <div className="text-[11px] text-zinc-400 font-mono">{m.sku} · {m.colores.length} colores</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {q.trim().length >= 2 && sugerencias.length === 0 && (
                    <p className="text-xs text-zinc-500 mt-2">No existe. <button onClick={() => { setModoNuevo(true); setNm(v => ({ ...v, modelo: q.trim().toUpperCase() })) }} className="text-teal-700 font-semibold hover:underline">Darlo de alta como modelo nuevo</button></p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                    <div><div className="text-sm font-semibold">{sel.marca} {sel.modelo}</div><div className="text-[11px] text-zinc-400 font-mono">{sel.sku} · {sel.medidas} · {sel.material}</div></div>
                    <button onClick={() => setSel(null)} className="text-xs text-zinc-500 hover:underline">Cambiar</button>
                  </div>
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <select value={colorId} onChange={e => setColorId(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Elige el color…</option>
                      {sel.colores.map(c => <option key={c.id} value={c.id}>{c.color} — {c.sku}</option>)}
                      <option value="nuevo">+ Color nuevo</option>
                    </select>
                    <input type="number" min={1} value={cant} onChange={e => setCant(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-right" aria-label="Piezas" />
                  </div>
                  {colorId === 'nuevo' && (
                    <input value={colorNuevo} onChange={e => setColorNuevo(e.target.value)} placeholder="Nombre del color, ej. AZUL MARINO MATE"
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {([['marca', 'Marca', 'SEIMA'], ['modelo', 'Modelo', 'SM2501'], ['color', 'Color', 'AZUL MARINO'], ['medidas', 'Medidas', '52-18-145']] as const).map(([k, l, ph]) => (
                <label key={k} className="block"><span className="text-[11px] font-semibold text-zinc-500">{l}</span>
                  <input value={nm[k]} onChange={e => setNm(v => ({ ...v, [k]: e.target.value }))} placeholder={ph} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" /></label>
              ))}
              <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Material</span>
                <select value={nm.material} onChange={e => setNm(v => ({ ...v, material: e.target.value }))} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {MATERIALES.map(m => <option key={m}>{m}</option>)}
                </select></label>
              <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Precio de venta (MXN)</span>
                <input type="number" value={nm.precio_gon} onChange={e => setNm(v => ({ ...v, precio_gon: e.target.value }))} placeholder="1137" className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" /></label>
              {esAdmin && <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Costo unitario</span>
                <input type="number" value={nm.costo} onChange={e => setNm(v => ({ ...v, costo: e.target.value }))} placeholder="380" className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" /></label>}
              <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Piezas</span>
                <input type="number" min={1} value={cant} onChange={e => setCant(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" /></label>
            </div>
          )}

          {err && <p className="text-xs text-red-500 mt-3">{err}</p>}
          <button onClick={agregar} className="mt-3 inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50">
            <Plus className="w-4 h-4" /> Agregar a la entrada
          </button>
        </section>
      </div>

      <section className="bg-white border border-zinc-200 rounded-xl p-4 lg:sticky lg:top-4">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2"><PackagePlus className="w-4 h-4 text-zinc-400" /> Esta entrada · {ubicLabel}</h3>
        {lineas.length === 0 ? (
          <p className="text-xs text-zinc-400 py-8 text-center">Agrega los armazones que llegaron</p>
        ) : (
          <div className="mt-3 space-y-1.5">
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
        <button onClick={guardar} disabled={guardando || !lineas.length}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-40">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar entrada
        </button>
      </section>
    </div>
  )
}

// Etiquetas 20 × 25 mm (banda azul) — una por pieza
export function imprimirEtiquetas(items: { sku: string; modelo: string; color: string; precio: number; cantidad: number }[]) {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const piezas = items.flatMap(i => Array.from({ length: i.cantidad }, () => i))
  const html = piezas.map(i => `
    <div class="e"><div class="b">g<span>o</span>n</div>
      <div class="m">${esc(i.modelo)}</div><div class="k">${esc(i.sku)}</div>
      <div class="c">${esc(i.color.split(' VARILLA')[0])}</div>
      <div class="p">$${Math.round(i.precio).toLocaleString('es-MX')}</div></div>`).join('')
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>
    @page { margin: 8mm; } body { margin: 0; font-family: 'Poppins','Helvetica Neue',Arial,sans-serif; }
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
