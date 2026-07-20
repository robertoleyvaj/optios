'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/hooks/useSession'
import {
  Plus, Search, X, Save, ChevronDown, ChevronLeft, Filter,
  Clock, CheckCircle2, AlertTriangle, Truck,
  Package, Eye, Phone, Calendar, FileText,
  ArrowRight, Printer, Link2, User, DollarSign,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'
import { getSucursalActual } from '@/lib/session'
import { hoyLocal, hoyMasDias } from '@/lib/fecha'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type EstadoOrden =
  | 'recibido'
  | 'en_laboratorio'
  | 'en_camino'
  | 'en_sucursal'
  | 'listo'
  | 'entregado'
  | 'problema'

type Tratamiento = 'ninguno' | 'tinte' | 'fotocromatico' | 'polarizado'

type OrdenLab = {
  id: number
  supabaseId: string   // UUID real en Supabase ('' en mock)
  folio: string
  folioVenta: string   // vínculo con venta
  pacienteId: string   // vínculo directo con expediente
  paciente: string
  telefono: string
  sucursal: string
  laboratorio: string
  tipoMica: string
  armazon: 'propio' | 'comprado'
  descripcionArmazon: string
  od: string
  oi: string
  add: string
  dp: string
  altura: string           // altura de montaje (progresivos/bifocales)
  tratamiento: Tratamiento
  colorTratamiento: string // para tinte o polarizado
  urgente: boolean
  fechaIngreso: string
  fechaPromesa: string
  fechaEntrega: string
  fechaEnvioLab: string    // cuando Sergio lo dejó en el lab
  fechaRecogidaLab: string // cuando Sergio lo recogió del lab
  pagadoLab: boolean                              // si ya se pagó al laboratorio
  fechaPagoLab: string                            // cuándo se pagó
  metodoPagoLab: 'transferencia' | 'efectivo' | '' // cómo se pagó
  estado: EstadoOrden
  costoLab: number
  precioCliente: number
  anticipo: number
  notas: string
  creadoPor: string            // quién registró la orden
  // Rastreo extendido
  verificado: boolean         // lente revisado al llegar a la óptica
  verificadoPor: string       // quién lo revisó
  fechaVerificacion: string   // cuándo se revisó
  notasVerificacion: string   // qué se revisó / problema encontrado
  motivoRetraso: string       // por qué se retrasó (si aplica)
  // Garantía
  folioOrigen: string         // folio de la orden original (solo en garantías)
  esGarantia: boolean         // true = orden de reposición por garantía
  motivoProblema: string      // motivo del problema al verificar
  archivado: boolean          // true = repartidor ya recogió la orden problema
}

type HistorialItem = {
  id: string
  created_at: string
  evento: 'estado' | 'contacto' | 'verificacion' | 'nota'
  estado_antes?: string
  estado_despues?: string
  canal?: string
  resultado?: string
  notas?: string
  registrado_por?: string
}

// ─────────────────────────────────────────
// Tipo para venta vinculada (real)
// ─────────────────────────────────────────
type VentaRef = {
  folio: string
  pacienteId: string
  paciente: string
  telefono: string
  sucursal: string
  od: string
  oi: string
  add: string
  dp: string
  armazon: string
}

// ─────────────────────────────────────────
// Config estados
// ─────────────────────────────────────────
const ESTADO_CONFIG: Record<EstadoOrden, { label: string; bg: string; text: string; dot: string; icon: React.ElementType }> = {
  recibido:       { label: 'Pendiente',     bg: 'bg-zinc-100',    text: 'text-zinc-600',   dot: '#94A3B8', icon: Package },
  en_laboratorio: { label: 'En laboratorio',bg: 'bg-violet-50',   text: 'text-violet-700', dot: '#7C3AED', icon: Clock },
  en_camino:      { label: 'En camino',     bg: 'bg-teal-50',     text: 'text-teal-700',   dot: '#0D9488', icon: Truck },
  en_sucursal:    { label: 'Por verificar', bg: 'bg-amber-50',    text: 'text-amber-700',  dot: '#F59E0B', icon: Package },
  listo:          { label: 'Listo',         bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: '#10B981', icon: CheckCircle2 },
  entregado:      { label: 'Entregado',     bg: 'bg-zinc-100',    text: 'text-zinc-400',   dot: '#CBD5E1', icon: CheckCircle2 },
  problema:       { label: 'Con problema',  bg: 'bg-red-50',      text: 'text-red-600',    dot: '#EF4444', icon: AlertTriangle },
}

const FLUJO: EstadoOrden[] = ['recibido', 'en_laboratorio', 'en_camino', 'en_sucursal', 'listo', 'entregado']

const TIPOS_MICA = [
  'Monofocal blanca',
  'Monofocal antirreflejante',
  'Monofocal transitions',
  'Progresiva estándar',
  'Progresiva antirreflejante',
  'Progresiva transitions',
  'Bifocal',
  'Lentes de contacto blandos',
  'Lentes de contacto rígidos',
]

const LABORATORIOS = ['Karen', 'Indigo', 'Tecnolab', 'Richardson', 'Exce Lentes', 'El Nuevo']
const SUCURSALES   = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

const dias = (n: number) => hoyMasDias(n)

const formVacio = (sucursalDefault = 'Baja Visión'): Omit<OrdenLab, 'id' | 'folio'> => ({
  supabaseId: '',
  folioVenta: '', pacienteId: '', paciente: '', telefono: '', sucursal: sucursalDefault,
  laboratorio: 'Laboratorio Visión', tipoMica: 'Monofocal antirreflejante',
  armazon: 'comprado', descripcionArmazon: '',
  od: '', oi: '', add: '', dp: '', altura: '', tratamiento: 'ninguno', colorTratamiento: '', urgente: false,
  fechaIngreso: dias(0), fechaPromesa: dias(7), fechaEntrega: '',
  fechaEnvioLab: '', fechaRecogidaLab: '',
  pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const,
  estado: 'recibido', costoLab: 0, precioCliente: 0, anticipo: 0, notas: '', creadoPor: '',
  verificado: false, verificadoPor: '', fechaVerificacion: '', notasVerificacion: '', motivoRetraso: '',
  folioOrigen: '', esGarantia: false, motivoProblema: '', archivado: false,
})

function diasRestantes(fecha: string) {
  if (!fecha) return null
  return Math.round((new Date(fecha).getTime() - Date.now()) / 86400000)
}

// ─────────────────────────────────────────
// Componente: buscador de venta
// ─────────────────────────────────────────
function BuscadorVenta({ onSelect }: { onSelect: (v: VentaRef) => void }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<VentaRef[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 2) { setResultados([]); return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { data } = await createClient()
        .from('ventas')
        .select('folio, sucursal, paciente_id, pacientes(nombre, apellido, telefono)')
        .ilike('folio', `%${query}%`)
        .eq('estado', 'activa')
        .limit(5)
      if (data) {
        setResultados(data.map((v: Record<string, unknown>) => {
          const p = v.pacientes as { nombre?: string; apellido?: string; telefono?: string } | null
          return {
            folio:      v.folio as string,
            sucursal:   v.sucursal as string,
            pacienteId: (v.paciente_id as string) ?? '',
            paciente:   p ? `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim() : '',
            telefono:   p?.telefono ?? '',
            od: '', oi: '', add: '', dp: '', armazon: '',
          }
        }))
      }
    }, 200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full border border-zinc-200 rounded pl-9 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          placeholder="Buscar por folio (V-0041) o nombre de paciente..."
        />
      </div>
      {open && query.length > 1 && resultados.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden">
          {resultados.map(v => (
            <button key={v.folio}
              onClick={() => { onSelect(v); setQuery(''); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-zinc-100 transition-colors flex items-center gap-3 border-b border-zinc-50 last:border-0">
              <div className="w-8 h-8 rounded bg-[#0B0E14] flex items-center justify-center flex-shrink-0">
                <Link2 className="w-3.5 h-3.5 text-[#0D9488]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-zinc-500">{v.folio}</span>
                  <span className="text-sm font-semibold text-zinc-700">{v.paciente}</span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{v.sucursal} · {v.telefono}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Componente: modal de impresión
// ─────────────────────────────────────────
const TRATAMIENTO_LABEL: Record<string, string> = {
  ninguno:      '',
  tinte:        'Tinte',
  fotocromatico:'Fotocromático',
  polarizado:   'Polarizado',
}

function parseGrad(grad: string) {
  // Soporta "esf cil eje", "esf / cil / eje°", o "esf/cil/eje"
  const parts = grad.trim().split(/\s*\/\s*|\s+/).map(p => p.replace(/°$/, '').trim()).filter(p => p && p !== '/')
  return { esf: parts[0] || '—', cil: parts[1] || '—', eje: parts[2] || '—' }
}

function PrintModal({ orden, onClose }: { orden: OrdenLab; onClose: () => void }) {
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const tratLabel = TRATAMIENTO_LABEL[orden.tratamiento] || ''
  const tratFull  = tratLabel
    ? (orden.colorTratamiento ? `${tratLabel} ${orden.colorTratamiento}` : tratLabel)
    : ''

  const handlePrint = () => {
    const od = parseGrad(orden.od)
    const oi = parseGrad(orden.oi)

    // Filas opcionales de la tabla de graduación
    const addRow    = orden.add    ? `<tr><td class="lbl">ADD</td><td class="val" colspan="3">${orden.add}</td><td></td></tr>` : ''
    const alturaRow = orden.altura ? `<tr><td class="lbl">Alt.</td><td class="val" colspan="3">${orden.altura} mm</td><td></td></tr>` : ''
    const dpRow     = `<tr><td class="lbl">D.P.</td><td class="val" colspan="3">${orden.dp} mm</td><td></td></tr>`
    const tratRow   = tratFull     ? `<tr><td class="lbl">Trat.</td><td class="val" colspan="3" style="font-weight:700">${tratFull}</td><td></td></tr>` : ''

    const armazonStr = orden.descripcionArmazon
      ? `${orden.descripcionArmazon} · ${orden.armazon === 'propio' ? 'del cliente' : 'comprado'}`
      : (orden.armazon === 'propio' ? 'Armazón del cliente' : '—')

    const notasHtml = orden.notas
      ? `<div style="border-top:1px dashed #ccc;padding:6px 0;font-size:9px;color:#555"><b>Obs:</b> ${orden.notas}</div>`
      : ''

    const garantiaHtml = orden.esGarantia
      ? `<div style="background:#7C3AED;color:#fff;text-align:center;font-size:13px;font-weight:900;letter-spacing:2px;padding:6px 0;margin-bottom:8px;border-radius:3px;">🔄 GARANTÍA</div>`
      : ''

    const motivoHtml = orden.esGarantia && orden.motivoProblema
      ? `<div style="border-top:1px dashed #ccc;margin-top:8px;padding-top:6px;font-size:9px;color:#555">
           <b>Motivo de reposición:</b> ${orden.motivoProblema}
           ${orden.folioOrigen ? `<br/><span style="color:#aaa">Orden original: ${orden.folioOrigen}</span>` : ''}
         </div>`
      : ''

    const win = window.open('', '_blank', 'width=420,height=640')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${orden.folio}</title>
<style>
  @page { size: 4in 6in; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #000; width: 100%; }
  .hdr { display: flex; justify-content: space-between; align-items: center; background: #111; color: #fff; padding: 8px 10px; border-radius: 4px; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hdr-left h1 { font-size: 14px; font-weight: 900; letter-spacing: -0.3px; color: #fff; }
  .hdr-left p { font-size: 9px; color: #aaa; }
  .hdr-right { text-align: right; }
  .folio { font-size: 15px; font-weight: 900; font-family: monospace; color: #4DB6AC; }
  .fecha { font-size: 9px; color: #aaa; }
  .paciente { font-size: 14px; font-weight: 900; margin-bottom: 1px; }
  .sucursal { font-size: 9px; color: #777; margin-bottom: 8px; }
  .sep { border: none; border-top: 1px dashed #bbb; margin: 7px 0; }
  .grad-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .grad-table th { background: #f0f0f0; font-size: 9px; font-weight: 700; text-align: center; padding: 4px 3px; border: 1px solid #ccc; }
  .grad-table th:first-child { text-align: left; }
  .grad-table td { border: 1px solid #ddd; padding: 4px 3px; font-family: monospace; font-size: 10px; }
  .lbl { font-weight: 700; font-family: sans-serif; font-size: 9px; background: #f8f8f8; }
  .val { text-align: center; }
  .mica-box { background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px; padding: 5px 7px; margin-bottom: 6px; }
  .mica-tipo { font-size: 12px; font-weight: 900; }
  .mica-sub  { font-size: 9px; color: #444; margin-top: 1px; }
  .armazon   { font-size: 10px; color: #333; margin-bottom: 6px; }
  .meta { display: flex; justify-content: space-between; font-size: 9px; color: #555; margin-bottom: 6px; }
  .firma-area { border-top: 1px solid #000; margin-top: 10px; padding-top: 4px; text-align: right; font-size: 9px; color: #777; }
  .folio-ref { font-size: 9px; font-family: monospace; color: #555; }
</style></head><body>
  ${garantiaHtml}
  ${orden.urgente ? `<div style="background:#000;color:#fff;text-align:center;font-size:22px;font-weight:900;letter-spacing:3px;padding:7px 0;margin-bottom:8px;border-radius:3px;">⚡ URGENTE</div>` : ''}

  <div class="hdr">
    <div class="hdr-left">
      <h1>${SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea1 ?? orden.sucursal}</h1>
      <p>${SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea2 ? SUCURSAL_CONFIG[orden.sucursal].nombreLinea2 + ' · ' : ''}Orden de laboratorio</p>
    </div>
    <div class="hdr-right">
      <div class="folio">${orden.folio}</div>
      <div class="fecha">${fecha}</div>
    </div>
  </div>

  <div class="paciente">${orden.paciente}</div>
  <div class="sucursal">${orden.sucursal}</div>
  <hr class="sep">

  <table class="grad-table">
    <thead><tr>
      <th></th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>ADD</th>
    </tr></thead>
    <tbody>
      <tr><td class="lbl">OD</td><td class="val">${od.esf}</td><td class="val">${od.cil}</td><td class="val">${od.eje !== '—' ? od.eje+'°' : '—'}</td><td class="val">${orden.add || '—'}</td></tr>
      <tr><td class="lbl">OI</td><td class="val">${oi.esf}</td><td class="val">${oi.cil}</td><td class="val">${oi.eje !== '—' ? oi.eje+'°' : '—'}</td><td class="val">${orden.add || '—'}</td></tr>
      ${dpRow}${alturaRow}${tratRow}
    </tbody>
  </table>

  <hr class="sep">

  <div class="mica-box">
    <div class="mica-tipo">${orden.tipoMica}</div>
    ${tratFull ? `<div class="mica-sub">Tratamiento: <b>${tratFull}</b></div>` : ''}
  </div>

  <div class="armazon"><b>Armazón:</b> ${armazonStr}</div>

  ${notasHtml}
  ${motivoHtml}

  <div class="meta">
    <span>Ingreso: <b>${orden.fechaIngreso}</b></span>
    <span>Entrega: <b>${orden.fechaPromesa}</b></span>
  </div>

  <div class="firma-area">Recibido por: _________________________</div>
</body></html>`)
    win.document.close()
    setTimeout(() => { win.print() }, 300)
  }

  const od = parseGrad(orden.od)
  const oi = parseGrad(orden.oi)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header fijo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-zinc-700">Vista previa — {orden.folio}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{orden.paciente} · {orden.sucursal}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-[#1A1D27] transition-colors">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></button>
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Vista previa de la hoja 4×6" */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Vista previa · Hoja 4×6&quot; (térmica)</p>
              <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5">100 × 150 mm</span>
            </div>
            <div className="border border-zinc-200 rounded-lg overflow-hidden text-sm">
              {/* Banner urgente */}
              {orden.urgente && (
                <div className="bg-black text-white text-center text-sm font-black tracking-widest py-2">
                  ⚡ URGENTE
                </div>
              )}
              {/* Header */}
              <div className="bg-[#0B0E14] px-5 py-4 flex justify-between items-start">
                <div>
                  <p className="text-white font-bold text-base">{SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea1 ?? orden.sucursal}</p>
                  {SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea2 && (
                    <p className="text-white/70 text-xs">{SUCURSAL_CONFIG[orden.sucursal].nombreLinea2}</p>
                  )}
                  <p className="text-white/60 text-xs">Orden de laboratorio</p>
                </div>
                <div className="text-right">
                  <p className="text-[#0D9488] font-mono font-bold">{orden.folio}</p>
                  <p className="text-white/60 text-xs">{fecha}</p>
                </div>
              </div>

              <div className="p-5 grid grid-cols-2 gap-6">
                {/* Columna izquierda */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Paciente</p>
                    <p className="font-bold text-zinc-800">{orden.paciente}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Sucursal</p>
                    <p className="text-zinc-700">{orden.sucursal}</p>
                  </div>
                  {orden.folioVenta && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 mb-1">Ref. venta</p>
                      <p className="font-mono text-xs text-zinc-500">{orden.folioVenta}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Tipo de mica</p>
                    <p className="font-bold text-zinc-800">{orden.tipoMica}</p>
                    {tratFull && <p className="text-xs text-zinc-600 mt-0.5 font-semibold">{tratFull}</p>}
                  </div>
                  {orden.descripcionArmazon && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 mb-1">Armazón</p>
                      <p className="text-zinc-700">{orden.descripcionArmazon}</p>
                      <p className="text-xs text-zinc-400">{orden.armazon === 'propio' ? 'Del cliente' : 'Comprado en tienda'}</p>
                    </div>
                  )}
                </div>

                {/* Columna derecha: graduación */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-2">Graduación</p>
                  <table className="w-full text-xs border border-zinc-200 rounded overflow-hidden">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-zinc-500 font-semibold"></th>
                        <th className="text-center px-2 py-2 text-zinc-500 font-semibold">Esf</th>
                        <th className="text-center px-2 py-2 text-zinc-500 font-semibold">Cil</th>
                        <th className="text-center px-2 py-2 text-zinc-500 font-semibold">Eje</th>
                        {orden.add && <th className="text-center px-2 py-2 text-zinc-500 font-semibold">ADD</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {[
                        { label: 'OD', grad: orden.od },
                        { label: 'OI', grad: orden.oi },
                      ].map(r => {
                        const g = parseGrad(r.grad)
                        return (
                          <tr key={r.label}>
                            <td className="px-3 py-2 font-bold text-zinc-600">{r.label}</td>
                            <td className="text-center px-2 py-2 font-mono text-zinc-800">{g.esf}</td>
                            <td className="text-center px-2 py-2 font-mono text-zinc-800">{g.cil}</td>
                            <td className="text-center px-2 py-2 font-mono text-zinc-800">{g.eje}°</td>
                            {orden.add && <td className="text-center px-2 py-2 font-mono text-zinc-800">{orden.add}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600">
                    <span><span className="font-semibold">D.P.:</span> {orden.dp} mm</span>
                    {orden.altura && <span><span className="font-semibold">Altura:</span> {orden.altura} mm</span>}
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="border-t border-zinc-200 px-5 py-3 bg-zinc-50 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-zinc-400">Fecha de ingreso</p>
                  <p className="text-zinc-700 mt-0.5">{orden.fechaIngreso}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-400">Fecha promesa</p>
                  <p className="text-zinc-700 mt-0.5 font-semibold">{orden.fechaPromesa}</p>
                </div>
              </div>

              {orden.notas && (
                <div className="border-t border-zinc-200 px-5 py-3 text-xs text-zinc-600">
                  <span className="font-semibold text-zinc-400">Observaciones: </span>{orden.notas}
                </div>
              )}

              {/* Footer firma */}
              <div className="border-t border-zinc-200 px-5 py-4 flex justify-end">
                <div className="text-center text-xs text-zinc-400">
                  <div className="border-t border-zinc-300 w-48 mb-1"></div>
                  Recibido por / firma
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente fuera del árbol para que React no lo desmonte en cada render
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-200 last:border-0">
      <span className="text-sm text-zinc-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function VistaRepartidor({ ordenes, onUpdate }: {
  ordenes: OrdenLab[]
  onUpdate: (id: number, changes: Partial<OrdenLab>) => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [llevandoDraft, setLlevandoDraft] = useState<{
    laboratorio: string
    fechaPromesa: string
    notas: string
  }>({ laboratorio: '', fechaPromesa: '', notas: '' })
  const [recogendoDraft, setRecogendoDraft] = useState<{
    costoLab: string
    metodoPagoLab: 'transferencia' | 'efectivo' | ''
  }>({ costoLab: '', metodoPagoLab: '' })
  // Sergio solo ve las órdenes que todavía requieren su acción
  const lista = ordenes
    .filter(o => !['entregado', 'problema', 'en_sucursal', 'listo'].includes(o.estado) && !o.archivado)
    .sort((a, b) => (a.fechaIngreso ?? '').localeCompare(b.fechaIngreso ?? '') || a.folio.localeCompare(b.folio))

  // Órdenes problema: el vendedor marcó un defecto, Sergio debe recogerlas y llevarlas de vuelta al lab
  const problemaList = ordenes
    .filter(o => o.estado === 'problema' && !o.archivado)
    .sort((a, b) => a.folio.localeCompare(b.folio))

  const BADGE: Record<string, { bg: string; text: string; label: string }> = {
    recibido:       { bg: 'bg-zinc-100',   text: 'text-zinc-600',   label: 'Pendiente'      },
    en_laboratorio: { bg: 'bg-violet-50',  text: 'text-violet-700', label: 'En laboratorio' },
    en_camino:      { bg: 'bg-teal-50',    text: 'text-teal-700',   label: 'En camino'      },
    en_sucursal:    { bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Por verificar'  },
  }

  const DOT: Record<string, string> = {
    recibido: 'bg-zinc-400', en_laboratorio: 'bg-violet-500',
    en_camino: 'bg-teal-500', en_sucursal: 'bg-amber-500',
  }

  const openOrder = (id: number) => {
    const o = lista.find(x => x.id === id)
    setSelectedId(id)
    setLlevandoDraft({
      laboratorio: o?.laboratorio ?? '',
      fechaPromesa: o?.fechaPromesa ?? '',
      notas: o?.notas ?? '',
    })
    setRecogendoDraft({
      costoLab: o && o.costoLab > 0 ? String(o.costoLab) : '',
      metodoPagoLab: o?.metodoPagoLab ?? '',
    })
  }

  const selected = lista.find(o => o.id === selectedId) ?? null

  // ── Vista "Regresar al lab" — órdenes problema ────────────
  if (selected && selected.estado === 'problema') {
    const o = selected
    return (
      <div className="max-w-sm mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedId(null)}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600">
            <ChevronLeft className="w-4 h-4" /> Órdenes
          </button>
          <span className="text-sm font-bold text-zinc-500">{o.folio}</span>
          <div className="w-20" />
        </div>

        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="h-1 bg-red-400" />
          <div className="px-4 pt-4 pb-3 border-b border-zinc-200">
            <p className="text-lg font-bold text-zinc-800">{o.paciente}</p>
            <p className="text-sm text-zinc-400 mt-0.5">
              {o.tipoMica}{o.descripcionArmazon ? ` · ${o.descripcionArmazon}` : ''}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{o.sucursal} · {o.laboratorio}</p>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Lente llegó con problema
            </div>
            {o.motivoProblema && (
              <p className="text-xs text-zinc-500 mt-2 px-1"><b>Motivo:</b> {o.motivoProblema}</p>
            )}
            <p className="text-xs text-zinc-400 mt-3">Recoge el lente de la óptica y regresa al laboratorio para reposición.</p>
          </div>
        </div>

        <button
          onClick={() => {
            onUpdate(o.id, { archivado: true })
            setSelectedId(null)
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors"
        >
          <ArrowRight className="w-4 h-4" /> Ya lo recogí y lo llevé al lab
        </button>
      </div>
    )
  }

  // ── Vista "Llevar al lab" — órdenes recibido ──────────────
  if (selected && selected.estado === 'recibido') {
    const o = selected
    return (
      <div className="max-w-sm mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedId(null)}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600">
            <ChevronLeft className="w-4 h-4" /> Órdenes
          </button>
          <span className="text-sm font-bold text-zinc-500">{o.folio}</span>
          <div className="w-20" />
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-zinc-200">
            <p className="text-lg font-bold text-zinc-800">{o.paciente}</p>
            <p className="text-sm text-zinc-400 mt-0.5">
              {o.tipoMica}{o.descripcionArmazon ? ` · ${o.descripcionArmazon}` : ''}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{o.sucursal}</p>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Laboratorio</label>
              <select value={llevandoDraft.laboratorio}
                onChange={e => setLlevandoDraft(d => ({ ...d, laboratorio: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-[#0D9488]">
                <option value="">Sin asignar</option>
                {LABORATORIOS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">¿Cuándo estará listo?</label>
              <input type="date" value={llevandoDraft.fechaPromesa}
                onChange={e => setLlevandoDraft(d => ({ ...d, fechaPromesa: e.target.value }))}
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-[#0D9488] w-48" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Observaciones</label>
              <textarea value={llevandoDraft.notas} rows={2} placeholder="—"
                onChange={e => setLlevandoDraft(d => ({ ...d, notas: e.target.value.toUpperCase() }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-[#0D9488] resize-none uppercase placeholder:normal-case" />
            </div>
          </div>
        </div>

        {!llevandoDraft.laboratorio && (
          <p className="text-xs text-center text-red-500 font-medium -mb-1">Selecciona el laboratorio antes de continuar</p>
        )}
        <button
          disabled={!llevandoDraft.laboratorio}
          onClick={() => {
            onUpdate(o.id, {
              estado: 'en_laboratorio',
              laboratorio: llevandoDraft.laboratorio,
              fechaPromesa: llevandoDraft.fechaPromesa,
              notas: llevandoDraft.notas,
              fechaEnvioLab: hoyLocal(),
            })
            setSelectedId(null)
          }}
          className={`w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-colors ${
            llevandoDraft.laboratorio
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
        >
          <ArrowRight className="w-4 h-4" /> Ya lo dejé en el laboratorio
        </button>
      </div>
    )
  }

  // ── Vista "Recoger del lab" — órdenes en_laboratorio ──────
  if (selected && selected.estado === 'en_laboratorio') {
    const o = selected
    const hoy = hoyLocal()
    const listaHoy = o.fechaPromesa === hoy
    return (
      <div className="max-w-sm mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => { setSelectedId(null) }}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600">
            <ChevronLeft className="w-4 h-4" /> Órdenes
          </button>
          <span className="text-sm font-bold text-zinc-500">{o.folio}</span>
          <div className="w-20" />
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-zinc-200">
            <p className="text-lg font-bold text-zinc-800">{o.paciente}</p>
            <p className="text-sm text-zinc-400 mt-0.5">
              {o.tipoMica}{o.descripcionArmazon ? ` · ${o.descripcionArmazon}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-zinc-400">{o.sucursal}</span>
              {o.laboratorio && <span className="text-xs text-indigo-600 font-semibold">· {o.laboratorio}</span>}
              {o.fechaPromesa && (
                <span className={`text-xs font-semibold ${listaHoy ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  · {listaHoy ? 'Listo hoy' : `Listo el ${o.fechaPromesa.replace(/^\d{4}-/, '').replace('-', '/')}`}
                </span>
              )}
            </div>
          </div>

          {o.notas && (
            <div className="px-4 py-3 border-b border-zinc-200">
              <p className="text-xs text-zinc-400 font-semibold mb-1">Observaciones</p>
              <p className="text-sm text-zinc-600">{o.notas}</p>
            </div>
          )}

          <div className="px-4 py-4 space-y-4">
            <p className="text-xs text-zinc-400">Registra lo que cobró el laboratorio:</p>

            {/* Monto + botón Pagado en la misma fila */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">¿Cuánto cobró el lab?</label>
              <div className="flex gap-2 items-center">
                <input type="number" placeholder="$0" value={recogendoDraft.costoLab}
                  onChange={e => setRecogendoDraft(d => ({ ...d, costoLab: e.target.value }))}
                  className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-[#0D9488] w-36" />
                {/* Botón Pagado — guarda sin cambiar estado */}
                {o.pagadoLab ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                    <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>
                    Pagado
                  </span>
                ) : (
                  <button
                    disabled={!recogendoDraft.costoLab || !recogendoDraft.metodoPagoLab}
                    onClick={() => {
                      onUpdate(o.id, {
                        costoLab:      Number(recogendoDraft.costoLab),
                        metodoPagoLab: recogendoDraft.metodoPagoLab,
                        pagadoLab:     true,
                        fechaPagoLab:  hoyLocal(),
                      })
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-bold border transition-colors bg-emerald-600 text-white disabled:opacity-30 disabled:cursor-not-allowed">
                    Pagado
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">¿Cómo pagaste?</label>
              <div className="flex gap-2">
                {([
                  { v: '' as const,              label: 'Sin pagar'     },
                  { v: 'efectivo' as const,      label: 'Efectivo'      },
                  { v: 'transferencia' as const, label: 'Transferencia' },
                ]).map(m => (
                  <button key={m.v}
                    onClick={() => setRecogendoDraft(d => ({ ...d, metodoPagoLab: m.v }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      recogendoDraft.metodoPagoLab === m.v
                        ? 'bg-[#0B0E14] text-white border-[#0B0E14]'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {!o.pagadoLab && (
          <p className="text-xs text-center text-red-500 font-medium -mb-1">
            Primero marca como Pagado antes de continuar
          </p>
        )}
        <button
          disabled={!o.pagadoLab}
          onClick={() => {
            onUpdate(o.id, {
              estado: 'en_camino',
              costoLab:      Number(recogendoDraft.costoLab) || 0,
              metodoPagoLab: recogendoDraft.metodoPagoLab,
              pagadoLab:     true,
              fechaRecogidaLab: hoyLocal(),
            })
            setSelectedId(null)
          }}
          className={`w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-colors ${
            o.pagadoLab
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
        >
          <Truck className="w-4 h-4" /> Ya lo recogí, voy en camino a la óptica
        </button>
      </div>
    )
  }

  // ── Vista "Entregar en sucursal" — órdenes en_camino ─────
  if (selected && selected.estado === 'en_camino') {
    const o = selected
    return (
      <div className="max-w-sm mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => { setSelectedId(null) }}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600">
            <ChevronLeft className="w-4 h-4" /> Órdenes
          </button>
          <span className="text-sm font-bold text-zinc-500">{o.folio}</span>
          <div className="w-20" />
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-zinc-200">
            <p className="text-lg font-bold text-zinc-800">{o.paciente}</p>
            <p className="text-sm text-zinc-400 mt-0.5">
              {o.tipoMica}{o.descripcionArmazon ? ` · ${o.descripcionArmazon}` : ''}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{o.sucursal} · {o.laboratorio}</p>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-2.5 text-sm font-medium">
              <Truck className="w-4 h-4 flex-shrink-0" />
              En camino a la óptica
            </div>
            <p className="text-xs text-zinc-400 mt-3">Cuando llegues a la sucursal y entregues el lente, marca la entrega:</p>
          </div>
        </div>

        <button
          onClick={() => {
            onUpdate(o.id, { estado: 'en_sucursal' })
            setSelectedId(null)
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
        >
          <Package className="w-4 h-4" /> Ya lo entregué en la óptica
        </button>
      </div>
    )
  }

  // ── Lista por secciones ────────────────────────────────────
  const porLlevarList = lista.filter(o => o.estado === 'recibido')
  const enLabList     = lista.filter(o => o.estado === 'en_laboratorio')
  const enCaminoList  = lista.filter(o => o.estado === 'en_camino')
  const hoy           = hoyLocal()
  const sinPagarCount = lista.filter(o => o.costoLab > 0 && !o.pagadoLab).length

  const OrdenRow = ({ o }: { o: OrdenLab }) => {
    const sinPagar  = o.costoLab > 0 && !o.pagadoLab
    const listaHoy  = o.fechaPromesa === hoy
    const accionLabel =
      o.estado === 'recibido'       ? 'Llevar al lab →' :
      o.estado === 'en_laboratorio' ? 'Recoger →' :
      o.estado === 'en_camino'      ? 'Entregar →' : ''

    return (
      <button onClick={() => openOrder(o.id)}
        className="w-full flex items-stretch hover:bg-zinc-100 transition-colors text-left">
        <div className="flex items-center pl-4 pr-3">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[o.estado]}`} />
        </div>
        <div className="flex-1 py-3.5 pr-4 min-w-0 border-l border-zinc-200">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-bold text-zinc-400">{o.folio}</span>
            <span className="text-xs font-semibold text-zinc-400">
              {accionLabel}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-800 leading-tight">
            {o.paciente}
            {o.urgente && <span className="ml-1 text-red-500 text-xs">⚡</span>}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-400">{o.sucursal}</span>
            {o.laboratorio && <span className="text-xs text-violet-600">· {o.laboratorio}</span>}
            {o.fechaPromesa && (
              <span className={`text-xs font-semibold ${listaHoy ? 'text-emerald-600' : 'text-zinc-400'}`}>
                · {listaHoy ? 'Hoy' : o.fechaPromesa.replace(/^\d{4}-/, '').replace('-', '/')}
              </span>
            )}
            {sinPagar && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 ml-auto">Sin pagar</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">

      {lista.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">Todo al día</p>
          <p className="text-xs text-zinc-400 mt-1">Sin órdenes pendientes</p>
        </div>
      )}

      {/* Por llevar */}
      {porLlevarList.length > 0 && (
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-400 inline-block" />
            Por llevar · {porLlevarList.length}
          </p>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
            {porLlevarList.map(o => <OrdenRow key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {/* En laboratorio */}
      {enLabList.length > 0 && (
        <div>
          <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
            En laboratorio · {enLabList.length}
          </p>
          <div className="bg-white rounded-xl border border-violet-100 overflow-hidden divide-y divide-zinc-100">
            {enLabList.map(o => <OrdenRow key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {/* En camino */}
      {enCaminoList.length > 0 && (
        <div>
          <p className="text-xs font-bold text-teal-600 uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
            En camino · {enCaminoList.length}
          </p>
          <div className="bg-white rounded-xl border border-teal-100 overflow-hidden divide-y divide-zinc-100">
            {enCaminoList.map(o => <OrdenRow key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {/* Regresar al lab (problema) */}
      {problemaList.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Regresar al lab · {problemaList.length}
          </p>
          <div className="bg-white rounded-xl border border-red-100 overflow-hidden divide-y divide-zinc-100">
            {problemaList.map(o => (
              <button key={o.id} onClick={() => openOrder(o.id)}
                className="w-full flex items-stretch hover:bg-red-50 transition-colors text-left">
                <div className="flex items-center pl-4 pr-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-400" />
                </div>
                <div className="flex-1 py-3.5 pr-4 min-w-0 border-l border-zinc-200">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-zinc-400">{o.folio}</span>
                    <span className="text-xs font-semibold text-red-500">Regresar al lab →</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 leading-tight">{o.paciente}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-400">{o.sucursal}</span>
                    {o.laboratorio && <span className="text-xs text-violet-600">· {o.laboratorio}</span>}
                    {o.motivoProblema && (
                      <span className="text-xs text-red-400 truncate">· {o.motivoProblema}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sin pagar */}
      {sinPagarCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <DollarSign className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-semibold">
            {sinPagarCount} {sinPagarCount === 1 ? 'orden pendiente' : 'órdenes pendientes'} de pago al laboratorio
          </p>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────
// Vista simplificada para vendedor
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// Modal: Ficha completa de ciclo de vida
// ─────────────────────────────────────────
function VistaVendedor({ ordenes, sucursal, rol, onPrint, onUpdate, onProblema, onNuevaOrden }: {
  ordenes: OrdenLab[]
  sucursal: string
  rol: string
  onPrint: (o: OrdenLab) => void
  onUpdate: (id: number, changes: Partial<OrdenLab>) => void
  onProblema: (original: OrdenLab, motivo: string) => void
  onNuevaOrden: () => void
}) {
  const [busquedaLocal, setBusquedaLocal] = useState('')

  const pendientes = ordenes
    .filter(o => {
      const matchSucursal = sucursal === 'Todas' || o.sucursal === sucursal
      const matchEstado   = o.estado !== 'entregado' && !o.archivado
      const q = busquedaLocal.toLowerCase().trim()
      const matchBusqueda = !q ||
        o.paciente.toLowerCase().includes(q) ||
        o.folio.toLowerCase().includes(q) ||
        o.tipoMica.toLowerCase().includes(q)
      return matchSucursal && matchEstado && matchBusqueda
    })
    .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso)) // más recientes primero

  const listos   = pendientes.filter(o => o.estado === 'listo')
  const enCamino = pendientes.filter(o => o.estado === 'en_camino')
  const otros    = pendientes.filter(o => !['listo', 'en_camino', 'entregado'].includes(o.estado))
  const problemas = pendientes.filter(o => o.estado === 'problema')

  const EntregaCard = ({ o }: { o: OrdenLab }) => {
    const [showProblema, setShowProblema] = useState(false)
    const [motivoInput, setMotivoInput]   = useState('')

    const cfg = ESTADO_CONFIG[o.estado] ?? ESTADO_CONFIG['recibido']
    const Icon = cfg.icon
    const dr = diasRestantes(o.fechaPromesa)
    const vencida = dr !== null && dr < 0

    const borderColor =
      o.estado === 'listo'    ? 'border-emerald-200 hover:border-emerald-300' :
      o.estado === 'problema' ? 'border-red-200 hover:border-red-300' :
      o.esGarantia            ? 'border-purple-200 hover:border-purple-300' :
      vencida                 ? 'border-amber-200 hover:border-amber-300' : 'border-zinc-200 hover:border-zinc-300'

    return (
      <div className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer ${borderColor}`}>
        {/* Banda de color */}
        {o.estado === 'listo'    && <div className="h-1 bg-emerald-400" />}
        {o.estado === 'problema' && <div className="h-1 bg-red-400" />}
        {o.esGarantia && o.estado !== 'problema' && <div className="h-1 bg-purple-400" />}
        {vencida && !['listo','problema'].includes(o.estado) && !o.esGarantia && <div className="h-1 bg-amber-400" />}

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-bold text-zinc-800">{o.paciente}</p>
                {o.esGarantia && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded uppercase tracking-wide">Garantía</span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{o.telefono} · {o.folio}</p>
              {o.folioOrigen && (
                <p className="text-xs text-purple-400 flex items-center gap-1 mt-0.5">
                  <Link2 className="w-2.5 h-2.5" /> Repone {o.folioOrigen}
                </p>
              )}
              {o.folioVenta && !o.folioOrigen && (
                <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Link2 className="w-2.5 h-2.5" /> {o.folioVenta}
                </p>
              )}
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
          </div>

          {/* Mica + promesa */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-600 font-medium">
              {o.urgente && <span className="text-xs font-black text-black mr-1.5">⚡ URGENTE ·</span>}
              {o.tipoMica}
            </span>
            <span className={`${vencida ? 'text-red-500 font-semibold' : dr === 0 ? 'text-amber-500 font-semibold' : dr !== null && dr <= 2 ? 'text-amber-500' : 'text-zinc-400'}`}>
              {dr === null ? '' : vencida ? `Venció hace ${Math.abs(dr)}d` : dr === 0 ? 'Hoy' : `${dr} días`}
              {o.fechaPromesa ? ` · ${o.fechaPromesa}` : ''}
            </span>
          </div>

          {/* Motivo problema (garantías y problemas) */}
          {o.motivoProblema && (
            <div className="flex items-start gap-2 bg-red-50 rounded px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-red-500" />
              {o.motivoProblema}
            </div>
          )}

          {/* Orden problema: esperando a Sergio */}
          {o.estado === 'problema' && (
            <div className="flex items-center gap-2 bg-zinc-50 rounded px-3 py-2 text-xs text-zinc-500">
              <Truck className="w-3 h-3 flex-shrink-0 text-zinc-400" />
              Esperando a que Sergio recoja el lente
            </div>
          )}

          {/* Pipeline de estado (no mostrar en problema) */}
          {o.estado !== 'problema' && (
            <div className="flex items-center gap-0 pt-1 border-t border-zinc-200">
              {[
                { label: 'Pendiente', done: true },
                { label: 'En lab',    done: ['en_laboratorio','en_camino','en_sucursal','listo','entregado'].includes(o.estado) },
                { label: 'Listo',     done: ['listo','entregado'].includes(o.estado) },
                { label: 'Entregado', done: o.estado === 'entregado' },
              ].map((step, i) => (
                <React.Fragment key={step.label}>
                  {i > 0 && (
                    <div className={`flex-1 h-0.5 mb-3 ${step.done ? 'bg-emerald-400' : 'bg-zinc-200'}`} />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      step.done ? 'bg-emerald-500' : 'bg-zinc-200'
                    }`}>
                      {step.done && (
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="1.8">
                          <polyline points="1.5,5 4,7.5 8.5,2.5"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-[10px] leading-tight text-center ${step.done ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {step.label}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Acciones según estado */}
          {o.estado === 'en_sucursal' && !showProblema && (
            <div className="space-y-2">
              <button
                onClick={() => onUpdate(o.id, { estado: 'listo' })}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Lente verificado — marcar listo
              </button>
              <button
                onClick={() => setShowProblema(true)}
                className="w-full flex items-center justify-center gap-2 py-2 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Hay un problema con el lente
              </button>
            </div>
          )}

          {/* Input de motivo problema */}
          {o.estado === 'en_sucursal' && showProblema && (
            <div className="space-y-2 border border-red-200 rounded-lg p-3 bg-red-50">
              <p className="text-xs font-semibold text-red-700">¿Cuál es el problema?</p>
              <textarea
                value={motivoInput}
                onChange={e => setMotivoInput(e.target.value.toUpperCase())}
                rows={2}
                placeholder="Ej: tinte llegó incorrecto, graduación muy diferente…"
                className="w-full border border-red-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-400 resize-none uppercase placeholder:normal-case"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowProblema(false); setMotivoInput('') }}
                  className="flex-1 py-1.5 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!motivoInput.trim()}
                  onClick={() => {
                    if (motivoInput.trim()) {
                      onProblema(o, motivoInput.trim())
                      setShowProblema(false)
                      setMotivoInput('')
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${
                    motivoInput.trim()
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  Confirmar problema
                </button>
              </div>
            </div>
          )}

          {o.estado === 'listo' && (
            <div className="flex flex-col gap-1.5">
              {/* Aviso y candado de costo: solo admin. Gerente/vendedor entregan sin ver costos */}
              {rol === 'administrador' && o.costoLab === 0 && !o.esGarantia && (
                <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3 font-medium">
                  ⚠️ Falta registrar el costo del laboratorio antes de entregar
                </p>
              )}
              <button
                disabled={rol === 'administrador' && o.costoLab === 0 && !o.esGarantia}
                onClick={() => onUpdate(o.id, { estado: 'entregado', fechaEntrega: hoyLocal() })}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-colors ${
                  rol !== 'administrador' || o.costoLab > 0 || o.esGarantia
                    ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Entregado al paciente
              </button>
            </div>
          )}

          {/* Imprimir */}
          <div className="flex items-center justify-end border-t border-zinc-200 pt-2">
            <button
              onClick={() => onPrint(o)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> {o.esGarantia ? 'Etiqueta garantía' : 'Imprimir orden'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header + stats */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-800">Laboratorio</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{sucursal} · {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNuevaOrden}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-zinc-900 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva orden
          </button>
          {[
            { label: 'Listas',    n: listos.length,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'En camino', n: enCamino.length, color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: 'Problema',  n: problemas.length,color: 'text-red-600',     bg: 'bg-red-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg px-3 py-2 text-center min-w-[60px]`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.n}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Buscador local */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={busquedaLocal}
          onChange={e => setBusquedaLocal(e.target.value)}
          placeholder="Buscar paciente, folio o tipo de mica..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300/50 placeholder:text-zinc-400"
        />
        {busquedaLocal && (
          <button onClick={() => setBusquedaLocal('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {pendientes.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
          {busquedaLocal ? `Sin resultados para "${busquedaLocal}"` : 'Sin órdenes pendientes'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

          {/* Columna izquierda: En proceso */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-zinc-200">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                En proceso
              </p>
              <span className="text-xs font-bold text-zinc-400">
                · {[...enCamino, ...otros].length}
              </span>
            </div>

            {enCamino.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-blue-500 flex items-center gap-1.5 px-0.5">
                  <Truck className="w-3 h-3" /> En camino
                </p>
                {enCamino.map(o => <EntregaCard key={o.id} o={o} />)}
              </div>
            )}

            {otros.length > 0 && (
              <div className="space-y-2">
                {enCamino.length > 0 && (
                  <p className="text-[11px] font-semibold text-zinc-400 px-0.5">En laboratorio / recibido</p>
                )}
                {otros.map(o => <EntregaCard key={o.id} o={o} />)}
              </div>
            )}

            {[...enCamino, ...otros].length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-8">Sin órdenes en proceso</p>
            )}
          </div>

          {/* Columna derecha: Listos para entrega */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Listos para entrega
              </p>
              <span className="text-xs font-bold text-emerald-400">· {listos.length}</span>
            </div>

            {listos.length > 0
              ? listos.map(o => <EntregaCard key={o.id} o={o} />)
              : <p className="text-xs text-zinc-400 text-center py-8">Sin lentes listos aún</p>
            }
          </div>

        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
// ── Helper: mapea fila de Supabase → OrdenLab ────────────────
function rowToOrden(r: Record<string, unknown>, idx: number): OrdenLab {
  return {
    id: idx + 1,
    supabaseId: r.id as string,
    folio: r.folio as string,
    folioVenta: (r.folio_venta as string) ?? '',
    pacienteId: (r.paciente_id as string) ?? '',
    paciente: r.paciente as string,
    telefono: (r.telefono as string) ?? '',
    sucursal: r.sucursal as string,
    laboratorio: (r.laboratorio as string) ?? '',
    tipoMica: (r.tipo_mica as string) ?? '',
    armazon: (r.armazon as 'propio' | 'comprado') ?? 'comprado',
    descripcionArmazon: (r.descripcion_armazon as string) ?? '',
    od: (r.od as string) ?? '',
    oi: (r.oi as string) ?? '',
    add: (r.add_graduacion as string) ?? '',
    dp: (r.dp as string) ?? '',
    altura: (r.altura as string) ?? '',
    tratamiento: (r.tratamiento as Tratamiento) ?? 'ninguno',
    colorTratamiento: (r.color_tratamiento as string) ?? '',
    urgente: (r.urgente as boolean) ?? false,
    fechaIngreso: (r.fecha_ingreso as string) ?? '',
    fechaPromesa: (r.fecha_promesa as string) ?? '',
    fechaEntrega: (r.fecha_entrega as string) ?? '',
    fechaEnvioLab: (r.fecha_envio_lab as string) ?? '',
    fechaRecogidaLab: (r.fecha_recogida_lab as string) ?? '',
    pagadoLab: (r.pagado_lab as boolean) ?? false,
    fechaPagoLab: (r.fecha_pago_lab as string) ?? '',
    metodoPagoLab: (r.metodo_pago_lab as 'transferencia' | 'efectivo' | '') ?? '',
    estado: (r.estado as EstadoOrden) ?? 'recibido',
    costoLab: Number(r.costo_lab) ?? 0,
    precioCliente: Number(r.precio_cliente) ?? 0,
    anticipo: Number(r.anticipo) ?? 0,
    notas: (r.notas as string) ?? '',
    creadoPor: (r.creado_por as string) ?? '',
    verificado: (r.verificado as boolean) ?? false,
    verificadoPor: (r.verificado_por as string) ?? '',
    fechaVerificacion: (r.fecha_verificacion as string) ?? '',
    notasVerificacion: (r.notas_verificacion as string) ?? '',
    motivoRetraso: (r.motivo_retraso as string) ?? '',
    folioOrigen:    (r.folio_origen as string) ?? '',
    esGarantia:     (r.es_garantia as boolean) ?? false,
    motivoProblema: (r.motivo_problema as string) ?? '',
    archivado:      (r.archivado as boolean) ?? false,
  }
}

export default function LaboratorioPage() {
  const [ordenes, setOrdenes] = useState<OrdenLab[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | 'todas'>('todas')
  const [filtroSucursal, setFiltroSucursal] = useState('Todas')
  const [detalle, setDetalle] = useState<OrdenLab | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Omit<OrdenLab, 'id' | 'folio'>>(formVacio())
  const [ventaVinculada, setVentaVinculada] = useState<VentaRef | null>(null)
  const [printModal, setPrintModal] = useState<OrdenLab | null>(null)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [contactModal, setContactModal] = useState<{
    canal: 'llamada' | 'whatsapp' | 'presencial'
    resultado: 'contesto' | 'no_contesto' | 'buzon' | 'enviado'
    notas: string
  } | null>(null)

  // Usuario activo
  const { usuario: sessionUser } = useSession()
  const [demoUser, setDemoUser] = useState<{ rol: string; sucursal: string; nombre: string } | null>(null)
  const [sucursalCrear, setSucursalCrear] = useState('Baja Visión')
  const router = useRouter()

  // ── Cargar órdenes desde Supabase ──────────────────────────
  useEffect(() => {
    const fetchOrdenes = async () => {
      setCargando(true)
      try {
        // Leer usuario (Supabase Auth o legacy localStorage)
        let legacyU: { rol?: string; sucursal?: string; nombre?: string } = {}
        try { legacyU = JSON.parse(localStorage.getItem('optios_demo_user') || '{}') } catch { /* noop */ }
        const user = {
          rol:      sessionUser?.rol      || legacyU.rol      || 'vendedor',
          sucursal: sessionUser?.sucursal || legacyU.sucursal || '',
          nombre:   sessionUser?.nombre   || legacyU.nombre   || '',
        }
        setDemoUser(user as { rol: string; sucursal: string; nombre: string })
        setSucursalCrear(getSucursalActual())

        const supabase = createClient()
        let q = supabase.from('ordenes_lab').select('*').order('fecha_ingreso', { ascending: true })
        // Vendedores solo ven órdenes de su sucursal
        if (user?.rol === 'vendedor' && user?.sucursal) {
          q = q.eq('sucursal', user.sucursal)
        }
        const { data, error } = await q
        if (data && !error) {
          setOrdenes(data.map((r, i) => rowToOrden(r as Record<string, unknown>, i)))
        }
      } catch (e) {
        console.warn('Error al cargar órdenes:', e)
      } finally {
        setCargando(false)
      }
    }
    fetchOrdenes()
  }, [])

  // ── Escribir cambios a Supabase ─────────────────────────────
  const updateEnSupabase = useCallback(async (supabaseId: string, changes: Partial<OrdenLab>) => {
    if (!supabaseId) return // mock row, skip
    const supabase = createClient()
    const dbChanges: Record<string, unknown> = {}
    if (changes.estado           !== undefined) dbChanges.estado              = changes.estado
    if (changes.laboratorio      !== undefined) dbChanges.laboratorio         = changes.laboratorio
    if (changes.costoLab         !== undefined) dbChanges.costo_lab           = changes.costoLab
    if (changes.metodoPagoLab    !== undefined) dbChanges.metodo_pago_lab     = changes.metodoPagoLab
    if (changes.pagadoLab        !== undefined) dbChanges.pagado_lab          = changes.pagadoLab
    if (changes.fechaPagoLab     !== undefined) dbChanges.fecha_pago_lab      = changes.fechaPagoLab
    if (changes.notas            !== undefined) dbChanges.notas               = changes.notas
    if (changes.fechaPromesa     !== undefined) dbChanges.fecha_promesa       = changes.fechaPromesa
    if (changes.fechaEnvioLab    !== undefined) dbChanges.fecha_envio_lab     = changes.fechaEnvioLab
    if (changes.fechaRecogidaLab   !== undefined) dbChanges.fecha_recogida_lab   = changes.fechaRecogidaLab
    if (changes.fechaEntrega       !== undefined) dbChanges.fecha_entrega        = changes.fechaEntrega
    if (changes.verificado         !== undefined) dbChanges.verificado           = changes.verificado
    if (changes.verificadoPor      !== undefined) dbChanges.verificado_por       = changes.verificadoPor
    if (changes.fechaVerificacion  !== undefined) dbChanges.fecha_verificacion   = changes.fechaVerificacion
    if (changes.notasVerificacion  !== undefined) dbChanges.notas_verificacion   = changes.notasVerificacion
    if (changes.motivoRetraso      !== undefined) dbChanges.motivo_retraso       = changes.motivoRetraso
    if (changes.archivado          !== undefined) dbChanges.archivado            = changes.archivado
    if (changes.motivoProblema     !== undefined) dbChanges.motivo_problema      = changes.motivoProblema
    await supabase.from('ordenes_lab').update(dbChanges).eq('id', supabaseId)
  }, [])

  // ── Log automático de eventos en historial ──────────────────
  const logHistorial = useCallback(async (
    supabaseId: string,
    evento: {
      tipo: HistorialItem['evento']
      estadoAntes?: string; estadoDespues?: string
      canal?: string; resultado?: string
      notas?: string; sucursal?: string
    }
  ) => {
    if (!supabaseId) return
    const supabase = createClient()
    await supabase.from('ordenes_lab_historial').insert({
      orden_id:       supabaseId,
      evento:         evento.tipo,
      estado_antes:   evento.estadoAntes,
      estado_despues: evento.estadoDespues,
      canal:          evento.canal,
      resultado:      evento.resultado,
      notas:          evento.notas,
      registrado_por: demoUser?.nombre,
      sucursal:       evento.sucursal,
    })
  }, [demoUser])

  const fetchHistorial = useCallback(async (supabaseId: string) => {
    if (!supabaseId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('ordenes_lab_historial')
      .select('*')
      .eq('orden_id', supabaseId)
      .order('created_at', { ascending: true })
    if (data) setHistorial(data as HistorialItem[])
  }, [])

  const esRepartidor = demoUser?.rol === 'repartidor'
  const esAdmin      = demoUser?.rol === 'administrador'   // solo admin ve costos de laboratorio

  const filtradas = ordenes
    .filter(o => {
      const q = busqueda.toLowerCase()
      const matchQ = o.paciente.toLowerCase().includes(q) || o.folio.toLowerCase().includes(q) || o.folioVenta.toLowerCase().includes(q)
      const matchE  = filtroEstado === 'todas' || o.estado === filtroEstado
      const matchS  = filtroSucursal === 'Todas' || o.sucursal === filtroSucursal
      return matchQ && matchE && matchS
    })
    .sort((a, b) => (a.fechaIngreso ?? '').localeCompare(b.fechaIngreso ?? '') || a.folio.localeCompare(b.folio))

  const activas      = ordenes.filter(o => o.estado !== 'entregado')
  const porLlevar    = activas.filter(o => o.estado === 'recibido').length
  const enLab        = activas.filter(o => o.estado === 'en_laboratorio').length
  const enCamino     = activas.filter(o => o.estado === 'en_camino').length
  const enSucursal   = activas.filter(o => o.estado === 'en_sucursal').length
  const listas       = activas.filter(o => o.estado === 'listo').length
  const problemas    = activas.filter(o => o.estado === 'problema').length
  const sinPagar     = ordenes.filter(o => o.costoLab > 0 && !o.pagadoLab).length
  const totalPendLab = ordenes.reduce((s, o) => s + (o.costoLab > 0 && !o.pagadoLab ? o.costoLab : 0), 0)

  const nextFolio = `LAB-${String(ordenes.length + 42).padStart(4, '0')}`

  const vincularVenta = (v: VentaRef) => {
    setVentaVinculada(v)
    setForm(prev => ({
      ...prev,
      folioVenta: v.folio,
      pacienteId: v.pacienteId,
      paciente: v.paciente,
      telefono: v.telefono,
      sucursal: v.sucursal,
      od: v.od,
      oi: v.oi,
      add: v.add,
      dp: v.dp,
      descripcionArmazon: v.armazon,
    }))
  }

  const cambiarEstado = async (id: number, estado: EstadoOrden, notasExtra?: string) => {
    const hoy = hoyLocal()
    const orden = ordenes.find(o => o.id === id)

    // Si la venta tiene saldo pendiente al entregar, mandar a Ventas a liquidar
    // (reutiliza el flujo completo: abono, ticket, dólares, ruteo a banco)
    if (estado === 'entregado' && orden?.folioVenta) {
      const supabase = createClient()
      const { data: ventaDB } = await supabase
        .from('ventas')
        .select('saldo')
        .eq('folio', orden.folioVenta)
        .single()
      if (ventaDB && Number(ventaDB.saldo) > 0) {
        const saldo = Number(ventaDB.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })
        if (confirm(`El cliente tiene un saldo pendiente de $${saldo}.\n\n¿Ir a Ventas para cobrarlo y darle su ticket? Después regresas aquí a entregar.`)) {
          router.push(`/dashboard/ventas?liquidar=${orden.folioVenta}`)
        }
        return
      }
    }

    const changes: Partial<OrdenLab> = { estado }
    if (estado === 'en_laboratorio' && orden && !orden.fechaEnvioLab)       changes.fechaEnvioLab      = hoy
    if (estado === 'en_sucursal'    && orden && !orden.fechaRecogidaLab)   changes.fechaRecogidaLab   = hoy
    if (estado === 'entregado'      && orden && !orden.fechaEntrega)       changes.fechaEntrega       = hoy
    if (estado === 'listo'          && orden && !orden.fechaVerificacion) {
      changes.fechaVerificacion = hoy
      changes.verificadoPor     = demoUser?.nombre ?? ''
      changes.verificado        = true
    }
    setOrdenes(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o))
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, ...changes } : null)
    if (orden?.supabaseId) {
      await updateEnSupabase(orden.supabaseId, changes)
      await logHistorial(orden.supabaseId, {
        tipo: 'estado',
        estadoAntes: orden.estado,
        estadoDespues: estado,
        notas: notasExtra,
        sucursal: orden.sucursal,
      })
      // Refresh historial si esta orden está en el detalle
      if (detalle?.id === id) fetchHistorial(orden.supabaseId)
    }
  }

  const guardar = async () => {
    const supabase = createClient()
    const { data: ultimoL } = await supabase
      .from('ordenes_lab')
      .select('folio')
      .ilike('folio', 'L-%')
      .order('folio', { ascending: false })
      .limit(1)
    const nL = ultimoL?.[0]?.folio ? parseInt(ultimoL[0].folio.replace(/\D/g, '')) + 1 : 1
    const folio: string = `L-${String(nL).padStart(4, '0')}`

    // Insertar en Supabase
    const { data: inserted } = await supabase.from('ordenes_lab').insert({
      folio,
      folio_venta:         form.folioVenta,
      paciente_id:         form.pacienteId || null,
      paciente:            form.paciente,
      telefono:            form.telefono,
      sucursal:            form.sucursal,
      laboratorio:         form.laboratorio,
      tipo_mica:           form.tipoMica,
      armazon:             form.armazon,
      descripcion_armazon: form.descripcionArmazon,
      od: form.od, oi: form.oi, add_graduacion: form.add, dp: form.dp, altura: form.altura,
      tratamiento:         form.tratamiento,
      color_tratamiento:   form.colorTratamiento,
      urgente:             form.urgente,
      fecha_ingreso:       form.fechaIngreso,
      fecha_promesa:       form.fechaPromesa,
      estado:              'recibido',
      costo_lab:           form.costoLab,
      precio_cliente:      form.precioCliente,
      anticipo:            form.anticipo,
      notas:               form.notas,
      creado_por:          demoUser?.nombre ?? '',
    }).select('id').single()

    // Registrar evento de creación en el historial
    if (inserted?.id) {
      await supabase.from('ordenes_lab_historial').insert({
        orden_id:       inserted.id,
        evento:         'estado',
        estado_antes:   null,
        estado_despues: 'recibido',
        registrado_por: demoUser?.nombre ?? '',
        notas:          'Orden creada',
      })
    }

    const nueva: OrdenLab = {
      id: Date.now(),
      folio,
      ...form,
      supabaseId: inserted?.id ?? '',
    }
    setOrdenes(prev => [nueva, ...prev])
    setModal(false)
    setVentaVinculada(null)
    setDetalle(nueva)
  }

  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  // ── Props compartidos para VistaTienda ──────────────────────
  const vistaTiendaProps = {
    ordenes,
    sucursal: demoUser?.sucursal ?? 'Todas',
    rol: demoUser?.rol ?? '',
    onPrint: (o: OrdenLab) => setPrintModal(o),
    onNuevaOrden: () => { setForm(formVacio(sucursalCrear)); setVentaVinculada(null); setModal(true) },
    onUpdate: (id: number, changes: Partial<OrdenLab>) => {
      const orden = ordenes.find(o => o.id === id)
      if (changes.estado) cambiarEstado(id, changes.estado as EstadoOrden)
      else {
        if (orden?.supabaseId) updateEnSupabase(orden.supabaseId, changes)
        setOrdenes(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o))
      }
    },
    onProblema: async (original: OrdenLab, motivo: string) => {
            // 1. Marcar original como problema
            const hoy = hoyLocal()
            setOrdenes(prev => prev.map(o => o.id === original.id
              ? { ...o, estado: 'problema', motivoProblema: motivo }
              : o
            ))
            if (original.supabaseId) {
              await updateEnSupabase(original.supabaseId, { estado: 'problema', motivoProblema: motivo })
              await logHistorial(original.supabaseId, {
                tipo: 'estado',
                estadoAntes: original.estado,
                estadoDespues: 'problema',
                notas: motivo,
                sucursal: original.sucursal,
              })
            }

            // 2. Crear nueva orden de garantía en Supabase
            const supabase = createClient()
            const { data: ultimoL } = await supabase
              .from('ordenes_lab').select('folio').ilike('folio', 'L-%')
              .order('folio', { ascending: false }).limit(1)
            const nL = ultimoL?.[0]?.folio ? parseInt(ultimoL[0].folio.replace(/\D/g, '')) + 1 : 1
            const folioNuevo = `L-${String(nL).padStart(4, '0')}`

            const { data: inserted } = await supabase.from('ordenes_lab').insert({
              folio:               folioNuevo,
              folio_venta:         original.folioVenta,
              paciente:            original.paciente,
              telefono:            original.telefono,
              sucursal:            original.sucursal,
              paciente_id:         original.pacienteId || null,
              tipo_mica:           original.tipoMica,
              armazon:             original.armazon,
              descripcion_armazon: original.descripcionArmazon,
              od:                  original.od,
              oi:                  original.oi,
              add_graduacion:      original.add,
              dp:                  original.dp,
              altura:              original.altura,
              tratamiento:         original.tratamiento,
              color_tratamiento:   original.colorTratamiento,
              urgente:             original.urgente,
              fecha_ingreso:       hoy,
              fecha_promesa:       '',
              estado:              'recibido',
              costo_lab:           0,
              precio_cliente:      original.precioCliente,
              anticipo:            original.anticipo,
              notas:               '',
              folio_origen:        original.folio,
              es_garantia:         true,
              motivo_problema:     motivo,
            }).select('id').single()

            // 3. Agregar nueva orden al estado local
            const nuevaOrden: OrdenLab = {
              id: Date.now(),
              folio: folioNuevo,
              supabaseId: inserted?.id ?? '',
              folioVenta: original.folioVenta,
              pacienteId: original.pacienteId,
              paciente: original.paciente,
              telefono: original.telefono,
              sucursal: original.sucursal,
              laboratorio: '',
              tipoMica: original.tipoMica,
              armazon: original.armazon,
              descripcionArmazon: original.descripcionArmazon,
              od: original.od,
              oi: original.oi,
              add: original.add,
              dp: original.dp,
              altura: original.altura,
              tratamiento: original.tratamiento,
              colorTratamiento: original.colorTratamiento,
              urgente: original.urgente,
              fechaIngreso: hoy,
              fechaPromesa: '',
              fechaEntrega: '',
              fechaEnvioLab: '',
              fechaRecogidaLab: '',
              pagadoLab: false,
              fechaPagoLab: '',
              metodoPagoLab: '',
              estado: 'recibido',
              costoLab: 0,
              precioCliente: original.precioCliente,
              anticipo: original.anticipo,
              notas: '',
              verificado: false,
              verificadoPor: '',
              fechaVerificacion: '',
              notasVerificacion: '',
              motivoRetraso: '',
              creadoPor: '',
              folioOrigen: original.folio,
              esGarantia: true,
              motivoProblema: motivo,
              archivado: false,
            }
            setOrdenes(prev => [nuevaOrden, ...prev])
          },
  }

  // Vista repartidor — flujo completo de mensajería
  if (esRepartidor) {
    return <VistaRepartidor ordenes={ordenes} onUpdate={(id, changes) => {
      const orden = ordenes.find(o => o.id === id)
      if (orden?.supabaseId) updateEnSupabase(orden.supabaseId, changes)
      setOrdenes(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o))
    }} />
  }

  return (
    <>
      <VistaVendedor {...vistaTiendaProps} />

      {/* ── MODAL IMPRIMIR ── */}
      {printModal && <PrintModal orden={printModal} onClose={() => setPrintModal(null)} />}


      {/* ── MODAL NUEVA ORDEN ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Nueva orden de laboratorio</h2>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">{nextFolio}</p>
              </div>
              <button onClick={() => setModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Vincular a venta */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <p className="text-xs font-semibold text-zinc-500 mb-2 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Vincular a venta existente
                </p>
                {ventaVinculada ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-zinc-700">{ventaVinculada.folio} — {ventaVinculada.paciente}</p>
                        <p className="text-xs text-zinc-400">Datos auto-completados desde la venta</p>
                      </div>
                    </div>
                    <button onClick={() => { setVentaVinculada(null); setForm(formVacio(sucursalCrear)) }}
                      className="p-2 rounded border border-zinc-200 hover:bg-white text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <BuscadorVenta onSelect={vincularVenta} />
                )}
              </div>

              {/* Paciente — si no hay venta vinculada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                    <User className="inline w-3 h-3 mr-1 -mt-0.5" /> Paciente *
                  </label>
                  <input value={form.paciente} onChange={e => f('paciente', e.target.value.toUpperCase())}
                    className={`w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case ${ventaVinculada ? 'text-zinc-400' : ''}`}
                    placeholder="Nombre completo" readOnly={!!ventaVinculada} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono</label>
                  <input value={form.telefono} onChange={e => f('telefono', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="686 000 0000" readOnly={!!ventaVinculada} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <div className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 text-zinc-600">
                    {form.sucursal}
                  </div>
                </div>
              </div>

              {/* Tipo + laboratorio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de mica *</label>
                  <div className="relative">
                    <select value={form.tipoMica} onChange={e => f('tipoMica', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {TIPOS_MICA.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Laboratorio</label>
                  <div className="relative">
                    <select value={form.laboratorio} onChange={e => f('laboratorio', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {LABORATORIOS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Armazón */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Armazón</label>
                <div className="flex gap-2 mb-2">
                  {[{ v: 'comprado', l: 'Comprado en tienda' }, { v: 'propio', l: 'Propio del cliente' }].map(opt => (
                    <button key={opt.v} onClick={() => f('armazon', opt.v as 'comprado' | 'propio')}
                      className={`flex-1 py-2 rounded text-xs font-semibold border transition-all ${form.armazon === opt.v ? 'bg-[#0B0E14] border-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <input value={form.descripcionArmazon} onChange={e => f('descripcionArmazon', e.target.value.toUpperCase())}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case"
                  placeholder="Marca, color, modelo..." />
              </div>

              {/* Graduación */}
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-500">Graduación</p>
                  {ventaVinculada && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Auto-llenado desde venta</span>}
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: 'OD', field: 'od' as const, ph: 'ej. -2.50 -0.75 x170' },
                    { label: 'OI', field: 'oi' as const, ph: 'ej. -2.25 -0.50 x005' },
                  ].map(row => (
                    <div key={row.field} className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-zinc-100 px-2 py-1.5 rounded text-zinc-600 w-10 text-center flex-shrink-0">{row.label}</span>
                      <input value={form[row.field]} onChange={e => f(row.field, e.target.value.toUpperCase())}
                        className="flex-1 border border-zinc-200 rounded px-3 py-2 text-sm font-mono bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case"
                        placeholder={row.ph} />
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { l: 'ADD',    f: 'add'    as const, ph: '+2.00' },
                      { l: 'D.P.',   f: 'dp'     as const, ph: '62 mm' },
                      { l: 'Altura', f: 'altura' as const, ph: '18 mm' },
                    ].map(row => (
                      <div key={row.f} className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-zinc-100 px-2 py-1.5 rounded text-zinc-600 min-w-[42px] text-center flex-shrink-0">{row.l}</span>
                        <input value={form[row.f]} onChange={e => f(row.f, e.target.value.toUpperCase())}
                          className="flex-1 border border-zinc-200 rounded px-3 py-2 text-sm font-mono bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case"
                          placeholder={row.ph} />
                      </div>
                    ))}
                  </div>

                  {/* Tratamiento */}
                  <div className="border-t border-zinc-200 pt-3">
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Tratamiento</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {([
                        { v: 'ninguno',      l: 'Ninguno' },
                        { v: 'tinte',        l: 'Tinte' },
                        { v: 'fotocromatico',l: 'Fotocromático' },
                        { v: 'polarizado',   l: 'Polarizado' },
                      ] as { v: Tratamiento; l: string }[]).map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => { f('tratamiento', opt.v); if (opt.v !== 'tinte' && opt.v !== 'polarizado') f('colorTratamiento', '') }}
                          className={`py-2 rounded text-xs font-semibold border transition-all ${form.tratamiento === opt.v ? 'bg-[#0B0E14] border-[#0B0E14] text-white' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {(form.tratamiento === 'tinte' || form.tratamiento === 'polarizado') && (
                      <input
                        value={form.colorTratamiento}
                        onChange={e => f('colorTratamiento', e.target.value.toUpperCase())}
                        className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case"
                        placeholder={form.tratamiento === 'tinte' ? 'Color del tinte (ej. café, gris, rosa...)' : 'Color de polarizado (ej. gris, café, verde...)'}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha de ingreso</label>
                  <input type="date" value={form.fechaIngreso} onChange={e => f('fechaIngreso', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha promesa al cliente</label>
                  <input type="date" value={form.fechaPromesa} onChange={e => f('fechaPromesa', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
              </div>

              {/* Financiero */}
              <div className={`grid gap-4 grid-cols-1 ${esAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {[
                  ...(esAdmin ? [{ l: 'Costo laboratorio', f: 'costoLab' as const }] : []),
                  { l: 'Precio al cliente',  f: 'precioCliente' as const },
                  { l: 'Anticipo recibido',  f: 'anticipo' as const },
                ].map(item => (
                  <div key={item.f}>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{item.l}</label>
                    <input type="number" value={form[item.f] || ''} onChange={e => f(item.f, parseFloat(e.target.value) || 0)}
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                      placeholder="0.00" />
                  </div>
                ))}
              </div>

              {/* Urgente */}
              <button type="button"
                onClick={() => f('urgente', !form.urgente)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-black tracking-widest border-2 transition-all ${
                  form.urgente
                    ? 'bg-black border-black text-white'
                    : 'border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600'
                }`}>
                ⚡ {form.urgente ? 'URGENTE (activo)' : 'Marcar como urgente'}
              </button>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notas</label>
                <textarea value={form.notas} onChange={e => f('notas', e.target.value.toUpperCase())} rows={3}
                  className="w-full border border-zinc-200 rounded px-3 py-3 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none placeholder:text-zinc-400 uppercase placeholder:normal-case"
                  placeholder="Indicaciones especiales, observaciones..." />
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.paciente}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-40">
                <Save className="w-4 h-4" /> Registrar orden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
