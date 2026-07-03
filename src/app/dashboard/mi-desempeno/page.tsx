'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Zap, Award, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'

// ── Comisiones y bonos ───────────────────────────────────────────
const BONOS_TABLA = [
  { meta: 50000,  bono: 500  },
  { meta: 100000, bono: 800  },
  { meta: 150000, bono: 1200 },
  { meta: 200000, bono: 4050 },
  { meta: 230000, bono: 5100 },
  { meta: 250000, bono: 5800 },
  { meta: 265000, bono: 6325 },
  { meta: 300000, bono: 7550 },
]

function calcularComision(ventas: number): number {
  if (ventas <= 0) return 0
  if (ventas <= 100000) return ventas * 0.015
  if (ventas <= 150000) return 1500 + (ventas - 100000) * 0.02
  return 1500 + 1000 + (ventas - 150000) * 0.025
}

function calcularBono(ventas: number) {
  let actual = 0
  let siguiente: { meta: number; bono: number } | null = null
  for (const b of BONOS_TABLA) {
    if (ventas >= b.meta) actual = b.bono
    else { siguiente = b; break }
  }
  return { actual, siguiente }
}

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('es-MX')
}

// ── Componente de donut pequeño ──────────────────────────────────
function DonutProgress({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  return (
    <svg width="90" height="90" className="-rotate-90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#E2E8F0" strokeWidth="8" />
      <circle
        cx="45" cy="45" r={r} fill="none"
        stroke="#6366F1" strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

// ── Barra de progreso ─────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

export default function MiDesempenoPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [ventasMes, setVentasMes] = useState(0)
  const [ordenes, setOrdenes] = useState(0)
  const [metaMes, setMetaMes] = useState(200000)
  const [nombre, setNombre] = useState('')

  // Leer usuario del localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setNombre(u.nombre ?? '')
      }
    } catch { /* noop */ }
  }, [])

  // Fetch ventas del mes seleccionado
  useEffect(() => {
    if (!nombre) return
    const fetchData = async () => {
      try {
        const sb = createClient()
        const inicio = new Date(anio, mes, 1).toISOString()
        const fin = new Date(anio, mes + 1, 0, 23, 59, 59).toISOString()

        const { data: ventas } = await sb
          .from('ventas')
          .select('total')
          .eq('atendido_por', nombre)
          .eq('es_cotizacion', false)
          .eq('estado', 'activa')
          .gte('created_at', inicio)
          .lte('created_at', fin)

        if (ventas) {
          setVentasMes(ventas.reduce((s, v) => s + Number(v.total), 0))
          setOrdenes(ventas.length)
        }

        // Fetch meta del mes (tabla metas_vendedor si existe)
        const mesStr = `${anio}-${String(mes + 1).padStart(2, '0')}`
        const { data: meta } = await sb
          .from('metas_vendedor')
          .select('meta_monto')
          .eq('vendedor_nombre', nombre)
          .eq('mes', mesStr)
          .single()
        if (meta?.meta_monto) setMetaMes(Number(meta.meta_monto))
        else setMetaMes(200000)
      } catch { /* usa defaults */ }
    }
    fetchData()
  }, [nombre, mes, anio])

  const comision = calcularComision(ventasMes)
  const { actual: bonoActual, siguiente: bonoSiguiente } = calcularBono(ventasMes)
  const totalExtra = comision + bonoActual
  const pctMeta = Math.min((ventasMes / metaMes) * 100, 100)
  const pctBono = bonoSiguiente
    ? Math.min((ventasMes / bonoSiguiente.meta) * 100, 100)
    : 100
  const diasMes = new Date(anio, mes + 1, 0).getDate()
  const promedioDia = ordenes > 0 ? ventasMes / diasMes : 0

  const nombreMes = new Date(anio, mes, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })
  const esMesActual = mes === now.getMonth() && anio === now.getFullYear()

  const irMesAnterior = () => {
    if (mes === 0) { setMes(11); setAnio(a => a - 1) }
    else setMes(m => m - 1)
  }
  const irMesSiguiente = () => {
    if (mes === 11) { setMes(0); setAnio(a => a + 1) }
    else setMes(m => m + 1)
  }

  // Mensaje motivacional
  const mensajeMotivacional = () => {
    if (pctMeta >= 100) return '¡Alcanzaste tu meta mensual! Eres increíble 🏆'
    if (pctMeta >= 80) return '¡Casi llegas! Estás a muy poco de tu meta 💪'
    if (pctMeta >= 50) return '¡Vas por buen camino! Sigue así para alcanzar tu meta 💼'
    return 'Cada venta cuenta. ¡Tú puedes alcanzar la meta este mes! 🚀'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Mi desempeño</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Resumen de comisiones y bonos</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2 shadow-sm">
          <button onClick={irMesAnterior} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-zinc-800 capitalize w-32 text-center">{nombreMes}</span>
          <button
            onClick={irMesSiguiente}
            disabled={esMesActual}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Comisión */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Comisión</p>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{fmt(comision)}</p>
          <p className="text-xs text-zinc-400 mt-1">Escalonada por ventas</p>
        </div>

        {/* Bono */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Bono</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{fmt(bonoActual)}</p>
          <p className="text-xs text-zinc-400 mt-1">Metas alcanzadas</p>
        </div>

        {/* Total acumulado */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Total acumulado</p>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmt(totalExtra)}</p>
          <p className="text-xs text-zinc-400 mt-1">Comisión + Bono</p>
        </div>

        {/* Meta mensual con donut */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Meta mensual</p>
              <p className="text-xl font-bold text-zinc-800">{fmt(metaMes)}</p>
              <p className="text-xs text-zinc-400 mt-1">Objetivo de ventas</p>
            </div>
            <div className="relative flex items-center justify-center">
              <DonutProgress pct={pctMeta} />
              <span className="absolute text-xs font-bold text-zinc-700">{Math.round(pctMeta)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Progreso ── */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-700">Tu progreso este mes</h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Para el siguiente bono */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-50 flex items-center justify-center">
                <Award className="w-3 h-3 text-emerald-500" />
              </div>
              <p className="text-sm text-zinc-500">Para el siguiente bono</p>
              {bonoSiguiente && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {Math.round(pctBono)}%
                </span>
              )}
            </div>
            {bonoSiguiente ? (
              <>
                <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{fmt(bonoSiguiente.bono)}</p>
                <ProgressBar pct={pctBono} color="bg-emerald-500" />
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{fmt(ventasMes)}</span>
                  <span>{fmt(bonoSiguiente.meta)}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Te faltan{' '}
                  <span className="font-semibold text-zinc-700">
                    {fmt(bonoSiguiente.meta - ventasMes)}
                  </span>{' '}
                  para el siguiente bono
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-emerald-600">¡Máximo!</p>
                <ProgressBar pct={100} color="bg-emerald-500" />
                <p className="text-xs text-zinc-500 font-semibold text-emerald-600">
                  Alcanzaste el bono máximo del mes 🏆
                </p>
              </>
            )}
          </div>

          {/* Para alcanzar la meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-indigo-500" />
              </div>
              <p className="text-sm text-zinc-500">Para alcanzar tu meta mensual</p>
              <span className="ml-auto text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {Math.round(pctMeta)}%
              </span>
            </div>
            <p className="text-2xl font-semibold text-zinc-900 tracking-tight">
              {pctMeta >= 100 ? '¡Lograda!' : fmt(metaMes - ventasMes)}
            </p>
            <ProgressBar pct={pctMeta} color="bg-indigo-500" />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{fmt(ventasMes)}</span>
              <span>{fmt(metaMes)}</span>
            </div>
            <p className="text-xs text-zinc-500">
              {pctMeta >= 100
                ? <span className="font-semibold text-indigo-600">¡Meta superada este mes! 🎉</span>
                : <>Te faltan <span className="font-semibold text-zinc-700">{fmt(metaMes - ventasMes)}</span> para alcanzar tu meta</>
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Resumen de ventas ── */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-700">Resumen de ventas</h2>
        </div>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Ventas del mes</p>
            <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{fmt(ventasMes)}</p>
          </div>
          <div className="w-px h-10 bg-zinc-100" />
          <div>
            <p className="text-xs text-zinc-400 mb-1">Promedio por día</p>
            <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{fmt(promedioDia)}</p>
          </div>
          <div className="w-px h-10 bg-zinc-100" />
          <div>
            <p className="text-xs text-zinc-400 mb-1">Órdenes realizadas</p>
            <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{ordenes}</p>
          </div>
          <div className="ml-auto">
            <Link
              href="/dashboard/ventas"
              className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
            >
              Ver detalle de ventas
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Banner motivacional ── */}
      <div className="bg-[#0B0E14] rounded-2xl px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{mensajeMotivacional()}</p>
          <p className="text-xs text-white/50 mt-0.5">
            Las comisiones se calculan en base a las ventas realizadas y las metas alcanzadas.
          </p>
        </div>
        {bonoSiguiente && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-white/50">Próximo bono</p>
            <p className="text-lg font-bold text-amber-400">{fmt(bonoSiguiente.bono)}</p>
          </div>
        )}
      </div>

    </div>
  )
}
