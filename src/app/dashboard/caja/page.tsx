'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Banknote, CreditCard, Building2, CheckCircle2,
  AlertTriangle, Printer, Clock, Lock, RefreshCw, MapPin,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia'

type ResumenMetodo = { monto: number; transacciones: number }

type CorteGuardado = {
  id: string
  fecha: string
  sucursal: string
  usuario: string
  total_ventas: number
  efectivo_sistema: number
  efectivo_contado: number
  diferencia: number
  fondo: number
  entrega: number
  notas: string
  cerrado: boolean
}

// ─────────────────────────────────────────
// Configuración de métodos de pago
// ─────────────────────────────────────────
const METODOS: {
  key: MetodoPago
  label: string
  icon: React.ElementType
  color: string
  bg: string
}[] = [
  { key: 'efectivo',      label: 'Efectivo',       icon: Banknote,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'debito',        label: 'Tarjeta débito',  icon: CreditCard, color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { key: 'credito',       label: 'Tarjeta crédito', icon: CreditCard, color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { key: 'transferencia', label: 'Transferencia',   icon: Building2,  color: 'text-zinc-600',   bg: 'bg-zinc-100'  },
]

const RESUMEN_VACIO: Record<MetodoPago, ResumenMetodo> = {
  efectivo:      { monto: 0, transacciones: 0 },
  debito:        { monto: 0, transacciones: 0 },
  credito:       { monto: 0, transacciones: 0 },
  transferencia: { monto: 0, transacciones: 0 },
}

export default function CajaPage() {
  // ── Estado del usuario / sucursal ──
  const [usuario, setUsuario] = useState({ nombre: '', sucursal: '' })

  // ── Datos del día ──
  const [ventas, setVentas]       = useState<Record<MetodoPago, ResumenMetodo>>(RESUMEN_VACIO)
  const [historial, setHistorial] = useState<CorteGuardado[]>([])
  const [corteHoy, setCorteHoy]   = useState<CorteGuardado | null>(null)
  const [cargando, setCargando]   = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)

  // ── Formulario de corte ──
  const [efectivoContado, setEfectivoContado] = useState('')
  const [fondo, setFondo]     = useState('500')
  const [notas, setNotas]     = useState('')
  const [guardando, setGuardando] = useState(false)

  // ── Cálculos ──
  const esperado   = ventas.efectivo.monto
  const contado    = parseFloat(efectivoContado) || 0
  const fondoNum   = parseFloat(fondo) || 0
  const diferencia = contado - esperado
  const entrega    = Math.max(0, contado - fondoNum)
  const total      = Object.values(ventas).reduce((s, v) => s + v.monto, 0)
  const cerrado    = !!corteHoy

  // ── Leer usuario del localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUsuario({ nombre: u.nombre ?? '', sucursal: u.sucursal ?? '' })
      }
    } catch { /* noop */ }
  }, [])

  // ── Cargar datos ──
  const cargarDatos = useCallback(async (sucursal: string) => {
    if (!sucursal) return
    setCargando(true)
    const sb  = createClient()
    const hoy = new Date().toISOString().split('T')[0]

    // 1. Ventas del día agrupadas por método de pago
    const { data: ventasData } = await sb
      .from('ventas')
      .select('metodo_pago, total')
      .eq('sucursal', sucursal)
      .eq('estado', 'activa')
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)

    if (ventasData) {
      const resumen = JSON.parse(JSON.stringify(RESUMEN_VACIO)) as Record<MetodoPago, ResumenMetodo>
      for (const v of ventasData) {
        const key = v.metodo_pago as MetodoPago
        if (resumen[key]) {
          resumen[key] = {
            monto:         resumen[key].monto + Number(v.total),
            transacciones: resumen[key].transacciones + 1,
          }
        }
      }
      setVentas(resumen)
    }

    // 2. ¿Ya existe corte hoy?
    const { data: corteData } = await sb
      .from('cortes_caja')
      .select('*')
      .eq('sucursal', sucursal)
      .eq('fecha', hoy)
      .maybeSingle()

    if (corteData) {
      setCorteHoy(corteData)
      setEfectivoContado(String(corteData.efectivo_contado))
      setFondo(String(corteData.fondo))
      setNotas(corteData.notas)
    } else {
      setCorteHoy(null)
    }

    // 3. Historial (últimos 10 cortes, excluyendo hoy)
    const { data: historialData } = await sb
      .from('cortes_caja')
      .select('*')
      .eq('sucursal', sucursal)
      .neq('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(10)

    setHistorial(historialData ?? [])
    setUltimaActualizacion(new Date())
    setCargando(false)
  }, [])

  useEffect(() => {
    if (usuario.sucursal) cargarDatos(usuario.sucursal)
  }, [usuario.sucursal, cargarDatos])

  // ── Guardar corte en Supabase ──
  const cerrarCaja = async () => {
    if (!efectivoContado || guardando) return
    setGuardando(true)
    const sb  = createClient()
    const hoy = new Date().toISOString().split('T')[0]

    const payload = {
      fecha:            hoy,
      sucursal:         usuario.sucursal,
      usuario:          usuario.nombre,
      total_ventas:     total,
      efectivo_sistema: esperado,
      efectivo_contado: contado,
      diferencia,
      fondo:            fondoNum,
      entrega,
      notas,
      cerrado:          true,
    }

    const { data, error } = await sb
      .from('cortes_caja')
      .upsert(payload, { onConflict: 'fecha,sucursal' })
      .select()
      .single()

    if (!error && data) setCorteHoy(data)
    setGuardando(false)
  }

  // ─────────────────────────────────────────
  // Sin sucursal (no hizo check-in)
  // ─────────────────────────────────────────
  if (!cargando && !usuario.sucursal) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
        <MapPin className="w-10 h-10" />
        <p className="text-sm font-medium">Necesitas hacer check-in primero</p>
        <p className="text-xs">Recarga la página para seleccionar tu sucursal</p>
      </div>
    )
  }

  // ─────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-3xl">

      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Corte de caja</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {usuario.sucursal && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-full font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {usuario.sucursal}
            </span>
          )}
          <button
            onClick={() => cargarDatos(usuario.sucursal)}
            disabled={cargando}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 px-3 py-1.5 rounded-full hover:bg-zinc-50 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Banner caja ya cerrada */}
      {cerrado && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-700">Caja cerrada</p>
            <p className="text-xs text-emerald-600">
              Cerrada por {corteHoy?.usuario} · Entrega: ${corteHoy?.entrega.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
        </div>
      )}

      {/* Resumen de ventas del día */}
      <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-700">Ventas registradas hoy</h3>
          <div className="flex items-center gap-2">
            {ultimaActualizacion && (
              <span className="text-xs text-zinc-400">
                Act. {ultimaActualizacion.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded">Solo lectura</span>
          </div>
        </div>

        {cargando ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">Cargando ventas...</div>
        ) : (
          <>
            <div className="divide-y divide-zinc-50">
              {METODOS.map(m => {
                const Icon = m.icon
                const data = ventas[m.key]
                return (
                  <div key={m.key} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-8 h-8 rounded ${m.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700">{m.label}</p>
                      <p className="text-xs text-zinc-400">
                        {data.transacciones === 0
                          ? 'Sin transacciones'
                          : `${data.transacciones} transacción${data.transacciones !== 1 ? 'es' : ''}`}
                      </p>
                    </div>
                    <p className={`text-base font-bold ${data.monto > 0 ? 'text-zinc-800' : 'text-zinc-300'}`}>
                      ${data.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
              <span className="text-sm font-semibold text-zinc-600">Total del día</span>
              <span className="text-lg font-bold text-zinc-800">
                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Conteo físico de efectivo */}
      <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
        <h3 className="text-sm font-bold text-zinc-700 mb-4">Conteo de efectivo</h3>

        <div className="grid grid-cols-2 gap-5">
          {/* Esperado */}
          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 mb-1">Efectivo esperado (sistema)</p>
            <p className="text-3xl font-bold text-zinc-700">
              ${esperado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {ventas.efectivo.transacciones} cobro{ventas.efectivo.transacciones !== 1 ? 's' : ''} en efectivo
            </p>
          </div>

          {/* Contado */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-1.5">Efectivo contado físicamente *</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -tranzinc-y-1/2 text-zinc-400 font-bold">$</span>
              <input
                type="number"
                value={efectivoContado}
                onChange={e => setEfectivoContado(e.target.value)}
                disabled={cerrado}
                className="w-full border-2 border-zinc-200 rounded-lg pl-8 pr-4 py-4 text-2xl font-bold text-zinc-800 focus:outline-none focus:border-[#0D9488] disabled:bg-zinc-50 disabled:text-zinc-400"
                placeholder="0.00"
              />
            </div>

            {efectivoContado !== '' && (
              <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-lg ${
                diferencia === 0
                  ? 'bg-emerald-50 border border-emerald-200'
                  : diferencia > 0
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {diferencia === 0
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <p className={`text-sm font-bold ${
                  diferencia === 0 ? 'text-emerald-700' : diferencia > 0 ? 'text-blue-700' : 'text-red-700'
                }`}>
                  {diferencia === 0
                    ? 'Sin diferencia — cuadra perfecto'
                    : diferencia > 0
                    ? `Sobrante: +$${diferencia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                    : `Faltante: -$${Math.abs(diferencia).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fondo y entrega */}
        {efectivoContado !== '' && (
          <div className="mt-5 grid grid-cols-2 gap-4 pt-5 border-t border-zinc-100">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                Fondo que se queda en caja
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-sm">$</span>
                <input
                  type="number"
                  value={fondo}
                  onChange={e => setFondo(e.target.value)}
                  disabled={cerrado}
                  className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 disabled:bg-zinc-50 disabled:text-zinc-400"
                />
              </div>
              <p className="text-xs text-zinc-400 mt-1">Para apertura del siguiente día</p>
            </div>
            <div className="bg-[#0B0E14] rounded-lg p-4 flex flex-col justify-center">
              <p className="text-xs text-white/50 font-semibold">Total a entregar</p>
              <p className="text-3xl font-bold text-[#0D9488] mt-1">
                ${entrega.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-white/40 mt-1">Contado menos fondo</p>
            </div>
          </div>
        )}

        {/* Notas */}
        {efectivoContado !== '' && !cerrado && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notas del corte</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none placeholder:text-zinc-400"
              placeholder="Observaciones, diferencias, devoluciones en efectivo..."
            />
          </div>
        )}
        {cerrado && corteHoy?.notas && (
          <div className="mt-4 px-4 py-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 mb-1">Notas del corte</p>
            <p className="text-sm text-zinc-600">{corteHoy.notas}</p>
          </div>
        )}

        {/* Botón cerrar / ya cerrada */}
        {!cerrado && (
          <div className="mt-5 flex gap-3">
            <button
              onClick={cerrarCaja}
              disabled={!efectivoContado || guardando}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-all"
            >
              {guardando
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Lock className="w-4 h-4" />}
              {guardando ? 'Guardando...' : 'Cerrar caja del día'}
            </button>
            <button
              disabled={!efectivoContado}
              className="flex items-center gap-2 px-4 py-3 border border-zinc-200 text-zinc-500 rounded text-sm hover:bg-zinc-50 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        )}
      </div>

      {/* Historial de cortes */}
      <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" /> Cortes anteriores
          </h3>
          <span className="text-xs text-zinc-400">{usuario.sucursal}</span>
        </div>

        {historial.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">
            {cargando ? 'Cargando...' : 'Sin cortes anteriores'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {historial.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                <div className="w-10 h-10 rounded bg-zinc-50 border border-zinc-200 flex items-center justify-center flex-shrink-0">
                  {c.diferencia === 0
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-700">
                    {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                      weekday: 'short', day: '2-digit', month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {c.usuario} · Entrega: ${c.entrega.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  {c.diferencia !== 0 && (
                    <p className={`text-xs font-bold ${c.diferencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {c.diferencia > 0 ? '+' : ''}${c.diferencia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400">
                    Total: ${c.total_ventas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <button className="text-zinc-300 hover:text-zinc-500">
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
