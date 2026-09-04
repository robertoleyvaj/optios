'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import RequireRol from '@/components/RequireRol'
import { Ticket, Plus, Loader2, ArrowLeft, X } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TIPOS = [
  { v: 'porcentaje', label: 'Porcentaje' },
  { v: 'monto', label: 'Monto fijo (USD)' },
  { v: 'componente', label: 'Componente gratis' },
]
const OBJETIVOS = [
  { v: 'armazon', label: 'Armazón' }, { v: 'ar', label: 'AR (antirreflejante)' }, { v: 'arprem', label: 'AR premium' },
  { v: 'blue', label: 'Filtro azul' }, { v: 'foto', label: 'Fotocromático' }, { v: 'pol', label: 'Polarizado' },
  { v: 'tinte', label: 'Tinte' }, { v: 'anti', label: 'Antiempañante' },
]
const CAMPANAS = ['temporada', 'alianza', 'cortesia', 'otra']
const OBJ_LABEL: Record<string, string> = Object.fromEntries(OBJETIVOS.map(o => [o.v, o.label]))

const vacio = {
  codigo: '', tipo: 'porcentaje', valor: '', objetivo: 'armazon', compra_minima: '',
  vigencia_desde: '', vigencia_hasta: '', usos_max: '', combinable: false, campana: 'temporada', descripcion: '',
}

function descTexto(c: any): string {
  if (c.tipo === 'porcentaje') return `${c.valor}% del total`
  if (c.tipo === 'monto') return `$${c.valor} USD del total`
  return `${OBJ_LABEL[c.objetivo] || c.objetivo} gratis`
}

function CuponesInner() {
  const [cupones, setCupones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<any>(vacio)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/tienda/cupones')
      const j = await r.json()
      if (j.ok) setCupones(j.cupones)
    } finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const r = await fetch('/api/tienda/cupones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', ...form }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setForm(vacio); setAbierto(false); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') } finally { setGuardando(false) }
  }

  const toggle = async (c: any) => {
    await fetch('/api/tienda/cupones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id: c.id, activo: !c.activo }),
    })
    cargar()
  }

  const input = 'w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30'

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finanzas" className="text-zinc-400 hover:text-zinc-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#0D9488]" />
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Cupones</h1>
          </div>
        </div>
        <button onClick={() => { setAbierto(a => !a); setError('') }}
          className="flex items-center gap-1.5 bg-[#0D9488] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0B7C72]">
          {abierto ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {abierto ? 'Cerrar' : 'Nuevo código'}
        </button>
      </div>

      {abierto && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Código</label>
              <input className={`${input} uppercase`} value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="VERANO15" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Tipo de descuento</label>
              <select className={input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {form.tipo === 'componente' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Componente gratis</label>
                <select className={input} value={form.objetivo} onChange={e => set('objetivo', e.target.value)}>
                  {OBJETIVOS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">{form.tipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (USD)'}</label>
                <input type="number" className={input} value={form.valor} onChange={e => set('valor', e.target.value)} placeholder={form.tipo === 'porcentaje' ? '15' : '10'} />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Compra mínima (USD)</label>
              <input type="number" className={input} value={form.compra_minima} onChange={e => set('compra_minima', e.target.value)} placeholder="Ninguna" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Campaña</label>
              <select className={input} value={form.campana} onChange={e => set('campana', e.target.value)}>
                {CAMPANAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Vigencia desde</label>
              <input type="date" className={input} value={form.vigencia_desde} onChange={e => set('vigencia_desde', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Vigencia hasta</label>
              <input type="date" className={input} value={form.vigencia_hasta} onChange={e => set('vigencia_hasta', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Usos máximos</label>
              <input type="number" className={input} value={form.usos_max} onChange={e => set('usos_max', e.target.value)} placeholder="Sin límite" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={form.combinable} onChange={e => set('combinable', e.target.checked)} />
            Combinable con otros códigos
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 bg-[#0D9488] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0B7C72] disabled:opacity-60">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar código
            </button>
            <button onClick={() => { setForm(vacio); setAbierto(false) }} className="px-4 py-2 rounded-lg text-sm text-zinc-600 border border-zinc-200 hover:bg-zinc-50">Cancelar</button>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm text-zinc-500 mb-2">Códigos</p>
        {cargando ? (
          <div className="flex items-center justify-center h-32 text-zinc-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : cupones.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-10 border border-zinc-100 rounded-xl">Aún no hay códigos. Crea el primero.</p>
        ) : (
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1.3fr_1.6fr_1fr_0.6fr_0.8fr] gap-2 px-4 py-2.5 bg-zinc-50 text-xs text-zinc-400 font-medium">
              <span>Código</span><span>Descuento</span><span>Vigencia</span><span>Usos</span><span>Estado</span>
            </div>
            {cupones.map(c => (
              <div key={c.id} className="grid grid-cols-[1.3fr_1.6fr_1fr_0.6fr_0.8fr] gap-2 px-4 py-3 border-t border-zinc-100 text-sm items-center">
                <span className="font-mono font-semibold text-zinc-800">{c.codigo}</span>
                <span className="text-zinc-600">{descTexto(c)}{c.compra_minima ? ` · mín $${c.compra_minima}` : ''}</span>
                <span className="text-zinc-500 text-xs">{c.vigencia_hasta ? `hasta ${c.vigencia_hasta}` : 'sin límite'}</span>
                <span className="text-zinc-500">{c.usos ?? 0}{c.usos_max ? `/${c.usos_max}` : ''}</span>
                <button onClick={() => toggle(c)} className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${c.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                  {c.activo ? 'activo' : 'pausado'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CuponesPage() {
  return <RequireRol roles={['administrador']}><CuponesInner /></RequireRol>
}
