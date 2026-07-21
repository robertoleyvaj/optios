'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { rangoDiaLocal } from '@/lib/fecha'
import RequireRol from '@/components/RequireRol'
import {
  TrendingUp, ShoppingBag, Package, Target, CheckCircle2,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type Periodo = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'anio' | 'personalizado'

type Venta = {
  id: string
  total: number
  anticipo: number
  saldo: number
  sucursal: string
  metodo_pago: string
  atendido_por: string
  created_at: string
}

type OrdenLab = { estado: string; precio_cliente: number; fecha_promesa: string | null; venta_id: string | null }

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────
// Gerente solo ve hasta mensual (sus metas); admin ve todo el rango.
const PERIODOS_GERENTE: { key: Periodo; label: string }[] = [
  { key: 'hoy',    label: 'Hoy'         },
  { key: 'semana', label: 'Semana'      },
  { key: 'mes',    label: 'Mes'         },
]
const PERIODOS_ADMIN: { key: Periodo; label: string }[] = [
  ...PERIODOS_GERENTE,
  { key: 'trimestre',     label: 'Trimestre'     },
  { key: 'semestre',      label: 'Semestre'      },
  { key: 'anio',          label: 'Año'           },
  { key: 'personalizado', label: 'Personalizado' },
]

const SUCURSALES = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']

const COLOR_SUC: Record<string, string> = {
  'Baja Visión':    '#0D9488',
  '5 de Mayo':      '#0B0E14',
  'Plaza Laureles': '#6366F1',
}

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────
function getDateRange(periodo: Periodo, desde = '', hasta = '') {
  const hoy  = new Date()
  const pad  = (n: number) => String(n).padStart(2, '0')
  const fin  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
  const fmt  = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

  if (periodo === 'hoy')           return { inicio: fin, fin }
  if (periodo === 'personalizado') return { inicio: desde || fin, fin: hasta || fin }
  if (periodo === 'semana') {
    const d = new Date(hoy); const dia = hoy.getDay() || 7
    d.setDate(hoy.getDate() - dia + 1)
    return { inicio: fmt(d), fin }
  }
  if (periodo === 'mes') return { inicio: `${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-01`, fin }
  if (periodo === 'trimestre') {
    const q = Math.floor(hoy.getMonth() / 3)
    return { inicio: `${hoy.getFullYear()}-${pad(q*3+1)}-01`, fin }
  }
  if (periodo === 'semestre') {
    const h = hoy.getMonth() < 6 ? 1 : 7
    return { inicio: `${hoy.getFullYear()}-${pad(h)}-01`, fin }
  }
  return { inicio: `${hoy.getFullYear()}-01-01`, fin }
}

// Rango del periodo INMEDIATAMENTE anterior (mismo tamaño), para comparar ▲/▼.
function getPrevRange(periodo: Periodo, inicio: string, fin: string) {
  const dIni = new Date(inicio + 'T12:00:00')
  const dFin = new Date(fin + 'T12:00:00')
  const dias = Math.round((dFin.getTime() - dIni.getTime()) / 86400000) + 1
  const prevFin = new Date(dIni.getTime() - 86400000)
  const prevIni = new Date(prevFin.getTime() - (dias - 1) * 86400000)
  const f = (d: Date) => d.toLocaleDateString('en-CA')
  return { inicio: f(prevIni), fin: f(prevFin) }
}

function metaPeriodo(periodo: Periodo, mensual: number): number {
  if (periodo === 'hoy')       return Math.round(mensual / 30)
  if (periodo === 'semana')    return Math.round(mensual / 4)
  if (periodo === 'mes')       return mensual
  if (periodo === 'trimestre') return mensual * 3
  if (periodo === 'semestre')  return mensual * 6
  if (periodo === 'anio')      return mensual * 12
  return mensual
}

const $$ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtDia(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MESES_CORTO[parseInt(m) - 1] ?? ''}`
}

// ─────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, color, children }: {
  label: string; value: string; sub: string
  icon: React.ElementType
  color: string   // Tailwind text color class
  children?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <Icon className={`w-4 h-4 ${color} opacity-60`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5 flex-1">{sub}</p>
      {children}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200/80 rounded-lg p-5">
      <h3 className="text-sm font-bold text-zinc-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
function hoyMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ReportesPage() {
  const [periodo,     setPeriodo]     = useState<Periodo>('hoy')
  const [desde,       setDesde]       = useState('')
  const [hasta,       setHasta]       = useState('')
  const [sucursal,    setSucursal]    = useState('Todas')
  const [metaMensual, setMetaMensual] = useState(0)
  const [metasPorSuc, setMetasPorSuc] = useState<Record<string, number>>({})
  const [rolUsuario,  setRolUsuario]  = useState('administrador')

  // Data
  const [ventas,     setVentas]     = useState<Venta[]>([])
  const [cotCount,   setCotCount]   = useState(0)
  const [ordLab,     setOrdLab]     = useState<OrdenLab[]>([])
  const [prevTotal,  setPrevTotal]  = useState(0)   // ventas del periodo anterior (para ▲/▼)
  const [enCaja,     setEnCaja]     = useState(0)    // efectivo en caja hoy (las 3 sucursales)
  const [deudaListos, setDeudaListos] = useState(0)  // saldo pendiente de ventas con lentes listos
  const [cargando,   setCargando]   = useState(true)
  const [hoverIdx,   setHoverIdx]   = useState<number | null>(null)  // punto activo del gráfico de ritmo

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      setRolUsuario(u.rol || 'vendedor')
      if (u.rol !== 'administrador' && u.sucursal && u.sucursal !== 'Todas') {
        setSucursal(u.sucursal)
      }
    } catch {}
  }, [])

  // ── Fetch meta from DB ───────────────────────
  useEffect(() => {
    const fetchMeta = async () => {
      const mes = hoyMes()
      const sb = createClient()
      const { data } = await sb.from('metas').select('sucursal, meta').eq('mes', mes)
      const map: Record<string, number> = {}
      for (const r of data || []) map[r.sucursal] = Number(r.meta)
      setMetasPorSuc(map)
      const val = sucursal === 'Todas'
        ? Object.values(map).reduce((s, m) => s + m, 0)
        : (map[sucursal] ?? 0)
      setMetaMensual(val)
    }
    fetchMeta()
  }, [sucursal])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { inicio, fin } = getDateRange(periodo, desde, hasta)
    const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
    const sb = createClient()
    // Rango del periodo en hora Tijuana (mismo criterio que caja e inicio)
    const rangoInicio = rangoDiaLocal(inicio).start
    const rangoFin    = rangoDiaLocal(fin).end
    const rangoHoy    = rangoDiaLocal(hoyStr)

    // Query builder helpers
    const baseVentas = () => sb.from('ventas')
      .select('id, total, anticipo, saldo, sucursal, metodo_pago, atendido_por, created_at')
      .eq('es_cotizacion', false)
      .gte('created_at', rangoInicio)
      .lte('created_at', rangoFin)

    let qVentas = baseVentas()
    let qCot    = sb.from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('es_cotizacion', true)
      .gte('created_at', rangoInicio)
      .lte('created_at', rangoFin)
    let qLab    = sb.from('ordenes_lab')
      .select('estado, precio_cliente, fecha_promesa, venta_id')
      .neq('estado', 'entregado')
      .neq('estado', 'cancelada')

    // Periodo anterior (mismo tamaño) para comparación ▲/▼
    const prev = getPrevRange(periodo, inicio, fin)
    let qPrev = sb.from('ventas')
      .select('total')
      .eq('es_cotizacion', false)
      .gte('created_at', rangoDiaLocal(prev.inicio).start)
      .lte('created_at', rangoDiaLocal(prev.fin).end)

    // Efectivo que entró HOY a caja (foto del día)
    let qCaja = sb.from('pagos_venta')
      .select('monto')
      .eq('metodo_pago', 'efectivo')
      .neq('moneda', 'USD')
      .gte('created_at', rangoHoy.start)
      .lte('created_at', rangoHoy.end)

    if (sucursal !== 'Todas') {
      qVentas = qVentas.eq('sucursal', sucursal)
      qCot    = qCot.eq('sucursal', sucursal)
      qLab    = qLab.eq('sucursal', sucursal)
      qPrev   = qPrev.eq('sucursal', sucursal)
      qCaja   = qCaja.eq('sucursal', sucursal)
    }

    const [rV, rC, rL, rP, rCaja] = await Promise.all([qVentas, qCot, qLab, qPrev, qCaja])

    const ordLabData = rL.data || []
    setVentas(rV.data || [])
    setCotCount(rC.count ?? 0)
    setOrdLab(ordLabData)
    setPrevTotal((rP.data || []).reduce((s: number, v: { total: number }) => s + Number(v.total), 0))
    setEnCaja((rCaja.data || []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0))

    // Deuda: saldo pendiente de las ventas cuyos lentes YA están listos (sin duplicar por venta)
    const idsListos = [...new Set(
      ordLabData.filter((o: OrdenLab) => o.estado === 'listo' && o.venta_id).map((o: OrdenLab) => o.venta_id),
    )] as string[]
    if (idsListos.length > 0) {
      const { data: vDeuda } = await sb.from('ventas').select('saldo').in('id', idsListos)
      setDeudaListos((vDeuda || []).reduce((s: number, v: { saldo: number }) => s + Number(v.saldo || 0), 0))
    } else {
      setDeudaListos(0)
    }

    setCargando(false)
  }, [periodo, desde, hasta, sucursal])

  useEffect(() => { cargar() }, [cargar])

  // ── Cálculos ──────────────────────────────
  const totalFacturado = ventas.reduce((s, v) => s + Number(v.total), 0)
  const saldoTotal     = ventas.reduce((s, v) => s + Number(v.saldo), 0)

  const metaP   = metaPeriodo(periodo, metaMensual)
  const metaPct = metaP > 0 ? Math.min(Math.round((totalFacturado / metaP) * 100), 100) : 0
  const metaFaltante = Math.max(0, metaP - totalFacturado)

  // Variación vs periodo anterior
  const deltaPct = prevTotal > 0
    ? Math.round(((totalFacturado - prevTotal) / prevTotal) * 100)
    : (totalFacturado > 0 ? 100 : 0)

  // Lentes: listos por entregar (esperando pickup) vs total pendientes
  const lentesSinEntregar = ordLab.length
  const lentesListas      = ordLab.filter(o => o.estado === 'listo').length

  const totalAtendidos = ventas.length + cotCount
  const convPct = totalAtendidos > 0 ? Math.round((ventas.length / totalAtendidos) * 100) : 0

  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)
  const carteraVencida = ventas.filter(v => Number(v.saldo) > 0 && new Date(v.created_at) < hace30)
    .reduce((s, v) => s + Number(v.saldo), 0)

  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })

  // Por sucursal — siempre muestra las 3, con su % de meta del periodo
  const porSucursal = ['Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => {
    const total = ventas.filter(v => v.sucursal === s).reduce((sum, v) => sum + Number(v.total), 0)
    const metaSuc = metaPeriodo(periodo, metasPorSuc[s] ?? 0)
    return { nombre: s, total, count: ventas.filter(v => v.sucursal === s).length,
      metaPct: metaSuc > 0 ? Math.round((total / metaSuc) * 100) : 0 }
  })
  const maxSuc = Math.max(...porSucursal.map(s => s.total), 1)

  // Lab: en proceso / listas para llamar / atrasadas
  const labListas   = ordLab.filter(o => o.estado === 'listo').length
  const labProceso  = ordLab.filter(o => o.estado !== 'listo').length
  const labAtrasadas = ordLab.filter(o => o.estado !== 'listo' && o.fecha_promesa && o.fecha_promesa < hoyStr).length

  // Serie acumulada para "ritmo hacia la meta"
  const porDia: Record<string, number> = {}
  for (const v of ventas) {
    const d = new Date(v.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
    porDia[d] = (porDia[d] || 0) + Number(v.total)
  }
  const diasOrden = Object.keys(porDia).sort()
  let accSerie = 0
  const serie = diasOrden.map(d => { accSerie += porDia[d]; return accSerie })

  // Curvas SVG del ritmo acumulado vs meta
  const ritmoYMax = Math.max(metaP, serie[serie.length - 1] || 0, 1)
  const ritmoPts = serie.map((val, i) => {
    const x = serie.length <= 1 ? 400 : (i / (serie.length - 1)) * 400
    const y = 120 - (val / ritmoYMax) * 108
    return `${x.toFixed(0)},${y.toFixed(0)}`
  })
  const ritmoLine = ritmoPts.length ? 'M' + ritmoPts.join(' L') : ''
  const ritmoArea = ritmoPts.length ? `M0,120 L${ritmoPts.join(' L')} L400,120 Z` : ''
  const ritmoYMeta = 120 - (metaP / ritmoYMax) * 108
  // Puntos con posición en % (para overlay HTML interactivo)
  const ritmoPuntos = serie.map((val, i) => ({
    xPct: serie.length <= 1 ? 100 : (i / (serie.length - 1)) * 100,
    yPct: (120 - (val / ritmoYMax) * 108) / 120 * 100,
    acc: val,
    fecha: diasOrden[i],
  }))

  const esAdmin = rolUsuario === 'administrador' || rolUsuario === 'gerente'
  const periodosDisponibles = rolUsuario === 'administrador' ? PERIODOS_ADMIN : PERIODOS_GERENTE
  const { inicio, fin } = getDateRange(periodo, desde, hasta)
  const periodoLabel = { hoy: 'diaria', semana: 'semanal', mes: 'mensual', trimestre: 'trimestral', semestre: 'semestral', anio: 'anual', personalizado: 'del período' }[periodo]

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Reportes</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {inicio === fin ? inicio : `${inicio} → ${fin}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Período (gerente: hasta mensual · admin: todo) */}
          <div className="flex bg-zinc-100 rounded-lg p-1 gap-0.5 max-w-full overflow-x-auto">
            {periodosDisponibles.map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}>{p.label}</button>
            ))}
          </div>

          {esAdmin && (
            <select value={sucursal} onChange={e => setSucursal(e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs bg-white text-zinc-700 focus:outline-none">
              {SUCURSALES.map(s => <option key={s}>{s}</option>)}
            </select>
          )}

          {periodo === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
              <span className="text-zinc-400 text-xs">→</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
            </div>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">Cargando datos…</div>
      ) : (
        <>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg px-4 py-4 border border-zinc-200/80">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Ventas del periodo</p>
                <TrendingUp className="w-4 h-4 text-teal-600 opacity-60" />
              </div>
              <p className="text-2xl font-bold text-teal-600">{$$(totalFacturado)}</p>
              <p className="text-xs mt-1">
                <span className="text-zinc-400">{metaPct}% meta · </span>
                <span className={deltaPct >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                  {deltaPct >= 0 ? '▲' : '▼'}{Math.abs(deltaPct)}% vs ant.
                </span>
              </p>
            </div>
            <KPI label="# Ventas" value={String(ventas.length)} sub="transacciones"
              icon={ShoppingBag} color="text-zinc-800" />
            <KPI label="Por cobrar" value={$$(saldoTotal)}
              sub={carteraVencida > 0 ? `Vencido: ${$$(carteraVencida)}` : 'saldos de clientes'}
              icon={Package} color={saldoTotal > 0 ? 'text-rose-600' : 'text-green-600'} />
            <KPI label="En caja hoy" value={$$(enCaja)} sub="efectivo del día"
              icon={Target} color="text-teal-600" />
          </div>

          {/* ── Ventas por óptica + Operación ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Ventas por óptica">
              <div className="space-y-3.5">
                {porSucursal.map(s => (
                  <div key={s.nombre}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs text-zinc-700">{s.nombre}</span>
                      <span className="text-xs text-zinc-500">{$$(s.total)}{s.metaPct > 0 ? ` · ${s.metaPct}% meta` : ''}</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(Math.round((s.total / maxSuc) * 100), 2)}%`, background: COLOR_SUC[s.nombre] }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Operación">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center bg-violet-50 rounded-lg py-3"><div className="text-xl font-bold text-violet-700">{labProceso}</div><div className="text-[10px] text-zinc-400">En lab</div></div>
                <div className="text-center bg-emerald-50 rounded-lg py-3"><div className="text-xl font-bold text-emerald-700">{labListas}</div><div className="text-[10px] text-zinc-400">Listas</div></div>
                <div className="text-center bg-rose-50 rounded-lg py-3"><div className="text-xl font-bold text-rose-600">{labAtrasadas}</div><div className="text-[10px] text-zinc-400">Atrasadas</div></div>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <div><p className="text-xs text-zinc-400">Cotizaciones abiertas</p><p className="text-lg font-bold text-zinc-700">{cotCount}</p></div>
                <div className="text-right"><p className="text-xs text-zinc-400">Conversión</p><p className={`text-lg font-bold ${convPct >= 50 ? 'text-teal-600' : convPct >= 30 ? 'text-amber-600' : 'text-rose-600'}`}>{convPct}%</p></div>
              </div>
            </Card>
          </div>

          {/* ── Ritmo hacia meta + Lentes sin entregar ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title={`Ritmo hacia la meta ${periodoLabel}`}>
              {serie.length === 0 ? (
                <p className="text-sm text-zinc-400 py-10 text-center">Sin ventas en el periodo</p>
              ) : (
                <>
                  <div className="relative" style={{ height: 120 }} onMouseLeave={() => setHoverIdx(null)}>
                    <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
                      <defs><linearGradient id="ritmoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0D9488" stopOpacity="0.18"/><stop offset="1" stopColor="#0D9488" stopOpacity="0"/></linearGradient></defs>
                      {metaP > 0 && <line x1="0" y1={ritmoYMeta} x2="400" y2={ritmoYMeta} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth="1.5" />}
                      <path d={ritmoArea} fill="url(#ritmoG)" />
                      <path d={ritmoLine} fill="none" stroke="#0D9488" strokeWidth="2.5" />
                    </svg>

                    {/* Overlay interactivo: columnas de hover + puntos */}
                    {ritmoPuntos.map((pt, i) => (
                      <div key={i}>
                        <div
                          onMouseEnter={() => setHoverIdx(i)}
                          className="absolute top-0 bottom-0 -translate-x-1/2 cursor-pointer"
                          style={{ left: `${pt.xPct}%`, width: `${Math.max(100 / ritmoPuntos.length, 6)}%` }}
                        />
                        <div
                          className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all ${hoverIdx === i ? 'bg-teal-600 ring-2 ring-teal-200 scale-125' : 'bg-teal-500'}`}
                          style={{ left: `${pt.xPct}%`, top: `${pt.yPct}%`, opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.3 }}
                        />
                      </div>
                    ))}

                    {/* Tooltip */}
                    {hoverIdx !== null && ritmoPuntos[hoverIdx] && (
                      <div
                        className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none bg-zinc-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg"
                        style={{ left: `${Math.min(Math.max(ritmoPuntos[hoverIdx].xPct, 14), 86)}%`, top: `${ritmoPuntos[hoverIdx].yPct}%`, marginTop: -10 }}
                      >
                        <div className="text-zinc-300">{fmtDia(ritmoPuntos[hoverIdx].fecha)}</div>
                        <div className="font-bold">Acumulado: {$$(ritmoPuntos[hoverIdx].acc)}</div>
                        <div className="text-amber-300">Meta: {$$(metaP)}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-zinc-500">Acumulado: <b className="text-zinc-700">{$$(totalFacturado)}</b></span>
                    <span className="text-amber-600">Meta: {$$(metaP)}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{metaPct >= 100 ? '¡Meta alcanzada! 🎉' : `Van ${metaPct}% · faltan ${$$(metaFaltante)}`}</p>
                </>
              )}
            </Card>

            <Card title="Lentes listos por entregar">
              <div className="flex items-end gap-5 mb-3">
                <div><p className="text-3xl font-bold text-zinc-800">{lentesListas}</p><p className="text-xs text-zinc-400">listos, sin recoger</p></div>
                <div className="pb-1"><p className="text-lg font-bold text-rose-600">{$$(deudaListos)}</p><p className="text-xs text-zinc-400">te deben (saldo)</p></div>
              </div>
              {lentesListas > 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Llámale al cliente para que {lentesListas === 1 ? 'venga por su lente' : 'vengan por sus lentes'}</span>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">Ninguno listo por entregar aún</p>
              )}
              <p className="text-[11px] text-zinc-400 mt-2">{lentesSinEntregar} en total sin entregar (incluye en proceso)</p>
            </Card>
          </div>

        </>
      )}
    </div>
  )
}

export default function ReportesPageProtected() {
  return (
    <RequireRol roles={['administrador', 'gerente']}>
      <ReportesPage />
    </RequireRol>
  )
}
