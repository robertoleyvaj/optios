'use client'

import { useEffect, useState } from 'react'
import { Loader2, Printer, CheckCircle2, Trash2, Tag } from 'lucide-react'
import { imprimirEtiquetas } from './Entradas'

// ─────────────────────────────────────────────────────────────
// Etiquetas por imprimir
// Las entradas (y reimpresiones) se juntan aquí. Al terminar la carga:
// "Generar documento" (todas en tabloide) → imprimir → "Ya se imprimieron".
// ─────────────────────────────────────────────────────────────

type Pend = { sku: string; marca: string; modelo: string; color: string; precio: number; cantidad: number; ids: number[]; motivos: string[] }
const POR_HOJA = 165   // 11 × 15 etiquetas de 20×25 mm en tabloide con márgenes de 8 mm
const MOTIVO: Record<string, string> = { entrada: 'Entrada', reimpresion: 'Reimpresión', cambio_precio: 'Cambio de precio' }

export default function Etiquetas({ onCambio }: { onCambio?: (n: number) => void }) {
  const [pend, setPend] = useState<Pend[] | null>(null)
  const [msg, setMsg] = useState('')
  const [generado, setGenerado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  const cargar = async () => {
    const j = await fetch('/api/inv/etiquetas', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false }))
    const lista: Pend[] = j.ok ? j.pendientes : []
    setPend(lista)
    onCambio?.(lista.reduce((s, p) => s + p.cantidad, 0))
    if (!j.ok) setMsg('No se pudo cargar la cola: ' + (j.error ?? ''))
  }
  useEffect(() => { const t = setTimeout(cargar, 0); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = (pend ?? []).reduce((s, p) => s + p.cantidad, 0)
  const hojas = Math.ceil(total / POR_HOJA)

  const generar = () => {
    if (!pend?.length) return
    // Ordenadas por modelo para pegarlas fácil
    const orden = [...pend].sort((a, b) => `${a.marca} ${a.modelo} ${a.sku}`.localeCompare(`${b.marca} ${b.modelo} ${b.sku}`))
    imprimirEtiquetas(orden.map(p => ({ sku: p.sku, modelo: p.modelo, color: p.color, precio: p.precio, cantidad: p.cantidad })))
    setGenerado(true)
  }

  const accion = async (accion: 'impresas' | 'quitar', ids: number[]) => {
    setTrabajando(true); setMsg('')
    try {
      const j = await fetch('/api/inv/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, ids }) }).then(r => r.json())
      if (!j.ok) throw new Error(j.error)
      if (accion === 'impresas') { setMsg('Listo. La cola quedó vacía para la próxima carga.'); setGenerado(false) }
      await cargar()
    } catch (e) { setMsg('Error: ' + (e instanceof Error ? e.message : '')) }
    finally { setTrabajando(false) }
  }

  if (pend === null) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><Tag className="w-5 h-5 text-teal-700" /></div>
          <div>
            <div className="text-lg font-semibold text-zinc-900">{total} etiquetas por imprimir</div>
            <div className="text-xs text-zinc-500">{pend.length} armazones · {hojas} {hojas === 1 ? 'hoja' : 'hojas'} tabloide</div>
          </div>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={generar} disabled={!total}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-40">
            <Printer className="w-4 h-4" /> Generar documento
          </button>
          <button onClick={() => { if (confirm(`¿Ya se imprimieron las ${total} etiquetas? Se quitan de la cola.`)) accion('impresas', pend.flatMap(p => p.ids)) }}
            disabled={!total || trabajando}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-40 ${generado ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}>
            <CheckCircle2 className="w-4 h-4" /> Ya se imprimieron
          </button>
        </div>
      </div>
      {msg && <div className="text-xs px-3 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600">{msg}</div>}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
        {pend.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-12">No hay etiquetas pendientes. Se agregan solas con cada entrada.</p>
        ) : (
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200">
              <th className="text-left font-semibold px-3 py-2">SKU</th>
              <th className="text-left font-semibold px-3 py-2">Armazón</th>
              <th className="text-left font-semibold px-3 py-2">Motivo</th>
              <th className="text-right font-semibold px-3 py-2">Precio</th>
              <th className="text-right font-semibold px-3 py-2">Etiquetas</th>
              <th className="w-10"></th>
            </tr></thead>
            <tbody>
              {pend.map(p => (
                <tr key={p.sku} className="border-b border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{p.sku}</td>
                  <td className="px-3 py-2">{p.marca} {p.modelo} <span className="text-zinc-400">· {p.color}</span></td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{p.motivos.map(m => MOTIVO[m] ?? m).join(', ')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${Math.round(p.precio).toLocaleString('es-MX')}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{p.cantidad}</td>
                  <td className="px-2"><button onClick={() => { if (confirm(`¿Quitar las ${p.cantidad} etiquetas de ${p.sku} sin imprimir?`)) accion('quitar', p.ids) }} className="text-zinc-300 hover:text-red-500" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-zinc-400">En la ventana de impresión elige tamaño <b>Tabloide (11 × 17)</b> y escala al 100%.</p>
    </div>
  )
}
