'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { rangoDiaLocal } from '@/lib/fecha'
import RequireRol from '@/components/RequireRol'
import {
  TrendingUp, ShoppingBag, Package, Target, CheckCircle2, Receipt, RotateCcw,
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
  const [enCaja,     setEnCaja]     = useState(0)    // efectivo en caja hoy (las 3 sucursales)
  const [enCajaUSD,  setEnCajaUSD]  = useState(0)    // dólares en caja (las 3 sucursales)
  const [cajaSaldos, setCajaSaldos] = useState<{ sucursal: string; fondo: number; ingresos: number; egresos: number; saldo: number; saldoUsd: number }[]>([])
  const [cajaAbierto, setCajaAbierto] = useState(false)
  const [deudaListos, setDeudaListos] = useState(0)  // saldo pendiente de ventas con lentes listos
  const [deudaProceso, setDeudaProceso] = useState(0) // saldo de ventas con lentes aún en laboratorio
  const [porCobrarTotal, setPorCobrarTotal] = useState(0) // saldo pendiente TOTAL histórico (no del periodo)
  const [garantias,  setGarantias]  = useState(0)    // órdenes de garantía/reposición en el periodo
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
    const sb = createClient()
    // Rango del periodo en hora Tijuana (mismo criterio que caja e inicio)
    const rangoInicio = rangoDiaLocal(inicio).start
    const rangoFin    = rangoDiaLocal(fin).end

    // Query builder helpers
    const baseVentas = () => sb.from('ventas')
      .select('id, total, anticipo, saldo, sucursal, metodo_pago, atendido_por, created_at')
      .eq('es_cotizacion', false)
      .neq('estado', 'cancelada')
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
    // Garantías / reposiciones creadas en el periodo
    let qGar    = sb.from('ordenes_lab')
      .select('id', { count: 'exact', head: true })
      .eq('es_garantia', true)
      .gte('created_at', rangoInicio)
      .lte('created_at', rangoFin)
    // Por cobrar TOTAL (histórico, sin importar periodo): todo saldo pendiente
    let qDeuda  = sb.from('ventas')
      .select('id, saldo, sucursal')
      .eq('es_cotizacion', false)
      .neq('estado', 'cancelada')
      .gt('saldo', 0)


    // ── Efectivo REAL en cada caja: mismo cálculo que el módulo Caja
    //    (fondo del último corte + efectivo que entró desde entonces − egresos en efectivo).
    const sucsCaja = sucursal !== 'Todas'
      ? [sucursal]
      : ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

    // Último corte CERRADO por sucursal (define el fondo y el punto de arranque)
    const { data: cortesData } = await sb
      .from('cortes_caja')
      .select('sucursal, fondo, fondo_usd, cerrado_at')
      .eq('cerrado', true)
      .not('cerrado_at', 'is', null)
      .order('cerrado_at', { ascending: false, nullsFirst: false })
    const lastCorte: Record<string, { fondo: number; fondoUsd: number; cerrado_at: string | null }> = {}
    for (const c of (cortesData ?? []) as { sucursal: string; fondo: number; fondo_usd: number | null; cerrado_at: string | null }[]) {
      if (!lastCorte[c.sucursal]) lastCorte[c.sucursal] = { fondo: Number(c.fondo) || 0, fondoUsd: Number(c.fondo_usd) || 0, cerrado_at: c.cerrado_at }
    }
    const cortesTs = sucsCaja.map(s => lastCorte[s]?.cerrado_at).filter(Boolean) as string[]
    const minCerrado = cortesTs.length ? cortesTs.reduce((a, b) => (a < b ? a : b)) : '1970-01-01T00:00:00Z'

    // Efectivo (pesos) y egresos en efectivo desde ese punto
    let qEf = sb.from('pagos_venta')
      .select('sucursal, monto, created_at')
      .eq('metodo_pago', 'efectivo').neq('moneda', 'USD')
      .gt('created_at', minCerrado)
    let qEfUsd = sb.from('pagos_venta')
      .select('sucursal, monto_origen, created_at')
      .eq('metodo_pago', 'efectivo').eq('moneda', 'USD')
      .gt('created_at', minCerrado)
    let qEg = sb.from('gastos')
      .select('sucursal, monto, created_at, metodo_pago')
      .eq('es_caja', true)
      .gt('created_at', minCerrado)

    if (sucursal !== 'Todas') {
      qVentas = qVentas.eq('sucursal', sucursal)
      qCot    = qCot.eq('sucursal', sucursal)
      qLab    = qLab.eq('sucursal', sucursal)
      qGar    = qGar.eq('sucursal', sucursal)
      qDeuda  = qDeuda.eq('sucursal', sucursal)
      qEf     = qEf.eq('sucursal', sucursal)
      qEfUsd  = qEfUsd.eq('sucursal', sucursal)
      qEg     = qEg.eq('sucursal', sucursal)
    }

    const [rV, rC, rL, rGar, rDeuda, rEf, rEfUsd, rEg] = await Promise.all([qVentas, qCot, qLab, qGar, qDeuda, qEf, qEfUsd, qEg])

    const ordLabData = rL.data || []
    setVentas(rV.data || [])
    setCotCount(rC.count ?? 0)
    setOrdLab(ordLabData)
    setGarantias(rGar.count ?? 0)

    const efRows    = (rEf.data ?? []) as { sucursal: string; monto: number; created_at: string }[]
    const efUsdRows = (rEfUsd.data ?? []) as { sucursal: string; monto_origen: number | null; created_at: string }[]
    const egRows    = (rEg.data ?? []) as { sucursal: string; monto: number; created_at: string; metodo_pago: string | null }[]
    const saldos = sucsCaja.map(suc => {
      const corte = lastCorte[suc]
      const desde = corte?.cerrado_at ?? null
      const fondo = corte?.fondo ?? 0
      const fondoUsd = corte?.fondoUsd ?? 0
      const enRango = (ts: string) => !desde || ts > desde
      const ingresos = efRows
        .filter(p => p.sucursal === suc && enRango(p.created_at))
        .reduce((s, p) => s + Number(p.monto), 0)
      const egresos = egRows
        .filter(g => g.sucursal === suc && (g.metodo_pago ?? 'efectivo') === 'efectivo' && enRango(g.created_at))
        .reduce((s, g) => s + Number(g.monto), 0)
      const ingresosUsd = efUsdRows
        .filter(p => p.sucursal === suc && enRango(p.created_at))
        .reduce((s, p) => s + Number(p.monto_origen ?? 0), 0)
      const egresosUsd = egRows
        .filter(g => g.sucursal === suc && g.metodo_pago === 'efectivo_usd' && enRango(g.created_at))
        .reduce((s, g) => s + Number(g.monto), 0)
      return { sucursal: suc, fondo, ingresos, egresos, saldo: fondo + ingresos - egresos, saldoUsd: fondoUsd + ingresosUsd - egresosUsd }
    })
    setEnCaja(saldos.reduce((s, x) => s + x.saldo, 0))
    setEnCajaUSD(saldos.reduce((s, x) => s + x.saldoUsd, 0))
    setCajaSaldos(saldos)

    // ── Por cobrar: total histórico + desglose por estado de laboratorio ──
    //    Total = todo saldo pendiente. Listo = sus lentes ya están para entregar
    //    (acción: llamar al cliente). En proceso = aún en lab (acción: apurar el lab).
    const deudaRows = (rDeuda.data ?? []) as { id: string; saldo: number }[]
    setPorCobrarTotal(deudaRows.reduce((s, v) => s + Number(v.saldo || 0), 0))
    const saldoPorVenta: Record<string, number> = {}
    for (const v of deudaRows) saldoPorVenta[v.id] = Number(v.saldo || 0)
    const idsListos  = new Set(ordLabData.filter((o: OrdenLab) => o.estado === 'listo' && o.venta_id).map((o: OrdenLab) => o.venta_id as string))
    const idsProceso = new Set(ordLabData.filter((o: OrdenLab) => o.estado !== 'listo' && o.venta_id).map((o: OrdenLab) => o.venta_id as string))
    const sumSet = (ids: Set<string>) => [...ids].reduce((s, id) => s + (saldoPorVenta[id] ?? 0), 0)
    setDeudaListos(sumSet(idsListos))
    setDeudaProceso(sumSet(idsProceso))

    setCargando(false)
  }, [periodo, desde, hasta, sucursal])

  useEffect(() => { cargar() }, [cargar])

  // ── Cálculos ──────────────────────────────
  const totalFacturado = ventas.reduce((s, v) => s + Number(v.total), 0)
  const ticketProm     = ventas.length > 0 ? Math.round(totalFacturado / ventas.length) : 0
  const tasaGarantia   = ventas.length > 0 ? (garantias / ventas.length) * 100 : 0
  // Por cobrar: lo que no cae ni en "listo" ni en "en lab" (p.ej. ventas a crédito sin orden de lab)
  const cobrarOtros    = Math.max(0, porCobrarTotal - deudaListos - deudaProceso)

  const metaP   = metaPeriodo(periodo, metaMensual)
  const metaPct = metaP > 0 ? Math.min(Math.round((totalFacturado / metaP) * 100), 100) : 0
  const metaFaltante = Math.max(0, metaP - totalFacturado)


  // Lentes: listos por entregar (esperando pickup) vs total pendientes
  const lentesSinEntregar = ordLab.length
  const lentesListas      = ordLab.filter(o => o.estado === 'listo').length

  const totalAtendidos = ventas.length + cotCount
  const convPct = totalAtendidos > 0 ? Math.round((ventas.length / totalAtendidos) * 100) : 0

  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })

  // Por sucursal — siempre muestra las 3, ordenadas por venta (ranking), con ticket y % meta
  const porSucursal = ['Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => {
    const vs = ventas.filter(v => v.sucursal === s)
    const total = vs.reduce((sum, v) => sum + Number(v.total), 0)
    const metaSuc = metaPeriodo(periodo, metasPorSuc[s] ?? 0)
    return { nombre: s, total, count: vs.length,
      ticket: vs.length > 0 ? Math.round(total / vs.length) : 0,
      metaPct: metaSuc > 0 ? Math.round((total / metaSuc) * 100) : 0 }
  }).sort((a, b) => b.total - a.total)
  const maxSuc = Math.max(...porSucursal.map(s => s.total), 1)

  // Serie acumulada para "ritmo hacia la meta"
  const porDia: Record<string, number> = {}
  for (const v of ventas) {
    const d = new Date(v.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
    porDia[d] = (porDia[d] || 0) + Number(v.total)
  }
  const diasOrden = Object.keys(porDia).sort()
  let accSerie = 0
  const serie = diasOrden.map(d => { accSerie += porDia[d]; return accSerie })

  // ── Proyección al cierre del periodo (¿vas adelantado o atrasado?) ──
  const rng = getDateRange(periodo, desde, hasta)
  const dIni = new Date(rng.inicio + 'T12:00:00')
  const dFinP = new Date(rng.fin + 'T12:00:00')
  const dHoy = new Date(hoyStr + 'T12:00:00')
  const diasTotales = Math.max(1, Math.round((dFinP.getTime() - dIni.getTime()) / 86400000) + 1)
  const finTransc = dHoy < dFinP ? dHoy : dFinP
  const diasTransc = Math.max(1, Math.round((finTransc.getTime() - dIni.getTime()) / 86400000) + 1)
  const proyeccion = Math.round((totalFacturado / diasTransc) * diasTotales)
  const metaEsperada = metaP * (diasTransc / diasTotales)
  const vaAdelantado = metaP > 0 && totalFacturado >= metaEsperada
  const proyVsMeta = proyeccion - metaP
  const mostrarProy = periodo !== 'hoy' && diasTotales > 1 && serie.length > 0

  // Curvas SVG del ritmo acumulado vs meta
  const ritmoYMax = Math.max(metaP, serie[serie.length - 1] || 0, mostrarProy ? proyeccion : 0, 1)
  const ritmoPts = serie.map((val, i) => {
    const x = serie.length <= 1 ? 400 : (i / (serie.length - 1)) * 400
    const y = 120 - (val / ritmoYMax) * 108
    return `${x.toFixed(0)},${y.toFixed(0)}`
  })
  const ritmoLine = ritmoPts.length ? 'M' + ritmoPts.join(' L') : ''
  const ritmoArea = ritmoPts.length ? `M0,120 L${ritmoPts.join(' L')} L400,120 Z` : ''
  const ritmoYMeta = 120 - (metaP / ritmoYMax) * 108
  const ritmoProyY = 120 - (proyeccion / ritmoYMax) * 108
  const ritmoLastPt = ritmoPts[ritmoPts.length - 1] || '0,120'
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
          <div className="flex flex-wrap bg-zinc-100 rounded-lg p-1 gap-0.5 max-w-full">
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg px-4 py-4 border border-zinc-200/80">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Ventas del periodo</p>
                <TrendingUp className="w-4 h-4 text-teal-600 opacity-60" />
              </div>
              <p className="text-2xl font-bold text-teal-600">{$$(totalFacturado)}</p>
              <p className="text-xs mt-1 text-zinc-400">{metaPct}% de la meta</p>
            </div>
            <KPI label="# Ventas" value={String(ventas.length)}
              sub={ventas.length > 0 ? `ticket prom. ${$$(ticketProm)}` : 'transacciones'}
              icon={ShoppingBag} color="text-zinc-800" />

            {/* Por cobrar — total histórico con desglose accionable */}
            <div className="bg-white rounded-lg px-4 py-4 border border-zinc-200/80">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Por cobrar</p>
                <Package className={`w-4 h-4 opacity-60 ${porCobrarTotal > 0 ? 'text-rose-600' : 'text-green-600'}`} />
              </div>
              <p className={`text-2xl font-bold ${porCobrarTotal > 0 ? 'text-rose-600' : 'text-green-600'}`}>{$$(porCobrarTotal)}</p>
              {porCobrarTotal > 0 ? (
                <>
                  <div className="flex h-1.5 rounded-full overflow-hidden mt-2 mb-2 bg-zinc-100">
                    <div style={{ width: `${(deudaListos / porCobrarTotal) * 100}%` }} className="bg-teal-500" />
                    <div style={{ width: `${(deudaProceso / porCobrarTotal) * 100}%` }} className="bg-amber-400" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-teal-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" />Listo p/ cobrar</span>
                      <span className="font-bold text-teal-700">{$$(deudaListos)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />En laboratorio</span>
                      <span className="font-bold text-amber-700">{$$(deudaProceso)}</span>
                    </div>
                    {cobrarOtros > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Otros saldos</span><span className="font-medium">{$$(cobrarOtros)}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-zinc-400 mt-0.5">sin saldos pendientes</p>
              )}
            </div>

            <KPI label="Ticket promedio" value={$$(ticketProm)}
              sub={ventas.length > 0 ? `${ventas.length} ventas` : 'sin ventas'}
              icon={Receipt} color="text-indigo-600" />

            {rolUsuario === 'administrador' && (
              <button onClick={() => setCajaAbierto(true)}
                className="bg-white rounded-lg px-4 py-4 border border-zinc-200/80 text-left hover:border-teal-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-400">En caja</p>
                  <Target className="w-4 h-4 text-teal-600 opacity-60" />
                </div>
                <p className="text-2xl font-bold text-teal-600">{$$(enCaja)}</p>
                {enCajaUSD !== 0 && <p className="text-sm font-bold text-blue-600 -mt-0.5">+ USD ${enCajaUSD.toFixed(2)}</p>}
                <p className="text-xs text-zinc-400 mt-0.5">efectivo real · <span className="text-teal-600 font-medium">ver desglose</span></p>
              </button>
            )}
          </div>

          {/* ── Ventas por óptica + Operación ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Ventas por óptica">
              <div className="space-y-3">
                {porSucursal.map((s, i) => {
                  const lider = i === 0 && s.total > 0
                  return (
                    <div key={s.nombre} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${lider ? 'bg-teal-600 text-white' : 'bg-zinc-100 text-zinc-400'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className={`text-xs font-semibold ${s.total > 0 ? 'text-zinc-700' : 'text-zinc-400'}`}>
                            {s.nombre}
                            {lider && <span className="ml-1.5 text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full align-middle">LÍDER</span>}
                          </span>
                          <span className={`text-xs font-bold ${s.total > 0 ? 'text-zinc-800' : 'text-zinc-400'}`}>{$$(s.total)}</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(Math.round((s.total / maxSuc) * 100), 2)}%`, background: COLOR_SUC[s.nombre] }} />
                        </div>
                        <div className="flex gap-2 mt-1 text-[11px] text-zinc-400">
                          <span>{s.count} {s.count === 1 ? 'venta' : 'ventas'}</span>
                          {s.ticket > 0 && <><span>·</span><span>ticket {$$(s.ticket)}</span></>}
                          {s.metaPct > 0 && <><span>·</span><span className={s.metaPct >= 100 ? 'text-emerald-600 font-semibold' : ''}>{s.metaPct}% meta</span></>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title="Servicio y calidad">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-violet-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-0.5"><RotateCcw className="w-3.5 h-3.5 text-violet-600" /><span className="text-[10px] text-zinc-500 font-medium">Garantías / reposiciones</span></div>
                  <div className="text-2xl font-bold text-violet-700">{garantias}</div>
                  <div className="text-[10px] text-zinc-400">en el periodo</div>
                </div>
                <div className={`rounded-lg p-3 ${tasaGarantia >= 5 ? 'bg-rose-50' : 'bg-amber-50'}`}>
                  <div className="text-[10px] text-zinc-500 font-medium mb-0.5">Tasa de garantía</div>
                  <div className={`text-2xl font-bold ${tasaGarantia >= 5 ? 'text-rose-600' : 'text-amber-600'}`}>{tasaGarantia.toFixed(1)}%</div>
                  <div className="text-[10px] text-zinc-400">garantías ÷ ventas</div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <div><p className="text-xs text-zinc-400">Cotizaciones del periodo</p><p className="text-lg font-bold text-zinc-700">{cotCount}</p></div>
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
                  {/* Fila de indicadores: acumulado · meta · proyección · adelantado/atrasado */}
                  <div className="flex flex-wrap items-end gap-x-5 gap-y-2 mb-3">
                    <div><p className="text-lg font-bold text-teal-600 leading-none">{$$(totalFacturado)}</p><p className="text-[10px] text-zinc-400 mt-1">acumulado · {metaPct}%</p></div>
                    <div><p className="text-lg font-bold text-zinc-700 leading-none">{$$(metaP)}</p><p className="text-[10px] text-zinc-400 mt-1">meta</p></div>
                    {mostrarProy && (
                      <>
                        <div><p className="text-lg font-bold text-blue-600 leading-none">{$$(proyeccion)}</p><p className="text-[10px] text-zinc-400 mt-1">proyección al cierre</p></div>
                        <div className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${vaAdelantado ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {vaAdelantado ? '▲ Vas adelantado' : '▼ Vas atrasado'}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="relative" style={{ height: 120 }} onMouseLeave={() => setHoverIdx(null)}>
                    <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
                      <defs><linearGradient id="ritmoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0D9488" stopOpacity="0.18"/><stop offset="1" stopColor="#0D9488" stopOpacity="0"/></linearGradient></defs>
                      {metaP > 0 && <line x1="0" y1={ritmoYMeta} x2="400" y2={ritmoYMeta} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth="1.5" />}
                      {mostrarProy && <path d={`M${ritmoLastPt} L400,${ritmoProyY.toFixed(0)}`} fill="none" stroke="#2563EB" strokeWidth="2" strokeDasharray="5 4" />}
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
                  {/* Leyenda */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400 mt-2">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-500 inline-block" />acumulado</span>
                    {mostrarProy && <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-blue-600 inline-block" />proyección</span>}
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />meta</span>
                  </div>
                  <p className="text-xs mt-1.5">
                    {metaPct >= 100
                      ? <span className="text-emerald-600 font-semibold">¡Meta alcanzada! 🎉</span>
                      : mostrarProy
                        ? <span className="text-zinc-500">Al ritmo actual cierras en <b className={proyVsMeta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{$$(proyeccion)}</b> — {proyVsMeta >= 0 ? <span className="text-emerald-600 font-semibold">{$$(proyVsMeta)} arriba</span> : <span className="text-rose-600 font-semibold">{$$(Math.abs(proyVsMeta))} abajo</span>} de la meta</span>
                        : <span className="text-zinc-400">Van {metaPct}% · faltan {$$(metaFaltante)}</span>}
                  </p>
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

      {/* ── Desglose de "En caja" — saldo real por sucursal (solo admin) ── */}
      {cajaAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCajaAbierto(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <div>
                <p className="text-sm font-bold text-zinc-800">Efectivo real en caja</p>
                <p className="text-xs text-zinc-400">Fondo + ingresos − egresos · {sucursal}</p>
              </div>
              <button onClick={() => setCajaAbierto(false)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto">
              {cajaSaldos.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-10">Sin datos de caja</p>
              ) : cajaSaldos.map(c => (
                <div key={c.sucursal} className="border-b border-zinc-100">
                  <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-50">
                    <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">{c.sucursal}</span>
                    <span className="text-right">
                      <span className={`text-base font-bold ${c.saldo < 0 ? 'text-red-600' : 'text-teal-700'}`}>{$$(c.saldo)}</span>
                      {c.saldoUsd !== 0 && <span className="block text-xs font-bold text-blue-600">USD ${c.saldoUsd.toFixed(2)}</span>}
                    </span>
                  </div>
                  <div className="px-5 py-2.5 space-y-1 text-xs">
                    <div className="flex justify-between text-zinc-500"><span>Fondo (último corte)</span><span>{$$(c.fondo)}</span></div>
                    <div className="flex justify-between text-teal-600"><span>+ Ingresos en efectivo</span><span>+{$$(c.ingresos)}</span></div>
                    <div className="flex justify-between text-red-500"><span>− Egresos en efectivo</span><span>−{$$(c.egresos)}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-200">
              <span className="text-sm font-semibold text-zinc-500">Total en caja</span>
              <span className="text-right">
                <span className="text-lg font-bold text-teal-700">{$$(enCaja)}</span>
                {enCajaUSD !== 0 && <span className="block text-sm font-bold text-blue-600">USD ${enCajaUSD.toFixed(2)}</span>}
              </span>
            </div>
          </div>
        </div>
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
