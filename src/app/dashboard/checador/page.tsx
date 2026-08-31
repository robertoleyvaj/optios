'use client'

import { useState, useEffect, useCallback } from 'react'
import { hoyLocal } from '@/lib/fecha'
import { Clock, LogIn, LogOut, CheckCircle2, MapPin, Monitor } from 'lucide-react'

const TZ = 'America/Tijuana'

type Asistencia = {
  id: string
  usuario_id: string
  sucursal: string | null
  fecha: string
  entrada: string | null
  salida: string | null
}

const horaFmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

function duracion(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—'
  const ms = new Date(salida).getTime() - new Date(entrada).getTime()
  if (ms <= 0) return '—'
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

// El checador solo funciona desde computadora (no teléfono/tablet)
function esDispositivoMovil(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry/i.test(ua) ||
    (typeof window !== 'undefined' && window.innerWidth < 900)
}

export default function ChecadorPage() {
  const [user, setUser] = useState<{ id: string; nombre: string; apodo: string; sucursal: string } | null>(null)
  const [asis, setAsis] = useState<Asistencia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [marcando, setMarcando] = useState(false)
  const [reloj, setReloj] = useState('')
  const [esMovil, setEsMovil] = useState(false)
  useEffect(() => { setEsMovil(esDispositivoMovil()) }, [])

  // Reloj en vivo
  useEffect(() => {
    const tick = () => setReloj(new Date().toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const cargarEstado = useCallback(async (uid: string) => {
    setCargando(true)
    try {
      const res = await fetch(`/api/empleados/asistencia?usuario_id=${uid}&fecha=${hoyLocal()}`)
      const j = await res.json()
      setAsis(j.ok && j.asistencias?.length ? j.asistencias[0] : null)
    } catch { setAsis(null) } finally { setCargando(false) }
  }, [])

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      if (u.id) {
        setUser({ id: u.id, nombre: u.nombre ?? '', apodo: u.apodo ?? (u.nombre?.split(' ')[0] ?? ''), sucursal: u.sucursal ?? '' })
        cargarEstado(u.id)
      } else { setCargando(false) }
    } catch { setCargando(false) }
  }, [cargarEstado])

  const marcar = async (tipo: 'entrada' | 'salida') => {
    if (!user) return
    setMarcando(true)
    try {
      const res = await fetch('/api/empleados/asistencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id, usuario_nombre: user.nombre, sucursal: user.sucursal, tipo }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setAsis(j.asistencia as Asistencia)
    } catch (e) {
      alert('No se pudo registrar: ' + (e instanceof Error ? e.message : ''))
    } finally { setMarcando(false) }
  }

  const yaEntro = !!asis?.entrada
  const yaSalio = !!asis?.salida
  const fechaLarga = new Date().toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 text-[#0D9488] mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Checador</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Hola, {user?.apodo || ''}</h1>
        <p className="text-sm text-zinc-400 mt-0.5 capitalize">{fechaLarga}</p>
        {user?.sucursal && (
          <p className="inline-flex items-center gap-1 text-xs text-zinc-500 mt-2 bg-zinc-100 rounded-full px-2.5 py-1">
            <MapPin className="w-3 h-3" /> {user.sucursal}
          </p>
        )}
      </div>

      {/* Reloj */}
      <div className="text-center mb-6">
        <p className="text-4xl font-bold text-zinc-900 tabular-nums tracking-tight">{reloj}</p>
      </div>

      {/* Estado del día */}
      <div className="bg-white rounded-2xl ring-1 ring-zinc-200 p-5 mb-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase font-semibold">Entrada</p>
            <p className={`text-lg font-bold ${yaEntro ? 'text-teal-700' : 'text-zinc-300'}`}>{horaFmt(asis?.entrada ?? null)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase font-semibold">Salida</p>
            <p className={`text-lg font-bold ${yaSalio ? 'text-zinc-800' : 'text-zinc-300'}`}>{horaFmt(asis?.salida ?? null)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase font-semibold">Horas</p>
            <p className="text-lg font-bold text-zinc-800">{duracion(asis?.entrada ?? null, asis?.salida ?? null)}</p>
          </div>
        </div>
      </div>

      {/* Botón de acción */}
      {cargando ? (
        <p className="text-center text-sm text-zinc-400 py-4">Cargando…</p>
      ) : !user ? (
        <p className="text-center text-sm text-zinc-400 py-4">Inicia sesión para checar.</p>
      ) : esMovil ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 bg-amber-50 rounded-2xl ring-1 ring-amber-100 text-center">
          <Monitor className="w-8 h-8 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">Solo desde la computadora</p>
          <p className="text-xs text-amber-700 leading-relaxed">El registro de entrada y salida solo se hace desde la computadora de la óptica, no desde el teléfono.</p>
        </div>
      ) : !yaEntro ? (
        <button onClick={() => marcar('entrada')} disabled={marcando}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#0D9488] text-white rounded-2xl text-base font-bold hover:bg-teal-600 transition-colors disabled:opacity-50 shadow-sm">
          <LogIn className="w-5 h-5" /> {marcando ? 'Registrando…' : 'Registrar entrada'}
        </button>
      ) : !yaSalio ? (
        <button onClick={() => marcar('salida')} disabled={marcando}
          className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-900 text-white rounded-2xl text-base font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-sm">
          <LogOut className="w-5 h-5" /> {marcando ? 'Registrando…' : 'Registrar salida'}
        </button>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6 bg-emerald-50 rounded-2xl ring-1 ring-emerald-100">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-800">Día registrado. ¡Buen trabajo!</p>
        </div>
      )}
    </div>
  )
}
