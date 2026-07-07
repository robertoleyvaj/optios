'use client'

// Expediente clínico interno — vista del optometrista
// Para el documento del paciente ir a /hoja

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, FileText, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────
type RxEye = { esfera: string; cilindro: string; eje: string; add: string }

type Consulta = {
  id: string
  created_at: string
  motivo: string
  sucursal: string
  atendido_por: string
  antecedentes_medicos: Record<string, boolean> | null
  antecedentes_oculares: Record<string, boolean> | null
  antecedentes_familiares: Record<string, boolean> | null
  medicamentos: string
  alergias: string
  habitos: {
    horas_computadora: number; horas_celular: number; horas_lectura: number
    horas_videojuegos: number; maneja_noche: boolean; lentes_sol: boolean
    lentes_seguridad: boolean; actividad_laboral: string; distancia_trabajo: string
  } | null
  sintomas_lista: string[]
  sintomas_obs: string
  av_vl_od: string; av_vl_oi: string
  av_vc_od: string; av_vc_oi: string
  av_sc_od: string; av_sc_oi: string
  auto_od: RxEye | null; auto_oi: RxEye | null
  rx_od: RxEye | null; rx_oi: RxEye | null
  rx_dp_od: string; rx_dp_oi: string
  lens_od: string; lens_oi: string
  observaciones_clinicas: string
  diagnosticos: string[]
  rec_clinicas: string[]
  rec_comerciales: { producto: string; razon: string; prioridad: string }[] | null
  estado: string
}

type Receta = {
  id: string; fecha: string; tipo: string; optometrista: string
  od_esfera: string; od_cilindro: string; od_eje: string; od_add: string
  oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_add: string
  dp: string; observaciones: string
}

type Paciente = {
  id: string; nombre: string; apellido: string; fecha_nacimiento: string
  telefono: string; email: string; sexo: string; ocupacion: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcEdad(f: string) {
  if (!f) return '—'
  const hoy = new Date(); const nac = new Date(f)
  let e = hoy.getFullYear() - nac.getFullYear()
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) e--
  return `${e} años`
}
function formatFecha(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatHora(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
function keys(obj: Record<string, boolean> | null | undefined): string[] {
  if (!obj) return []
  return Object.entries(obj).filter(([, v]) => v).map(([k]) => k)
}
function fv(v: string | null | undefined) {
  if (!v || v === '' || v === '0.00') return '—'
  return v
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ResumenInternoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [paciente, setPaciente]       = useState<Paciente | null>(null)
  const [consultas, setConsultas]     = useState<Consulta[]>([])
  const [seleccionada, setSeleccionada] = useState<Consulta | null>(null)
  const [receta, setReceta]           = useState<Receta | null>(null)
  const [cargando, setCargando]       = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient()
      const [{ data: p }, { data: cs }, { data: r }] = await Promise.all([
        supabase.from('pacientes').select('id,nombre,apellido,fecha_nacimiento,telefono,email,sexo,ocupacion').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
        supabase.from('recetas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }).limit(1).single(),
      ])
      setPaciente(p as Paciente)
      const lista = (cs ?? []) as Consulta[]
      setConsultas(lista)
      setSeleccionada(lista[0] ?? null)
      setReceta(r as Receta)
      setCargando(false)
    }
    cargar()
  }, [id])

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!paciente) return (
    <div className="p-8 text-center text-zinc-400">
      <p>Paciente no encontrado.</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-[#0D9488] hover:underline">Volver</button>
    </div>
  )

  const c = seleccionada

  return (
    <div className="max-w-6xl mx-auto">

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-zinc-900">{paciente.nombre} {paciente.apellido}</h1>
          <p className="text-xs text-zinc-400">{calcEdad(paciente.fecha_nacimiento)} · {paciente.telefono} {paciente.email && `· ${paciente.email}`}</p>
        </div>
        <button
          onClick={() => router.push(`/dashboard/expedientes/${id}/hoja`)}
          className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
          <FileText className="w-3.5 h-3.5" /> Hoja del paciente
        </button>
      </div>

      <div className="flex gap-5">

        {/* ─── Lista de consultas ─────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Consultas ({consultas.length})</p>
          <div className="space-y-1">
            {consultas.map((c2) => (
              <button key={c2.id}
                onClick={() => setSeleccionada(c2)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${seleccionada?.id === c2.id ? 'bg-[#0D9488] border-[#0D9488] text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                <p className={`text-xs font-semibold ${seleccionada?.id === c2.id ? 'text-white' : 'text-zinc-800'}`}>{formatFecha(c2.created_at)}</p>
                <p className={`text-[10px] mt-0.5 truncate ${seleccionada?.id === c2.id ? 'text-white/70' : 'text-zinc-400'}`}>{c2.motivo || 'Sin motivo'}</p>
                <p className={`text-[10px] ${seleccionada?.id === c2.id ? 'text-white/60' : 'text-zinc-400'}`}>{c2.atendido_por || '—'}</p>
              </button>
            ))}
            {consultas.length === 0 && (
              <div className="text-xs text-zinc-400 px-3 py-4 text-center">Sin consultas registradas</div>
            )}
          </div>
        </div>

        {/* ─── Detalle de consulta ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {!c ? (
            <div className="bg-white rounded-xl border border-zinc-100 p-8 text-center text-zinc-400 text-sm">
              Selecciona una consulta para ver el detalle
            </div>
          ) : (
            <>
              {/* Info general */}
              <Card titulo="Información general">
                <div className="grid grid-cols-3 gap-3">
                  <Campo label="Fecha" valor={`${formatFecha(c.created_at)} ${formatHora(c.created_at)}`} />
                  <Campo label="Optometrista" valor={c.atendido_por} />
                  <Campo label="Sucursal" valor={c.sucursal} />
                  <Campo label="Motivo" valor={c.motivo} />
                  <Campo label="Estado" valor={c.estado} badge />
                </div>
              </Card>

              {/* Síntomas */}
              {(c.sintomas_lista?.length > 0 || c.sintomas_obs) && (
                <Card titulo="Síntomas referidos">
                  {c.sintomas_lista?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {c.sintomas_lista.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  )}
                  {c.sintomas_obs && <p className="text-xs text-zinc-500 italic">"{c.sintomas_obs}"</p>}
                </Card>
              )}

              {/* Antecedentes */}
              {(keys(c.antecedentes_medicos).length > 0 || keys(c.antecedentes_oculares).length > 0 || keys(c.antecedentes_familiares).length > 0 || c.medicamentos || c.alergias) && (
                <Card titulo="Antecedentes">
                  <div className="grid grid-cols-2 gap-4">
                    {keys(c.antecedentes_medicos).length > 0 && (
                      <AntecGroup label="Sistémicos" items={keys(c.antecedentes_medicos)} />
                    )}
                    {keys(c.antecedentes_oculares).length > 0 && (
                      <AntecGroup label="Oculares previos" items={keys(c.antecedentes_oculares)} />
                    )}
                    {keys(c.antecedentes_familiares).length > 0 && (
                      <AntecGroup label="Familiares" items={keys(c.antecedentes_familiares)} />
                    )}
                    {c.medicamentos && c.medicamentos !== 'Ninguno' && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Medicamentos</p>
                        <p className="text-xs text-zinc-700">{c.medicamentos}</p>
                      </div>
                    )}
                    {c.alergias && c.alergias !== 'Ninguna' && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Alergias</p>
                        <p className="text-xs text-zinc-700">{c.alergias}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Hábitos */}
              {c.habitos && (
                <Card titulo="Hábitos visuales">
                  <div className="grid grid-cols-4 gap-2">
                    {c.habitos.horas_computadora > 0 && <HabitoItem label="Computadora" valor={`${c.habitos.horas_computadora}h/día`} />}
                    {c.habitos.horas_celular > 0 && <HabitoItem label="Celular" valor={`${c.habitos.horas_celular}h/día`} />}
                    {c.habitos.horas_lectura > 0 && <HabitoItem label="Lectura" valor={`${c.habitos.horas_lectura}h/día`} />}
                    {c.habitos.horas_videojuegos > 0 && <HabitoItem label="Videojuegos" valor={`${c.habitos.horas_videojuegos}h/día`} />}
                    {c.habitos.actividad_laboral && <HabitoItem label="Actividad" valor={c.habitos.actividad_laboral} />}
                    {c.habitos.distancia_trabajo && <HabitoItem label="Dist. trabajo" valor={c.habitos.distancia_trabajo} />}
                    {c.habitos.maneja_noche && <HabitoItem label="Maneja de noche" valor="Sí" />}
                    {c.habitos.lentes_sol && <HabitoItem label="Lentes de sol" valor="Sí" />}
                    {c.habitos.lentes_seguridad && <HabitoItem label="Lentes seg." valor="Sí" />}
                  </div>
                </Card>
              )}

              {/* Agudeza visual + refracción */}
              {(c.av_vl_od || c.av_vl_oi || c.av_sc_od || c.rx_od) && (
                <Card titulo="Agudeza visual y refracción">
                  {/* AV */}
                  {(c.av_vl_od || c.av_vl_oi) && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Agudeza visual</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50">
                            <th className="text-left px-3 py-2 text-zinc-500 font-semibold border border-zinc-200 w-16"></th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">AV Lejos c/c</th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">AV Cerca c/c</th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">AV Lejos s/c</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'OD', vl: c.av_vl_od, vc: c.av_vc_od, sc: c.av_sc_od },
                            { label: 'OI', vl: c.av_vl_oi, vc: c.av_vc_oi, sc: c.av_sc_oi },
                          ].map(row => (
                            <tr key={row.label}>
                              <td className="px-3 py-2 font-bold text-zinc-700 border border-zinc-200">{row.label}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.vl)}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.vc)}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.sc)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Lentes actuales */}
                  {(c.lens_od || c.lens_oi) && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Lentes actuales</p>
                      <div className="flex gap-4 text-xs">
                        {c.lens_od && <span className="text-zinc-700"><span className="font-semibold">OD:</span> {c.lens_od}</span>}
                        {c.lens_oi && <span className="text-zinc-700"><span className="font-semibold">OI:</span> {c.lens_oi}</span>}
                      </div>
                    </div>
                  )}

                  {/* Refracción subjetiva */}
                  {c.rx_od && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Refracción subjetiva</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50">
                            <th className="text-left px-3 py-2 text-zinc-500 font-semibold border border-zinc-200 w-16"></th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">Esfera</th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">Cilindro</th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">Eje</th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">ADD</th>
                            <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">D.P.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'OD', rx: c.rx_od, dp: c.rx_dp_od },
                            { label: 'OI', rx: c.rx_oi, dp: c.rx_dp_oi },
                          ].map(row => (
                            <tr key={row.label}>
                              <td className="px-3 py-2 font-bold text-zinc-700 border border-zinc-200">{row.label}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.rx?.esfera)}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.rx?.cilindro)}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{row.rx?.eje ? `${row.rx.eje}°` : '—'}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.rx?.add)}</td>
                              <td className="px-3 py-2 text-center font-mono border border-zinc-200">{row.dp ? `${row.dp} mm` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {c.observaciones_clinicas && (
                    <p className="text-xs text-zinc-500 italic mt-3 pt-3 border-t border-zinc-100">{c.observaciones_clinicas}</p>
                  )}
                </Card>
              )}

              {/* Diagnósticos */}
              {c.diagnosticos?.length > 0 && (
                <Card titulo="Diagnósticos">
                  <div className="flex flex-wrap gap-2">
                    {c.diagnosticos.map((d, i) => (
                      <span key={i} className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded text-xs font-medium">{d}</span>
                    ))}
                  </div>
                </Card>
              )}

              {/* Prescripción final (de recetas) */}
              {receta && (
                <Card titulo={`Prescripción final — ${receta.tipo} (${formatFecha(receta.fecha)})`}>
                  <table className="w-full text-xs border-collapse mb-3">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="text-left px-3 py-2 text-zinc-500 font-semibold border border-zinc-200 w-16"></th>
                        <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">Esfera</th>
                        <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">Cilindro</th>
                        <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">Eje</th>
                        <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">ADD</th>
                        <th className="px-3 py-2 text-zinc-500 font-semibold border border-zinc-200">D.P.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'OD', esf: receta.od_esfera, cil: receta.od_cilindro, eje: receta.od_eje, add: receta.od_add, dp: receta.dp },
                        { label: 'OI', esf: receta.oi_esfera, cil: receta.oi_cilindro, eje: receta.oi_eje, add: receta.oi_add, dp: '' },
                      ].map(row => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-bold text-zinc-700 border border-zinc-200">{row.label}</td>
                          <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.esf)}</td>
                          <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.cil)}</td>
                          <td className="px-3 py-2 text-center font-mono border border-zinc-200">{row.eje ? `${row.eje}°` : '—'}</td>
                          <td className="px-3 py-2 text-center font-mono border border-zinc-200">{fv(row.add)}</td>
                          <td className="px-3 py-2 text-center font-mono border border-zinc-200">{row.dp ? `${row.dp} mm` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span>Optometrista: <span className="font-semibold text-zinc-700">{receta.optometrista}</span></span>
                    {receta.observaciones && <span>Obs: {receta.observaciones}</span>}
                  </div>
                </Card>
              )}

              {/* Recomendaciones clínicas */}
              {c.rec_clinicas?.length > 0 && (
                <Card titulo="Recomendaciones clínicas">
                  <div className="space-y-1.5">
                    {c.rec_clinicas.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#0D9488] flex-shrink-0 mt-2" />
                        <p className="text-xs text-zinc-700">{r}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recomendaciones comerciales */}
              {c.rec_comerciales && c.rec_comerciales.length > 0 && (
                <Card titulo="Recomendaciones comerciales">
                  <div className="space-y-2">
                    {c.rec_comerciales.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 bg-zinc-50 rounded-lg">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${r.prioridad === 'alta' ? 'bg-red-100 text-red-700' : r.prioridad === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-200 text-zinc-600'}`}>
                          {r.prioridad}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-zinc-800">{r.producto}</p>
                          <p className="text-xs text-zinc-500">{r.razon}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{titulo}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function Campo({ label, valor, badge }: { label: string; valor?: string; badge?: boolean }) {
  if (!valor) return null
  return (
    <div>
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">{label}</p>
      {badge ? (
        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs font-medium">{valor}</span>
      ) : (
        <p className="text-xs font-medium text-zinc-800">{valor}</p>
      )}
    </div>
  )
}

function AntecGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(i => (
          <span key={i} className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs">{i}</span>
        ))}
      </div>
    </div>
  )
}

function HabitoItem({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-zinc-50 rounded-lg p-2">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold text-zinc-700 mt-0.5">{valor}</p>
    </div>
  )
}
