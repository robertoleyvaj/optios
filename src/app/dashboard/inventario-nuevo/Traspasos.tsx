'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Plus, Trash2, Loader2, Send, CheckCircle2, ArrowRight, X, Truck } from 'lucide-react'
import { getSucursalActual } from '@/lib/session'

// ─────────────────────────────────────────────────────────────
// Traspasos entre sucursales
//  · Enviar (admin/gerente): la pieza sale del origen y queda "en camino"
//  · Recibir (quien esté en la sucursal destino): entra al stock
//  · Cancelar (admin/gerente, si sigue en camino): regresa al origen
// ─────────────────────────────────────────────────────────────

type Ubic = 'baja' | 'mayo' | 'plaza' | 'bodega'
type Color = { id: number; sku: string; color: string; stock_baja: number; stock_mayo: number; stock_plaza: number; bodega: number }
type Modelo = { id: number; sku: string; marca: string; modelo: string; colores: Color[] }
type Tr = {
  id: number; folio: string; created_at: string; origen: Ubic; destino: Ubic; estado: 'en_camino' | 'recibido' | 'cancelado'
  enviado_por: string | null; recibido_por: string | null; recibido_at: string | null; notas: string | null
  traspaso_items: { sku: string; descripcion: string | null; cantidad: number }[]
}

export const UBIC_LABEL: Record<Ubic, string> = { baja: 'Baja Visión', mayo: '5 de Mayo', plaza: 'Plaza Laureles', bodega: 'Bodega' }
const COL: Record<Ubic, keyof Color> = { baja: 'stock_baja', mayo: 'stock_mayo', plaza: 'stock_plaza', bodega: 'bodega' }
export const ubicDeSucursal = (s: string): Ubic => s === '5 de Mayo' ? 'mayo' : s === 'Plaza Laureles' ? 'plaza' : 'baja'
const fecha = (s: string) => new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Traspasos({ modelos = [], puedeEnviar, soloRecibir = false, onDone }: {
  modelos?: Modelo[]; puedeEnviar: boolean; soloRecibir?: boolean; onDone?: () => void
}) {
  const miUbic = ubicDeSucursal(getSucursalActual())
  const [lista, setLista] = useState<Tr[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [trabajando, setTrabajando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const url = soloRecibir ? `/api/inv/traspasos?estado=en_camino&destino=${miUbic}` : '/api/inv/traspasos'
    const j = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false }))
    setLista(j.ok ? j.traspasos : [])
    setCargando(false)
  }, [soloRecibir, miUbic])
  useEffect(() => { cargar() }, [cargar])

  const accion = async (t: Tr, a: 'recibir' | 'cancelar') => {
    if (a === 'cancelar' && !confirm(`¿Cancelar ${t.folio}? Las piezas regresan a ${UBIC_LABEL[t.origen]}.`)) return
    setTrabajando(t.id); setMsg('')
    const j = await fetch('/api/inv/traspasos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, accion: a }),
    }).then(r => r.json()).catch(() => ({ ok: false, error: 'Sin conexión' }))
    setTrabajando(null)
    if (!j.ok) { setMsg('No se pudo: ' + j.error); return }
    setMsg(a === 'recibir' ? `${t.folio} recibido: las piezas ya están en ${UBIC_LABEL[t.destino]}.` : `${t.folio} cancelado.`)
    cargar(); onDone?.()
  }

  const enCamino = lista.filter(t => t.estado === 'en_camino')
  const historial = lista.filter(t => t.estado !== 'en_camino')

  return (
    <div className="space-y-4">
      {msg && <div className="text-sm px-4 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-700">{msg}</div>}

      {puedeEnviar && !soloRecibir && <NuevoTraspaso modelos={modelos} onEnviado={f => { setMsg(`${f} enviado. Queda en camino hasta que lo reciban.`); cargar(); onDone?.() }} />}

      <section className="bg-white border border-zinc-200 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-800">{soloRecibir ? `Por recibir en ${UBIC_LABEL[miUbic]}` : 'En camino'}</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{enCamino.length}</span>
        </div>
        {cargando ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 text-teal-600 animate-spin" /></div>
          : enCamino.length === 0 ? <p className="text-sm text-zinc-400 text-center py-10">No hay traspasos en camino.</p>
          : enCamino.map(t => (
            <TrRow key={t.id} t={t}>
              <div className="flex gap-2">
                {(t.destino === miUbic || puedeEnviar) && (
                  <button onClick={() => accion(t, 'recibir')} disabled={trabajando === t.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 disabled:opacity-50">
                    {trabajando === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Ya llegó
                  </button>
                )}
                {puedeEnviar && (
                  <button onClick={() => accion(t, 'cancelar')} disabled={trabajando === t.id}
                    className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-50">Cancelar</button>
                )}
              </div>
            </TrRow>
          ))}
      </section>

      {!soloRecibir && historial.length > 0 && (
        <section className="bg-white border border-zinc-200 rounded-xl">
          <div className="px-4 py-3 border-b border-zinc-100"><h3 className="text-sm font-semibold text-zinc-800">Recientes</h3></div>
          {historial.slice(0, 30).map(t => (
            <TrRow key={t.id} t={t}>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${t.estado === 'recibido' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {t.estado === 'recibido' ? `Recibido · ${t.recibido_por ?? ''}` : 'Cancelado'}
              </span>
            </TrRow>
          ))}
        </section>
      )}
    </div>
  )
}

function TrRow({ t, children }: { t: Tr; children: React.ReactNode }) {
  const pzas = t.traspaso_items.reduce((s, i) => s + i.cantidad, 0)
  return (
    <div className="px-4 py-3 border-b border-zinc-100 last:border-0 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{t.folio}</span>
          <span className="text-zinc-600">{UBIC_LABEL[t.origen]}</span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">{UBIC_LABEL[t.destino]}</span>
          <span className="text-[11px] text-zinc-400">· {pzas} pza{pzas === 1 ? '' : 's'} · {fecha(t.created_at)} · {t.enviado_por}</span>
        </div>
        <div className="mt-1 space-y-0.5">
          {t.traspaso_items.map((i, k) => (
            <div key={k} className="text-xs text-zinc-600"><span className="font-mono text-zinc-400 mr-2">{i.sku}</span>{i.cantidad} × {i.descripcion}</div>
          ))}
        </div>
        {t.notas && <div className="text-xs text-zinc-400 mt-1">{t.notas}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function NuevoTraspaso({ modelos, onEnviado }: { modelos: Modelo[]; onEnviado: (folio: string) => void }) {
  const [origen, setOrigen] = useState<Ubic>(ubicDeSucursal(getSucursalActual()))
  const [destino, setDestino] = useState<Ubic>('plaza')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Modelo | null>(null)
  const [lineas, setLineas] = useState<{ color: Color; modelo: Modelo; cantidad: number }[]>([])
  const [notas, setNotas] = useState('')
  const [err, setErr] = useState('')
  const [enviando, setEnviando] = useState(false)

  const sugerencias = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^vrl[\s-]*/, '')
    if (t.length < 2) return []
    return modelos.filter(m => m.colores.some(c => Number(c[COL[origen]]) > 0))
      .filter(m => (`${m.marca} ${m.modelo} ${m.sku} ` + m.colores.map(c => c.sku).join(' ')).toLowerCase().includes(t)).slice(0, 8)
  }, [q, modelos, origen])

  const yaEnLista = (c: Color) => lineas.filter(l => l.color.id === c.id).reduce((s, l) => s + l.cantidad, 0)
  const agregar = (m: Modelo, c: Color) => {
    const disp = Number(c[COL[origen]]) - yaEnLista(c)
    if (disp <= 0) { setErr(`No quedan piezas de ese color en ${UBIC_LABEL[origen]}`); return }
    setErr('')
    setLineas(l => {
      const ex = l.find(x => x.color.id === c.id)
      return ex ? l.map(x => x.color.id === c.id ? { ...x, cantidad: x.cantidad + 1 } : x) : [...l, { color: c, modelo: m, cantidad: 1 }]
    })
    setSel(null); setQ('')
  }

  const enviar = async () => {
    if (origen === destino) { setErr('Elige dos ubicaciones distintas'); return }
    if (!lineas.length) { setErr('Agrega al menos una pieza'); return }
    setEnviando(true); setErr('')
    const j = await fetch('/api/inv/traspasos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origen, destino, notas, items: lineas.map(l => ({ color_id: l.color.id, cantidad: l.cantidad })) }),
    }).then(r => r.json()).catch(() => ({ ok: false, error: 'Sin conexión' }))
    setEnviando(false)
    if (!j.ok) { setErr('No se pudo enviar: ' + j.error); return }
    setLineas([]); setNotas(''); onEnviado(j.folio)
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2"><Send className="w-4 h-4 text-zinc-400" /> Nuevo traspaso</h3>
      <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
        <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Sale de</span>
          <select value={origen} onChange={e => { setOrigen(e.target.value as Ubic); setLineas([]) }} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
            {(Object.keys(UBIC_LABEL) as Ubic[]).map(u => <option key={u} value={u}>{UBIC_LABEL[u]}</option>)}
          </select></label>
        <ArrowRight className="w-4 h-4 text-zinc-400 mb-3 hidden sm:block" />
        <label className="block"><span className="text-[11px] font-semibold text-zinc-500">Va a</span>
          <select value={destino} onChange={e => setDestino(e.target.value as Ubic)} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white">
            {(Object.keys(UBIC_LABEL) as Ubic[]).map(u => <option key={u} value={u} disabled={u === origen}>{UBIC_LABEL[u]}</option>)}
          </select></label>
      </div>

      <div className="mt-3">
        {!sel ? (
          <div className="relative">
            <div className="flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-zinc-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Busca el armazón que sale de ${UBIC_LABEL[origen]} (1391, modelo o marca)…`} className="flex-1 text-sm focus:outline-none" />
            </div>
            {sugerencias.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden">
                {sugerencias.map(m => (
                  <button key={m.id} onClick={() => { setSel(m); setQ('') }} className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                    <div className="text-sm font-medium">{m.marca} {m.modelo}</div>
                    <div className="text-[11px] font-mono text-zinc-400">{m.sku}</div>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && sugerencias.length === 0 && <p className="text-xs text-zinc-400 mt-2">No hay piezas de eso en {UBIC_LABEL[origen]}.</p>}
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{sel.marca} {sel.modelo}</span>
              <button onClick={() => setSel(null)} className="text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {sel.colores.map(c => {
                const disp = Number(c[COL[origen]]) - yaEnLista(c)
                return (
                  <button key={c.id} onClick={() => agregar(sel, c)} disabled={disp <= 0}
                    className="text-left border border-zinc-200 rounded-lg px-3 py-2 hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed">
                    <div className="text-sm">{c.color}</div>
                    <div className="text-[11px] text-zinc-400"><span className="font-mono">{c.sku}</span> · {disp} en {UBIC_LABEL[origen]}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {lineas.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {lineas.map(l => (
            <div key={l.color.id} className="flex items-center gap-2 text-sm bg-zinc-50 rounded-lg px-3 py-2">
              <span className="font-mono text-[11px] text-zinc-400">{l.color.sku}</span>
              <span className="flex-1 truncate">{l.modelo.marca} {l.modelo.modelo} · {l.color.color}</span>
              <span className="font-semibold">{l.cantidad}</span>
              <button onClick={() => agregar(l.modelo, l.color)} className="text-zinc-400 hover:text-teal-600" aria-label="Una más"><Plus className="w-4 h-4" /></button>
              <button onClick={() => setLineas(x => x.filter(y => y.color.id !== l.color.id))} className="text-zinc-300 hover:text-red-500" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Motivo (opcional): cliente lo apartó, reacomodo de exhibición…"
        className="mt-3 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      <button onClick={enviar} disabled={enviando || !lineas.length}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-40">
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar traspaso
      </button>
    </section>
  )
}
