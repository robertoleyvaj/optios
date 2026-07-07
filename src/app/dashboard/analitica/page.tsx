'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, TrendingUp, Eye, Activity, Repeat2, Star, BarChart2, RefreshCw } from 'lucide-react'

// ──────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────
type Consulta = {
  id: string
  paciente_id: string
  motivo: string | null
  antecedentes_medicos: Record<string, boolean> | null
  antecedentes_familiares: Record<string, boolean> | null
  diagnosticos: string[] | null
  sintomas_lista: string[] | null
  created_at: string
}

type FreqItem = { label: string; count: number }

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function contarFrecuencias(items: (string | undefined | null)[]): FreqItem[] {
  const mapa: Record<string, number> = {}
  for (const item of items) {
    if (!item || item === 'Ninguna' || item === 'Ninguno') continue
    mapa[item] = (mapa[item] || 0) + 1
  }
  return Object.entries(mapa)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

function contarJsonbKeys(consultas: Consulta[], campo: 'antecedentes_medicos' | 'antecedentes_familiares'): FreqItem[] {
  const mapa: Record<string, number> = {}
  for (const c of consultas) {
    const obj = c[campo]
    if (!obj) continue
    for (const key of Object.keys(obj)) {
      if (!key || key === 'Ninguna' || key === 'Ninguno') continue
      mapa[key] = (mapa[key] || 0) + 1
    }
  }
  return Object.entries(mapa)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

function contarDiagnosticos(consultas: Consulta[]): FreqItem[] {
  const mapa: Record<string, number> = {}
  for (const c of consultas) {
    if (!c.diagnosticos) continue
    const diags = Array.isArray(c.diagnosticos) ? c.diagnosticos : []
    for (const d of diags) {
      if (!d) continue
      mapa[d] = (mapa[d] || 0) + 1
    }
  }
  return Object.entries(mapa)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// ──────────────────────────────────────────
// Componentes
// ──────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = 'teal' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    teal:   'bg-[#0D9488]/10 text-[#0D9488]',
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber:  'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color] || colors.teal}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-zinc-800 leading-none">{value}</p>
      <p className="text-xs font-semibold text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function BarList({ title, items, total, emptyMsg = 'Sin datos aún' }: {
  title: string; items: FreqItem[]; total: number; emptyMsg?: string
}) {
  if (items.length === 0) return (
    <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-700 mb-4">{title}</p>
      <p className="text-xs text-zinc-400">{emptyMsg}</p>
    </div>
  )
  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-700 mb-4">{title}</p>
      <div className="space-y-3">
        {items.slice(0, 8).map(({ label, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-600 truncate max-w-[65%]">{label}</span>
                <span className="font-semibold text-zinc-500">{count} <span className="font-normal text-zinc-400">({pct}%)</span></span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0D9488] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────
export default function AnaliticaPage() {
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('consultas')
      .select('id, paciente_id, motivo, antecedentes_medicos, antecedentes_familiares, diagnosticos, sintomas_lista, created_at')
      .order('created_at', { ascending: false })
    setConsultas((data as Consulta[]) || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // ── KPIs base
  const totalConsultas     = consultas.length
  const pacientesUnicos    = new Set(consultas.map(c => c.paciente_id)).size
  const conteoPorPaciente  = consultas.reduce<Record<string, number>>((acc, c) => {
    acc[c.paciente_id] = (acc[c.paciente_id] || 0) + 1; return acc
  }, {})
  const pacientesRecurrentes = Object.values(conteoPorPaciente).filter(n => n > 1).length
  const pctRecurrentes       = pacientesUnicos > 0 ? Math.round((pacientesRecurrentes / pacientesUnicos) * 100) : 0

  // ── Frecuencias
  const freqMotivos     = contarFrecuencias(consultas.map(c => c.motivo))
  const freqDiagnostics = contarDiagnosticos(consultas)
  const freqSintomas    = contarFrecuencias(consultas.flatMap(c => c.sintomas_lista || []))
  const freqAntecMed    = contarJsonbKeys(consultas, 'antecedentes_medicos')
  const freqAntecFam    = contarJsonbKeys(consultas, 'antecedentes_familiares')

  // ── Primeras consultas vs revisiones
  const primeras   = consultas.filter(c => c.motivo === 'Primera consulta').length
  const revisiones = totalConsultas - primeras

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800">Analítica Clínica</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Basado en {totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''} registradas</p>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {totalConsultas === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-100 p-12 text-center shadow-sm">
          <BarChart2 className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-500">Aún no hay consultas registradas</p>
          <p className="text-xs text-zinc-400 mt-1">Los datos aparecerán aquí conforme se completen expedientes</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Activity}  label="Total consultas"         value={totalConsultas}   color="teal" />
            <KpiCard icon={Users}     label="Pacientes únicos"        value={pacientesUnicos}  color="blue" />
            <KpiCard icon={Repeat2}   label="Pacientes recurrentes"   value={`${pctRecurrentes}%`} sub={`${pacientesRecurrentes} de ${pacientesUnicos}`} color="purple" />
            <KpiCard icon={Star}      label="Primera consulta"        value={primeras} sub={`${revisiones} revisiones`} color="amber" />
          </div>

          {/* Fila 1: Motivos + Diagnósticos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarList title="Motivos de consulta" items={freqMotivos} total={totalConsultas} />
            <BarList title="Diagnósticos más frecuentes" items={freqDiagnostics} total={totalConsultas} emptyMsg="Se generan al completar el paso de diagnóstico" />
          </div>

          {/* Fila 2: Síntomas + Antecedentes médicos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarList title="Síntomas más comunes" items={freqSintomas} total={totalConsultas} emptyMsg="Se registran en el paso de síntomas del wizard" />
            <BarList title="Enfermedades sistémicas reportadas" items={freqAntecMed} total={totalConsultas} emptyMsg="Se registran en la historia clínica" />
          </div>

          {/* Fila 3: Antecedentes familiares + resumen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarList title="Antecedentes familiares" items={freqAntecFam} total={totalConsultas} />
            <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm">
              <p className="text-sm font-semibold text-zinc-700 mb-4">Resumen general</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-zinc-50 pb-2">
                  <span className="text-zinc-500">Diagnóstico más frecuente</span>
                  <span className="font-semibold text-zinc-700">{freqDiagnostics[0]?.label || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-2">
                  <span className="text-zinc-500">Síntoma más común</span>
                  <span className="font-semibold text-zinc-700">{freqSintomas[0]?.label || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-2">
                  <span className="text-zinc-500">Motivo más frecuente</span>
                  <span className="font-semibold text-zinc-700">{freqMotivos[0]?.label || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-2">
                  <span className="text-zinc-500">Enfermedad sistémica más reportada</span>
                  <span className="font-semibold text-zinc-700">{freqAntecMed[0]?.label || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ant. familiar más frecuente</span>
                  <span className="font-semibold text-zinc-700">{freqAntecFam[0]?.label || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
