'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { bloqueAnual, diasDesbloqueados, diasParaSiguiente, inicioAnioServicio, diasVacaciones } from '@/lib/vacaciones'
import { Palmtree, CalendarDays, Check, X, AlertTriangle, Clock3 } from 'lucide-react'

type Solicitud = {
  id: string; usuario_id: string; usuario_nombre: string | null; sucursal: string | null
  tipo: string; fecha_inicio: string; fecha_fin: string; dias: number; motivo: string | null
  estado: string; resuelto_por: string | null; resuelto_at: string | null; created_at: string
}
type Emp = { id: string; nombre: string; apodo: string | null; sucursal: string | null; fecha_ingreso: string | null; rol: string }

const fmtF = (f: string | null) => {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1] ?? ''} ${y}`
}
const rango = (a: string, b: string) => a === b ? fmtF(a) : `${fmtF(a)} – ${fmtF(b)}`
const solapan = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && b1 <= a2

const BADGE: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700',
  aprobada: 'bg-emerald-50 text-emerald-700',
  rechazada: 'bg-rose-50 text-rose-600',
}

export default function VacacionesPage() {
  const [user, setUser] = useState<{ id: string; nombre: string; apodo: string; sucursal: string; rol: string } | null>(null)
  const [miIngreso, setMiIngreso] = useState<string | null>(null)
  const [miDescanso, setMiDescanso] = useState<string | null>(null)
  const [miNacimiento, setMiNacimiento] = useState<string | null>(null)
  const [mias, setMias] = useState<Solicitud[]>([])
  const [empleados, setEmpleados] = useState<Emp[]>([])
  const [todas, setTodas] = useState<Solicitud[]>([])
  const [form, setForm] = useState({ tipo: 'vacaciones', fecha_inicio: '', fecha_fin: '', motivo: '' })
  const [enviando, setEnviando] = useState(false)

  const esGestor = user?.rol === 'administrador' || user?.rol === 'gerente'

  const cargarMias = useCallback(async (uid: string) => {
    const res = await fetch(`/api/empleados/vacaciones?usuario_id=${uid}`)
    const j = await res.json()
    setMias((j.ok ? j.solicitudes : []) as Solicitud[])
  }, [])

  const cargarAdmin = useCallback(async () => {
    const { data } = await createClient().from('usuarios')
      .select('id, nombre, apodo, sucursal, fecha_ingreso, rol').eq('activo', true).neq('rol', 'administrador').order('nombre')
    setEmpleados((data ?? []) as Emp[])
    const res = await fetch('/api/empleados/vacaciones')
    const j = await res.json()
    setTodas((j.ok ? j.solicitudes : []) as Solicitud[])
  }, [])

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      if (!u.id) return
      setUser({ id: u.id, nombre: u.nombre ?? '', apodo: u.apodo ?? (u.nombre?.split(' ')[0] ?? ''), sucursal: u.sucursal ?? '', rol: u.rol ?? 'vendedor' })
      cargarMias(u.id)
      createClient().from('usuarios').select('fecha_ingreso, dia_descanso, fecha_nacimiento').eq('id', u.id).single()
        .then(({ data }) => { setMiIngreso(data?.fecha_ingreso ?? null); setMiDescanso(data?.dia_descanso ?? null); setMiNacimiento(data?.fecha_nacimiento ?? null) })
      if (u.rol === 'administrador' || u.rol === 'gerente') cargarAdmin()
    } catch { /* noop */ }
  }, [cargarMias, cargarAdmin])

  // Saldo propio — el bloque del año se desbloquea poco a poco
  const diasTotales = bloqueAnual(miIngreso)
  const desbloqueados = diasDesbloqueados(miIngreso)
  const faltanParaSig = diasParaSiguiente(miIngreso)
  const inicioAnio = miIngreso ? inicioAnioServicio(miIngreso) : null
  const tomados = mias.filter(s => s.tipo === 'vacaciones' && s.estado === 'aprobada' && (!inicioAnio || s.fecha_inicio >= inicioAnio))
    .reduce((n, s) => n + s.dias, 0)
  const disponibles = Math.max(0, desbloqueados - tomados)

  const diasSolicitud = form.fecha_inicio && form.fecha_fin ? diasVacaciones(form.fecha_inicio, form.fecha_fin, miDescanso, miNacimiento) : 0

  const enviar = async () => {
    if (!user || !form.fecha_inicio || !form.fecha_fin) return
    if (form.fecha_fin < form.fecha_inicio) { alert('La fecha final no puede ser antes de la inicial.'); return }
    setEnviando(true)
    try {
      const res = await fetch('/api/empleados/vacaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id, usuario_nombre: user.nombre, sucursal: user.sucursal,
          tipo: form.tipo, fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
          dias: diasSolicitud, motivo: form.motivo || null,
        }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setMias(prev => [j.solicitud as Solicitud, ...prev])
      if (esGestor) setTodas(prev => [j.solicitud as Solicitud, ...prev])
      setForm({ tipo: 'vacaciones', fecha_inicio: '', fecha_fin: '', motivo: '' })
    } catch (e) {
      alert('No se pudo enviar: ' + (e instanceof Error ? e.message : ''))
    } finally { setEnviando(false) }
  }

  const resolver = async (s: Solicitud, estado: 'aprobada' | 'rechazada') => {
    if (!user) return
    const res = await fetch('/api/empleados/vacaciones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, estado, resuelto_por: user.nombre }),
    })
    const j = await res.json()
    if (!j.ok) { alert('No se pudo: ' + j.error); return }
    const upd = (arr: Solicitud[]) => arr.map(x => x.id === s.id ? { ...x, estado, resuelto_por: user.nombre } : x)
    setTodas(upd); setMias(upd)
  }

  const pendientes = todas.filter(s => s.estado === 'pendiente')
  const aprobadas = todas.filter(s => s.estado === 'aprobada')

  // Empalmes (entre todas las sucursales) para una solicitud pendiente
  const empalmesDe = (s: Solicitud) => aprobadas.filter(a =>
    a.usuario_id !== s.usuario_id && solapan(s.fecha_inicio, s.fecha_fin, a.fecha_inicio, a.fecha_fin))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <Palmtree className="w-5 h-5 text-[#0D9488]" />
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Vacaciones</h1>
      </div>

      {/* Mi saldo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <div className="bg-teal-50 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold">Me tocan este año</p>
          <p className="text-2xl font-bold text-teal-700">{diasTotales}</p>
          <p className="text-[10px] text-zinc-400">por tu antigüedad</p>
        </div>
        <div className="bg-zinc-50 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold">Desbloqueados</p>
          <p className="text-2xl font-bold text-zinc-800">{desbloqueados}</p>
          <p className="text-[10px] text-zinc-400">liberados a hoy</p>
        </div>
        <div className="bg-zinc-50 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold">Tomados</p>
          <p className="text-2xl font-bold text-zinc-800">{tomados}</p>
        </div>
        <div className="bg-zinc-50 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold">Disponibles</p>
          <p className="text-2xl font-bold text-zinc-900">{disponibles}</p>
        </div>
      </div>
      {diasTotales > 0 && desbloqueados < diasTotales && (
        <p className="text-xs text-zinc-400 mb-5">Se desbloquea 1 día cada ~{Math.round(365 / diasTotales)} días · el siguiente en {faltanParaSig} día{faltanParaSig === 1 ? '' : 's'}.</p>
      )}
      {desbloqueados >= diasTotales && diasTotales > 0 && <div className="mb-5" />}

      {/* Solicitar */}
      <div className="bg-white rounded-xl ring-1 ring-zinc-200 p-4 mb-6">
        <p className="text-sm font-bold text-zinc-700 mb-3">Solicitar días</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase font-semibold mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none">
              <option value="vacaciones">Vacaciones (pagadas)</option>
              <option value="sin_goce">Descanso sin goce (no pagado)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase font-semibold mb-1">Del</label>
            <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
              className="border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase font-semibold mb-1">Al</label>
            <input type="date" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
              className="border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] text-zinc-500 uppercase font-semibold mb-1">Motivo (opcional)</label>
            <input type="text" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}
              className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-zinc-500">
            {diasSolicitud > 0 ? `${diasSolicitud} día${diasSolicitud > 1 ? 's' : ''} hábiles` : 'Elige las fechas'}
            {diasSolicitud > 0 && <span className="text-zinc-400"> · no cuenta tu descanso, festivos ni tu cumpleaños</span>}
            {form.tipo === 'vacaciones' && diasSolicitud > disponibles && diasSolicitud > 0 &&
              <span className="text-amber-600 font-semibold"> · excede tu saldo ({disponibles})</span>}
          </p>
          <button onClick={enviar} disabled={enviando || diasSolicitud === 0}
            className="flex items-center gap-1.5 bg-[#0D9488] text-white text-sm font-bold px-4 py-2 rounded hover:bg-teal-600 disabled:opacity-50">
            <CalendarDays className="w-4 h-4" /> {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </div>

      {/* Mis solicitudes */}
      <div className="mb-8">
        <p className="text-sm font-bold text-zinc-700 mb-2">Mis solicitudes</p>
        {mias.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4">Aún no has solicitado días.</p>
        ) : (
          <div className="space-y-1.5">
            {mias.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-white ring-1 ring-zinc-100 rounded-lg px-3 py-2.5 text-sm">
                <span className="flex-1 text-zinc-700">{rango(s.fecha_inicio, s.fecha_fin)}
                  <span className="text-zinc-400"> · {s.dias}d · {s.tipo === 'sin_goce' ? 'sin goce' : 'vacaciones'}</span></span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${BADGE[s.estado] ?? 'bg-zinc-100 text-zinc-500'}`}>{s.estado}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Gestión (admin / gerente) ── */}
      {esGestor && (
        <>
          <div className="border-t border-zinc-200 pt-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-zinc-700">Solicitudes por aprobar {pendientes.length > 0 && <span className="text-amber-600">({pendientes.length})</span>}</p>
            </div>
            {pendientes.length === 0 ? (
              <p className="text-sm text-zinc-400 py-2">Nada pendiente.</p>
            ) : (
              <div className="space-y-2">
                {pendientes.map(s => {
                  const emp = empalmesDe(s)
                  return (
                    <div key={s.id} className="bg-white ring-1 ring-zinc-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-zinc-800">{s.usuario_nombre} <span className="text-zinc-400 font-normal">· {s.sucursal}</span></p>
                          <p className="text-xs text-zinc-500">{rango(s.fecha_inicio, s.fecha_fin)} · {s.dias}d · {s.tipo === 'sin_goce' ? 'sin goce' : 'vacaciones'}{s.motivo ? ` · ${s.motivo}` : ''}</p>
                        </div>
                        <button onClick={() => resolver(s, 'aprobada')} className="flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-emerald-600"><Check className="w-3.5 h-3.5" />Aprobar</button>
                        <button onClick={() => resolver(s, 'rechazada')} className="flex items-center gap-1 bg-zinc-100 text-zinc-600 text-xs font-bold px-3 py-1.5 rounded hover:bg-zinc-200"><X className="w-3.5 h-3.5" />Rechazar</button>
                      </div>
                      {emp.length > 0 && (
                        <div className="mt-2 flex items-start gap-1.5 bg-amber-50 rounded px-2.5 py-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-700">Empalma con: {emp.map(a => `${a.usuario_nombre} (${a.sucursal}, ${rango(a.fecha_inicio, a.fecha_fin)})`).join(' · ')}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Saldos de todo el equipo */}
          <div>
            <p className="text-sm font-bold text-zinc-700 mb-2">Saldos del equipo</p>
            <div className="bg-white ring-1 ring-zinc-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-400">
                <span className="col-span-2">Empleado</span><span className="text-center">Le tocan</span><span className="text-center">Desbloq.</span><span className="text-center">Tomados</span><span className="text-center">Disponibles</span>
              </div>
              {empleados.map(e => {
                const total = bloqueAnual(e.fecha_ingreso)
                const desbloq = diasDesbloqueados(e.fecha_ingreso)
                const ini = e.fecha_ingreso ? inicioAnioServicio(e.fecha_ingreso) : null
                const tom = todas.filter(s => s.usuario_id === e.id && s.tipo === 'vacaciones' && s.estado === 'aprobada' && (!ini || s.fecha_inicio >= ini)).reduce((n, s) => n + s.dias, 0)
                const disp = Math.max(0, desbloq - tom)
                return (
                  <div key={e.id} className="grid grid-cols-6 gap-2 px-4 py-2.5 border-t border-zinc-50 text-sm items-center">
                    <span className="col-span-2 text-zinc-700">{e.nombre} <span className="text-zinc-400 text-xs">· {e.sucursal}</span></span>
                    <span className="text-center text-zinc-600">{total}</span>
                    <span className="text-center text-zinc-600">{desbloq}</span>
                    <span className="text-center text-zinc-600">{tom}</span>
                    <span className="text-center font-bold text-zinc-900">{disp}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
