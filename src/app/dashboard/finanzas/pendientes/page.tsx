'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import RequireRol from '@/components/RequireRol'
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Lock } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CAT_GASTO = ['renta', 'nomina', 'bonos_comisiones', 'proveedores', 'servicios', 'mantenimiento', 'marketing',
  'papeleria', 'limpieza', 'comision_terminal', 'compras', 'adelanto', 'comisiones', 'retiro_admin']
const CAT_LABEL: Record<string, string> = {
  renta: 'Renta', nomina: 'Nómina', bonos_comisiones: 'Bonos/comisiones', proveedores: 'Proveedores',
  servicios: 'Servicios', mantenimiento: 'Mantenimiento', marketing: 'Marketing', papeleria: 'Papelería',
  limpieza: 'Limpieza', comision_terminal: 'Comisión terminal', compras: 'Compra de inventario',
  adelanto: 'Adelanto sueldo', comisiones: 'Comisiones', retiro_admin: 'Retiro del dueño (no es gasto)',
}
const ESTADOS_CITA = ['atendida', 'cancelada', 'no_asistio']
const $$ = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

function Seccion({ titulo, n, hint, children }: { titulo: string; n: number; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div>
          <h3 className="text-sm font-bold text-zinc-800">{titulo}</h3>
          {hint && <p className="text-[11px] text-zinc-400 mt-0.5">{hint}</p>}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${n === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
          {n === 0 ? 'listo' : `${n} pendiente${n > 1 ? 's' : ''}`}
        </span>
      </div>
      {n > 0 && <div className="divide-y divide-zinc-50">{children}</div>}
    </div>
  )
}

function Fila({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">{children}</div>
}

function BtnGuardar({ onClick, saving, ok }: { onClick: () => void; saving: boolean; ok: boolean }) {
  return (
    <button onClick={onClick} disabled={saving || ok}
      className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-[#0D9488] text-white hover:bg-[#0B7C72]'} disabled:opacity-60`}>
      {ok ? '✓ Guardado' : saving ? '…' : 'Guardar'}
    </button>
  )
}

function PendientesInner() {
  const ahora = new Date()
  const [anio, setAnio] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [data, setData] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [edits, setEdits] = useState<Record<string, any>>({})   // key → valores del formulario
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [cerrando, setCerrando] = useState(false)

  // Lee mes/año del URL (?anio=&mes=) al montar
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const a = parseInt(q.get('anio') ?? '', 10)
    const m = parseInt(q.get('mes') ?? '', 10)
    if (Number.isInteger(a) && a > 2020) setAnio(a)
    if (Number.isInteger(m) && m >= 1 && m <= 12) setMes(m)
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const r = await fetch(`/api/finanzas/pendientes?anio=${anio}&mes=${mes}`)
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setData(j.pendientes); setEdits({}); setSaved({})
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') } finally { setCargando(false) }
  }, [anio, mes])
  useEffect(() => { cargar() }, [cargar])

  const setEdit = (key: string, campo: string, val: any) =>
    setEdits(p => ({ ...p, [key]: { ...p[key], [campo]: val } }))

  const guardar = async (key: string, payload: any) => {
    setSaving(p => ({ ...p, [key]: true }))
    try {
      const r = await fetch('/api/finanzas/pendientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setSaved(p => ({ ...p, [key]: true }))
    } catch (e) { alert('No se pudo guardar: ' + (e instanceof Error ? e.message : '')) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  const cerrarMes = async () => {
    if (!confirm(`Marcar ${MESES[mes - 1]} ${anio} como CONFIABLE. ¿Continuar?`)) return
    setCerrando(true)
    try {
      const r = await fetch('/api/finanzas/pendientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', anio, mes }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      await cargar()
    } catch (e) { alert('No se pudo cerrar: ' + (e instanceof Error ? e.message : '')) }
    finally { setCerrando(false) }
  }

  const c = data?.counts || {}
  const yaCerrado = data?.cierre?.estado === 'confiable'

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finanzas" className="text-zinc-400 hover:text-zinc-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Pendientes del cierre</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Corrige aquí lo que impide cerrar el mes; los demás datos no aparecen.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs bg-white">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs bg-white">
            {[0, 1, 2].map(k => ahora.getFullYear() - k).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-48 text-zinc-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reuniendo pendientes…</div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      ) : !data ? null : (
        <>
          {/* Barra de estado */}
          <div className={`rounded-lg p-4 flex items-center gap-3 ${yaCerrado ? 'bg-emerald-50' : data.materialesPendientes === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            {yaCerrado ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : data.materialesPendientes === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-800">
                {yaCerrado ? `${MESES[mes - 1]} ${anio} está marcado como CONFIABLE`
                  : data.materialesPendientes === 0 ? 'Sin pendientes materiales — puedes cerrar el mes'
                  : `${data.materialesPendientes} pendiente(s) material(es) por resolver`}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Total: {data.totalPendientes} · por aclarar {c.movAclarar} ({$$(data.montoAclarar)}) · USD {c.movUSD} · órdenes sin costo {c.ordenesSinCosto} · armazones {c.armazonesSinCosto} · citas {c.citasVencidas} · garantías {c.garantiasIncompletas}
              </p>
            </div>
            <button onClick={cerrarMes} disabled={cerrando || (data.materialesPendientes > 0 && !yaCerrado)}
              className="flex items-center gap-1.5 bg-[#0B0E14] text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[#1A1D27] disabled:opacity-40">
              {cerrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              {yaCerrado ? 'Recerrar' : 'Marcar CONFIABLE'}
            </button>
          </div>

          {/* 1. Movimientos por aclarar */}
          <Seccion titulo="1 · Movimientos por aclarar" n={c.movAclarar} hint="Asígnales una categoría válida (o marca 'Retiro del dueño').">
            {data.movAclarar.map((m: any) => {
              const key = `mov-${m.id}`
              return (
                <Fila key={key}>
                  <span className="text-zinc-400 text-xs w-20">{m.fecha}</span>
                  <span className="flex-1 min-w-[140px]">{m.concepto || '(sin concepto)'} · <b>{$$(m.monto)}</b> · {m.sucursal}{m.esCaja ? ' · caja' : ''}</span>
                  <select value={edits[key]?.categoria ?? ''} onChange={e => setEdit(key, 'categoria', e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs">
                    <option value="">Categoría…</option>
                    {CAT_GASTO.map(cat => <option key={cat} value={cat}>{CAT_LABEL[cat]}</option>)}
                  </select>
                  <BtnGuardar saving={!!saving[key]} ok={!!saved[key]}
                    onClick={() => edits[key]?.categoria && guardar(key, { action: 'update', tabla: 'gastos', id: m.id, campos: { categoria: edits[key].categoria } })} />
                </Fila>
              )
            })}
          </Seccion>

          {/* 2. Movimientos en USD */}
          <Seccion titulo="2 · Movimientos en dólares" n={c.movUSD} hint="Confirma el monto en pesos (MXN). Al guardar se cambia el método a efectivo.">
            {data.movUSD.map((m: any) => {
              const key = `usd-${m.id}`
              return (
                <Fila key={key}>
                  <span className="text-zinc-400 text-xs w-20">{m.fecha}</span>
                  <span className="flex-1 min-w-[140px]">{m.concepto || '(sin concepto)'} · registrado: <b>{m.monto}</b> · {m.sucursal}</span>
                  <input type="number" step="0.01" placeholder="Monto en MXN" value={edits[key]?.monto ?? ''} onChange={e => setEdit(key, 'monto', e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs w-28" />
                  <BtnGuardar saving={!!saving[key]} ok={!!saved[key]}
                    onClick={() => edits[key]?.monto && guardar(key, { action: 'update', tabla: 'gastos', id: m.id, campos: { monto: Number(edits[key].monto), metodo_pago: 'efectivo' } })} />
                </Fila>
              )
            })}
          </Seccion>

          {/* 3. Órdenes de laboratorio sin costo */}
          <Seccion titulo="3 · Órdenes de laboratorio sin costo" n={c.ordenesSinCosto} hint={`Ingreso asociado: ${$$(data.ingresoOrdenesSinCosto)}. Captura el costo real del laboratorio.`}>
            {data.ordenesSinCosto.map((o: any) => {
              const key = `ord-${o.id}`
              return (
                <Fila key={key}>
                  <span className="text-zinc-400 text-xs w-20">{o.folio}</span>
                  <span className="flex-1 min-w-[140px]">{o.paciente} · {o.tipoLente} · {o.sucursal} · {$$(o.ingreso)}</span>
                  <input placeholder="Laboratorio" value={edits[key]?.laboratorio ?? o.laboratorio} onChange={e => setEdit(key, 'laboratorio', e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs w-28" />
                  <input type="number" step="0.01" placeholder="Costo lab" value={edits[key]?.costo_lab ?? ''} onChange={e => setEdit(key, 'costo_lab', e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs w-24" />
                  <BtnGuardar saving={!!saving[key]} ok={!!saved[key]}
                    onClick={() => edits[key]?.costo_lab && guardar(key, { action: 'update', tabla: 'ordenes_lab', id: o.id, campos: { costo_lab: Number(edits[key].costo_lab), laboratorio: edits[key]?.laboratorio ?? o.laboratorio } })} />
                </Fila>
              )
            })}
          </Seccion>

          {/* 4. Armazones vendidos sin costo */}
          <Seccion titulo="4 · Armazones vendidos sin costo" n={c.armazonesSinCosto} hint="Captura el costo del modelo; se usará para todas sus ventas.">
            {data.armazonesSinCosto.map((a: any) => {
              const key = `arm-${a.sku}`
              return (
                <Fila key={key}>
                  <span className="text-zinc-500 text-xs w-24 font-mono">{a.sku}</span>
                  <span className="flex-1 min-w-[140px]">{a.marca} {a.modelo} · {a.piezas} vendido(s) · {$$(a.ingreso)}</span>
                  <input type="number" step="0.01" placeholder="Costo unitario" value={edits[key]?.costo ?? ''} onChange={e => setEdit(key, 'costo', e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs w-28" />
                  <BtnGuardar saving={!!saving[key]} ok={!!saved[key]}
                    onClick={() => edits[key]?.costo && guardar(key, { action: 'update_armazon', sku: a.sku, costo: Number(edits[key].costo) })} />
                </Fila>
              )
            })}
          </Seccion>

          {/* 5. Citas vencidas */}
          <Seccion titulo="5 · Citas vencidas sin cerrar" n={c.citasVencidas} hint="Ciérralas con su resultado real (no todo es no-show).">
            {data.citasVencidas.map((c2: any) => {
              const key = `cita-${c2.id}`
              return (
                <Fila key={key}>
                  <span className="text-zinc-400 text-xs w-20">{c2.fecha}</span>
                  <span className="flex-1 min-w-[140px]">{c2.paciente} · {c2.tipo} · {c2.sucursal} · <span className="text-amber-600">{c2.estado}</span></span>
                  <select value={edits[key]?.estado ?? ''} onChange={e => setEdit(key, 'estado', e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs">
                    <option value="">Resultado…</option>
                    {ESTADOS_CITA.map(es => <option key={es} value={es}>{es}</option>)}
                  </select>
                  <BtnGuardar saving={!!saving[key]} ok={!!saved[key]}
                    onClick={() => edits[key]?.estado && guardar(key, { action: 'update', tabla: 'citas', id: c2.id, campos: { estado: edits[key].estado } })} />
                </Fila>
              )
            })}
          </Seccion>

          {/* 6. Garantías incompletas */}
          <Seccion titulo="6 · Garantías incompletas" n={c.garantiasIncompletas} hint="Completa folio de origen, motivo y laboratorio.">
            {data.garantiasIncompletas.map((g: any) => {
              const key = `gar-${g.id}`
              return (
                <Fila key={key}>
                  <span className="text-zinc-400 text-xs w-20">{g.folio}</span>
                  <span className="min-w-[100px]">{g.paciente}</span>
                  <input placeholder="Folio origen" value={edits[key]?.folio_origen ?? g.folioOrigen} onChange={e => setEdit(key, 'folio_origen', e.target.value)}
                    className={`border rounded px-2 py-1 text-xs w-24 ${g.faltaOrigen ? 'border-amber-300' : 'border-zinc-200'}`} />
                  <input placeholder="Motivo" value={edits[key]?.motivo_problema ?? g.motivo} onChange={e => setEdit(key, 'motivo_problema', e.target.value)}
                    className={`border rounded px-2 py-1 text-xs flex-1 min-w-[120px] ${g.faltaMotivo ? 'border-amber-300' : 'border-zinc-200'}`} />
                  <input placeholder="Laboratorio" value={edits[key]?.laboratorio ?? g.laboratorio} onChange={e => setEdit(key, 'laboratorio', e.target.value)}
                    className={`border rounded px-2 py-1 text-xs w-24 ${g.faltaLab ? 'border-amber-300' : 'border-zinc-200'}`} />
                  <BtnGuardar saving={!!saving[key]} ok={!!saved[key]}
                    onClick={() => guardar(key, { action: 'update', tabla: 'ordenes_lab', id: g.id, campos: {
                      folio_origen: edits[key]?.folio_origen ?? g.folioOrigen,
                      motivo_problema: edits[key]?.motivo_problema ?? g.motivo,
                      laboratorio: edits[key]?.laboratorio ?? g.laboratorio,
                    } })} />
                </Fila>
              )
            })}
          </Seccion>

          <div className="flex justify-center pt-2">
            <button onClick={cargar} className="text-xs text-zinc-500 hover:text-zinc-800 underline">Recargar pendientes</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function PendientesPage() {
  return <RequireRol roles={['administrador']}><PendientesInner /></RequireRol>
}
