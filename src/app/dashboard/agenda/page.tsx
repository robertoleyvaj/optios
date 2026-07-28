'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFecha } from '@/lib/fecha'
import {
  ChevronLeft, ChevronRight, Plus, X, Save, Clock, Store,
  FileText, ChevronDown, XCircle, Calendar, Search, UserCheck,
  User, Phone, Mail, Eye, CreditCard, Pencil,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type EstadoCita = 'agendada' | 'confirmada' | 'atendida' | 'cancelada' |
                  'no_asistio' | 'llego' | 'en_consulta' | 'en_espera'

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

type DetallePaciente = {
  id: string; nombre: string; apellido: string
  telefono: string; email: string; fecha_nacimiento: string | null
}

type DetalleData = {
  paciente: DetallePaciente | null
  lastReceta: { tipo: string; fecha: string } | null
  lastVenta: { folio: string; total: number; created_at: string } | null
}

type PacienteBuscador = { id: string; nombre: string; telefono: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const TIPOS_CITA = ['Examen visual', 'Cita web', 'Revisión', 'Consulta', 'Lentes de contacto']
const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const START_H = 8
const END_H   = 19
const PX_MIN  = 1.15  // pixels per minute
const HORAS   = Array.from({ length: END_H - START_H }, (_, i) => i + START_H)

const EC: Record<EstadoCita, { label: string; bg: string; text: string; dot: string }> = {
  agendada:    { label: 'Pendiente',   bg: 'bg-amber-50',   text: 'text-amber-700',  dot: '#F59E0B' },
  confirmada:  { label: 'Confirmada',  bg: 'bg-blue-50',    text: 'text-blue-700',   dot: '#3B82F6' },
  llego:       { label: 'Llegó',       bg: 'bg-teal-50',    text: 'text-teal-700',   dot: '#14B8A6' },
  en_consulta: { label: 'En consulta', bg: 'bg-purple-50',  text: 'text-purple-700', dot: '#A855F7' },
  atendida:    { label: 'Finalizada',  bg: 'bg-zinc-100',   text: 'text-zinc-500',   dot: '#71717A' },
  cancelada:   { label: 'Cancelada',   bg: 'bg-red-50',     text: 'text-red-600',    dot: '#EF4444' },
  no_asistio:  { label: 'No asistió',  bg: 'bg-zinc-50',    text: 'text-zinc-400',   dot: '#A1A1AA' },
  en_espera:   { label: 'En espera',   bg: 'bg-orange-50',  text: 'text-orange-700', dot: '#F97316' },
}

const TIPO_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  'Examen visual':      { bg: 'bg-indigo-50',  border: 'border-l-indigo-400',  text: 'text-indigo-800'  },
  'Cita web':           { bg: 'bg-teal-50',    border: 'border-l-teal-400',    text: 'text-teal-800'    },
  'Revisión':           { bg: 'bg-purple-50',  border: 'border-l-purple-400',  text: 'text-purple-800'  },
  'Consulta':           { bg: 'bg-blue-50',    border: 'border-l-blue-400',    text: 'text-blue-800'    },
  'Lentes de contacto': { bg: 'bg-orange-50',  border: 'border-l-orange-400',  text: 'text-orange-800'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: Date) => formatFecha(d)
const hoy = new Date()

function getSemana(base: Date) {
  const lun = new Date(base)
  const dia = lun.getDay()
  lun.setDate(lun.getDate() - (dia === 0 ? 6 : dia - 1))
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(lun); d.setDate(lun.getDate() + i); return d })
}

function minsDesdeInicio(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return (h - START_H) * 60 + m
}

function hora12(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function edad(fNac: string) {
  const n = new Date(fNac), hoyD = new Date()
  let e = hoyD.getFullYear() - n.getFullYear()
  if (hoyD.getMonth() - n.getMonth() < 0 || (hoyD.getMonth() === n.getMonth() && hoyD.getDate() < n.getDate())) e--
  return e
}

const formVacio = (suc = 'Baja Visión'): Omit<Cita, 'id'> => ({
  pacienteId: null, paciente: '', telefono: '',
  tipo: 'Examen visual', seguimiento: null,
  fecha: fmt(hoy), hora: '10:00', duracion: 45,
  sucursal: suc, notas: '', estado: 'agendada',
})

// ── MiniCalendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ selected, onSelect, fechasConCitas }: {
  selected: Date; onSelect: (d: Date) => void; fechasConCitas: Set<string>
}) {
  const [mes, setMes] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  const primerDia = (mes.getDay() + 6) % 7
  const diasMes   = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const hoyStr    = fmt(hoy)
  const selStr    = fmt(selected)

  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMes(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100">
          <ChevronLeft className="w-3.5 h-3.5 text-zinc-500"/>
        </button>
        <span className="text-xs font-bold text-zinc-700">{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
        <button onClick={() => setMes(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100">
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500"/>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-zinc-400 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: primerDia }).map((_, i) => <div key={`e${i}`}/>)}
        {Array.from({ length: diasMes }).map((_, i) => {
          const day = i + 1
          const date = new Date(mes.getFullYear(), mes.getMonth(), day)
          const ds = fmt(date)
          const isHoy = ds === hoyStr
          const isSel = ds === selStr
          const hasCitas = fechasConCitas.has(ds)
          return (
            <button key={day} onClick={() => onSelect(date)}
              className={`h-7 flex items-center justify-center text-[11px] rounded-full relative font-medium transition-colors
                ${isSel ? 'bg-[#0B0E14] text-white' : isHoy ? 'bg-teal-100 text-teal-700 font-bold' : 'text-zinc-600 hover:bg-zinc-100'}`}>
              {day}
              {hasCitas && !isSel && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-500"/>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── BuscadorPaciente ──────────────────────────────────────────────────────────
function BuscadorPaciente({ value, onSelect, onManual }: {
  value: { id: string | null; nombre: string; telefono: string }
  onSelect: (p: PacienteBuscador) => void
  onManual: (nombre: string) => void
}) {
  const [q, setQ]       = useState(value.nombre)
  const [open, setOpen] = useState(false)
  const [res, setRes]   = useState<PacienteBuscador[]>([])
  const ref   = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (q.length < 2) { setRes([]); return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { data } = await createClient().from('pacientes')
        .select('id, nombre, apellido, telefono')
        .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`).limit(6)
      if (data) setRes(data.map((p: { id: string; nombre: string; apellido: string; telefono: string }) => ({
        id: p.id, nombre: `${p.nombre} ${p.apellido}`.trim(), telefono: p.telefono ?? '',
      })))
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"/>
        <input value={q}
          onChange={e => { setQ(e.target.value); onManual(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full border border-zinc-200 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          placeholder="Buscar paciente o escribir nombre..."/>
        {value.id && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded flex items-center gap-1">
            <UserCheck className="w-3 h-3"/> Expediente
          </span>
        )}
      </div>
      {open && q.length > 1 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden">
          {res.length > 0 ? (
            <>
              {res.map(p => (
                <button key={p.id} onClick={() => { onSelect(p); setQ(p.nombre); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#0B0E14] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{p.nombre[0]}</div>
                  <div><p className="text-sm font-semibold text-zinc-700">{p.nombre}</p><p className="text-xs text-zinc-400">{p.telefono}</p></div>
                  <UserCheck className="w-3.5 h-3.5 text-teal-500 ml-auto"/>
                </button>
              ))}
              <div className="px-4 py-2 border-t border-zinc-200">
                <button onClick={() => { onManual(q); setOpen(false) }} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1.5">
                  <User className="w-3 h-3"/> Usar &ldquo;{q}&rdquo; como paciente nuevo
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3">
              <p className="text-sm text-zinc-500 mb-2">No encontrado en expedientes</p>
              <button onClick={() => { onManual(q); setOpen(false) }} className="text-xs text-teal-600 font-semibold flex items-center gap-1.5">
                <Plus className="w-3 h-3"/> Registrar como nuevo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── AgendaPage ────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [citas, setCitas]             = useState<Cita[]>([])
  const [cargando, setCargando]       = useState(true)
  const [usuario, setUsuario]         = useState({ nombre: '', sucursal: '' })
  const [fecha, setFecha]             = useState(new Date())
  const [vista, setVista]             = useState<'dia' | 'semana'>('dia')
  const [sucFiltro, setSucFiltro]     = useState('Todas')
  const [search, setSearch]           = useState('')
  const [citaSel, setCitaSel]         = useState<Cita | null>(null)
  const [detData, setDetData]         = useState<DetalleData | null>(null)
  const [detTab, setDetTab]           = useState<'detalles'|'historial'|'notas'>('detalles')
  const [cargDet, setCargDet]         = useState(false)
  const [modal, setModal]             = useState(false)
  const [editando, setEditando]       = useState<Cita | null>(null)
  const [form, setForm]               = useState<Omit<Cita,'id'>>(formVacio())
  const [guardando, setGuardando]     = useState(false)
  const [ahora, setAhora]             = useState(new Date())
  const calRef = useRef<HTMLDivElement>(null)

  const semana  = getSemana(fecha)
  const fechaStr = fmt(fecha)
  const esAdmin  = !usuario.sucursal || usuario.sucursal === 'Todas'

  // Tick
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // User from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUsuario({ nombre: u.nombre ?? '', sucursal: u.sucursal ?? '' })
        if (u.sucursal && u.sucursal !== 'Todas') setSucFiltro(u.sucursal)
      }
    } catch { /* noop */ }
  }, [])

  // Load citas
  const cargarCitas = useCallback(async (suc: string) => {
    setCargando(true)
    const sb = createClient()
    let q = sb.from('citas').select('*').order('fecha').order('hora')
    if (suc && suc !== 'Todas') q = q.eq('sucursal', suc)
    const { data } = await q
    if (data) setCitas(data.map((c: Record<string,unknown>) => ({
      id: c.id as string, pacienteId: c.paciente_id as string|null,
      paciente: (c.paciente_nombre as string) ?? '',
      telefono: (c.paciente_telefono as string) ?? '',
      tipo: (c.tipo as string) ?? 'Revisión',
      seguimiento: c.seguimiento as number|null,
      fecha: c.fecha as string, hora: (c.hora as string) ?? '10:00',
      duracion: (c.duracion as number) ?? 30, sucursal: c.sucursal as string,
      notas: (c.notas as string) ?? '', estado: (c.estado as EstadoCita) ?? 'agendada',
    })))
    setCargando(false)
  }, [])

  useEffect(() => {
    if (usuario.sucursal !== '') cargarCitas(usuario.sucursal)
    else if (typeof window !== 'undefined' && !localStorage.getItem('optios_demo_user')) cargarCitas('Todas')
  }, [usuario.sucursal, cargarCitas])

  // Scroll to current time
  useEffect(() => {
    if (!calRef.current || cargando) return
    const mins = (new Date().getHours() - START_H) * 60 + new Date().getMinutes()
    if (mins > 0) calRef.current.scrollTop = Math.max(0, mins * PX_MIN - 120)
  }, [cargando])

  // Load detail
  const cargarDetalle = useCallback(async (c: Cita) => {
    setCitaSel(c); setDetTab('detalles'); setDetData(null)
    if (!c.pacienteId) return
    setCargDet(true)
    const sb = createClient()
    const [{ data: pac }, { data: rec }, { data: ven }] = await Promise.all([
      sb.from('pacientes').select('id,nombre,apellido,telefono,email,fecha_nacimiento').eq('id', c.pacienteId).single(),
      sb.from('recetas').select('tipo,fecha').eq('paciente_id', c.pacienteId).order('fecha', { ascending: false }).limit(1),
      sb.from('ventas').select('folio,total,created_at').eq('paciente_id', c.pacienteId).order('created_at', { ascending: false }).limit(1),
    ])
    setDetData({
      paciente: pac as DetallePaciente | null,
      lastReceta: rec?.[0] ? { tipo: (rec[0] as { tipo: string; fecha: string }).tipo, fecha: (rec[0] as { tipo: string; fecha: string }).fecha } : null,
      lastVenta: ven?.[0] ? { folio: (ven[0] as { folio: string; total: number; created_at: string }).folio, total: (ven[0] as { folio: string; total: number; created_at: string }).total, created_at: (ven[0] as { folio: string; total: number; created_at: string }).created_at } : null,
    })
    setCargDet(false)
  }, [])

  // Filtered
  const filtered = citas.filter(c => {
    if (sucFiltro !== 'Todas' && c.sucursal !== sucFiltro) return false
    if (search && !c.paciente.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const citasDia   = (ds: string) => filtered.filter(c => c.fecha === ds).sort((a,b) => a.hora.localeCompare(b.hora))
  const hoyList    = citasDia(fmt(hoy))
  const diaList    = citasDia(fechaStr)
  const fechasSets = new Set(filtered.map(c => c.fecha))
  const pendientes = filtered.filter(c => c.fecha >= fmt(hoy) && c.estado === 'agendada')
    .sort((a,b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)).slice(0, 4)

  // Current time line
  const nowMins    = (ahora.getHours() - START_H) * 60 + ahora.getMinutes()
  const nowTop     = nowMins * PX_MIN
  const showNow    = fechaStr === fmt(hoy) && ahora.getHours() >= START_H && ahora.getHours() < END_H

  // Actions
  const abrirNueva = (ds?: string, h?: string) => {
    const suc = usuario.sucursal && usuario.sucursal !== 'Todas' ? usuario.sucursal : 'Baja Visión'
    setEditando(null); setForm({ ...formVacio(suc), fecha: ds ?? fechaStr, hora: h ?? '10:00' }); setModal(true)
  }
  const abrirEditar = (c: Cita) => {
    setEditando(c)
    setForm({ pacienteId: c.pacienteId, paciente: c.paciente, telefono: c.telefono, tipo: c.tipo,
      seguimiento: c.seguimiento, fecha: c.fecha, hora: c.hora, duracion: c.duracion,
      sucursal: c.sucursal, notas: c.notas, estado: c.estado })
    setModal(true)
  }

  const guardar = async () => {
    if (!form.paciente || guardando) return
    setGuardando(true)
    const sb = createClient()
    const p = { paciente_id: form.pacienteId, paciente_nombre: form.paciente,
      paciente_telefono: form.telefono, tipo: form.tipo, seguimiento: form.seguimiento,
      fecha: form.fecha, hora: form.hora, duracion: form.duracion,
      sucursal: form.sucursal, notas: form.notas, estado: form.estado }
    if (editando) {
      await sb.from('citas').update(p).eq('id', editando.id)
      setCitas(prev => prev.map(c => c.id === editando.id ? { ...c, ...form } : c))
      if (citaSel?.id === editando.id) setCitaSel({ ...editando, ...form })
    } else {
      const { data } = await sb.from('citas').insert(p).select().single()
      if (data) setCitas(prev => [...prev, { id: (data as { id: string }).id, ...form }])
    }
    setGuardando(false); setModal(false)
  }

  const cambiarEstado = async (id: string, estado: EstadoCita) => {
    await createClient().from('citas').update({ estado }).eq('id', id)
    setCitas(prev => prev.map(c => c.id === id ? { ...c, estado } : c))
    if (citaSel?.id === id) setCitaSel(prev => prev ? { ...prev, estado } : null)
  }

  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }))

  const tipoLabel = (c: Cita) => c.tipo === 'Revisión' && c.seguimiento ? `Revisión ${c.seguimiento}` : c.tipo

  const horaOpts = () => {
    const opts = []
    for (let h = START_H; h < END_H; h++) {
      opts.push(`${h.toString().padStart(2,'0')}:00`)
      opts.push(`${h.toString().padStart(2,'0')}:30`)
    }
    return opts
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex -mx-4 -mb-4 md:-mx-6 md:-mb-6 bg-zinc-50" style={{ height: 'calc(100vh - 80px)' }}>

      {/* ── SIDEBAR IZQUIERDO ─────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-zinc-200 hidden md:flex flex-col overflow-hidden">
        <MiniCalendar selected={fecha} onSelect={d => { setFecha(d); setVista('dia') }} fechasConCitas={fechasSets}/>

        <div className="h-px bg-zinc-100 mx-4"/>

        {/* Agenda de hoy */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Hoy</span>
            <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-semibold">{hoyList.length}</span>
          </div>
          {hoyList.length === 0 ? (
            <p className="text-xs text-zinc-400">Sin citas hoy</p>
          ) : hoyList.map(c => (
            <button key={c.id} onClick={() => { setFecha(new Date(c.fecha+'T12:00:00')); setVista('dia'); cargarDetalle(c) }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 w-9 flex-shrink-0">{c.hora}</span>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: EC[c.estado].dot }}/>
              <span className="text-xs text-zinc-700 truncate">{c.paciente.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Pendientes de confirmar */}
        {pendientes.length > 0 && (
          <>
            <div className="h-px bg-zinc-100 mx-4"/>
            <div className="px-4 py-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pendientes</span>
                <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold">{pendientes.length}</span>
              </div>
              {pendientes.map(c => (
                <button key={c.id} onClick={() => { setFecha(new Date(c.fecha+'T12:00:00')); setVista('dia'); cargarDetalle(c) }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-amber-50 mb-1">
                  <p className="text-xs font-semibold text-zinc-700 truncate">{c.paciente}</p>
                  <p className="text-[10px] text-zinc-400">
                    {c.fecha === fmt(hoy) ? 'Hoy' : c.fecha === fmt(new Date(Date.now()+86400000)) ? 'Mañana' : c.fecha} · {c.hora}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-zinc-200 px-3 md:px-5 py-3 flex flex-wrap items-center gap-2 md:gap-2.5 flex-shrink-0">
          <button onClick={() => { const d = new Date(fecha); d.setDate(d.getDate()-(vista==='dia'?1:7)); setFecha(d) }}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-100">
            <ChevronLeft className="w-4 h-4 text-zinc-500"/>
          </button>
          <span className="min-w-[160px] text-center text-sm font-bold text-zinc-800">
            {vista === 'dia'
              ? fecha.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'long' })
              : `${MESES[semana[0].getMonth()]} ${semana[0].getFullYear()}`}
          </span>
          <button onClick={() => { const d = new Date(fecha); d.setDate(d.getDate()+(vista==='dia'?1:7)); setFecha(d) }}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-100">
            <ChevronRight className="w-4 h-4 text-zinc-500"/>
          </button>
          <button onClick={() => { setFecha(new Date()); setVista('dia') }}
            className="px-3 py-1.5 text-xs font-semibold border border-zinc-200 rounded-lg hover:bg-zinc-100 text-zinc-600">Hoy</button>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
              placeholder="Buscar paciente..."/>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {esAdmin && (
              <div className="relative">
                <select value={sucFiltro} onChange={e => setSucFiltro(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-600 focus:outline-none">
                  {['Todas',...SUCURSALES].map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none"/>
              </div>
            )}
            <div className="flex border border-zinc-200 rounded-lg overflow-hidden">
              {(['dia','semana'] as const).map((v,i) => (
                <button key={v} onClick={() => setVista(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${vista===v?'bg-[#0B0E14] text-white':'text-zinc-500 hover:bg-zinc-100'}`}>
                  {['Día','Semana'][i]}
                </button>
              ))}
            </div>
            <button onClick={() => abrirNueva()}
              className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-700 active:scale-[0.98] transition-all">
              <Plus className="w-3.5 h-3.5"/> Nueva cita
            </button>
          </div>
        </div>

        {/* Calendar */}
        {cargando ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-zinc-400">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/>
              <p className="text-sm">Cargando agenda...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto" ref={calRef}>

            {/* ── DÍA ── */}
            {vista === 'dia' && (
              <div className="relative" style={{ height: `${(END_H - START_H) * 60 * PX_MIN + 40}px` }}>
                {/* Hour lines */}
                {HORAS.map(h => (
                  <div key={h} className="absolute left-0 right-0 flex items-start pointer-events-none"
                    style={{ top: `${(h - START_H) * 60 * PX_MIN}px` }}>
                    <span className="w-14 text-right pr-3 text-[11px] text-zinc-400 font-medium -mt-2 flex-shrink-0">
                      {h.toString().padStart(2,'0')}:00
                    </span>
                    <div className="flex-1 border-t border-zinc-200"/>
                  </div>
                ))}
                {/* Half-hour dashes */}
                {HORAS.map(h => (
                  <div key={`h${h}`} className="absolute left-14 right-0 border-t border-dashed border-zinc-50 pointer-events-none"
                    style={{ top: `${((h - START_H) * 60 + 30) * PX_MIN}px` }}/>
                ))}
                {/* Click zones */}
                {HORAS.flatMap(h => ['00','30'].map(m => (
                  <div key={`z${h}${m}`}
                    className="absolute left-14 right-0 cursor-pointer group"
                    style={{ top: `${((h - START_H)*60 + parseInt(m)) * PX_MIN}px`, height: `${30 * PX_MIN}px` }}
                    onClick={() => abrirNueva(fechaStr, `${h.toString().padStart(2,'0')}:${m}`)}>
                    <div className="h-full opacity-0 group-hover:opacity-100 bg-teal-50/60 flex items-center px-3 transition-opacity">
                      <span className="text-[10px] text-teal-600 font-medium flex items-center gap-1">
                        <Plus className="w-2.5 h-2.5"/> {h.toString().padStart(2,'0')}:{m}
                      </span>
                    </div>
                  </div>
                )))}

                {/* Appointments */}
                {diaList.map(c => {
                  const top    = minsDesdeInicio(c.hora) * PX_MIN
                  const height = Math.max(c.duracion * PX_MIN, 32)
                  const ts     = TIPO_STYLE[c.tipo] ?? TIPO_STYLE['Consulta']
                  const ec     = EC[c.estado]
                  const compact = height < 48
                  return (
                    <div key={c.id} onClick={() => cargarDetalle(c)}
                      className={`absolute left-16 right-4 rounded-lg border-l-[3px] shadow-sm cursor-pointer z-10
                        hover:shadow-md hover:brightness-95 transition-all overflow-hidden
                        ${ts.bg} ${ts.border} ${citaSel?.id === c.id ? 'ring-2 ring-teal-500 ring-offset-1' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}>
                      <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
                        <div className="flex items-start justify-between gap-1">
                          <p className={`font-bold leading-tight truncate ${compact ? 'text-[11px]' : 'text-xs'} ${ts.text}`}>
                            {c.paciente}
                          </p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ec.bg} ${ec.text}`}>
                            {ec.label}
                          </span>
                        </div>
                        {!compact && (
                          <p className={`text-[10px] opacity-60 mt-0.5 truncate ${ts.text}`}>
                            {tipoLabel(c)} · {c.hora} ({c.duracion}min)
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Current time */}
                {showNow && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowTop}px` }}>
                    <div className="flex items-center">
                      <span className="w-14 text-right pr-2 text-[10px] font-bold text-red-500 flex-shrink-0">
                        {ahora.getHours().toString().padStart(2,'0')}:{ahora.getMinutes().toString().padStart(2,'0')}
                      </span>
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1"/>
                      <div className="flex-1 h-px bg-red-400"/>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SEMANA ── */}
            {vista === 'semana' && (
              <div>
                <div className="grid sticky top-0 bg-white z-10 border-b border-zinc-200" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                  <div className="border-r border-zinc-200"/>
                  {semana.map((d, i) => {
                    const ds = fmt(d)
                    const esH = ds === fmt(hoy)
                    const n = citasDia(ds).length
                    return (
                      <div key={i} onClick={() => { setFecha(d); setVista('dia') }}
                        className={`px-2 py-3 border-r last:border-r-0 border-zinc-200 text-center cursor-pointer hover:bg-zinc-100 ${esH ? 'bg-teal-50' : ''}`}>
                        <p className={`text-[10px] font-semibold ${esH ? 'text-teal-600' : 'text-zinc-400'}`}>{DIAS_LABEL[i]}</p>
                        <p className={`text-base font-bold mt-0.5 ${esH ? 'text-teal-700' : 'text-zinc-700'}`}>{d.getDate()}</p>
                        {n > 0 && <span className="text-[9px] text-zinc-400">{n}</span>}
                      </div>
                    )
                  })}
                </div>
                {HORAS.map(h => (
                  <div key={h} className="grid border-b border-zinc-200" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                    <div className="border-r border-zinc-200 text-right pr-2 pt-1">
                      <span className="text-[11px] text-zinc-400">{h.toString().padStart(2,'0')}:00</span>
                    </div>
                    {semana.map((d, di) => {
                      const ds = fmt(d)
                      const cs = citasDia(ds).filter(c => c.hora.startsWith(h.toString().padStart(2,'0')))
                      return (
                        <div key={di} className="border-r last:border-r-0 border-zinc-200 p-1 min-h-[52px] cursor-pointer hover:bg-zinc-100/50 group"
                          onClick={() => { if (!cs.length) abrirNueva(ds, `${h.toString().padStart(2,'0')}:00`) }}>
                          {!cs.length && (
                            <div className="h-full min-h-[40px] flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Plus className="w-3 h-3 text-zinc-400"/>
                            </div>
                          )}
                          {cs.map(c => {
                            const ts = TIPO_STYLE[c.tipo] ?? TIPO_STYLE['Consulta']
                            return (
                              <div key={c.id}
                                onClick={e => { e.stopPropagation(); setFecha(d); setVista('dia'); cargarDetalle(c) }}
                                className={`text-[10px] px-1.5 py-1 rounded border-l-2 mb-1 cursor-pointer hover:opacity-80 ${ts.bg} ${ts.border} ${ts.text}`}>
                                <p className="font-semibold truncate">{c.paciente.split(' ')[0]}</p>
                                <p className="opacity-60 truncate">{tipoLabel(c)}</p>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="bg-white border-t border-zinc-200 px-5 py-2 flex items-center gap-4 flex-shrink-0 overflow-x-auto">
          {(Object.entries(EC) as [EstadoCita, typeof EC[EstadoCita]][]).map(([, ec]) => (
            <div key={ec.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ background: ec.dot }}/>
              <span className="text-[11px] text-zinc-500">{ec.label}</span>
            </div>
          ))}
        </div>
      </main>

      {/* ── PANEL DETALLE ─────────────────────────────────────────────────── */}
      {citaSel && (
        <aside className="w-[300px] flex-shrink-0 bg-white border-l border-zinc-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-200 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-zinc-800 truncate text-sm">{citaSel.paciente}</h3>
                <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${EC[citaSel.estado].bg} ${EC[citaSel.estado].text}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: EC[citaSel.estado].dot }}/>
                  {EC[citaSel.estado].label}
                </span>
              </div>
              <button onClick={() => setCitaSel(null)} className="ml-2 flex-shrink-0 mt-0.5">
                <X className="w-4 h-4 text-zinc-400 hover:text-zinc-600"/>
              </button>
            </div>
            {cargDet ? (
              <div className="mt-3 space-y-1.5 animate-pulse">
                <div className="h-3 bg-zinc-100 rounded w-3/4"/>
                <div className="h-3 bg-zinc-100 rounded w-1/2"/>
              </div>
            ) : detData?.paciente ? (
              <div className="mt-3 space-y-1">
                {detData.paciente.telefono && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Phone className="w-3 h-3"/> {detData.paciente.telefono}
                  </div>
                )}
                {detData.paciente.email && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Mail className="w-3 h-3"/> <span className="truncate">{detData.paciente.email}</span>
                  </div>
                )}
                {detData.paciente.fecha_nacimiento && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <User className="w-3 h-3"/> {edad(detData.paciente.fecha_nacimiento)} años
                  </div>
                )}
              </div>
            ) : citaSel.telefono ? (
              <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5"><Phone className="w-3 h-3"/>{citaSel.telefono}</p>
            ) : null}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-200 flex-shrink-0">
            {(['detalles','historial','notas'] as const).map(tab => (
              <button key={tab} onClick={() => setDetTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors
                  ${detTab===tab ? 'border-b-2 border-teal-500 text-teal-600' : 'text-zinc-400 hover:text-zinc-600'}`}>
                {tab === 'detalles' ? 'Detalles' : tab === 'historial' ? 'Historial' : 'Notas'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {detTab === 'detalles' && (
              <div className="space-y-3">
                <div className="space-y-2.5 text-sm text-zinc-600">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-zinc-400 flex-shrink-0"/>
                    <span>{new Date(citaSel.fecha+'T12:00:00').toLocaleDateString('es-MX',{ weekday:'long', day:'numeric', month:'long' })}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-zinc-400 flex-shrink-0"/>
                    <span>{hora12(citaSel.hora)} · {citaSel.duracion} min</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Store className="w-4 h-4 text-zinc-400 flex-shrink-0"/>
                    <span>{citaSel.sucursal}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-zinc-400 flex-shrink-0"/>
                    <span>{tipoLabel(citaSel)}</span>
                  </div>
                  {citaSel.notas && (
                    <div className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5"/>
                      <span className="text-xs leading-relaxed">{citaSel.notas}</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-zinc-200">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2">Cambiar estado</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(EC) as [EstadoCita, typeof EC[EstadoCita]][]).map(([estado, ec]) => (
                      <button key={estado} onClick={() => cambiarEstado(citaSel.id, estado)}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                          ${citaSel.estado===estado ? `${ec.bg} ${ec.text} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                        {ec.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {detTab === 'historial' && (
              <div className="space-y-3">
                {!citaSel.pacienteId ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Sin expediente vinculado</p>
                ) : cargDet ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-16 bg-zinc-100 rounded-lg"/><div className="h-16 bg-zinc-100 rounded-lg"/>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-zinc-200 p-3">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Eye className="w-3 h-3"/> Última graduación
                      </p>
                      {detData?.lastReceta ? (
                        <><p className="text-sm font-semibold text-zinc-700">{detData.lastReceta.tipo}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{detData.lastReceta.fecha}</p></>
                      ) : <p className="text-xs text-zinc-400">Sin recetas</p>}
                    </div>
                    <div className="rounded-lg border border-zinc-200 p-3">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3"/> Última compra
                      </p>
                      {detData?.lastVenta ? (
                        <><p className="text-sm font-semibold text-zinc-700">${detData.lastVenta.total.toLocaleString('es-MX')}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{detData.lastVenta.folio} · {new Date(detData.lastVenta.created_at).toLocaleDateString('es-MX')}</p></>
                      ) : <p className="text-xs text-zinc-400">Sin compras</p>}
                    </div>
                  </>
                )}
              </div>
            )}

            {detTab === 'notas' && (
              <div>
                <textarea key={citaSel.id} defaultValue={citaSel.notas} rows={9}
                  onBlur={async e => {
                    const n = e.target.value
                    if (n !== citaSel.notas) {
                      await createClient().from('citas').update({ notas: n }).eq('id', citaSel.id)
                      setCitas(prev => prev.map(c => c.id === citaSel.id ? { ...c, notas: n } : c))
                      setCitaSel(prev => prev ? { ...prev, notas: n } : null)
                    }
                  }}
                  className="w-full border border-zinc-200 rounded-lg p-3 text-sm text-zinc-700 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none"
                  placeholder="Notas de la cita..."/>
                <p className="text-[10px] text-zinc-400 mt-1">Se guarda al salir del campo</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 pt-3 border-t border-zinc-200 flex flex-col gap-2 flex-shrink-0">
            <button onClick={() => abrirEditar(citaSel)}
              className="flex items-center justify-center gap-2 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-600 font-medium hover:bg-zinc-100">
              <Pencil className="w-3.5 h-3.5"/> Editar cita
            </button>
            {citaSel.estado !== 'cancelada' && (
              <button onClick={() => cambiarEstado(citaSel.id, 'cancelada')}
                className="flex items-center justify-center gap-2 py-2 border border-red-200 rounded-lg text-sm text-red-500 font-medium hover:bg-red-50">
                <XCircle className="w-3.5 h-3.5"/> Cancelar cita
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── MODAL ─────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-zinc-800">{editando ? 'Editar cita' : 'Nueva cita'}</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-zinc-400"/></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Paciente *</label>
                <BuscadorPaciente
                  value={{ id: form.pacienteId, nombre: form.paciente, telefono: form.telefono }}
                  onSelect={p => setForm(prev => ({ ...prev, pacienteId: p.id, paciente: p.nombre, telefono: p.telefono }))}
                  onManual={n => setForm(prev => ({ ...prev, pacienteId: null, paciente: n }))}
                />
                {!form.pacienteId && form.paciente && (
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono</label>
                    <input value={form.telefono} onChange={e => f('telefono', e.target.value)}
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none"
                      placeholder="686 000 0000"/>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de cita</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_CITA.map(t => (
                    <button key={t} onClick={() => { f('tipo', t); if (t !== 'Revisión') f('seguimiento', null) }}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-left transition-all
                        ${form.tipo===t ? 'bg-[#0B0E14] border-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {form.tipo === 'Revisión' && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Seguimiento #</label>
                    <div className="flex gap-2">
                      {[1,2,3,4].map(n => (
                        <button key={n} onClick={() => f('seguimiento', n)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all
                            ${form.seguimiento===n ? 'bg-purple-600 border-purple-600 text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Hora *</label>
                  <div className="relative">
                    <select value={form.hora} onChange={e => f('hora', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {horaOpts().map(h => <option key={h}>{h}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"/>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Duración</label>
                  <div className="relative">
                    <select value={form.duracion} onChange={e => f('duracion', parseInt(e.target.value))}
                      className="w-full appearance-none border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {[15,20,30,45,60,90].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <div className="relative">
                    <select value={form.sucursal} onChange={e => f('sucursal', e.target.value)}
                      disabled={!esAdmin}
                      className="w-full appearance-none border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8 disabled:opacity-60">
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"/>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Estado</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(EC) as [EstadoCita, typeof EC[EstadoCita]][]).map(([estado, ec]) => (
                    <button key={estado} onClick={() => f('estado', estado)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                        ${form.estado===estado ? `${ec.bg} ${ec.text} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      {ec.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  <FileText className="inline w-3.5 h-3.5 mr-1 -mt-0.5"/>Notas
                </label>
                <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={3}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-3 text-sm bg-zinc-50 focus:outline-none resize-none placeholder:text-zinc-400"
                  placeholder="Observaciones, historial relevante..."/>
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white border-t border-zinc-200 pt-4">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-semibold hover:bg-zinc-100">
                Cancelar
              </button>
              <button onClick={guardar}
                disabled={!form.paciente || (form.tipo==='Revisión' && !form.seguimiento) || guardando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-40 transition-all">
                <Save className="w-4 h-4"/>
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agendar cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
