'use client'
// Encargos que Rob le pide a Sergio. "Ya lo compré" abre Registrar ligado al encargo.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import type { Encargo } from '@/lib/ruta'

const TZ = 'America/Tijuana'
const fechaCorta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { timeZone: TZ, day: 'numeric', month: 'short' }) : ''

export default function EncargosPage() {
  const [encargos, setEncargos] = useState<Encargo[] | null>(null)
  const [sinTabla, setSinTabla] = useState(false)

  useEffect(() => {
    fetch('/api/ruta').then(r => r.json()).then(j => {
      setEncargos(j.ok ? j.encargos ?? [] : [])
      setSinTabla(!!j.sinTabla)
    }).catch(() => setEncargos([]))
  }, [])

  const pend = (encargos ?? []).filter(e => e.estado === 'pendiente')
  const hechos = (encargos ?? []).filter(e => e.estado === 'comprado')

  return (
    <div className="max-w-md mx-auto pt-2">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Encargos</h1>
      <p className="text-sm text-zinc-400 mt-0.5">Lo que te pidió Rob</p>

      {encargos === null ? (
        <div className="py-12 text-center text-sm text-zinc-300">Cargando…</div>
      ) : pend.length === 0 ? (
        <div className="py-12 text-center">
          <ClipboardList className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-600">No tienes encargos pendientes</p>
          {sinTabla && <p className="text-xs text-zinc-400 mt-1">(Falta activar encargos en la base)</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pend.map(e => (
            <div key={e.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-semibold text-zinc-900">{e.descripcion}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex-shrink-0">Pendiente</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{e.sucursal !== 'General' ? `Para ${e.sucursal} · ` : ''}{fechaCorta(e.created_at)}</p>
              {e.nota && <p className="text-sm text-zinc-600 mt-2">{e.nota}</p>}
              <Link href={`/dashboard/ruta/registrar?encargo=${e.id}`}
                className="mt-3 flex items-center justify-center h-11 rounded-xl bg-[#0B0E14] text-white text-sm font-semibold active:scale-[0.98] transition-transform">
                Ya lo compré
              </Link>
            </div>
          ))}
        </div>
      )}

      {hechos.length > 0 && (
        <div className="mt-8">
          <p className="text-sm text-zinc-400 mb-1">Ya comprados</p>
          <div className="divide-y divide-zinc-200/70">
            {hechos.map(e => (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-700 truncate">{e.descripcion}</p>
                  <p className="text-xs text-zinc-400">{fechaCorta(e.comprado_at)} · {e.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo'}</p>
                </div>
                <span className="text-sm font-semibold text-zinc-700 tabular-nums">${Number(e.monto ?? 0).toLocaleString('es-MX')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
