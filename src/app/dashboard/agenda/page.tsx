'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, Plus, X, Save,
  Clock, Store, FileText, ChevronDown,
  CheckCircle2, XCircle, AlertCircle, Calendar,
  Search, UserCheck, User,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type EstadoCita = 'agendada' | 'confirmada' | 'atendida' | 'cancelada' | 'no_asistio'

type Cita = {
  id: string
  pacienteId: string | null
  paciente: string
  telefono: string
  tipo: string
  seguimiento: number | null
  fecha: string
  hora: string
  duracion: number
  sucursal: string
  notas: string
  estado: EstadoCita
}

type PacienteBuscador = { id: string; nombre: string; telefono: string }

const TIPOS_CITA = ['Examen visual', 'Cita web', 'Revisión', 'Consulta', 'Lentes de contacto']
const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

const TIPO_COLORES: Record<string, { cell: string; dot: string }> = {
  'Examen visual':      { cell: 'bg-indigo-100 border-l-indigo-500 text-indigo-800',  dot: '#6366F1' },
  'Cita web':           { cell: 'bg-teal-100 border-l-[#0D9488] text-teal-800',       dot: '#0D9488' },
  'Revisión':           { cell: 'bg-purple-100 border-l-purple-500 text-purple-800',  dot: '#A855F7' },
  'Consulta':           { cell: 'bg-blue-100 border-l-blue-500 text-blue-800',         dot: '#3B82F6' },
  'Lentes de contacto': { cell: 'bg-orange-100 border-l-orange-500 text-orange-800',  dot: '#F97316' },
}

const ESTADO_CONFIG: Record<EstadoCita, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  agendada:    { label: 'Agendada',    bg: 'bg-zinc-100',   text: 'text-zinc-600',   icon: Calendar },
  confirmada:  { label: 'Confirmada',  bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: CheckCircle2 },
  atendida:    { label: 'Atendida',    bg: 'bg-blue-50',     text: 'text-blue-700',    icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',   bg: 'bg-red-50',      text: 'text-red-600',     icon: XCircle },
  no_asistio:  { label: 'No asistió', bg: 'bg-amber-50',    text: 'text-amber-700',   icon: AlertCircle },
}

// 10:00 – 18:00
const HORAS = Array.from({ length: 9 }, (_, i) => `${(i + 10).toString().padStart(2, '0')}:00`)
const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getSemana(base: Date) {
  const lunes = new Date(base)
  const dia = lunes.getDay()
  lunes.setDate(lunes.getDate() - (dia === 0 ? 6 : dia - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }

const hoy = new Date()

const formVacio = (sucursal = 'Baja Visión'): Omit<Cita, 'id'> => ({
  pacienteId: null, paciente: '', telefono: '',
  tipo: 'Examen visual', seguimiento: null,
  fecha: fmt(hoy), hora: '10:00', duracion: 45,
  sucursal, notas: '', estado: 'agendada',
})

// ─────────────────────────────────────────
// Buscador de paciente (busca en Supabase)
// ─────────────────────────────────────────
function BuscadorPaciente({
  value, onSelect, onManual,
}: {
  value: { id: string | null; nombre: string; telefono: string }
  onSelect: (p: PacienteBuscador) => void
  onManual: (nombre: string) => void
}) {
  const [query, setQuery]       = useState(value.nombre)
  const [open, setOpen]         = useState(false)
  const [resultados, setResultados] = useState<PacienteBuscador[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Búsqueda con debounce
  useEffect(() => {
    if (query.length < 2) { setResultados([]); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const sb = createClient()
      const { data } = await sb
        .from('pacientes')
        .select('id, nombre, apellido, telefono')
        .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
        .limit(6)
      if (data) {
        setResultados(data.map((p: { id: string; nombre: string; apellido: string; telefono: string }) => ({
          id: p.id,
          nombre: `${p.nombre} ${p.apellido}`.trim(),
          telefono: p.telefono ?? '',
        })))
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onManual(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full border border-zinc-200 rounded pl-9 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          placeholder="Buscar paciente o escribir nombre nuevo..."
        />
        {value.id && (
          <div className="absolute right-2 top-1/2 -tranzinc-y-1/2 flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
            <UserCheck className="w-3 h-3" /> Expediente
          </div>
        )}
      </div>
      {open && query.length > 1 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded shadow-lg overflow-hidden">
          {resultados.length > 0 ? (
            <>
              {resultados.map(p => (
                <button key={p.id} onClick={() => { onSelect(p); setQuery(p.nombre); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 transition-colors flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#0B0E14] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {p.nombre[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-700">{p.nombre}</p>
                    <p className="text-xs text-zinc-400">{p.telefono}</p>
                  </div>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                </button>
              ))}
              <div className="px-4 py-2 border-t border-zinc-100">
                <button onClick={() => { onManual(query); setOpen(false) }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Continuar con &ldquo;{query}&rdquo; como paciente nuevo
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3">
              <p className="text-sm text-zinc-500 mb-2">No se encontró en expedientes</p>
              <button onClick={() => { onManual(query); setOpen(false) }}
                className="text-xs text-[#0D9488] font-semibold flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Registrar &ldquo;{query}&rdquo; como paciente nuevo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function AgendaPage() {
  const [citas, setCitas]           = useState<Cita[]>([])
  const [cargando, setCargando]     = useState(true)
  const [usuario, setUsuario]       = useState({ nombre: '', sucursal: '' })
  const [baseDate, setBaseDate]     = useState(new Date())
  const [vista, setVista]           = useState<'semana' | 'lista'>('semana')
  const [sucursalFiltro, setSucursalFiltro] = useState('Todas')
  const [modal, setModal]           = useState(false)
  const [guardando, setGuardando]   = useState(false)
  const [editando, setEditando]     = useState<Cita | null>(null)
  const [form, setForm]             = useState<Omit<Cita, 'id'>>(formVacio())
  const [detalle, setDetalle]       = useState<Cita | null>(null)

  const semana   = getSemana(baseDate)
  const mesLabel = `${MESES[semana[0].getMonth()]} ${semana[0].getFullYear()}`

  // ── Leer usuario del localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUsuario({ nombre: u.nombre ?? '', sucursal: u.sucursal ?? '' })
        // Si el usuario tiene sucursal específica, filtrar por ella
        if (u.sucursal && u.sucursal !== 'Todas') {
          setSucursalFiltro(u.sucursal)
        }
      }
    } catch { /* noop */ }
  }, [])

  // ── Cargar citas desde Supabase ──
  const cargarCitas = useCallback(async (sucursal: string) => {
    setCargando(true)
    const sb = createClient()
    // Si tiene sucursal específica, filtrar; si es 'Todas', cargar todas
    let query = sb
      .from('citas')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
    if (sucursal && sucursal !== 'Todas') {
      query = query.eq('sucursal', sucursal)
    }
    const { data } = await query
    if (data) {
      setCitas(data.map((c: Record<string, unknown>) => ({
        id:          c.id as string,
        pacienteId:  c.paciente_id as string | null,
        paciente:    (c.paciente_nombre as string) ?? '',
        telefono:    (c.paciente_telefono as string) ?? '',
        tipo:        (c.tipo as string) ?? 'Revisión',
        seguimiento: c.seguimiento as number | null,
        fecha:       c.fecha as string,
        hora:        (c.hora as string) ?? '10:00',
        duracion:    (c.duracion as number) ?? 30,
        sucursal:    c.sucursal as string,
        notas:       (c.notas as string) ?? '',
        estado:      (c.estado as EstadoCita) ?? 'agendada',
      })))
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    // Cargar citas cuando se conoce la sucursal del usuario
    if (usuario.sucursal !== '') {
      cargarCitas(usuario.sucursal)
    } else if (!localStorage.getItem('optios_demo_user')) {
      // sin login → cargar todas
      cargarCitas('Todas')
    }
  }, [usuario.sucursal, cargarCitas])

  // ── Filtrado local ──
  const citasFiltradas = citas.filter(c =>
    sucursalFiltro === 'Todas' || c.sucursal === sucursalFiltro
  )

  const citasDia  = (fecha: string) =>
    citasFiltradas.filter(c => c.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora))
  const citasHora = (fecha: string, hora: string) =>
    citasFiltradas.filter(c => c.fecha === fecha && c.hora === hora)

  const citasHoy  = citasFiltradas.filter(c => c.fecha === fmt(hoy))
  const confirmadas = citasHoy.filter(c => c.estado === 'confirmada').length
  const atendidas   = citasHoy.filter(c => c.estado === 'atendida').length
  const pendientes  = citasHoy.filter(c => c.estado === 'agendada').length

  const abrirNueva = (fecha?: string, hora?: string) => {
    setEditando(null)
    const suc = usuario.sucursal !== 'Todas' && usuario.sucursal ? usuario.sucursal : 'Baja Visión'
    setForm({ ...formVacio(suc), fecha: fecha ?? fmt(hoy), hora: hora ?? '10:00' })
    setModal(true)
  }

  const abrirEditar = (c: Cita) => {
    setEditando(c)
    setForm({
      pacienteId: c.pacienteId, paciente: c.paciente, telefono: c.telefono,
      tipo: c.tipo, seguimiento: c.seguimiento, fecha: c.fecha, hora: c.hora,
      duracion: c.duracion, sucursal: c.sucursal, notas: c.notas, estado: c.estado,
    })
    setDetalle(null)
    setModal(true)
  }

  // ── Guardar cita (nueva o editar) en Supabase ──
  const guardar = async () => {
    if (!form.paciente || guardando) return
    setGuardando(true)
    const sb = createClient()
    const payload = {
      paciente_id:       form.pacienteId,
      paciente_nombre:   form.paciente,
      paciente_telefono: form.telefono,
      tipo:              form.tipo,
      seguimiento:       form.seguimiento,
      fecha:             form.fecha,
      hora:              form.hora,
      duracion:          form.duracion,
      sucursal:          form.sucursal,
      notas:             form.notas,
      estado:            form.estado,
    }
    if (editando) {
      const { error } = await sb.from('citas').update(payload).eq('id', editando.id)
      if (!error) {
        setCitas(prev => prev.map(c => c.id === editando.id ? { ...c, ...form } : c))
      }
    } else {
      const { data, error } = await sb.from('citas').insert(payload).select().single()
      if (!error && data) {
        const nueva: Cita = {
          id: data.id, pacienteId: form.pacienteId, paciente: form.paciente,
          telefono: form.telefono, tipo: form.tipo, seguimiento: form.seguimiento,
          fecha: form.fecha, hora: form.hora, duracion: form.duracion,
          sucursal: form.sucursal, notas: form.notas, estado: form.estado,
        }
        setCitas(prev => [...prev, nueva])
      }
    }
    setGuardando(false)
    setModal(false)
  }

  // ── Cambiar estado en Supabase ──
  const cambiarEstado = async (id: string, estado: EstadoCita) => {
    const sb = createClient()
    await sb.from('citas').update({ estado }).eq('id', id)
    setCitas(prev => prev.map(c => c.id === id ? { ...c, estado } : c))
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, estado } : null)
  }

  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const tipoLabel = (c: Cita) =>
    c.tipo === 'Revisión' && c.seguimiento ? `Revisión — Seguimiento ${c.seguimiento}` : c.tipo

  const esAdmin = usuario.sucursal === 'Todas' || !usuario.sucursal

  return (
    <div className="space-y-5 h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Agenda</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Citas y reservaciones · Lun–Dom, 10:00–18:00</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro sucursal solo visible para admin/todas */}
          {esAdmin && (
            <div className="relative">
              <select value={sucursalFiltro} onChange={e => setSucursalFiltro(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 text-sm bg-white border border-zinc-200 rounded text-zinc-600 focus:outline-none">
                {['Todas', ...SUCURSALES].map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          )}
          <button onClick={() => abrirNueva()}
            className="flex items-center gap-2 bg-[#0B0E14] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#1A1D27] active:scale-[0.98] transition-all">
            <Plus className="w-4 h-4" /> Nueva cita
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Citas hoy',    value: citasHoy.length, color: 'text-zinc-800',   sub: 'total programadas' },
          { label: 'Confirmadas',  value: confirmadas,      color: 'text-emerald-600', sub: 'listas para atender' },
          { label: 'Por atender',  value: pendientes,       color: 'text-blue-600',    sub: 'agendadas sin confirmar' },
          { label: 'Atendidas',    value: atendidas,        color: 'text-zinc-400',   sub: 'completadas hoy' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
            <p className="text-xs font-medium text-zinc-400">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{cargando ? '—' : k.value}</p>
            <p className="text-xs text-zinc-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}
            className="w-8 h-8 flex items-center justify-center rounded border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
          <span className="text-sm font-semibold text-zinc-700 min-w-48 text-center">{mesLabel}</span>
          <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }}
            className="w-8 h-8 flex items-center justify-center rounded border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
          <button onClick={() => setBaseDate(new Date())}
            className="ml-2 px-3 py-1.5 text-xs font-medium border border-zinc-200 bg-white rounded hover:bg-zinc-50 transition-colors text-zinc-600">
            Hoy
          </button>
        </div>
        <div className="flex items-center border border-zinc-200 rounded overflow-hidden">
          {(['semana', 'lista'] as const).map((v, i) => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${vista === v ? 'bg-[#0B0E14] text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>
              {['Semana', 'Lista'][i]}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">Cargando citas...</div>
      ) : (
        <>
          {/* ── VISTA SEMANA ── */}
          {vista === 'semana' && (
            <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden flex-1">
              <div className="grid border-b border-zinc-100" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
                <div className="border-r border-zinc-100" />
                {semana.map((dia, i) => {
                  const esHoy = fmt(dia) === fmt(hoy)
                  const esDom = i === 6
                  const n = citasDia(fmt(dia)).length
                  return (
                    <div key={i} className={`px-2 py-3 border-r last:border-r-0 border-zinc-100 text-center ${esHoy ? 'bg-[#0B0E14]' : esDom ? 'bg-zinc-50' : ''}`}>
                      <p className={`text-xs font-semibold ${esHoy ? 'text-[#0D9488]' : esDom ? 'text-zinc-400' : 'text-zinc-400'}`}>{DIAS_LABEL[i]}</p>
                      <p className={`text-lg font-bold mt-0.5 ${esHoy ? 'text-white' : esDom ? 'text-zinc-500' : 'text-zinc-700'}`}>{dia.getDate()}</p>
                      {n > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${esHoy ? 'bg-[#0D9488]/20 text-[#0D9488]' : 'bg-zinc-100 text-zinc-500'}`}>{n}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="overflow-y-auto max-h-[460px]">
                {HORAS.map(hora => (
                  <div key={hora} className="grid border-b border-zinc-50 last:border-b-0" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
                    <div className="px-2 py-2 border-r border-zinc-100 text-right flex-shrink-0">
                      <span className="text-xs text-zinc-400 font-medium">{hora}</span>
                    </div>
                    {semana.map((dia, di) => {
                      const cs = citasHora(fmt(dia), hora)
                      const esDom = di === 6
                      return (
                        <div key={di}
                          className={`border-r last:border-r-0 border-zinc-100 p-1 min-h-[56px] cursor-pointer group relative ${esDom ? 'bg-zinc-50/60' : 'hover:bg-zinc-50/50'}`}
                          onClick={() => cs.length === 0 && abrirNueva(fmt(dia), hora)}
                        >
                          {cs.length === 0 && (
                            <div className="opacity-0 group-hover:opacity-100 absolute inset-1 flex items-center justify-center transition-opacity pointer-events-none">
                              <Plus className="w-3.5 h-3.5 text-zinc-300" />
                            </div>
                          )}
                          {cs.map(c => {
                            const colores = TIPO_COLORES[c.tipo]?.cell ?? 'bg-zinc-100 border-l-zinc-400 text-zinc-700'
                            return (
                              <div key={c.id}
                                onClick={e => { e.stopPropagation(); setDetalle(c) }}
                                className={`text-xs px-1.5 py-1 rounded border-l-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity ${colores}`}
                              >
                                <p className="font-semibold truncate leading-tight">{c.paciente}</p>
                                <p className="opacity-70 truncate leading-tight">{tipoLabel(c)}</p>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VISTA LISTA ── */}
          {vista === 'lista' && (
            <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
              <div className="divide-y divide-zinc-50">
                {semana.map((dia, idx) => {
                  const cs = citasDia(fmt(dia))
                  const esHoy = fmt(dia) === fmt(hoy)
                  const esDom = idx === 6
                  return (
                    <div key={fmt(dia)}>
                      <div className={`flex items-center gap-3 px-5 py-3 ${esHoy ? 'bg-[#0B0E14]' : esDom ? 'bg-zinc-50' : 'bg-zinc-50'}`}>
                        <Calendar className={`w-4 h-4 ${esHoy ? 'text-[#0D9488]' : 'text-zinc-400'}`} />
                        <span className={`text-sm font-semibold ${esHoy ? 'text-white' : 'text-zinc-600'}`}>
                          {DIAS_LABEL[idx]}, {dia.getDate()} de {MESES[dia.getMonth()]}
                          {esHoy && <span className="ml-2 text-xs text-[#0D9488]">— Hoy</span>}
                        </span>
                        {cs.length === 0 && <span className={`text-xs ml-auto ${esHoy ? 'text-white/40' : 'text-zinc-400'}`}>Sin citas</span>}
                      </div>
                      {cs.map(c => {
                        const ec = ESTADO_CONFIG[c.estado]
                        const EIcon = ec.icon
                        const dot = TIPO_COLORES[c.tipo]?.dot ?? '#CBD5E1'
                        return (
                          <div key={c.id}
                            onClick={() => setDetalle(c)}
                            className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors cursor-pointer">
                            <div className="w-14 text-center flex-shrink-0">
                              <p className="text-sm font-bold text-zinc-700">{c.hora}</p>
                              <p className="text-xs text-zinc-400">{c.duracion}min</p>
                            </div>
                            <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: dot }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-zinc-700">{c.paciente}
                                {c.pacienteId && <span className="ml-2 text-xs font-normal text-emerald-500">expediente</span>}
                              </p>
                              <p className="text-xs text-zinc-400">{tipoLabel(c)} · {c.sucursal}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded ${ec.bg} ${ec.text}`}>
                              <EIcon className="w-3 h-3" /> {ec.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PANEL DETALLE ── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div>
                <p className="text-sm font-bold text-zinc-800">{detalle.paciente}
                  {detalle.pacienteId && <span className="ml-2 text-xs font-normal text-emerald-500">expediente</span>}
                </p>
                <p className="text-xs text-zinc-400">{detalle.telefono}</p>
              </div>
              <button onClick={() => setDetalle(null)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span>{detalle.hora} · {detalle.duracion} min · {tipoLabel(detalle)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Store className="w-4 h-4 text-zinc-400" />
                <span>{detalle.sucursal}</span>
              </div>
              {detalle.notas && (
                <div className="flex items-start gap-2 text-sm text-zinc-600">
                  <FileText className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <span>{detalle.notas}</span>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-2">Cambiar estado</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['agendada','confirmada','atendida','cancelada','no_asistio'] as EstadoCita[]).map(e => {
                    const ec = ESTADO_CONFIG[e]
                    return (
                      <button key={e} onClick={() => cambiarEstado(detalle.id, e)}
                        className={`py-2 rounded text-xs font-semibold border transition-all ${detalle.estado === e ? `${ec.bg} ${ec.text} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                        {ec.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 pb-4 flex gap-2">
              <button onClick={() => setDetalle(null)}
                className="flex-1 py-2 border border-zinc-200 rounded text-sm text-zinc-500 hover:bg-zinc-50">
                Cerrar
              </button>
              <button onClick={() => abrirEditar(detalle)}
                className="flex-1 py-2 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-[#1A1D27]">
                Editar cita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA / EDITAR ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-800">{editando ? 'Editar cita' : 'Nueva cita'}</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Paciente */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Paciente *</label>
                <BuscadorPaciente
                  value={{ id: form.pacienteId, nombre: form.paciente, telefono: form.telefono }}
                  onSelect={p => setForm(prev => ({ ...prev, pacienteId: p.id, paciente: p.nombre, telefono: p.telefono }))}
                  onManual={nombre => setForm(prev => ({ ...prev, pacienteId: null, paciente: nombre }))}
                />
                {form.pacienteId === null && form.paciente && (
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono</label>
                    <input value={form.telefono} onChange={e => f('telefono', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                      placeholder="686 000 0000" />
                  </div>
                )}
              </div>

              {/* Tipo de cita */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de cita</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_CITA.map(t => (
                    <button key={t} onClick={() => { f('tipo', t); if (t !== 'Revisión') f('seguimiento', null) }}
                      className={`py-2.5 px-3 rounded text-xs font-medium border text-left transition-all ${form.tipo === t ? 'bg-[#0B0E14] border-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                      {t === 'Cita web' ? 'Cita web · automático' : t}
                    </button>
                  ))}
                </div>
                {form.tipo === 'Revisión' && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Seguimiento #</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(n => (
                        <button key={n} onClick={() => f('seguimiento', n)}
                          className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${form.seguimiento === n ? 'bg-purple-600 border-purple-600 text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fecha + hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Hora *</label>
                  <div className="relative">
                    <select value={form.hora} onChange={e => f('hora', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {Array.from({ length: 17 }, (_, i) => {
                        const h = Math.floor(i / 2) + 10
                        const m = i % 2 === 0 ? '00' : '30'
                        if (h > 18 || (h === 18 && m === '30')) return null
                        return `${h.toString().padStart(2,'0')}:${m}`
                      }).filter(Boolean).map(h => <option key={h!}>{h}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Duración + sucursal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Duración</label>
                  <div className="relative">
                    <select value={form.duracion} onChange={e => f('duracion', parseInt(e.target.value))}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {[15,20,30,45,60,90].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <div className="relative">
                    <select value={form.sucursal} onChange={e => f('sucursal', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8"
                      disabled={!esAdmin}>
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Estado</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['agendada','confirmada','atendida','cancelada','no_asistio'] as EstadoCita[]).map(e => {
                    const ec = ESTADO_CONFIG[e]
                    return (
                      <button key={e} onClick={() => f('estado', e)}
                        className={`py-2 rounded text-xs font-semibold border transition-all ${form.estado === e ? `${ec.bg} ${ec.text} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                        {ec.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  <FileText className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Notas
                </label>
                <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={4}
                  className="w-full border border-zinc-200 rounded px-3 py-3 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none placeholder:text-zinc-400"
                  placeholder="Indicaciones especiales, historial relevante, motivo de consulta..." />
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.paciente || (form.tipo === 'Revisión' && !form.seguimiento) || guardando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-all">
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agendar cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
