'use client'

import { useState } from 'react'
import {
  BarChart2, TrendingUp, Users, Package,
  Download, ChevronDown, Sparkles, FileText,
  Calendar, Store,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORES_PIE = ['#0D9488', '#0B0E14', '#6366F1', '#F97316', '#10B981']

const DATA_MENSUAL = [
  { mes: 'Ene', baja: 82000, mayo: 61000, plaza: 74000 },
  { mes: 'Feb', baja: 91000, mayo: 68000, plaza: 79000 },
  { mes: 'Mar', baja: 88000, mayo: 72000, plaza: 85000 },
  { mes: 'Abr', baja: 103000, mayo: 79000, plaza: 92000 },
  { mes: 'May', baja: 118000, mayo: 84000, plaza: 98000 },
  { mes: 'Jun', baja: 95000, mayo: 71000, plaza: 88000 },
]

const DATA_PRODUCTOS = [
  { name: 'Armazones', value: 42 },
  { name: 'Micas progresivas', value: 28 },
  { name: 'LC blandos', value: 15 },
  { name: 'Micas mono', value: 10 },
  { name: 'Otros', value: 5 },
]

const TOP_PRODUCTOS = [
  { nombre: 'Armazón Ray-Ban RB5154',     vendidos: 18, total: 86400 },
  { nombre: 'Micas progresivas AR',       vendidos: 24, total: 76800 },
  { nombre: 'Acuvue Oasys mensuales',     vendidos: 31, total: 49600 },
  { nombre: 'Armazón Oakley crosslink',   vendidos: 12, total: 58800 },
  { nombre: 'Micas transitions grey',     vendidos: 19, total: 57000 },
]

export default function ReportesPage() {
  const [mes, setMes] = useState('Junio')
  const [sucursal, setSucursal] = useState('Todas')
  const [generandoIA, setGenerandoIA] = useState(false)
  const [reporteIA, setReporteIA] = useState('')

  const generarReporteIA = async () => {
    setGenerandoIA(true)
    setReporteIA('')
    await new Promise(r => setTimeout(r, 1800))
    setReporteIA(`**Resumen ejecutivo — ${mes} 2026**

Las tres sucursales registraron ventas combinadas de **$254,000 MXN**, un **8.2% por encima del promedio de los últimos 6 meses**. Baja Visión lidera con el 37% de los ingresos totales.

**Puntos destacados:**
- Los armazones Ray-Ban representaron el 34% de las ventas de armazones, consolidándose como el producto más solicitado.
- Las micas progresivas antirreflejantes tuvieron un crecimiento del 15% respecto a mayo, impulsado por la campaña de verano.
- Lentes de contacto Acuvue registraron la mayor frecuencia de compra (recompra recurrente en 68% de los casos).

**Áreas de oportunidad:**
- 5 de Mayo está un 12% por debajo de su meta mensual. Se recomienda revisar el inventario de armazones de gama media.
- 3 órdenes de laboratorio vencieron su fecha de promesa esta semana — riesgo de insatisfacción del cliente.
- El margen neto de tarjeta crédito se redujo 2.1 puntos por comisiones bancarias. Considerar incentivar pagos en efectivo o débito.`)
    setGenerandoIA(false)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Reportes</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Análisis de desempeño y métricas clave</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={mes} onChange={e => setMes(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm bg-white border border-zinc-200 rounded text-zinc-600 focus:outline-none">
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={sucursal} onChange={e => setSucursal(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm bg-white border border-zinc-200 rounded text-zinc-600 focus:outline-none">
              {['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 bg-white rounded text-sm text-zinc-600 hover:bg-zinc-50">
            <Download className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Ventas del mes',     value: '$254,000', icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50', sub: '+8.2% vs mayo' },
          { label: 'Tickets atendidos',  value: '312',      icon: Users,       color: 'text-blue-600',    bg: 'bg-blue-50',    sub: '104 por sucursal' },
          { label: 'Ticket promedio',    value: '$814',     icon: BarChart2,   color: 'text-indigo-600',  bg: 'bg-indigo-50',  sub: '+5% vs mayo' },
          { label: 'Órdenes de lab',     value: '47',       icon: Package,     color: 'text-amber-600',   bg: 'bg-amber-50',   sub: '3 con problema' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">{k.label}</p>
                <div className={`w-8 h-8 rounded ${k.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold mt-2 ${k.color}`}>{k.value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-3 gap-5">
        {/* Ventas por sucursal mensual */}
        <div className="col-span-2 bg-white rounded-lg border border-zinc-200/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
              <Store className="w-4 h-4 text-zinc-400" /> Ventas por sucursal (6 meses)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA_MENSUAL} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString('es-MX')}`, '']} contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="baja"  name="Baja Visión"    fill="#0D9488" radius={[3,3,0,0]} />
              <Bar dataKey="mayo"  name="5 de Mayo"      fill="#0B0E14" radius={[3,3,0,0]} opacity={0.8} />
              <Bar dataKey="plaza" name="Plaza Laureles"  fill="#6366F1" radius={[3,3,0,0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categorías de venta */}
        <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
          <h3 className="text-sm font-bold text-zinc-700 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-zinc-400" /> Por categoría
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={DATA_PRODUCTOS} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {DATA_PRODUCTOS.map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => [`${Number(v)}%`, '']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {DATA_PRODUCTOS.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORES_PIE[i] }} />
                <span className="text-zinc-600 flex-1">{d.name}</span>
                <span className="font-semibold text-zinc-700">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top productos + Reporte IA */}
      <div className="grid grid-cols-2 gap-5">
        {/* Top productos */}
        <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
          <h3 className="text-sm font-bold text-zinc-700 mb-4">Top 5 productos del mes</h3>
          <div className="space-y-3">
            {TOP_PRODUCTOS.map((p, i) => {
              const pct = Math.round((p.total / TOP_PRODUCTOS[0].total) * 100)
              return (
                <div key={p.nombre}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-600 font-medium">{i + 1}. {p.nombre}</span>
                    <span className="text-zinc-500">{p.vendidos} uds · ${p.total.toLocaleString('es-MX')}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#0D9488]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reporte IA */}
        <div className="bg-white rounded-lg border border-zinc-200/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0D9488]" /> Análisis de IA
            </h3>
            <span className="text-xs text-zinc-400">Powered by Claude</span>
          </div>
          {!reporteIA && !generandoIA && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#0D9488]/10 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-[#0D9488]" />
              </div>
              <p className="text-sm text-zinc-500 mb-4">Genera un análisis automático del mes con recomendaciones para tu negocio</p>
              <button onClick={generarReporteIA}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-[#1A1D27]">
                <Sparkles className="w-4 h-4" /> Generar reporte del mes
              </button>
            </div>
          )}
          {generandoIA && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Analizando datos del mes...</p>
              </div>
            </div>
          )}
          {reporteIA && (
            <div className="flex-1 overflow-y-auto">
              <div className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">{reporteIA}</div>
              <button onClick={() => setReporteIA('')}
                className="mt-4 text-xs text-zinc-400 hover:text-zinc-600 underline">
                Regenerar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
