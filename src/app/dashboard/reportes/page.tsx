'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RequireRol from '@/components/RequireRol'
import { BarChart3, TrendingUp, ShoppingBag, Package } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type Periodo = 'semana' | 'mes' | 'trimestre' | 'anio' | 'personalizado'

type Venta = {
  id: string
  total: number
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

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'semana',        label: 'Esta semana'   },
  { key: 'mes',           label: 'Este mes'      },
  { key: 'trimestre',     label: 'Trimestre'     },
  { key: 'anio',          label: 'Este año'      },
  { key: 'personalizado', label: 'Personalizado' },
]

const SUCURSALES = ['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles']

const METODOS: Record<string, string> = {
  efectivo:      'Efectivo',
  debito:        'Débito',
  credito:       'Crédito',
  transferencia: 'Transferencia',
  deposito:      'Depósito',
}

const COLORES_SUCURSAL: Record<string, string> = {
  'Baja Visión':    '#0D9488',
  '5 de Mayo':      '#0B0E14',
  'Plaza Laureles': '#6366F1',
}

const COLORES_PIE = ['#0D9488', '#0B0E14', '#6366F1', '#F97316', '#10B981', '#F59E0B']

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────
function getDateRange(periodo: Periodo, desde = '', hasta = '') {
  const hoy = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const fin = fmt(hoy)

  if (periodo === 'personalizado') return { inicio: desde || fin, fin: hasta || fin }
  if (periodo === 'semana') {
    const d = new Date(hoy)
    const dia = hoy.getDay() || 7
    d.setDate(hoy.getDate() - dia + 1)
    return { inicio: fmt(d), fin }
  }
  if (periodo === 'mes')       return { inicio: `${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-01`, fin }
  if (periodo === 'trimestre') {
    const q = Math.floor(hoy.getMonth() / 3)
    return { inicio: `${hoy.getFullYear()}-${pad(q*3+1)}-01`, fin }
  }
  return { inicio: `${hoy.getFullYear()}-01-01`, fin }
}

const $$ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

// ─────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string
  icon: React.ElementType
  color: 'teal' | 'green' | 'amber' | 'blue'
}) {
  const map = {
    teal:  { card: 'text-teal-600',  bg: 'bg-teal-50'  },
    green: { card: 'text-green-600', bg: 'bg-green-50' },
    amber: { card: 'text-amber-600', bg: 'bg-amber-50' },
    blue:  { card: 'text-blue-600',  bg: 'bg-blue-50'  },
  }
  const c = map[color]
  return (
    <div className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <div className={`w-8 h-8 rounded ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.card}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold mt-2 ${c.card}`}>{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200/80 rounded-lg p-5">
      <h3 className="text-sm font-bold text-zinc-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function BarRow({ label, value, max, sub, color }: {
  label: string; value: number; max: number; sub: string; color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-zinc-700 truncate max-w-[65%]">{label}</span>
        <span className="text-xs text-zinc-400 ml-2 shrink-0">{sub}</span>
      </div>
      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(pct, 2)}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────
function ReportesPage() {
  const [periodo,    setPeriodo]    = useState<Periodo>('mes')
  const [desde,      setDesde]      = useState('')
  const [hasta,      setHasta]      = useState('')
  const [sucursal,   setSucursal]   = useState('Todas')
  const [ventas,     setVentas]     = useState<Venta[]>([])
  const [items,      setItems]      = useState<VentaItem[]>([])
  const [cargando,   setCargando]   = useState(true)
  const [rolUsuario, setRolUsuario] = useState('administrador')

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      setRolUsuario(u.rol || 'vendedor')
      if (u.rol !== 'administrador' && u.sucursal && u.sucursal !== 'Todas') {
        setSucursal(u.sucursal)
      }
    } catch {}
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { inicio, fin } = getDateRange(periodo, desde, hasta)
    const supabase = createClient()

    let q = supabase
      .from('ventas')
      .select('id, total, saldo, sucursal, metodo_pago, atendido_por, created_at')
      .eq('es_cotizacion', false)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fin}T23:59:59`)

    if (sucursal !== 'Todas') q = q.eq('sucursal', sucursal)

    const { data: ventasData } = await q
    const vList = ventasData || []
    setVentas(vList)

    if (vList.length > 0) {
      const { data: itemsData } = await supabase
        .from('ventas_items')
        .select('venta_id, nombre, cantidad, subtotal')
        .in('venta_id', vList.map(v => v.id))
      setItems(itemsData || [])
    } else {
      setItems([])
    }

    setCargando(false)
  }, [periodo, desde, hasta, sucursal])

  useEffect(() => { cargar() }, [cargar])

  // ── Cálculos ──────────────────────────────
  const totalFacturado = ventas.reduce((s, v) => s + v.total, 0)
  const totalCobrado   = ventas.reduce((s, v) => s + (v.total - v.saldo), 0)
  const saldoPendiente = ventas.reduce((s, v) => s + v.saldo, 0)
  const ticketPromedio = ventas.length ? totalFacturado / ventas.length : 0

  // Por sucursal (para barras)
  const porSucursal = ['Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => ({
    nombre: s,
    total:  ventas.filter(v => v.sucursal === s).reduce((sum, v) => sum + v.total, 0),
    count:  ventas.filter(v => v.sucursal === s).length,
  })).filter(s => s.total > 0)
  const maxSucursal = Math.max(...porSucursal.map(s => s.total), 1)

  // Por método de pago (para pie)
  const porMetodoPie = Object.entries(
    ventas.reduce((acc, v) => {
      const m = v.metodo_pago || 'efectivo'
      acc[m] = (acc[m] || 0) + v.total
      return acc
    }, {} as Record<string, number>)
  )
    .map(([key, value]) => ({ name: METODOS[key] || key, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)

  // Top 10 productos
  const topProductos = Object.entries(
    items.reduce((acc, i) => {
      const prev = acc[i.nombre] || { cantidad: 0, total: 0 }
      acc[i.nombre] = { cantidad: prev.cantidad + i.cantidad, total: prev.total + i.subtotal }
      return acc
    }, {} as Record<string, { cantidad: number; total: number }>)
  )
    .map(([nombre, { cantidad, total }]) => ({ nombre, cantidad, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
  const maxProducto = Math.max(...topProductos.map(p => p.total), 1)

  // Por vendedor
  const porVendedor = Object.entries(
    ventas.reduce((acc, v) => {
      const n = v.atendido_por || 'Sin asignar'
      const prev = acc[n] || { total: 0, count: 0 }
      acc[n] = { total: prev.total + v.total, count: prev.count + 1 }
      return acc
    }, {} as Record<string, { total: number; count: number }>)
  )
    .map(([nombre, { total, count }]) => ({ nombre, total, count }))
    .sort((a, b) => b.total - a.total)
  const maxVendedor = Math.max(...porVendedor.map(v => v.total), 1)

  // Datos para la gráfica de barras por sucursal
  const dataSucursalChart = porSucursal.map(s => ({
    name: s.nombre.replace('Plaza Laureles', 'Laureles'),
    total: s.total,
    fill: COLORES_SUCURSAL[s.nombre] || '#94A3B8',
  }))

  const { inicio, fin } = getDateRange(periodo, desde, hasta)
  const esAdmin = rolUsuario === 'administrador' || rolUsuario === 'gerente'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Reportes</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {inicio === fin ? inicio : `${inicio} → ${fin}`}
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex bg-zinc-100 rounded-lg p-1 gap-0.5">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.key
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {esAdmin && (
            <select
              value={sucursal}
              onChange={e => setSucursal(e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs bg-white text-zinc-700 focus:outline-none"
            >
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

      {/* Loading */}
      {cargando ? (
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
          Cargando datos…
        </div>
      ) : ventas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-2">
          <BarChart3 className="w-10 h-10 opacity-20" />
          <p className="text-sm">Sin ventas en este período</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Total facturado"
              value={$$(totalFacturado)}
              sub={`${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'}`}
              icon={TrendingUp}
              color="teal"
            />
            <KPICard
              label="Total cobrado"
              value={$$(totalCobrado)}
              sub="efectivamente recibido"
              icon={ShoppingBag}
              color="green"
            />
            <KPICard
              label="Por cobrar"
              value={$$(saldoPendiente)}
              sub="saldo pendiente"
              icon={Package}
              color={saldoPendiente > 0 ? 'amber' : 'blue'}
            />
            <KPICard
              label="Ticket promedio"
              value={$$(ticketPromedio)}
              sub="por venta"
              icon={BarChart3}
              color="blue"
            />
          </div>

          {/* Gráficas */}
          <div className="grid grid-cols-3 gap-5">
            {/* Ventas por sucursal — gráfica de barras */}
            {dataSucursalChart.length > 1 ? (
              <div className="col-span-2 bg-white rounded-lg border border-zinc-200/80 p-5">
                <h3 className="text-sm font-bold text-zinc-700 mb-4">Ventas por sucursal</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dataSucursalChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: unknown) => [$$(Number(v)), 'Total']}
                      contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {dataSucursalChart.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="col-span-2" />
            )}

            {/* Método de pago — pie */}
            <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
              <h3 className="text-sm font-bold text-zinc-700 mb-4">Método de pago</h3>
              {porMetodoPie.length > 0 && (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={porMetodoPie}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {porMetodoPie.map((_, i) => (
                          <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) => [$$(Number(v)), '']}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {porMetodoPie.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: COLORES_PIE[i % COLORES_PIE.length] }} />
                        <span className="text-zinc-600 flex-1">{d.name}</span>
                        <span className="font-semibold text-zinc-700">{$$(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top productos + Vendedores */}
          <div className="grid grid-cols-2 gap-5">
            {topProductos.length > 0 && (
              <Section title="Top productos">
                <div className="space-y-3">
                  {topProductos.map((p, i) => (
                    <BarRow
                      key={p.nombre}
                      label={`${i + 1}. ${p.nombre}`}
                      value={p.total}
                      max={maxProducto}
                      sub={`${p.cantidad} uds · ${$$(p.total)}`}
                      color="#0D9488"
                    />
                  ))}
                </div>
              </Section>
            )}

            {porVendedor.length > 0 && (
              <Section title="Ventas por vendedor">
                <div className="space-y-3">
                  {porVendedor.map(v => (
                    <BarRow
                      key={v.nombre}
                      label={v.nombre}
                      value={v.total}
                      max={maxVendedor}
                      sub={`${v.count} ventas · ${$$(v.total)}`}
                      color="#6366F1"
                    />
                  ))}
                </div>
              </Section>
            )}
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
