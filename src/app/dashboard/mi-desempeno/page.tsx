'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Zap, Award, ChevronLeft, ChevronRight, ExternalLink, Star } from 'lucide-react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────
// VENDEDOR
// ─────────────────────────────────────────────────────────────────
const V_BONO_DIARIO_META  = 10_000
const V_BONO_DIARIO_MONTO = 200

const V_BONOS: { meta: number; bono: number }[] = [
  { meta:  50_000, bono:   500 },
  { meta: 100_000, bono:   800 },
  { meta: 150_000, bono: 1_200 },
  { meta: 200_000, bono: 4_050 },
  { meta: 230_000, bono: 5_100 },
  { meta: 250_000, bono: 5_800 },
  { meta: 265_000, bono: 6_325 },
  { meta: 300_000, bono: 7_550 },
]

function calcularComisionVendedor(v: number) {
  if (v <= 0) return 0
  if (v <= 100_000) return v * 0.015
  if (v <= 150_000) return 1_500 + (v - 100_000) * 0.02
  return 1_500 + 1_000 + (v - 150_000) * 0.025
}

function desgloseVendedor(v: number) {
  const t1 = Math.min(v, 100_000)
  const t2 = v > 100_000 ? Math.min(v - 100_000, 50_000) : 0
  const t3 = v > 150_000 ? v - 150_000 : 0
  return [
    { label: '$0 – $100,000',       tasa: '1.5%', base: t1, ganado: t1 * 0.015 },
    { label: '$100,001 – $150,000', tasa: '2%',   base: t2, ganado: t2 * 0.02  },
    { label: '$150,001 +',          tasa: '2.5%', base: t3, ganado: t3 * 0.025 },
  ]
}

/** Bonos vendedor: NO acumulativos — solo el nivel máximo */
function calcularBonoVendedor(v: number) {
  let actual = 0, siguiente: typeof V_BONOS[0] | null = null
  for (const b of V_BONOS) {
    if (v >= b.meta) actual = b.bono
    else { siguiente = b; break }
  }
  return { actual, siguiente }
}

// ─────────────────────────────────────────────────────────────────
// GERENTE
// ─────────────────────────────────────────────────────────────────
const G_BONO_DIARIO_META  = 24_000
const G_BONO_DIARIO_MONTO = 300

const G_BONOS: { meta: number; bono: number; acumulado: number }[] = [
  { meta: 100_000, bono:   500, acumulado:    500 },
  { meta: 150_000, bono:   500, acumulado:  1_000 },
  { meta: 200_000, bono:   500, acumulado:  1_500 },
  { meta: 250_000, bono:   500, acumulado:  2_000 },
  { meta: 300_000, bono: 2_500, acumulado:  4_500 },
  { meta: 350_000, bono: 2_500, acumulado:  7_000 },
  { meta: 400_000, bono: 3_250, acumulado: 10_250 },
  { meta: 450_000, bono: 3_500, acumulado: 13_750 },
  { meta: 500_000, bono: 4_000, acumulado: 17_750 },
]

function calcularComisionGerente(v: number) {
  if (v <= 0) return 0
  if (v <= 300_000) return v * 0.01
  if (v <= 350_000) return 3_000 + (v - 300_000) * 0.015
  if (v <= 400_000) return 3_000 + 750 + (v - 350_000) * 0.02
  return 3_000 + 750 + 1_000 + (v - 400_000) * 0.025
}

function desgloseGerente(v: number) {
  const t1 = Math.min(v, 300_000)
  const t2 = v > 300_000 ? Math.min(v - 300_000, 50_000) : 0
  const t3 = v > 350_000 ? Math.min(v - 350_000, 50_000) : 0
  const t4 = v > 400_000 ? v - 400_000 : 0
  return [
    { label: '$0 – $300,000',       tasa: '1.0%', base: t1, ganado: t1 * 0.01  },
    { label: '$300,001 – $350,000', tasa: '1.5%', base: t2, ganado: t2 * 0.015 },
    { label: '$350,001 – $400,000', tasa: '2.0%', base: t3, ganado: t3 * 0.02  },
    { label: '$400,001 +',          tasa: '2.5%', base: t4, ganado: t4 * 0.025 },
  ]
}

/** Bonos gerente: ACUMULATIVOS — se suman todos los escalones alcanzados */
function calcularBonoGerente(v: number) {
  let actual = 0, siguiente: typeof G_BONOS[0] | null = null
  for (const b of G_BONOS) {
    if (v >= b.meta) actual = b.acumulado
    else { siguiente = b; break }
  }
  return { actual, siguiente }
}

// ─────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-MX') }

function DonutProgress({ pct }: { pct: number }) {
  const r = 36, circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  return (
    <svg width="90" height="90" className="-rotate-90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#E2E8F0" strokeWidth="8" />
      <circle cx="45" cy="45" r={r} fill="none" stroke="#6366F1" strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700" />
    </svg>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────
export default function MiDesempenoPage() {
  const now = new Date()
  const [mes,  setMes]  = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())

  const [ventasMes,  setVentasMes]  = useState(0)
  const [ventasHoy,  setVentasHoy]  = useState(0)
  const [ordenes,    setOrdenes]    = useState(0)
  const [metaMes,    setMetaMes]    = useState(0)
  const [nombre,     setNombre]     = useState('')
  const [sucursal,   setSucursal]   = useState('')
  const [rol,        setRol]        = useState('')
  const [usuarioId,  setUsuarioId]  = useState<string | null>(null)

  const esGerente = rol === 'gerente'

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      setNombre(u.nombre ?? '')
      setSucursal(u.sucursal ?? '')
      setRol(u.rol ?? '')
      setUsuarioId(u.id ?? null)
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    if (!nombre) return
    const fetchData = async () => {
      try {
        const sb = createClient()
        const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
        const inicio = new Date(anio, mes, 1).toISOString()
        const fin    = new Date(anio, mes + 1, 0, 23, 59, 59).toISOString()
        const esMesActualFetch = mes === now.getMonth() && anio === now.getFullYear()
        const mesStr = `${anio}-${String(mes + 1).padStart(2, '0')}`

        if (esGerente) {
          // Gerente ve ventas GLOBALES de las 3 sucursales
          const [rMes, rHoy, rMetas] = await Promise.all([
            sb.from('ventas').select('total').eq('es_cotizacion', false)
              .gte('created_at', inicio).lte('created_at', fin),
            esMesActualFetch
              ? sb.from('ventas').select('total').eq('es_cotizacion', false)
                  .gte('created_at', `${hoyStr}T00:00:00`).lte('created_at', `${hoyStr}T23:59:59`)
              : Promise.resolve({ data: [] }),
            sb.from('metas').select('meta').eq('mes', mesStr),
          ])
          const lista = rMes.data || []
          setVentasMes(lista.reduce((s, v) => s + Number(v.total), 0))
          setOrdenes(lista.length)
          setVentasHoy(((rHoy as { data: { total: number }[] | null }).data || []).reduce((s, v) => s + Number(v.total), 0))
          // Meta = suma de las 3 sucursales
          const totalMeta = (rMetas.data || []).reduce((s, m) => s + Number(m.meta), 0)
          setMetaMes(totalMeta || 400_000)
        } else {
          // Vendedor ve solo sus propias ventas
          const qBase = (start: string, end: string) => {
            const q = sb.from('ventas').select('total').eq('es_cotizacion', false)
              .gte('created_at', start).lte('created_at', end)
            return usuarioId ? q.eq('usuario_id', usuarioId) : q.eq('atendido_por', nombre)
          }
          const [rMes, rHoy] = await Promise.all([
            qBase(inicio, fin),
            esMesActualFetch
              ? qBase(`${hoyStr}T00:00:00`, `${hoyStr}T23:59:59`)
              : Promise.resolve({ data: [] }),
          ])
          const lista = rMes.data || []
          setVentasMes(lista.reduce((s, v) => s + Number(v.total), 0))
          setOrdenes(lista.length)
          setVentasHoy(((rHoy as { data: { total: number }[] | null }).data || []).reduce((s, v) => s + Number(v.total), 0))
          if (sucursal) {
            const { data: meta } = await sb.from('metas')
              .select('meta').eq('sucursal', sucursal).eq('mes', mesStr).maybeSingle()
            setMetaMes(meta ? Number(meta.meta) : 200_000)
          }
        }
      } catch { /* usa defaults */ }
    }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, sucursal, rol, mes, anio, usuarioId])

  // ── Cálculos según rol ───────────────────────────────────────────
  const BONO_DIARIO_META  = esGerente ? G_BONO_DIARIO_META  : V_BONO_DIARIO_META
  const BONO_DIARIO_MONTO = esGerente ? G_BONO_DIARIO_MONTO : V_BONO_DIARIO_MONTO
  const comision   = esGerente ? calcularComisionGerente(ventasMes) : calcularComisionVendedor(ventasMes)
  const { actual: bonoActual, siguiente: bonoSiguiente } = esGerente
    ? calcularBonoGerente(ventasMes) : calcularBonoVendedor(ventasMes)
  const totalExtra = comision + bonoActual
  const pctMeta    = Math.min((ventasMes / (metaMes || 1)) * 100, 100)
  const pctBono    = bonoSiguiente ? Math.min((ventasMes / bonoSiguiente.meta) * 100, 100) : 100
  const diasMes    = new Date(anio, mes + 1, 0).getDate()
  const promedioDia = ordenes > 0 ? ventasMes / diasMes : 0

  const esMesActual  = mes === now.getMonth() && anio === now.getFullYear()
  const bonoDiarioOk = esMesActual && ventasHoy >= BONO_DIARIO_META
  const pctDiario    = esMesActual ? Math.min(Math.round((ventasHoy / BONO_DIARIO_META) * 100), 100) : 0
  const faltaDiario  = Math.max(0, BONO_DIARIO_META - ventasHoy)
  const des          = esGerente ? desgloseGerente(ventasMes) : desgloseVendedor(ventasMes)
  const BONOS_TABLA  = esGerente ? G_BONOS : V_BONOS

  // Valor a mostrar del siguiente bono (acumulado para gerente, incremental para vendedor)
  const bonoSiguienteValor = bonoSiguiente
    ? (esGerente ? (bonoSiguiente as typeof G_BONOS[0]).acumulado : bonoSiguiente.bono)
    : 0
  const bonoSiguienteIncremental = bonoSiguiente?.bono ?? 0

  const nombreMes = new Date(anio, mes, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  const irMesAnterior  = () => { if (mes === 0) { setMes(11); setAnio(a => a - 1) } else setMes(m => m - 1) }
  const irMesSiguiente = () => { if (mes === 11) { setMes(0); setAnio(a => a + 1) } else setMes(m => m + 1) }

  const mensajeMotivacional = () => {
    if (pctMeta >= 100) return '¡Alcanzaste la meta global! Excelente trabajo 🏆'
    if (pctMeta >= 80)  return '¡Casi llegamos! Las sucursales están a muy poco de la meta 💪'
    if (pctMeta >= 50)  return '¡Buen ritmo! Sigue impulsando las ventas del grupo 💼'
    return 'Cada venta en las tres sucursales suma. ¡Vamos por la meta! 🚀'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Mi desempeño</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {esGerente ? 'Comisiones y bonos globales · 3 sucursales' : 'Resumen de comisiones y bonos'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2 shadow-sm">
          <button onClick={irMesAnterior} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-zinc-800 capitalize w-32 text-center">{nombreMes}</span>
          <button onClick={irMesSiguiente} disabled={esMesActual}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bono diario */}
      {esMesActual && (
        <div className={`rounded-2xl p-5 border flex items-center gap-5 ${bonoDiarioOk ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-100 shadow-sm'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bonoDiarioOk ? 'bg-emerald-500' : 'bg-zinc-100'}`}>
            <Zap className={`w-6 h-6 ${bonoDiarioOk ? 'text-white' : 'text-zinc-400'}`} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${bonoDiarioOk ? 'text-emerald-700' : 'text-zinc-600'}`}>
                {bonoDiarioOk
                  ? `¡Bono del día desbloqueado! +${fmt(BONO_DIARIO_MONTO)} 🎉`
                  : `Bono del día · ${fmt(BONO_DIARIO_MONTO)} si ${esGerente ? 'el grupo llega' : 'llegas'} a ${fmt(BONO_DIARIO_META)}`}
              </p>
              <span className="text-sm font-bold text-zinc-700">{fmt(ventasHoy)} hoy</span>
            </div>
            <div className="h-2.5 bg-zinc-200/60 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctDiario}%`, background: bonoDiarioOk ? '#10B981' : pctDiario >= 70 ? '#F59E0B' : '#6366F1' }} />
            </div>
            {!bonoDiarioOk && (
              <p className="text-xs text-zinc-400">
                {esGerente ? 'Le faltan al grupo ' : 'Te faltan '}
                <span className="font-semibold text-zinc-600">{fmt(faltaDiario)}</span> para el bono de hoy
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
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
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Bono</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{fmt(bonoActual)}</p>
          <p className="text-xs text-zinc-400 mt-1">{esGerente ? 'Bonos acumulados' : 'Metas alcanzadas'}</p>
        </div>
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
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Meta {esGerente ? 'global' : 'mensual'}</p>
              <p className="text-xl font-bold text-zinc-800">{fmt(metaMes)}</p>
              <p className="text-xs text-zinc-400 mt-1">{esGerente ? 'Suma 3 sucursales' : 'Objetivo de ventas'}</p>
            </div>
            <div className="relative flex items-center justify-center">
              <DonutProgress pct={pctMeta} />
              <span className="absolute text-xs font-bold text-zinc-700">{Math.round(pctMeta)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progreso */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-700">
            {esGerente ? 'Progreso global del grupo' : 'Tu progreso este mes'}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
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
                <div>
                  <p className="text-2xl font-semibold text-zinc-900 tracking-tight">
                    {fmt(bonoSiguienteValor)}
                  </p>
                  {esGerente && bonoSiguiente && (
                    <p className="text-xs text-zinc-400">+{fmt(bonoSiguienteIncremental)} adicional al llegar</p>
                  )}
                </div>
                <ProgressBar pct={pctBono} color="bg-emerald-500" />
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{fmt(ventasMes)}</span>
                  <span>{fmt(bonoSiguiente.meta)}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  {esGerente ? 'Le faltan al grupo ' : 'Te faltan '}
                  <span className="font-semibold text-zinc-700">{fmt(bonoSiguiente.meta - ventasMes)}</span>
                  {' '}para el siguiente escalón
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-emerald-600">¡Máximo!</p>
                <ProgressBar pct={100} color="bg-emerald-500" />
                <p className="text-xs font-semibold text-emerald-600">Alcanzaste el bono máximo del mes 🏆</p>
              </>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-indigo-500" />
              </div>
              <p className="text-sm text-zinc-500">Para alcanzar la meta {esGerente ? 'global' : 'mensual'}</p>
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
                : <>{esGerente ? 'Le faltan al grupo ' : 'Te faltan '}
                    <span className="font-semibold text-zinc-700">{fmt(metaMes - ventasMes)}</span> para la meta</>}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen ventas */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-700">
            {esGerente ? 'Ventas globales del grupo' : 'Resumen de ventas'}
          </h2>
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
            <p className="text-xs text-zinc-400 mb-1">Órdenes {esGerente ? 'del grupo' : 'realizadas'}</p>
            <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{ordenes}</p>
          </div>
          <div className="ml-auto">
            <Link href="/dashboard/ventas"
              className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
              Ver detalle de ventas
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Desglose comisión */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-700">Desglose de comisión</h2>
        </div>
        <div className="space-y-0">
          {des.map((t, i) => (
            <div key={i} className={`flex items-center justify-between py-3 ${i < des.length - 1 ? 'border-b border-zinc-100' : ''}`}>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.base > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-zinc-100 text-zinc-400'}`}>{t.tasa}</span>
                <div>
                  <p className={`text-sm ${t.base > 0 ? 'text-zinc-700' : 'text-zinc-300'}`}>{t.label}</p>
                  {t.base > 0 && <p className="text-xs text-zinc-400">sobre {fmt(t.base)}</p>}
                </div>
              </div>
              <p className={`text-sm font-bold ${t.ganado > 0 ? 'text-indigo-600' : 'text-zinc-300'}`}>{t.ganado > 0 ? fmt(t.ganado) : '—'}</p>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 mt-1">
            <p className="text-sm font-bold text-zinc-700">Total comisión del mes</p>
            <p className="text-base font-bold text-indigo-600">{fmt(comision)}</p>
          </div>
        </div>
      </div>

      {/* Escalera de bonos */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-700">Escalera de bonos del mes</h2>
        </div>
        <div className="space-y-2">
          {BONOS_TABLA.map((tier, i) => {
            const alcanzado   = ventasMes >= tier.meta
            const esSiguiente = !alcanzado && (i === 0 || ventasMes >= BONOS_TABLA[i - 1].meta)
            const bonoMostrar = esGerente && 'acumulado' in tier ? tier.acumulado : tier.bono
            return (
              <div key={tier.meta}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                  alcanzado ? 'bg-emerald-50 border border-emerald-200' :
                  esSiguiente ? 'bg-amber-50 border border-amber-200' :
                  'bg-zinc-50 border border-zinc-100'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  alcanzado ? 'bg-emerald-500 text-white' :
                  esSiguiente ? 'bg-amber-400 text-white' :
                  'bg-zinc-200 text-zinc-400'}`}>{alcanzado ? '✓' : i + 1}</div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${alcanzado ? 'text-emerald-700' : esSiguiente ? 'text-amber-700' : 'text-zinc-400'}`}>
                    {fmt(tier.meta)}
                    {esSiguiente && <span className="ml-2 text-xs font-normal text-amber-600">← faltan {fmt(tier.meta - ventasMes)}</span>}
                  </p>
                  {esGerente && 'acumulado' in tier && (
                    <p className={`text-xs ${alcanzado ? 'text-emerald-500' : 'text-zinc-400'}`}>
                      +{fmt(tier.bono)} adicional
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className={`w-3.5 h-3.5 ${alcanzado ? 'text-emerald-400' : esSiguiente ? 'text-amber-400' : 'text-zinc-300'}`} />
                  <div className="text-right">
                    <p className={`text-sm font-bold ${alcanzado ? 'text-emerald-600' : esSiguiente ? 'text-amber-600' : 'text-zinc-300'}`}>
                      {fmt(bonoMostrar)}
                    </p>
                    {esGerente && <p className="text-xs text-zinc-400">acumulado</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-zinc-400 mt-3">
          {esGerente
            ? 'Bonos acumulativos — cada escalón alcanzado se suma al anterior.'
            : 'Bonos no acumulables — solo aplica el del rango máximo alcanzado en el mes.'}
        </p>
      </div>

      {/* Banner motivacional */}
      <div className="bg-[#0B0E14] rounded-2xl px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{mensajeMotivacional()}</p>
          <p className="text-xs text-white/50 mt-0.5">
            Las comisiones se calculan sobre {esGerente ? 'las ventas globales de las tres sucursales.' : 'las ventas realizadas y las metas alcanzadas.'}
          </p>
        </div>
        {bonoSiguiente && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-white/50">Próximo bono {esGerente ? 'acumulado' : ''}</p>
            <p className="text-lg font-bold text-amber-400">
              {fmt(bonoSiguienteValor)}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
