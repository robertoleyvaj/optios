'use client'
// Inicio de Sergio (repartidor): resumen tranquilo del día.
// Cada renglón es un atajo a Trabajos ya filtrado.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fecha'
import { Store, FlaskConical, Truck, Undo2, ClipboardList, ChevronRight, CheckCircle2 } from 'lucide-react'

const TZ = 'America/Tijuana'
type Conteo = { recoger: number; lab: number; labProceso: number; entregar: number; regresar: number }

export default function InicioRuta() {
  const [nombre, setNombre] = useState('')
  const [uid, setUid] = useState('')
  const [entrada, setEntrada] = useState<string | null | undefined>(undefined)
  const [c, setC] = useState<Conteo | null>(null)
  const [encargos, setEncargos] = useState(0)

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      setNombre(u.apodo || (u.nombre ?? '').split(' ')[0] || '')
      setUid(u.id ?? '')
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    const sb = createClient()
    const hoy = hoyLocal()
    sb.from('ordenes_lab').select('estado, fecha_promesa, archivado')
      .in('estado', ['recibido', 'en_laboratorio', 'en_camino', 'problema'])
      .then(({ data }) => {
        const rows = (data ?? []) as { estado: string; fecha_promesa: string | null; archivado: boolean | null }[]
        const enLab = rows.filter(r => r.estado === 'en_laboratorio')
        const listos = enLab.filter(r => !r.fecha_promesa || r.fecha_promesa <= hoy).length
        setC({
          recoger: rows.filter(r => r.estado === 'recibido').length,
          lab: listos,
          labProceso: enLab.length - listos,
          entregar: rows.filter(r => r.estado === 'en_camino').length,
          regresar: rows.filter(r => r.estado === 'problema' && !r.archivado).length,
        })
      })
    fetch('/api/ruta').then(r => r.json()).then(j => {
      if (j.ok) setEncargos((j.encargos ?? []).filter((e: { estado: string }) => e.estado === 'pendiente').length)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!uid) return
    fetch(`/api/empleados/asistencia?usuario_id=${uid}&fecha=${hoyLocal()}`)
      .then(r => r.json())
      .then(j => setEntrada(j.ok && j.asistencias?.length ? j.asistencias[0].entrada ?? null : null))
      .catch(() => setEntrada(null))
  }, [uid])

  const hora = new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false })
  const saludo = Number(hora) < 12 ? 'Buenos días' : Number(hora) < 19 ? 'Buenas tardes' : 'Buenas noches'
  const fecha = new Date().toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
  const horaEntrada = entrada ? new Date(entrada).toLocaleTimeString('es-MX', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }) : ''

  const lineas = c ? [
    { n: c.recoger,  label: 'Recoger en ópticas',        sub: '',                                         icon: Store,        href: '/dashboard/laboratorio?f=recoger',  rojo: false },
    { n: c.lab,      label: 'Recoger en el laboratorio', sub: c.labProceso ? `${c.labProceso} más todavía en proceso` : '', icon: FlaskConical, href: '/dashboard/laboratorio?f=lab', rojo: false },
    { n: c.entregar, label: 'Entregar en ópticas',       sub: '',                                         icon: Truck,        href: '/dashboard/laboratorio?f=entregar', rojo: false },
    { n: c.regresar, label: 'Regresar al laboratorio',   sub: '',                                         icon: Undo2,        href: '/dashboard/laboratorio?f=regresar', rojo: true  },
  ].filter(l => l.n > 0) : []

  return (
    <div className="max-w-md mx-auto pt-2">
      <p className="text-sm text-zinc-400 first-letter:uppercase">{fecha}</p>
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mt-0.5">{saludo}{nombre ? `, ${nombre}` : ''}</h1>
      {entrada === undefined ? (
        <p className="text-sm text-zinc-300 mt-2">&nbsp;</p>
      ) : entrada ? (
        <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Entrada registrada a las {horaEntrada}</p>
      ) : null}

      <div className="mt-8">
        <p className="text-sm text-zinc-400 mb-1">Hoy te toca</p>
        {c === null ? (
          <div className="py-10 text-center text-sm text-zinc-300">Cargando…</div>
        ) : lineas.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-600">Todo al día</p>
            <p className="text-xs text-zinc-400 mt-0.5">No hay trabajos pendientes</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200/70">
            {lineas.map(l => {
              const Icon = l.icon
              return (
                <Link key={l.label} href={l.href} className="flex items-center gap-3.5 py-4 active:opacity-60">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${l.rojo ? 'text-red-500' : 'text-zinc-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[15px] ${l.rojo ? 'text-red-600' : 'text-zinc-800'}`}>{l.label}</p>
                    {l.sub && <p className="text-xs text-zinc-400 mt-0.5">{l.sub}</p>}
                  </div>
                  <span className={`text-2xl font-semibold tabular-nums ${l.rojo ? 'text-red-600' : 'text-zinc-900'}`}>{l.n}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {encargos > 0 && (
        <Link href="/dashboard/ruta/encargos" className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3.5 active:opacity-70">
          <ClipboardList className="w-5 h-5 text-zinc-500" />
          <span className="flex-1 text-sm text-zinc-700">{encargos} {encargos === 1 ? 'encargo pendiente' : 'encargos pendientes'}</span>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </Link>
      )}

      <Link href="/dashboard/laboratorio"
        className="mt-6 flex items-center justify-center h-12 rounded-xl bg-[#0B0E14] text-white text-sm font-semibold active:scale-[0.98] transition-transform">
        Ver mis trabajos
      </Link>
    </div>
  )
}
