'use client'
// Finanzas: encargos para Sergio (Rob le pide comprar algo). Al comprarlo, Sergio registra
// el gasto desde su app y se agrega solo a los egresos.
import { useEffect, useState } from 'react'
import { ClipboardList, Plus, X } from 'lucide-react'
import { SUCURSALES_RUTA, type Encargo } from '@/lib/ruta'

const TZ = 'America/Tijuana'
const fechaCorta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { timeZone: TZ, day: 'numeric', month: 'short' }) : ''

export default function EncargosAdmin({ onCambio }: { onCambio?: () => void }) {
  const [encargos, setEncargos] = useState<Encargo[]>([])
  const [sinTabla, setSinTabla] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ descripcion: '', sucursal: 'General', nota: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = () => fetch('/api/ruta').then(r => r.json()).then(j => {
    if (j.ok) { setEncargos(j.encargos ?? []); setSinTabla(!!j.sinTabla) }
  }).catch(() => {})
  useEffect(() => { cargar() }, [])

  const mandar = async () => {
    setError('')
    if (!f.descripcion.trim()) return setError('Escribe qué necesitas')
    setGuardando(true)
    try {
      const r = await fetch('/api/ruta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'encargo', ...f }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar')
      setAbierto(false); setF({ descripcion: '', sucursal: 'General', nota: '' })
      cargar(); onCambio?.()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }

  const cancelar = async (id: number) => {
    if (!confirm('¿Cancelar este encargo?')) return
    await fetch('/api/ruta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cancelar', id }) })
    cargar()
  }

  const pend = encargos.filter(e => e.estado === 'pendiente')
  const recientes = encargos.filter(e => e.estado === 'comprado').slice(0, 3)

  return (
    <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-700">Encargos para Sergio</h3>
          {pend.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{pend.length} pendiente{pend.length === 1 ? '' : 's'}</span>}
        </div>
        <button onClick={() => setAbierto(true)} disabled={sinTabla}
          className="flex items-center gap-1 border border-zinc-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> Nuevo encargo
        </button>
      </div>
      {sinTabla && <p className="text-xs text-amber-600 mt-2">Falta correr el SQL de encargos (ruta_1_encargos.sql).</p>}

      {(pend.length > 0 || recientes.length > 0) && (
        <div className="mt-3 divide-y divide-zinc-100">
          {pend.map(e => (
            <div key={e.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-zinc-800 truncate">{e.descripcion}</p>
                <p className="text-[11px] text-zinc-400">{e.sucursal} · {fechaCorta(e.created_at)}{e.nota ? ` · ${e.nota}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] text-amber-600 font-medium">Pendiente</span>
                <button onClick={() => cancelar(e.id)} title="Cancelar" className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {recientes.map(e => (
            <div key={e.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-zinc-500 truncate">{e.descripcion}</p>
                <p className="text-[11px] text-zinc-400">Comprado {fechaCorta(e.comprado_at)} · {e.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo'}</p>
              </div>
              <span className="text-sm font-semibold text-zinc-600 tabular-nums">${Number(e.monto ?? 0).toLocaleString('es-MX')}</span>
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setAbierto(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl p-5" onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-800">Nuevo encargo para Sergio</h2>
              <button onClick={() => setAbierto(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <label className="block text-xs font-semibold text-zinc-500 mt-4 mb-1.5">¿Qué necesitas?</label>
            <input value={f.descripcion} onChange={e => setF(x => ({ ...x, descripcion: e.target.value }))} placeholder="Estuches x20"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <label className="block text-xs font-semibold text-zinc-500 mt-4 mb-1.5">¿Para qué óptica?</label>
            <div className="flex flex-wrap gap-1.5">
              {SUCURSALES_RUTA.map(s => (
                <button key={s} onClick={() => setF(x => ({ ...x, sucursal: s }))}
                  className={`px-3 py-1.5 rounded-full text-xs border ${f.sucursal === s ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'bg-white text-zinc-600 border-zinc-200'}`}>{s}</button>
              ))}
            </div>
            <label className="block text-xs font-semibold text-zinc-500 mt-4 mb-1.5">Nota <span className="font-normal text-zinc-300">(opcional)</span></label>
            <input value={f.nota} onChange={e => setF(x => ({ ...x, nota: e.target.value }))} placeholder="Los negros, con el proveedor de siempre"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            <button onClick={mandar} disabled={guardando}
              className="w-full mt-5 py-3 rounded-lg bg-[#0B0E14] text-white text-sm font-semibold disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Mandar encargo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
