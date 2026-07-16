'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Search, Store, X, Clock, FlaskConical, LogOut, User, ChevronDown, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fecha'
import { getSucursalActual } from '@/lib/session'
import { useSession } from '@/hooks/useSession'

type Notif = { id: string; tipo: 'cita' | 'lab'; texto: string; sub: string }
type PacienteResult = { id: string; nombre: string; apellido: string; telefono: string }

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const { usuario: sessionUser, signOut } = useSession()
  const [legacyUser, setLegacyUser] = useState<{ nombre: string; sucursal: string; rol?: string } | null>(null)
  const [sucursalActual, setSucursalActual] = useState('')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) setLegacyUser(JSON.parse(raw))
    } catch { /* noop */ }
    setSucursalActual(getSucursalActual())
  }, [])
  const usuario = {
    nombre:   sessionUser?.nombre   || legacyUser?.nombre   || '',
    sucursal: sucursalActual,
    rol:      sessionUser?.rol      || legacyUser?.rol      || 'vendedor',
  }
  const [search, setSearch] = useState('')
  const [searchRes, setSearchRes] = useState<PacienteResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef  = useRef<HTMLDivElement>(null)
  const userRef   = useRef<HTMLDivElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const todayStr = today.charAt(0).toUpperCase() + today.slice(1)
  const todayISO = hoyLocal()

  // ── Load notifications ──
  const cargarNotifs = useCallback(async () => {
    const sb = createClient()
    const suc = usuario.sucursal && usuario.sucursal !== 'Todas' ? usuario.sucursal : null

    const [{ data: citas }, { data: labs }] = await Promise.all([
      (() => {
        let q = sb.from('citas').select('id, paciente_nombre, hora, estado').eq('fecha', todayISO)
          .in('estado', ['agendada', 'confirmada']).order('hora').limit(5)
        if (suc) q = q.eq('sucursal', suc)
        return q
      })(),
      (() => {
        let q = sb.from('ordenes_lab').select('id, paciente, folio').eq('estado', 'listo').limit(5)
        if (suc) q = q.eq('sucursal', suc)
        return q
      })(),
    ])

    const n: Notif[] = []
    ;(citas ?? []).forEach((c: Record<string, string>) => n.push({
      id: `c-${c.id}`, tipo: 'cita',
      texto: c.paciente_nombre || 'Paciente',
      sub: `Cita hoy a las ${c.hora}`,
    }))
    ;(labs ?? []).forEach((l: Record<string, string>) => n.push({
      id: `l-${l.id}`, tipo: 'lab',
      texto: l.paciente || 'Paciente',
      sub: `Lab ${l.folio} — listo para recoger`,
    }))
    setNotifs(n)
  }, [usuario.sucursal, todayISO])

  useEffect(() => {
    if (usuario.sucursal !== undefined) cargarNotifs()
  }, [usuario.sucursal, cargarNotifs])

  // ── Search pacientes ──
  useEffect(() => {
    if (search.length < 2) { setSearchRes([]); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const { data } = await createClient().from('pacientes')
        .select('id, nombre, apellido, telefono')
        .or(`nombre.ilike.%${search}%,apellido.ilike.%${search}%`)
        .limit(6)
      if (data) setSearchRes(data as PacienteResult[])
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [search])

  // ── Close on outside click ──
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const iniciales = usuario.nombre
    ? usuario.nombre.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()
    : 'RL'

  const cerrarSesion = async () => {
    localStorage.removeItem('optios_demo_user')
    await signOut()
    router.push('/login')
  }

  const irAExpediente = (p: PacienteResult) => {
    setSearch(''); setSearchOpen(false)
    router.push(`/dashboard/expedientes?search=${encodeURIComponent(`${p.nombre} ${p.apellido}`)}`)
  }

  return (
    <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0 relative z-30 gap-2">

      {/* ── Hamburger (mobile only) ── */}
      <button
        onClick={onMenuClick}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors flex-shrink-0"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5 text-zinc-600" />
      </button>

      {/* ── Search ── */}
      <div ref={searchRef} className="relative flex-1 lg:flex-none lg:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Buscar clientes, ventas, productos..."
          className="w-full pl-8 pr-8 py-1.5 text-[13px] bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder:text-zinc-400 transition-shadow"
        />
        {search && (
          <button onClick={() => { setSearch(''); setSearchRes([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown */}
        {searchOpen && search.length > 1 && (
          <div className="absolute top-full mt-1.5 left-0 w-full bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden z-50">
            {searchRes.length > 0 ? (
              <>
                <p className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wide border-b border-zinc-100">
                  Expedientes
                </p>
                {searchRes.map(p => (
                  <button key={p.id} onClick={() => irAExpediente(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#0B0E14] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p.nombre[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-700">{p.nombre} {p.apellido}</p>
                      <p className="text-xs text-zinc-400">{p.telefono}</p>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="px-4 py-4 text-sm text-zinc-400 text-center">
                Sin resultados para &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-2">

        {/* Date + Sucursal — hidden on mobile */}
        <div className="text-right mr-2 hidden md:block">
          <p className="text-[11px] text-zinc-400">{todayStr}</p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <Store className="w-3 h-3 text-teal-500" />
            {(usuario.rol === 'admin' || usuario.rol === 'gerente') ? (
              <select
                value={sucursalActual}
                onChange={e => {
                  const nueva = e.target.value
                  setSucursalActual(nueva)
                  try {
                    const raw = localStorage.getItem('optios_demo_user')
                    const u = raw ? JSON.parse(raw) : {}
                    localStorage.setItem('optios_demo_user', JSON.stringify({ ...u, sucursal: nueva }))
                  } catch { /* noop */ }
                  window.location.reload()
                }}
                className="text-[11px] font-medium text-zinc-600 bg-transparent border-none outline-none cursor-pointer hover:text-teal-600 transition-colors"
              >
                <option value="Baja Visión">Baja Visión</option>
                <option value="5 de Mayo">5 de Mayo</option>
                <option value="Plaza Laureles">Plaza Laureles</option>
              </select>
            ) : (
              <p className="text-[11px] font-medium text-zinc-600">
                {usuario.sucursal || 'Sin sucursal'}
              </p>
            )}
          </div>
        </div>

        {/* ── Notifications ── */}
        <div ref={notifRef} className="relative">
          <button onClick={() => { setNotifOpen(v => !v); setUserOpen(false) }}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">
            <Bell className="w-[15px] h-[15px] text-zinc-500" />
            {notifs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                <span className="text-sm font-bold text-zinc-700">Notificaciones</span>
                {notifs.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{notifs.length}</span>
                )}
              </div>

              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">Sin notificaciones pendientes</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50 max-h-72 overflow-y-auto">
                  {notifs.map(n => (
                    <button key={n.id}
                      onClick={() => {
                        setNotifOpen(false)
                        router.push(n.tipo === 'cita' ? '/dashboard/agenda' : '/dashboard/laboratorio')
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-zinc-50 flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${n.tipo === 'cita' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                        {n.tipo === 'cita' ? <Clock className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-700 truncate">{n.texto}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{n.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-zinc-100 px-4 py-2.5">
                <button onClick={() => { setNotifOpen(false); router.push('/dashboard/agenda') }}
                  className="text-xs text-teal-600 font-semibold hover:underline">
                  Ver agenda de hoy →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── User avatar ── */}
        <div ref={userRef} className="relative">
          <button onClick={() => { setUserOpen(v => !v); setNotifOpen(false) }}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-100 transition-colors">
            <div className="w-7 h-7 rounded-full bg-[#0B0E14] flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">{iniciales}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-zinc-100">
                <p className="text-sm font-bold text-zinc-800">{usuario.nombre || 'Usuario'}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{usuario.rol || 'Vendedor'} · {usuario.sucursal || 'Todas'}</p>
              </div>
              <button onClick={() => { setUserOpen(false); router.push('/dashboard/ajustes') }}
                className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-2.5 text-sm text-zinc-600">
                <User className="w-4 h-4 text-zinc-400" /> Mi perfil
              </button>
              <div className="border-t border-zinc-100" />
              <button onClick={cerrarSesion}
                className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-2.5 text-sm text-red-500">
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
