'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RequireRol from '@/components/RequireRol'
import {
  TrendingUp, ShoppingBag, Package, Target,
  BarChart3, Beaker, CheckCircle2, AlertTriangle,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type Periodo = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'anio' | 'personalizado'

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

type VentaItem = {
  venta_id: string
  nombre: string
  cantidad: number
  subtotal: number
}

type OrdenLab = { estado: string }

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'hoy',           label: 'Hoy'           },
  { key: 'semana',        label: 'Esta semana'   },
  { key: 'mes',           label: 'Este mes'      },
  { key: 'trimestre',     label: 'Trimestre'     },
  { key: 'anio',          label: 'Este año'      },
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
  return { inicio: `${hoy.getFullYear()}-01-01`, fin }
}

function metaPeriodo(periodo: Periodo, mensual: number): number {
  if (periodo === 'hoy')       return Math.round(mensual / 30)
  if (periodo === 'semana')    return Math.round(mensual / 4)
  if (periodo === 'mes')       return mensual
  if (periodo === 'trimestre') return mensual * 3
  if (periodo === 'anio')      return mensual * 12
  return mensual
}

function categorizarProducto(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('progresiv'))                                                          return 'Progresivos'
  if (n.includes('bifocal'))                                                            return 'Bifocales'
  if (n.includes('monofocal'))                                                          return 'Monofocales'
  if (n.includes('contacto') || /\blc\b/.test(n) ||
      ['biofinity','air optix','acuvue','oasys','clariti','dailies'].some(k=>n.includes(k))) return 'Lentes de contacto'
  if (n.includes('filtro')||n.includes('antirreflejo')||n.includes('blue')||
      n.includes('fotocrom')||n.includes('transitions')||n.includes('tinte'))          return 'Filtros'
  if (n.includes('armazon')||n.includes('marco'))                                      return 'Armazones'
  return 'Otros'
}

const $$ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

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

function BarRow({ label, value, max, right, color }: {
  label: string; value: number; max: number; right: string; color: string
}) {
  const pct = max > 0 ? Math.max(Math.round((value / max) * 100), 2) : 2
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-zinc-700 truncate max-w-[60%]">{label}</span>
        <span className="text-xs text-zinc-500 font-medium shrink-0">{right}</span>
      </div>
      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
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
  const [editMeta,    setEditMeta]    = useState(false)
  const [metaInput,   setMetaInput]   = useState('0')
  const [rolUsuario,  setRolUsuario]  = useState('administrador')

  // Data
  const [ventas,     setVentas]     = useState<Venta[]>([])
  const [items,      setItems]      = useState<VentaItem[]>([])
  const [ventasHoy,  setVentasHoy]  = useState<Venta[]>([])
  const [cotCount,   setCotCount]   = useState(0)
  const [ordLab,     setOrdLab]     = useState<OrdenLab[]>([])
  const [cargando,   setCargando]   = useState(true)

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
      if (sucursal === 'Todas') {
        const { data } = await sb.from('metas').select('meta').eq('mes', mes)
        const total = (data || []).reduce((s: number, r: { meta: number }) => s + Number(r.meta), 0)
        setMetaMensual(total)
        setMetaInput(String(total))
      } else {
        const { data } = await sb.from('metas').select('meta')
          .eq('sucursal', sucursal).eq('mes', mes).maybeSingle()
        const val = data ? Number(data.meta) : 0
        setMetaMensual(val)
        setMetaInput(String(val))
      }
    }
    fetchMeta()
  }, [sucursal])

  const guardarMetaDB = useCallback(async (valor: number) => {
    if (sucursal === 'Todas') return
    const mes = hoyMes()
    const sb = createClient()
    await sb.from('metas').upsert({ sucursal, mes, meta: valor }, { onConflict: 'sucursal,mes' })
  }, [sucursal])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { inicio, fin } = getDateRange(periodo, desde, hasta)
    const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
    const sb = createClient()

    // Query builder helpers
    const baseVentas = () => sb.from('ventas')
      .select('id, total, anticipo, saldo, sucursal, metodo_pago, atendido_por, created_at')
      .eq('es_cotizacion', false)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fin}T23:59:59`)

    let qVentas = baseVentas()
    let qHoy    = sb.from('ventas')
      .select('id, total, anticipo, saldo, sucursal, metodo_pago, atendido_por, created_at')
      .eq('es_cotizacion', false)
      .gte('created_at', `${hoyStr}T00:00:00`)
      .lte('created_at', `${hoyStr}T23:59:59`)
    let qCot    = sb.from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('es_cotizacion', true)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fin}T23:59:59`)
    let qLab    = sb.from('ordenes_lab')
      .select('estado')
      .neq('estado', 'entregado')

    if (sucursal !== 'Todas') {
      qVentas = qVentas.eq('sucursal', sucursal)
      qHoy    = qHoy.eq('sucursal', sucursal)
      qCot    = qCot.eq('sucursal', sucursal)
      qLab    = qLab.eq('sucursal', sucursal)
    }

    const [rV, rH, rC, rL] = await Promise.all([qVentas, qHoy, qCot, qLab])

    const vList = rV.data || []
    setVentas(vList)
    setVentasHoy(rH.data || [])
    setCotCount(rC.count ?? 0)
    setOrdLab(rL.data || [])

    if (vList.length > 0) {
      const { data: iData } = await sb
        .from('ventas_items')
        .select('venta_id, nombre, cantidad, subtotal')
        .in('venta_id', vList.map(v => v.id))
      setItems(iData || [])
    } else {
      setItems([])
    }

    setCargando(false)
  }, [periodo, desde, hasta, sucursal])

  useEffect(() => { cargar() }, [cargar])

  // ── Cálculos ──────────────────────────────
  const totalFacturado = ventas.reduce((s, v) => s + Number(v.total), 0)
  const totalCobrado   = ventas.reduce((s, v) => s + (Number(v.total) - Number(v.saldo)), 0)
  const saldoTotal     = ventas.reduce((s, v) => s + Number(v.saldo), 0)
  const ticketPromedio = ventas.length ? totalFacturado / ventas.length : 0

  const metaP   = metaPeriodo(periodo, metaMensual)
  const metaPct = metaP > 0 ? Math.min(Math.round((totalFacturado / metaP) * 100), 100) : 0
  const metaFaltante = Math.max(0, metaP - totalFacturado)
  const metaColor = metaPct >= 100 ? '#10B981' : metaPct >= 75 ? '#F59E0B' : '#EF4444'

  const totalHoy = ventasHoy.reduce((s, v) => s + Number(v.total), 0)

  const totalAtendidos = ventas.length + cotCount
  const convPct = totalAtendidos > 0 ? Math.round((ventas.length / totalAtendidos) * 100) : 0

  const ventasCredito = ventas.filter(v => Number(v.anticipo) > 0 && Number(v.saldo) > 0)
  const anticPromedio = ventasCredito.length > 0
    ? Math.round(ventasCredito.reduce((s, v) => s + (Number(v.anticipo) / Number(v.total)), 0) / ventasCredito.length * 100)
    : 0

  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)
  const carteraVencida = ventas.filter(v => Number(v.saldo) > 0 && new Date(v.created_at) < hace30)
    .reduce((s, v) => s + Number(v.saldo), 0)
  const carteraAlCorriente = saldoTotal - carteraVencida


  // Por sucursal — siempre muestra las 3
  const porSucursal = ['Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => ({
    nombre: s,
    total:  ventas.filter(v => v.sucursal === s).reduce((sum, v) => sum + Number(v.total), 0),
    count:  ventas.filter(v => v.sucursal === s).length,
  }))
  const maxSuc = Math.max(...porSucursal.map(s => s.total), 1)

  // Por vendedor
  const porVendedor = Object.entries(
    ventas.reduce((acc, v) => {
      const n = v.atendido_por || 'Sin asignar'
      const p = acc[n] || { total: 0, count: 0 }
      acc[n] = { total: p.total + Number(v.total), count: p.count + 1 }
      return acc
    }, {} as Record<string, { total: number; count: number }>)
  ).map(([nombre, d]) => ({ nombre, ...d })).sort((a, b) => b.total - a.total)
  const maxVend = Math.max(...porVendedor.map(v => v.total), 1)

  // Categorías
  const porCat = Object.entries(
    items.reduce((acc, i) => {
      const c = categorizarProducto(i.nombre)
      acc[c] = (acc[c] || 0) + Number(i.subtotal)
      return acc
    }, {} as Record<string, number>)
  ).map(([cat, total]) => ({ cat, total })).sort((a, b) => b.total - a.total)
  const totalCat = porCat.reduce((s, c) => s + c.total, 0)

  // Lab
  const LAB_ESTADOS = [
    { key: 'recibido',       label: 'Recibidos',   color: 'text-zinc-500',  dot: '#94A3B8' },
    { key: 'en_laboratorio', label: 'En proceso',  color: 'text-amber-600', dot: '#F59E0B' },
    { key: 'listo',          label: 'Listos',       color: 'text-green-600', dot: '#10B981' },
  ]
  const labCounts = LAB_ESTADOS.map(e => ({ ...e, count: ordLab.filter(o => o.estado === e.key).length }))

  const esAdmin = rolUsuario === 'administrador' || rolUsuario === 'gerente'
  const { inicio, fin } = getDateRange(periodo, desde, hasta)
  const periodoLabel = { hoy: 'diaria', semana: 'semanal', mes: 'mensual', trimestre: 'trimestral', anio: 'anual', personalizado: 'del período' }[periodo]

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
          {/* Meta mensual editable */}
          <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
            <Target className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-amber-700 font-medium">Meta mensual:</span>
            {editMeta ? (
              <input
                type="number"
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onBlur={() => {
                  const v = Number(metaInput) || 0
                  setMetaMensual(v); setEditMeta(false); guardarMetaDB(v)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = Number(metaInput) || 0
                    setMetaMensual(v); setEditMeta(false); guardarMetaDB(v)
                  }
                }}
                autoFocus
                className="w-24 bg-transparent text-amber-700 font-bold focus:outline-none border-b border-amber-400"
              />
            ) : (
              <button onClick={() => { setMetaInput(String(metaMensual)); setEditMeta(true) }}
                className={`text-amber-700 font-bold ${sucursal !== 'Todas' ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                title={sucursal === 'Todas' ? 'Suma de metas por sucursal' : 'Clic para editar'}>
                {metaMensual > 0 ? $$(metaMensual) : '—'}
              </button>
            )}
            {sucursal === 'Todas' && metaMensual > 0 && (
              <span className="text-amber-500 text-[10px]">(suma)</span>
            )}
          </div>

          {/* Período */}
          <div className="flex bg-zinc-100 rounded-lg p-1 gap-0.5">
            {PERIODOS.map(p => (
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

          {/* ── FILA 1: KPIs principales ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="Ventas del período" value={$$(totalFacturado)}
              sub={`${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'}`}
              icon={TrendingUp} color="text-teal-600" />
            <KPI label="Cobrado" value={$$(totalCobrado)}
              sub="efectivamente recibido"
              icon={ShoppingBag} color="text-green-600" />
            <KPI label="Por cobrar" value={$$(saldoTotal)}
              sub={carteraVencida > 0 ? `Vencido: ${$$(carteraVencida)}` : 'Sin cartera vencida'}
              icon={Package} color={saldoTotal > 0 ? 'text-amber-600' : 'text-green-600'} />

            {/* Meta con barra */}
            <div className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Meta {periodoLabel}</p>
                <Target className="w-4 h-4 text-amber-500 opacity-60" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{metaPct}%</p>
              <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${metaPct}%`, background: metaColor }} />
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                {metaPct >= 100 ? '¡Meta cumplida! 🎉' : `Faltan ${$$(metaFaltante)}`}
              </p>
            </div>
          </div>

          {/* ── FILA 2: KPIs operativos ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Ventas hoy */}
            <div className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
              <p className="text-xs font-medium text-zinc-400">Ventas de hoy</p>
              <p className="text-2xl font-bold mt-2 text-zinc-800">{$$(totalHoy)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {ventasHoy.length} venta{ventasHoy.length !== 1 ? 's' : ''} registradas
              </p>
            </div>

            <KPI label="Ticket promedio" value={$$(ticketPromedio)}
              sub={`${ventas.length} ventas en el período`}
              icon={BarChart3} color="text-blue-600" />

            {/* Conversión */}
            <div className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
              <p className="text-xs font-medium text-zinc-400">Conversión</p>
              <p className={`text-2xl font-bold mt-2 ${
                convPct >= 60 ? 'text-green-600' : convPct >= 40 ? 'text-amber-600' : 'text-rose-600'
              }`}>{convPct}%</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {ventas.length} ventas · {cotCount} cotizaciones
              </p>
            </div>

            {/* Anticipo promedio */}
            <div className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
              <p className="text-xs font-medium text-zinc-400">Anticipo promedio</p>
              <p className={`text-2xl font-bold mt-2 ${
                anticPromedio >= 50 ? 'text-green-600' : anticPromedio >= 30 ? 'text-amber-600' : 'text-zinc-600'
              }`}>{anticPromedio}%</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {ventasCredito.length} ventas a crédito
              </p>
            </div>
          </div>

          {/* ── FILA 3: Vendedores + Sucursales ── */}
          <div className="grid grid-cols-2 gap-5">
            <Card title="Ventas por vendedor">
              {porVendedor.length === 0 ? (
                <p className="text-sm text-zinc-400">Sin datos en este período</p>
              ) : (
                <div className="space-y-3">
                  {porVendedor.map(v => (
                    <BarRow key={v.nombre}
                      label={v.nombre}
                      value={v.total}
                      max={maxVend}
                      right={`${$$(v.total)} · ${totalFacturado > 0 ? Math.round((v.total / totalFacturado) * 100) : 0}%`}
                      color="#6366F1"
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Comparativo por sucursal">
              <div className="space-y-3">
                {porSucursal.map(s => (
                  <BarRow key={s.nombre}
                    label={s.nombre}
                    value={s.total}
                    max={maxSuc}
                    right={s.count > 0 ? `${$$(s.total)} · ${s.count} vtas` : '—'}
                    color={COLOR_SUC[s.nombre] || '#94A3B8'}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* ── FILA 4: Lab + Categorías + Cartera ── */}
          <div className="grid grid-cols-3 gap-5">

            {/* Laboratorio */}
            <Card title="Laboratorio">
              <div className="space-y-3">
                {labCounts.map(l => (
                  <div key={l.key} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.dot }} />
                      <span className="text-sm text-zinc-600">{l.label}</span>
                    </div>
                    <span className={`text-base font-bold ${l.color}`}>{l.count}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-100 pt-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Total activos</span>
                  <span className="text-sm font-bold text-zinc-700">{ordLab.length}</span>
                </div>
                {labCounts.find(l => l.key === 'listo' && l.count > 0) && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-2 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {labCounts.find(l => l.key === 'listo')?.count} lentes esperando al paciente
                  </div>
                )}
              </div>
            </Card>

            {/* Categorías */}
            <Card title="Categorías vendidas">
              {porCat.length === 0 ? (
                <p className="text-sm text-zinc-400">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {porCat.map(c => (
                    <BarRow key={c.cat}
                      label={c.cat}
                      value={c.total}
                      max={totalCat}
                      right={`${totalCat > 0 ? Math.round((c.total / totalCat) * 100) : 0}%`}
                      color="#0D9488"
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Cartera */}
            <Card title="Cartera por cobrar">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600">Al corriente</p>
                    <p className="text-xs text-zinc-400">menos de 30 días</p>
                  </div>
                  <p className="text-sm font-bold text-amber-600">{$$(carteraAlCorriente)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600">Vencida</p>
                    <p className="text-xs text-zinc-400">más de 30 días</p>
                  </div>
                  <p className={`text-sm font-bold ${carteraVencida > 0 ? 'text-rose-600' : 'text-zinc-300'}`}>
                    {$$(carteraVencida)}
                  </p>
                </div>

                {saldoTotal > 0 && (
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-amber-400 transition-all"
                      style={{ width: `${Math.round((carteraAlCorriente / saldoTotal) * 100)}%` }} />
                    <div className="h-full bg-rose-500 transition-all"
                      style={{ width: `${Math.round((carteraVencida / saldoTotal) * 100)}%` }} />
                  </div>
                )}

                <div className="border-t border-zinc-100 pt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">Total por cobrar</span>
                  <span className="text-sm font-bold text-zinc-700">{$$(saldoTotal)}</span>
                </div>

                {carteraVencida > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Cobrar urgente: {$$(carteraVencida)}
                  </div>
                )}
              </div>
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
