'use client'

import { useState, useEffect, useCallback } from 'react'
import RequireRol from '@/components/RequireRol'
import { createClient } from '@/lib/supabase/client'
import { OPCIONES_DESCANSO } from '@/lib/vacaciones'
import {
  Search, Edit2, Save, FileText, Upload, Trash2,
} from 'lucide-react'

// ─────────────────────────────────────────
type Empleado = {
  id: string
  nombre: string
  apodo: string | null
  iniciales: string | null
  username: string | null
  rol: string
  sucursal: string | null
  activo: boolean
  telefono: string | null
  email: string | null
  puesto: string | null
  fecha_nacimiento: string | null
  rfc: string | null
  nss: string | null
  direccion: string | null
  contacto_emergencia: string | null
  tipo_contrato: string | null
  horario_entrada: string | null
  horario_salida: string | null
  fecha_ingreso: string | null
  sueldo_diario: number | null
  dias_semana: number | null
  dia_descanso: string | null
}

type Documento = { id: string; nombre: string; categoria: string | null; url: string; path: string | null; tamano: number | null; subido_at: string }
type Asistencia = { id: string; sucursal: string | null; fecha: string; entrada: string | null; salida: string | null }

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles', 'Todas']
const CATEGORIAS_DOC = ['Contrato', 'INE', 'Comprobante domicilio', 'CURP', 'Otro']

const fmtFecha = (f: string | null) => {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1] ?? ''} ${y}`
}
const antiguedad = (f: string | null) => {
  if (!f) return ''
  const ini = new Date(f + 'T12:00:00'); const hoy = new Date()
  let meses = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth())
  if (hoy.getDate() < ini.getDate()) meses--
  if (meses < 0) return ''
  const a = Math.floor(meses / 12), mm = meses % 12
  return [a > 0 ? `${a} año${a > 1 ? 's' : ''}` : '', mm > 0 ? `${mm} mes${mm > 1 ? 'es' : ''}` : ''].filter(Boolean).join(' ') || 'recién ingresado'
}
const fmtTam = (n: number | null) => n ? (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : ''
const horaAsis = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'America/Tijuana', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
const durAsis = (e: string | null, s: string | null) => {
  if (!e || !s) return '—'
  const min = Math.round((new Date(s).getTime() - new Date(e).getTime()) / 60000)
  if (min <= 0) return '—'
  return `${Math.floor(min / 60)}h ${min % 60}m`
}
const $$ = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n)
// Horas del turno a partir de entrada/salida (default 8 si no hay horario)
function horasTurno(e: string | null, s: string | null): number {
  if (!e || !s) return 8
  const [eh, em] = e.split(':').map(Number)
  const [sh, sm] = s.split(':').map(Number)
  let mins = (sh * 60 + sm) - (eh * 60 + em)
  if (mins <= 0) mins += 24 * 60
  return Math.round((mins / 60) * 10) / 10
}

const rolLabel: Record<string, string> = {
  administrador: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor', repartidor: 'Repartidor',
}

function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [tab, setTab] = useState<'datos' | 'docs' | 'comp' | 'asist'>('datos')
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<Partial<Empleado>>({})
  const [guardando, setGuardando] = useState(false)
  const [docs, setDocs] = useState<Documento[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [catDoc, setCatDoc] = useState('Contrato')
  const [costos, setCostos] = useState<{ id: string; fecha: string; concepto: string; categoria: string; monto: number }[]>([])
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])

  const cargar = useCallback(async () => {
    const { data } = await createClient().from('usuarios').select('*').order('nombre')
    setEmpleados((data ?? []) as Empleado[])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const sel = empleados.find(e => e.id === selId) || null

  const cargarDocs = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/empleados/documento?usuario_id=${id}`)
      const j = await res.json()
      setDocs((j.ok ? j.documentos : []) as Documento[])
    } catch {
      setDocs([])
    }
  }, [])

  const cargarCostos = useCallback(async (id: string) => {
    const { data } = await createClient().from('gastos').select('id, fecha, concepto, categoria, monto').eq('empleado_id', id).order('fecha', { ascending: false })
    setCostos((data ?? []) as { id: string; fecha: string; concepto: string; categoria: string; monto: number }[])
  }, [])

  const cargarAsistencias = useCallback(async (id: string) => {
    try {
      const desde = new Date(); desde.setDate(desde.getDate() - 30)
      const d = desde.toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
      const res = await fetch(`/api/empleados/asistencia?usuario_id=${id}&desde=${d}`)
      const j = await res.json()
      setAsistencias((j.ok ? j.asistencias : []) as Asistencia[])
    } catch { setAsistencias([]) }
  }, [])

  const abrir = (e: Empleado) => { setSelId(e.id); setTab('datos'); setEditando(false); cargarDocs(e.id); cargarCostos(e.id); cargarAsistencias(e.id) }

  const editar = () => { if (sel) { setForm({ ...sel }); setEditando(true) } }
  const f = (k: keyof Empleado, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!sel) return
    setGuardando(true)
    const up = { ...form }; delete (up as { id?: string }).id
    const { error } = await createClient().from('usuarios').update(up).eq('id', sel.id)
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setEditando(false)
    cargar()
  }

  const subirDoc = async (file: File) => {
    if (!sel) return
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('usuario_id', sel.id); fd.append('categoria', catDoc)
      const res = await fetch('/api/empleados/documento', { method: 'POST', body: fd })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setDocs(prev => [j.documento as Documento, ...prev])
    } catch (e) {
      alert('No se pudo subir: ' + (e instanceof Error ? e.message : ''))
    } finally { setSubiendo(false) }
  }

  const borrarDoc = async (d: Documento) => {
    if (!confirm(`¿Borrar "${d.nombre}"?`)) return
    setDocs(prev => prev.filter(x => x.id !== d.id))
    await fetch('/api/empleados/documento', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, path: d.path }),
    }).catch(() => {})
  }

  const filtrados = empleados.filter(e =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.puesto ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.sucursal ?? '').toLowerCase().includes(busqueda.toLowerCase()))

  const campo = (label: string, k: keyof Empleado, tipo = 'text', full = false) => (
    <div key={k} className={full ? 'col-span-2' : ''}>
      <label className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1">{label}</label>
      {editando ? (
        <input type={tipo} value={(form[k] as string) ?? ''} onChange={e => f(k, e.target.value)}
          className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
      ) : (
        <div className="text-sm font-medium text-zinc-700">{tipo === 'date' ? fmtFecha(sel?.[k] as string) : ((sel?.[k] as string) || '—')}</div>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Empleados</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Expedientes, datos y documentos del personal</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Lista */}
        <div className="w-full md:w-64 flex-shrink-0 bg-white border border-zinc-200/80 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-zinc-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar empleado…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {filtrados.map(e => (
              <button key={e.id} onClick={() => abrir(e)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-50 text-left hover:bg-zinc-50 transition-colors ${selId === e.id ? 'bg-teal-50' : ''} ${!e.activo ? 'opacity-50' : ''}`}>
                <span className="w-8 h-8 rounded-full bg-[#0D9488] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {e.iniciales || e.nombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-700 truncate">{e.nombre}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{e.puesto || rolLabel[e.rol] || e.rol}{e.sucursal ? ` · ${e.sucursal}` : ''}</p>
                </div>
              </button>
            ))}
            {filtrados.length === 0 && <p className="text-xs text-zinc-400 text-center py-8">Sin resultados</p>}
          </div>
        </div>

        {/* Expediente */}
        <div className="flex-1 min-w-0">
          {!sel ? (
            <div className="bg-white border border-zinc-200/80 rounded-lg h-64 flex items-center justify-center text-sm text-zinc-400">
              Selecciona un empleado para ver su expediente
            </div>
          ) : (
            <div className="bg-white border border-zinc-200/80 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-100">
                <span className="w-14 h-14 rounded-full bg-[#0D9488] text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {sel.iniciales || sel.nombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-zinc-900">{sel.nombre}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sel.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>{sel.activo ? 'ACTIVO' : 'INACTIVO'}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {sel.puesto || rolLabel[sel.rol] || sel.rol}{sel.sucursal ? ` · ${sel.sucursal}` : ''}
                    {sel.fecha_ingreso ? ` · Ingreso ${fmtFecha(sel.fecha_ingreso)} · ${antiguedad(sel.fecha_ingreso)}` : ''}
                  </p>
                </div>
                {(tab === 'datos' || tab === 'comp') && !editando && (
                  <button onClick={editar} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-5 pt-3 border-b border-zinc-100">
                <button onClick={() => { setTab('datos') }} className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors ${tab === 'datos' ? 'text-[#0D9488] border-[#0D9488]' : 'text-zinc-400 border-transparent hover:text-zinc-600'}`}>Datos</button>
                <button onClick={() => { setTab('docs'); setEditando(false) }} className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors ${tab === 'docs' ? 'text-[#0D9488] border-[#0D9488]' : 'text-zinc-400 border-transparent hover:text-zinc-600'}`}>Documentos {docs.length > 0 && <span className="text-[9px] bg-zinc-100 text-zinc-500 rounded-full px-1.5">{docs.length}</span>}</button>
                <button onClick={() => { setTab('comp'); setEditando(false) }} className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors ${tab === 'comp' ? 'text-[#0D9488] border-[#0D9488]' : 'text-zinc-400 border-transparent hover:text-zinc-600'}`}>Compensación</button>
                <button onClick={() => { setTab('asist'); setEditando(false) }} className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors ${tab === 'asist' ? 'text-[#0D9488] border-[#0D9488]' : 'text-zinc-400 border-transparent hover:text-zinc-600'}`}>Asistencia</button>
                <span className="text-xs font-semibold px-3 py-2 text-zinc-300 cursor-not-allowed">Asistencia <span className="text-[9px]">(Fase 3)</span></span>
              </div>

              {/* Datos */}
              {tab === 'datos' && (
                <div className="px-5 py-4">
                  <p className="text-[11px] font-bold text-[#0D9488] tracking-wide mb-3">DATOS PERSONALES</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                    {campo('Teléfono', 'telefono')}
                    {campo('Correo', 'email')}
                    {campo('Fecha de nacimiento', 'fecha_nacimiento', 'date')}
                    {campo('RFC', 'rfc')}
                    {campo('NSS (IMSS)', 'nss')}
                    {campo('Contacto de emergencia', 'contacto_emergencia')}
                    {campo('Dirección', 'direccion', 'text', true)}
                  </div>
                  <p className="text-[11px] font-bold text-[#0D9488] tracking-wide mb-3">DATOS LABORALES</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {campo('Puesto', 'puesto')}
                    {editando ? (
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Sucursal</label>
                        <select value={(form.sucursal as string) ?? ''} onChange={e => f('sucursal', e.target.value)} className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none">
                          <option value="">—</option>{SUCURSALES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    ) : <div><label className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Sucursal</label><div className="text-sm font-medium text-zinc-700">{sel.sucursal || '—'}</div></div>}
                    {campo('Fecha de ingreso', 'fecha_ingreso', 'date')}
                    {campo('Tipo de contrato', 'tipo_contrato')}
                    {campo('Horario entrada', 'horario_entrada', 'time')}
                    {campo('Horario salida', 'horario_salida', 'time')}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Día de descanso</label>
                      {editando ? (
                        <select value={(form.dia_descanso as string) ?? ''} onChange={e => f('dia_descanso', e.target.value)}
                          className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 capitalize">
                          <option value="">—</option>
                          {OPCIONES_DESCANSO.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
                        </select>
                      ) : <div className="text-sm font-medium text-zinc-700 capitalize">{sel?.dia_descanso || '—'}</div>}
                    </div>
                  </div>

                  {editando && (
                    <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditando(false)} className="flex-1 py-2 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100">Cancelar</button>
                      <button onClick={guardar} disabled={guardando} className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-600 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Documentos */}
              {tab === 'docs' && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <select value={catDoc} onChange={e => setCatDoc(e.target.value)} className="border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none">
                      {CATEGORIAS_DOC.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0B0E14] hover:bg-[#1A1D27] px-3 py-2 rounded cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> {subiendo ? 'Subiendo…' : 'Subir documento'}
                      <input type="file" className="hidden" disabled={subiendo}
                        onChange={e => { const file = e.target.files?.[0]; if (file) subirDoc(file); e.target.value = '' }} />
                    </label>
                  </div>
                  {docs.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-10">Sin documentos. Sube el contrato, INE, etc.</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map(d => (
                        <div key={d.id} className="flex items-center gap-3 border border-zinc-100 rounded-lg px-3 py-2.5">
                          <div className="w-9 h-10 rounded bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-700 truncate">{d.nombre}</p>
                            <p className="text-[11px] text-zinc-400">{d.categoria} · {fmtTam(d.tamano)}</p>
                          </div>
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0D9488] hover:underline">Ver</a>
                          <button onClick={() => borrarDoc(d)} className="text-zinc-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Compensación (Fase 2) */}
              {tab === 'comp' && (
                <div className="px-5 py-4">
                  {editando ? (
                    <>
                      <p className="text-[11px] font-bold text-[#0D9488] tracking-wide mb-3">COMPENSACIÓN</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Sueldo diario (MXN)</label>
                          <input type="number" value={(form.sueldo_diario as number) ?? ''} onChange={e => f('sueldo_diario', e.target.value === '' ? null : Number(e.target.value))} placeholder="500"
                            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Días que trabaja por semana</label>
                          <input type="number" value={(form.dias_semana as number) ?? ''} onChange={e => f('dias_semana', e.target.value === '' ? null : Number(e.target.value))} placeholder="6"
                            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-3">El horario (entrada/salida) se toma de la pestaña Datos; la tarifa por hora se calcula sola.</p>
                      <div className="flex gap-2 mt-6">
                        <button onClick={() => setEditando(false)} className="flex-1 py-2 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100">Cancelar</button>
                        <button onClick={guardar} disabled={guardando} className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-600 disabled:opacity-50">
                          <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                      </div>
                    </>
                  ) : (() => {
                    const horas = horasTurno(sel.horario_entrada, sel.horario_salida)
                    const sueldo = Number(sel.sueldo_diario) || 0
                    const dias = Number(sel.dias_semana) || 6
                    const diasDescanso = dias >= 6 ? 1 : 0 // séptimo día pagado (LFT art. 69)
                    const diasPagados = dias + diasDescanso
                    const tarifaHora = horas > 0 ? sueldo / horas : 0
                    const semanal = sueldo * diasPagados
                    const mensual = semanal * 4.33
                    const totalCostos = costos.reduce((s, c) => s + Number(c.monto), 0)
                    return (
                      <>
                        {sueldo === 0 ? (
                          <p className="text-sm text-zinc-400 py-2">Sin sueldo capturado. Pica &quot;Editar&quot; para ponerlo.</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="bg-teal-50 rounded-lg p-3"><p className="text-[10px] text-zinc-500 uppercase">Sueldo diario</p><p className="text-xl font-bold text-teal-700">{$$(sueldo)}</p></div>
                              <div className="bg-zinc-50 rounded-lg p-3"><p className="text-[10px] text-zinc-500 uppercase">Tarifa por hora</p><p className="text-xl font-bold text-zinc-800">{$$(tarifaHora)}</p><p className="text-[10px] text-zinc-400">{horas}h de turno</p></div>
                              <div className="bg-zinc-50 rounded-lg p-3"><p className="text-[10px] text-zinc-500 uppercase">Días pagados/semana</p><p className="text-xl font-bold text-zinc-800">{diasPagados}</p><p className="text-[10px] text-zinc-400">{dias} trabajo{diasDescanso ? ` + ${diasDescanso} descanso` : ''}</p></div>
                            </div>
                            <div className="border-t border-zinc-100 pt-3">
                              <p className="text-[11px] font-bold text-zinc-500 mb-2">CUÁNTO TE CUESTA (estimado)</p>
                              <div className="flex gap-8">
                                <div><p className="text-[10px] text-zinc-400 uppercase">Por semana</p><p className="text-lg font-bold text-zinc-800">{$$(semanal)}</p></div>
                                <div><p className="text-[10px] text-zinc-400 uppercase">Por mes (aprox.)</p><p className="text-lg font-bold text-zinc-800">{$$(mensual)}</p></div>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-2">{diasPagados} días pagados ({dias} trabajo{diasDescanso ? ' + 1 séptimo día de ley' : ''}) × {$$(sueldo)}. La nómina real (Fase 4) usará las horas que checó.</p>
                            </div>
                          </>
                        )}

                        {/* Costos reales ligados desde Finanzas */}
                        <div className="border-t border-zinc-100 pt-3 mt-4">
                          <div className="flex items-baseline justify-between mb-2">
                            <p className="text-[11px] font-bold text-zinc-500">COSTOS REGISTRADOS <span className="font-normal text-zinc-400">(de Finanzas)</span></p>
                            <p className="text-sm font-bold text-rose-600">{$$(totalCostos)}</p>
                          </div>
                          {costos.length === 0 ? (
                            <p className="text-xs text-zinc-400">Sin egresos ligados. Cuando registres un egreso en Finanzas y elijas a este empleado, aparecerá aquí.</p>
                          ) : (
                            <div className="space-y-0.5">
                              {costos.slice(0, 10).map(c => (
                                <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-50">
                                  <span className="text-zinc-500 truncate">{fmtFecha(c.fecha)} · {c.concepto}<span className="text-zinc-300"> · {c.categoria}</span></span>
                                  <span className="font-semibold text-zinc-700 flex-shrink-0 ml-2">{$$(Number(c.monto))}</span>
                                </div>
                              ))}
                              {costos.length > 10 && <p className="text-[10px] text-zinc-400 mt-1">+{costos.length - 10} más</p>}
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Asistencia (Fase 3 · checador) */}
              {tab === 'asist' && (
                <div className="px-5 py-4">
                  {asistencias.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-10">Sin registros de checador en los últimos 30 días.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-2 px-2 pb-1.5 text-[10px] uppercase font-semibold text-zinc-400">
                        <span>Fecha</span><span className="text-center">Entrada</span><span className="text-center">Salida</span><span className="text-right">Horas</span>
                      </div>
                      <div className="space-y-0.5">
                        {asistencias.map(a => (
                          <div key={a.id} className="grid grid-cols-4 gap-2 items-center px-2 py-2 border-b border-zinc-50 text-sm">
                            <span className="text-zinc-600">{fmtFecha(a.fecha)}</span>
                            <span className="text-center font-semibold text-teal-700">{horaAsis(a.entrada)}</span>
                            <span className="text-center font-semibold text-zinc-700">{horaAsis(a.salida)}</span>
                            <span className="text-right font-bold text-zinc-800">{durAsis(a.entrada, a.salida)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmpleadosPageProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <EmpleadosPage />
    </RequireRol>
  )
}
