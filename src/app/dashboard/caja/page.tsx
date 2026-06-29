'use client'

import { useState } from 'react'
import {
  Banknote, CreditCard, Building2, CheckCircle2,
  AlertTriangle, Printer, ChevronDown, Clock,
  TrendingUp, ArrowRight, Lock,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type CorteGuardado = {
  id: number
  fecha: string
  sucursal: string
  usuario: string
  esperado: number
  contado: number
  diferencia: number
  fondo: number
  entrega: number
  cerrado: boolean
}

// ─────────────────────────────────────────
// Mock — ventas del día por método
// ─────────────────────────────────────────
const VENTAS_HOY = {
  efectivo:     { monto: 3750,  transacciones: 4 },
  debito:       { monto: 6200,  transacciones: 3 },
  credito:      { monto: 4800,  transacciones: 2 },
  transferencia:{ monto: 2100,  transacciones: 2 },
}

const CORTES_ANTERIORES: CorteGuardado[] = [
  { id: 1, fecha: '2026-06-25', sucursal: 'Baja Visión', usuario: 'Karina', esperado: 3200, contado: 3200, diferencia: 0,    fondo: 500, entrega: 2700, cerrado: true },
  { id: 2, fecha: '2026-06-24', sucursal: 'Baja Visión', usuario: 'Karina', esperado: 4100, contado: 4050, diferencia: -50,  fondo: 500, entrega: 3550, cerrado: true },
  { id: 3, fecha: '2026-06-23', sucursal: 'Baja Visión', usuario: 'Karina', esperado: 2800, contado: 2800, diferencia: 0,    fondo: 500, entrega: 2300, cerrado: true },
]

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

export default function CajaPage() {
  const [sucursal, setSucursal] = useState('Baja Visión')
  const [efectivoContado, setEfectivoContado] = useState('')
  const [fondo, setFondo] = useState('500')
  const [notas, setNotas] = useState('')
  const [cerrado, setCerrado] = useState(false)
  const [historial, setHistorial] = useState(CORTES_ANTERIORES)

  const esperado   = VENTAS_HOY.efectivo.monto
  const contado    = parseFloat(efectivoContado) || 0
  const fondoNum   = parseFloat(fondo) || 0
  const diferencia = contado - esperado
  const entrega    = Math.max(0, contado - fondoNum)

  const cerrarCaja = () => {
    const nuevo: CorteGuardado = {
      id: Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      sucursal,
      usuario: 'Karina',
      esperado,
      contado,
      diferencia,
      fondo: fondoNum,
      entrega,
      cerrado: true,
    }
    setHistorial(prev => [nuevo, ...prev])
    setCerrado(true)
  }

  const total = Object.values(VENTAS_HOY).reduce((s, v) => s + v.monto, 0)

  return (
    <div className="space-y-5 max-w-3xl">

      <div>
        <h1 className="text-xl font-bold text-slate-800">Corte de caja</h1>
        <p className="text-sm text-slate-400 mt-0.5">Cierre del día · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Selector de sucursal */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select value={sucursal} onChange={e => setSucursal(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 text-sm font-semibold bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30">
            {SUCURSALES.map(s => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {cerrado && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Caja cerrada
          </span>
        )}
      </div>

      {/* Resumen de ventas del día */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Ventas registradas hoy</h3>
          <span className="text-xs text-slate-400">Sistema · solo lectura</span>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { label: 'Efectivo',      icon: Banknote,  color: 'text-emerald-600', bg: 'bg-emerald-50', ...VENTAS_HOY.efectivo },
            { label: 'Tarjeta débito',icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50',    ...VENTAS_HOY.debito },
            { label: 'Tarjeta crédito',icon: CreditCard,color: 'text-purple-600', bg: 'bg-purple-50',  ...VENTAS_HOY.credito },
            { label: 'Transferencia', icon: Building2,  color: 'text-slate-600',  bg: 'bg-slate-100',  ...VENTAS_HOY.transferencia },
          ].map(m => {
            const Icon = m.icon
            return (
              <div key={m.label} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`w-8 h-8 rounded ${m.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{m.label}</p>
                  <p className="text-xs text-slate-400">{m.transacciones} transacciones</p>
                </div>
                <p className="text-base font-bold text-slate-800">${m.monto.toLocaleString('es-MX')}</p>
              </div>
            )
          })}
        </div>
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-600">Total del día</span>
          <span className="text-lg font-bold text-slate-800">${total.toLocaleString('es-MX')}</span>
        </div>
      </div>

      {/* Conteo físico de efectivo */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Conteo de efectivo</h3>

        <div className="grid grid-cols-2 gap-5">
          {/* Efectivo esperado */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 mb-1">Efectivo esperado (sistema)</p>
            <p className="text-3xl font-bold text-slate-700">${esperado.toLocaleString('es-MX')}</p>
            <p className="text-xs text-slate-400 mt-1">{VENTAS_HOY.efectivo.transacciones} cobros en efectivo</p>
          </div>

          {/* Efectivo contado */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Efectivo contado físicamente *</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={efectivoContado}
                onChange={e => setEfectivoContado(e.target.value)}
                disabled={cerrado}
                className="w-full border-2 border-slate-200 rounded-lg pl-8 pr-4 py-4 text-2xl font-bold text-slate-800 focus:outline-none focus:border-[#2BBFB3] disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="0.00"
              />
            </div>

            {/* Diferencia */}
            {efectivoContado !== '' && (
              <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-lg ${
                diferencia === 0 ? 'bg-emerald-50 border border-emerald-200' :
                diferencia > 0  ? 'bg-blue-50 border border-blue-200' :
                                  'bg-red-50 border border-red-200'
              }`}>
                {diferencia === 0
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <div>
                  <p className={`text-sm font-bold ${
                    diferencia === 0 ? 'text-emerald-700' : diferencia > 0 ? 'text-blue-700' : 'text-red-700'
                  }`}>
                    {diferencia === 0
                      ? 'Sin diferencia — cuadra perfecto'
                      : diferencia > 0
                      ? `Sobrante: +$${diferencia.toLocaleString('es-MX')}`
                      : `Faltante: -$${Math.abs(diferencia).toLocaleString('es-MX')}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fondo y entrega */}
        {efectivoContado !== '' && (
          <div className="mt-5 grid grid-cols-2 gap-4 pt-5 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fondo que se queda en caja</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" value={fondo} onChange={e => setFondo(e.target.value)} disabled={cerrado}
                  className="w-full border border-slate-200 rounded pl-7 pr-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 disabled:bg-slate-50 disabled:text-slate-400" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Para apertura del siguiente día</p>
            </div>
            <div className="bg-[#0B1A35] rounded-lg p-4 flex flex-col justify-center">
              <p className="text-xs text-white/50 font-semibold">Total a entregar</p>
              <p className="text-3xl font-bold text-[#2BBFB3] mt-1">${entrega.toLocaleString('es-MX')}</p>
              <p className="text-xs text-white/40 mt-1">Contado menos fondo</p>
            </div>
          </div>
        )}

        {/* Notas */}
        {efectivoContado !== '' && !cerrado && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notas del corte</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 resize-none placeholder:text-slate-400"
              placeholder="Observaciones, diferencias, devoluciones en efectivo..." />
          </div>
        )}

        {/* Botones */}
        {!cerrado ? (
          <div className="mt-5 flex gap-3">
            <button
              onClick={cerrarCaja}
              disabled={!efectivoContado}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0B1A35] text-white rounded text-sm font-bold hover:bg-[#0d2145] disabled:opacity-40 transition-all">
              <Lock className="w-4 h-4" /> Cerrar caja del día
            </button>
            <button
              disabled={!efectivoContado}
              className="flex items-center gap-2 px-4 py-3 border border-slate-200 text-slate-500 rounded text-sm hover:bg-slate-50 disabled:opacity-40">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        ) : (
          <div className="mt-5 flex gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-700">Caja cerrada correctamente</p>
                <p className="text-xs text-emerald-600">Entrega registrada: ${entrega.toLocaleString('es-MX')}</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-3 border border-slate-200 text-slate-500 rounded text-sm hover:bg-slate-50">
              <Printer className="w-4 h-4" /> Imprimir recibo
            </button>
          </div>
        )}
      </div>

      {/* Historial de cortes */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Cortes anteriores
          </h3>
          <span className="text-xs text-slate-400">{sucursal}</span>
        </div>
        <div className="divide-y divide-slate-50">
          {historial.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 rounded bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                {c.diferencia === 0
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">{c.fecha}</p>
                <p className="text-xs text-slate-400">{c.usuario} · Entrega: ${c.entrega.toLocaleString('es-MX')}</p>
              </div>
              <div className="text-right">
                {c.diferencia !== 0 && (
                  <p className={`text-xs font-bold ${c.diferencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {c.diferencia > 0 ? '+' : ''}{c.diferencia.toLocaleString('es-MX')}
                  </p>
                )}
                <p className="text-xs text-slate-400">Esperado: ${c.esperado.toLocaleString('es-MX')}</p>
              </div>
              <button className="text-slate-300 hover:text-slate-500">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
