'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/hooks/useSession'
import {
  Plus, Search, X, Save, Filter,
  Clock, CheckCircle2, AlertTriangle, Truck,
  Package, Eye, Phone, Calendar, FileText,
  Printer, Link2, User,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'
import { getSucursalActual, getSucursalFiltro, normalizarSucursal } from '@/lib/session'
import { hoyLocal, hoyMasDias } from '@/lib/fecha'
import { textoOjo } from '@/lib/graduacion'

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
  folioVenta: string   // vínculo con venta (folio de texto)
  ventaId: string      // id real de la venta (uuid) — liga costos/finanzas
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
  tratamiento: string      // texto libre: filtros que compró (antirreflejo, transition, etc.)
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
  recogidoAt?: string         // Sergio ya lo recogió en la óptica (todavía no lo deja en el lab)
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
  id: string
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
  esPaciente?: boolean   // true = resultado de paciente (venta vieja no en el sistema)
}

// Clasificación de productos para auto-llenar la orden desde una venta
const esMicaProd   = (n: string) => ['mica', 'monofocal', 'progres', 'bifocal', 'transitions', 'rebisel'].some(k => n.toLowerCase().includes(k))
const esFiltroProd = (n: string) => ['filtro', 'antirreflej', 'blue', 'fotocrom', 'polariz', 'tinte', 'crizal'].some(k => n.toLowerCase().includes(k))

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


const LABORATORIOS = ['Karen', 'Indigo', 'Tecnolab', 'Richardson', 'Exce Lentes', 'El Nuevo']
const SUCURSALES   = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

const dias = (n: number) => hoyMasDias(n)

const formVacio = (sucursalDefault = 'Baja Visión'): Omit<OrdenLab, 'id' | 'folio'> => ({
  supabaseId: '',
  folioVenta: '', ventaId: '', pacienteId: '', paciente: '', telefono: '', sucursal: sucursalDefault,
  laboratorio: '', tipoMica: 'Monofocal antirreflejante',
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

// Urgente AUTOMÁTICO: la orden aún no está lista/entregada y su fecha de promesa
// es hoy, mañana o ya pasó. También respeta el marcado manual (o.urgente).
function esUrgente(o: { urgente: boolean; estado: string; fechaPromesa: string }) {
  if (o.estado === 'listo' || o.estado === 'entregado') return false
  if (o.urgente) return true
  if (!o.fechaPromesa) return false
  const manana = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
  return o.fechaPromesa <= manana   // YYYY-MM-DD: hoy, mañana o vencido
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
    if (!query.trim()) { setResultados([]); return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const q = query.trim()
      const sb = createClient()

      // 1. Ventas por folio
      const { data: ventasData } = await sb
        .from('ventas')
        .select('id, folio, sucursal, paciente_id, pacientes(nombre, apellido, telefono)')
        .ilike('folio', `%${q}%`)
        .eq('estado', 'activa')
        .order('folio', { ascending: false })
        .limit(6)

      const resVentas: VentaRef[] = (ventasData ?? []).map((v: Record<string, unknown>) => {
        const p = v.pacientes as { nombre?: string; apellido?: string; telefono?: string } | null
        return {
          id:         v.id as string,
          folio:      v.folio as string,
          sucursal:   v.sucursal as string,
          pacienteId: (v.paciente_id as string) ?? '',
          paciente:   p ? `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim() : '',
          telefono:   p?.telefono ?? '',
          od: '', oi: '', add: '', dp: '', armazon: '',
        }
      })

      // 2. Pacientes por nombre — cada palabra debe aparecer en nombre O apellido (AND entre palabras)
      // Así "jose ed" solo trae pacientes que contengan ambas palabras, no todos los "jose".
      const words = q.split(/\s+/).filter(Boolean)
      let pacQuery = sb
        .from('pacientes')
        .select('id, nombre, apellido, telefono, sucursal_principal')
      for (const w of words) {
        pacQuery = pacQuery.or(`nombre.ilike.%${w}%,apellido.ilike.%${w}%`)
      }
      const { data: pacData } = await pacQuery.limit(30)
      const full = q.toLowerCase()
      const resPacientes: VentaRef[] = (pacData ?? [])
        .filter((p: Record<string, unknown>) => {
          const nombre = `${p.nombre ?? ''} ${p.apellido ?? ''}`.toLowerCase()
          return words.every(w => nombre.includes(w.toLowerCase()))
        })
        .slice(0, 8)
        .map((p: Record<string, unknown>) => ({
          id: '', folio: '',
          pacienteId: p.id as string,
          paciente:   `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim(),
          telefono:   (p.telefono as string) ?? '',
          sucursal:   normalizarSucursal(p.sucursal_principal as string) ?? '',
          od: '', oi: '', add: '', dp: '', armazon: '',
          esPaciente: true,
        }))

      setResultados([...resVentas, ...resPacientes])
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
      {open && query.length > 0 && resultados.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden">
          {resultados.map(v => (
            <button key={v.esPaciente ? `p-${v.pacienteId}` : `v-${v.id}`}
              onClick={() => { onSelect(v); setQuery(''); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-zinc-100 transition-colors flex items-center gap-3 border-b border-zinc-50 last:border-0">
              <div className="w-8 h-8 rounded bg-[#0B0E14] flex items-center justify-center flex-shrink-0">
                {v.esPaciente
                  ? <User className="w-3.5 h-3.5 text-[#0D9488]" />
                  : <Link2 className="w-3.5 h-3.5 text-[#0D9488]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {v.esPaciente
                    ? <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Paciente</span>
                    : <span className="font-mono text-xs font-bold text-zinc-500">{v.folio}</span>}
                  <span className="text-sm font-semibold text-zinc-700">{v.paciente}</span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{[v.sucursal, v.telefono].filter(Boolean).join(' · ')}</p>
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
  // Si es un código conocido (orden manual) se traduce; si es texto libre
  // (orden generada desde una venta: nombres de filtros), se muestra tal cual.
  const tratLabel = TRATAMIENTO_LABEL[orden.tratamiento] ?? orden.tratamiento
  const tratFull  = tratLabel
    ? (orden.colorTratamiento ? `${tratLabel} ${orden.colorTratamiento}` : tratLabel)
    : ''

  const handlePrint = async () => {
    const od = parseGrad(orden.od)
    const oi = parseGrad(orden.oi)

    // ── Adición y armazón: si la orden no los guardó, se leen EN VIVO de la
    //    venta (armazón) y del expediente del paciente (adición). Así funciona
    //    igual para órdenes viejas y nuevas.
    let addLive = orden.add
    let armazonLive = orden.descripcionArmazon
    if ((!addLive || !armazonLive) && orden.ventaId) {
      const sb = createClient()
      const { data: v } = await sb.from('ventas').select('paciente_id').eq('id', orden.ventaId).maybeSingle()
      if (!addLive && v?.paciente_id) {
        const { data: r } = await sb.from('recetas').select('od_add, oi_add')
          .eq('paciente_id', v.paciente_id as string).order('fecha', { ascending: false }).limit(1).maybeSingle()
        const addRec = (r?.od_add as string) || (r?.oi_add as string) || ''
        if (addRec) addLive = addRec
      }
      if (!armazonLive) {
        const { data: items } = await sb.from('ventas_items').select('nombre, sku').eq('venta_id', orden.ventaId)
        try {
          const j = await fetch('/api/ecomm/armazones', { cache: 'no-store' }).then(x => x.json())
          const armzSkus = new Set((j.armazones ?? []).map((a: { sku: string }) => a.sku))
          const it = (items ?? []).find((i: { sku: string }) => armzSkus.has(i.sku))
          if (it) armazonLive = (it.nombre as string).replace(/\s*·\s*#.*$/, '')
        } catch { /* si falla, se queda como estaba */ }
      }
    }

    // Filas opcionales de la tabla de graduación
    const alturaRow = orden.altura ? `<tr><td class="lbl">Alt.</td><td class="val" colspan="3">${orden.altura} mm</td><td></td></tr>` : ''
    const dpRow     = `<tr><td class="lbl">D.P.</td><td class="val" colspan="3">${orden.dp} mm</td><td></td></tr>`

    const armazonStr = armazonLive
      ? `${armazonLive} · ${orden.armazon === 'propio' ? 'del cliente' : 'comprado'}`
      : (orden.armazon === 'propio' ? 'Armazón del cliente' : '—')

    const notasHtml = orden.notas
      ? `<div style="border-top:1px dashed #ccc;padding:8px 0;font-size:13px;color:#333"><b>Obs:</b> ${orden.notas}</div>`
      : ''

    const garantiaHtml = orden.esGarantia
      ? `<div style="background:#7C3AED;color:#fff;text-align:center;font-size:18px;font-weight:900;letter-spacing:3px;padding:8px 0;margin-bottom:10px;border-radius:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">🔄 GARANTÍA</div>`
      : ''

    const motivoHtml = orden.esGarantia && orden.motivoProblema
      ? `<div style="border-top:1px dashed #ccc;margin-top:10px;padding-top:8px;font-size:13px;color:#333">
           <b>Motivo de reposición:</b> ${orden.motivoProblema}
           ${orden.folioOrigen ? `<br/><span style="color:#888">Orden original: ${orden.folioOrigen}</span>` : ''}
         </div>`
      : ''

    const win = window.open('', '_blank', 'width=420,height=640')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${orden.folio}</title>
<style>
  @page { size: 4in 6in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  /* Caja EXACTA de una etiqueta 4x6" (el padding hace de margen interno). */
  body { font-family: 'Arial', sans-serif; font-size: 15px; color: #000; width: 4in; height: 6in; padding: 6mm; display: flex; flex-direction: column; overflow: hidden; }
  /* Encabezado en NEGRO sobre BLANCO: los bloques negros grandes se embarran en térmica. */
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; color: #000; padding: 0 0 8px; border-bottom: 3px solid #000; margin-bottom: 14px; }
  .hdr-left h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.3px; color: #000; }
  .hdr-left p { font-size: 12px; color: #000; }
  .hdr-right { text-align: right; }
  .folio { font-size: 26px; font-weight: 900; font-family: monospace; color: #000; }
  .fecha { font-size: 12px; color: #000; }
  .paciente { font-size: 26px; font-weight: 900; margin-bottom: 2px; }
  .sucursal { font-size: 13px; color: #777; margin-bottom: 12px; }
  .sep { border: none; border-top: 1px dashed #999; margin: 12px 0; }
  .grad-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .grad-table th { background: #eee; font-size: 13px; font-weight: 700; text-align: center; padding: 8px 5px; border: 1px solid #bbb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .grad-table th:first-child { text-align: left; }
  .grad-table td { border: 1px solid #bbb; padding: 8px 5px; font-family: monospace; font-size: 17px; text-align: center; }
  .lbl { font-weight: 700; font-family: sans-serif; font-size: 13px; background: #f4f4f4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .val { text-align: center; }
  .mica-box { background: #eee; border: 1px solid #bbb; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mica-tipo { font-size: 20px; font-weight: 900; }
  .mica-sub  { font-size: 13px; color: #333; margin-top: 3px; }
  .armazon   { font-size: 15px; color: #222; margin-bottom: 10px; }
  .meta { display: flex; justify-content: space-between; font-size: 14px; color: #444; margin-bottom: 8px; }
  .firma-area { border-top: 1px solid #000; margin-top: auto; padding-top: 10px; text-align: right; font-size: 14px; color: #555; }
  .folio-ref { font-size: 12px; font-family: monospace; color: #555; }
</style></head><body>
  ${garantiaHtml}
  ${esUrgente(orden) ? `<div style="border:2px solid #000;text-align:center;font-size:17px;font-weight:900;letter-spacing:4px;padding:6px 0;margin-bottom:8px;">URGENTE</div>` : ''}

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
      <tr><td class="lbl">OD</td><td class="val">${od.esf}</td><td class="val">${od.cil}</td><td class="val">${od.eje !== '—' ? od.eje+'°' : '—'}</td><td class="val">${addLive || '—'}</td></tr>
      <tr><td class="lbl">OI</td><td class="val">${oi.esf}</td><td class="val">${oi.cil}</td><td class="val">${oi.eje !== '—' ? oi.eje+'°' : '—'}</td><td class="val">${addLive || '—'}</td></tr>
      ${dpRow}${alturaRow}
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

  <div class="meta" style="margin-top:auto">
    <span>Ingreso: <b>${orden.fechaIngreso}</b></span>
    <span>Laboratorio: ______________________</span>
  </div>
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
              {esUrgente(orden) && (
                <div className="bg-red-600 text-white text-center text-sm font-bold tracking-widest py-2">
                  URGENTE
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
                      <p className="text-xs text-zinc-400">{orden.armazon === 'propio' ? 'Del cliente' : 'Comprado con nosotros'}</p>
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
  // Trabajos de Sergio: tarjetas individuales, agrupadas por lugar.
  // Cada tarjeta tiene UN botón con el siguiente paso y una hoja de confirmación.
  // Dónde está el lente y si está pagado son independientes: el pago nunca detiene el avance.
  type Paso = 'recoger' | 'dejar' | 'recogerLab' | 'entregar' | 'regresar'
  type Filtro = 'todos' | 'recoger' | 'lab' | 'entregar' | 'regresar'

  const [filtro, setFiltro] = useState<Filtro>('todos')
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('f') as Filtro | null
    if (f && ['recoger', 'lab', 'entregar', 'regresar'].includes(f)) setFiltro(f)
  }, [])
  const [hoja, setHoja] = useState<{ o: OrdenLab; tipo: Paso | 'pagar' } | null>(null)
  const [d, setD] = useState({ laboratorio: '', fechaPromesa: '', monto: '', metodo: '' as '' | 'efectivo' | 'transferencia' })
  const [avisoHoja, setAvisoHoja] = useState('')
  const hoy = hoyLocal()

  const pasoDe = (o: OrdenLab): Paso | null =>
    o.estado === 'problema' ? (o.archivado ? null : 'regresar')
    : o.estado === 'recibido' ? (o.recogidoAt ? 'dejar' : 'recoger')
    : o.estado === 'en_laboratorio' ? 'recogerLab'
    : o.estado === 'en_camino' ? 'entregar'
    : null

  const activas = ordenes.filter(o => pasoDe(o) !== null)
  const enFiltro = (o: OrdenLab) => {
    const p = pasoDe(o)
    if (filtro === 'todos') return true
    if (filtro === 'recoger') return p === 'recoger' || p === 'dejar'
    if (filtro === 'lab') return p === 'recogerLab'
    if (filtro === 'entregar') return p === 'entregar'
    return p === 'regresar'
  }
  const cuenta = (f: Filtro) => activas.filter(o => {
    const p = pasoDe(o)
    return f === 'todos' ? true : f === 'recoger' ? (p === 'recoger' || p === 'dejar') : f === 'lab' ? p === 'recogerLab' : f === 'entregar' ? p === 'entregar' : p === 'regresar'
  }).length

  // Grupos por lugar: ópticas (recoger, regresar, entregar), "Contigo" (para dejar en el lab) y cada laboratorio
  const lugarDe = (o: OrdenLab) => {
    const p = pasoDe(o)
    if (p === 'dejar') return 'Contigo · para dejar en el lab'
    if (p === 'recogerLab') return `Laboratorio${o.laboratorio ? ` · ${o.laboratorio}` : ''}`
    return o.sucursal
  }
  const ORDEN_LUGAR = ['Baja Visión', '5 de Mayo', 'Plaza Laureles', 'Contigo · para dejar en el lab']
  const visibles = activas.filter(enFiltro).sort((a, b) => (a.fechaIngreso ?? '').localeCompare(b.fechaIngreso ?? '') || a.folio.localeCompare(b.folio))
  const grupos = new Map<string, OrdenLab[]>()
  for (const o of visibles) { const l = lugarDe(o); if (!grupos.has(l)) grupos.set(l, []); grupos.get(l)!.push(o) }
  const lugares = [...grupos.keys()].sort((a, b) => {
    const ia = ORDEN_LUGAR.indexOf(a), ib = ORDEN_LUGAR.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })

  const abrir = (o: OrdenLab, tipo: Paso | 'pagar') => {
    setAvisoHoja('')
    setD({
      laboratorio: o.laboratorio || '', fechaPromesa: o.fechaPromesa || '',
      monto: o.costoLab > 0 ? String(o.costoLab) : '', metodo: (o.metodoPagoLab || '') as '' | 'efectivo' | 'transferencia',
    })
    setHoja({ o, tipo })
  }

  // Pago opcional: si escribió monto y método, se marca pagado
  const pagoDraft = (): Partial<OrdenLab> => {
    const m = Number(d.monto)
    if (!(m > 0) || !d.metodo) return {}
    return { costoLab: m, metodoPagoLab: d.metodo, pagadoLab: true, fechaPagoLab: hoy }
  }

  const confirmar = () => {
    if (!hoja) return
    const { o, tipo } = hoja
    if (tipo === 'recoger') onUpdate(o.id, { recogidoAt: new Date().toISOString() })
    if (tipo === 'dejar') {
      if (!d.laboratorio) { setAvisoHoja('Escoge con qué laboratorio lo dejaste'); return }
      onUpdate(o.id, { estado: 'en_laboratorio', laboratorio: d.laboratorio, fechaPromesa: d.fechaPromesa, fechaEnvioLab: hoy, ...(o.pagadoLab ? {} : pagoDraft()) })
    }
    if (tipo === 'recogerLab') onUpdate(o.id, { estado: 'en_camino', fechaRecogidaLab: hoy, ...(o.pagadoLab ? {} : pagoDraft()) })
    if (tipo === 'entregar') onUpdate(o.id, { estado: 'en_sucursal' })
    if (tipo === 'regresar') onUpdate(o.id, { archivado: true })
    if (tipo === 'pagar') {
      const p = pagoDraft()
      if (!p.pagadoLab) { setAvisoHoja('Escribe cuánto pagaste y cómo'); return }
      onUpdate(o.id, p)
    }
    setHoja(null)
  }

  const FILTROS: { k: Filtro; l: string }[] = [
    { k: 'todos', l: 'Todos' }, { k: 'recoger', l: 'Recoger' }, { k: 'lab', l: 'En lab' }, { k: 'entregar', l: 'Entregar' }, { k: 'regresar', l: 'Regresar' },
  ]
  const BOTON: Record<Paso, string> = {
    recoger: 'Ya lo recogí', dejar: 'Lo dejé en el lab', recogerLab: 'Lo recogí del lab', entregar: 'Lo entregué', regresar: 'Lo recogí para regresarlo',
  }
  const PASO_N: Record<Paso, number> = { recoger: 0, dejar: 0, recogerLab: 1, entregar: 2, regresar: 0 }

  const ubicacion = (o: OrdenLab, p: Paso) =>
    p === 'recoger' ? `En ${o.sucursal}` :
    p === 'dejar' ? 'Contigo' :
    p === 'recogerLab' ? `Con ${o.laboratorio || 'el laboratorio'}` :
    p === 'entregar' ? `Contigo · va a ${o.sucursal}` :
    `En ${o.sucursal} · regresar al lab`

  const muestraPago = (p: Paso) => p === 'dejar' || p === 'recogerLab' || p === 'entregar'
  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`

  const titulo: Record<Paso | 'pagar', (o: OrdenLab) => string> = {
    recoger: o => `¿Recogiste el lente de ${o.paciente}?`,
    dejar: o => `¿Dejaste el lente de ${o.paciente} en el laboratorio?`,
    recogerLab: o => `¿Recogiste el lente de ${o.paciente} del laboratorio?`,
    entregar: o => `¿Entregaste el lente de ${o.paciente} en ${o.sucursal}?`,
    regresar: o => `¿Recogiste el lente de ${o.paciente} para regresarlo al lab?`,
    pagar: o => `Pago del lente de ${o.paciente}`,
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Trabajos</h1>
      <p className="text-sm text-zinc-400 mt-0.5">{activas.length} {activas.length === 1 ? 'pendiente' : 'pendientes'}</p>

      <div className="flex flex-wrap gap-2 mt-4">
        {FILTROS.map(f => {
          const n = cuenta(f.k)
          if (f.k !== 'todos' && n === 0) return null
          return (
            <button key={f.k} onClick={() => setFiltro(f.k)}
              className={`h-9 px-3.5 rounded-full text-sm border ${filtro === f.k ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : f.k === 'regresar' ? 'bg-white text-red-600 border-red-200' : 'bg-white text-zinc-600 border-zinc-200'}`}>
              {f.l} <span className="opacity-60">{n}</span>
            </button>
          )
        })}
      </div>

      {visibles.length === 0 && (
        <div className="py-14 text-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-600">Todo al día</p>
          <p className="text-xs text-zinc-400 mt-0.5">No hay trabajos pendientes aquí</p>
        </div>
      )}

      {lugares.map(lugar => (
        <div key={lugar} className="mt-6">
          <p className="text-sm font-medium text-zinc-500 mb-2">{lugar}</p>
          <div className="space-y-3">
            {grupos.get(lugar)!.map(o => {
              const p = pasoDe(o)!
              const rojo = p === 'regresar'
              const n = PASO_N[p]
              return (
                <div key={o.id} className={`bg-white rounded-2xl border p-4 ${rojo ? 'border-red-200' : 'border-zinc-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-zinc-900 leading-tight">
                        {o.paciente}
                        {esUrgente(o) && <span className="ml-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 bg-red-600 text-white rounded uppercase tracking-wide">Urgente</span>}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">{o.folio} · {o.tipoMica || 'Lente'} · de {o.sucursal}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className={`text-[11px] px-2 py-1 rounded-full ${rojo ? 'bg-red-50 text-red-700' : p === 'recogerLab' ? 'bg-violet-50 text-violet-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {ubicacion(o, p)}
                    </span>
                    {muestraPago(p) && (o.pagadoLab
                      ? <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Pagado{o.costoLab > 0 ? ` ${fmt$(o.costoLab)}` : ''}</span>
                      : <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700">Sin pagar</span>)}
                    {p === 'recogerLab' && o.fechaPromesa && (
                      <span className={`text-[11px] px-2 py-1 rounded-full ${o.fechaPromesa <= hoy ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {o.fechaPromesa <= hoy ? 'Ya debe estar listo' : `Listo el ${o.fechaPromesa.slice(8, 10)}/${o.fechaPromesa.slice(5, 7)}`}
                      </span>
                    )}
                  </div>
                  {rojo && o.motivoProblema && <p className="text-xs text-red-600 mt-2">{o.motivoProblema}</p>}

                  {!rojo && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1">
                        {[0, 1, 2, 3].map(i => (
                          <React.Fragment key={i}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i < n ? 'bg-emerald-500' : i === n ? 'bg-[#0D9488] ring-4 ring-[#0D9488]/15' : 'bg-zinc-200'}`} />
                            {i < 3 && <span className={`flex-1 h-0.5 ${i < n ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-1"><span>Óptica</span><span>Lab</span><span>En camino</span><span>Entregado</span></div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => abrir(o, p)}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform ${rojo ? 'bg-white text-red-600 border border-red-300' : 'bg-[#0B0E14] text-white'}`}>
                      {BOTON[p]}
                    </button>
                    {muestraPago(p) && !o.pagadoLab && (
                      <button onClick={() => abrir(o, 'pagar')}
                        className="h-11 px-4 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-700 bg-white active:scale-[0.98] transition-transform">
                        Pagar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Hoja de confirmación (sube desde abajo) ── */}
      {hoja && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setHoja(null)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-3 shadow-2xl" onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 rounded-full bg-zinc-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-zinc-900 leading-snug">{titulo[hoja.tipo](hoja.o)}</p>
            <p className="text-sm text-zinc-400 mt-0.5">{hoja.o.folio} · {hoja.o.tipoMica || 'Lente'} · de {hoja.o.sucursal}</p>

            {hoja.tipo === 'dejar' && (
              <>
                <p className="text-sm text-zinc-500 mt-5 mb-2">¿Con quién lo dejaste?</p>
                <div className="flex flex-wrap gap-2">
                  {LABORATORIOS.map(l => (
                    <button key={l} onClick={() => setD(x => ({ ...x, laboratorio: l }))}
                      className={`h-10 px-3.5 rounded-full text-sm border ${d.laboratorio === l ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'bg-white text-zinc-600 border-zinc-200'}`}>{l}</button>
                  ))}
                </div>
                <p className="text-sm text-zinc-500 mt-4 mb-2">¿Cuándo estará listo? <span className="text-zinc-300">(opcional)</span></p>
                <input type="date" value={d.fechaPromesa} onChange={e => setD(x => ({ ...x, fechaPromesa: e.target.value }))}
                  className="w-full h-12 px-3.5 rounded-xl border border-zinc-200 bg-white" />
              </>
            )}

            {(hoja.tipo === 'pagar' || ((hoja.tipo === 'dejar' || hoja.tipo === 'recogerLab') && !hoja.o.pagadoLab)) && (
              <div className={`mt-5 ${hoja.tipo === 'pagar' ? '' : 'rounded-2xl border border-zinc-200 p-4'}`}>
                {hoja.tipo !== 'pagar' && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-700">¿Pagaste ahorita?</span>
                    <span className="text-xs text-zinc-400">Opcional</span>
                  </div>
                )}
                <input value={d.monto} onChange={e => setD(x => ({ ...x, monto: e.target.value.replace(/[^\d.]/g, '') }))}
                  inputMode="decimal" placeholder="$0" className="w-full h-12 px-3.5 rounded-xl border border-zinc-200 bg-white" />
                <div className="grid grid-cols-2 h-12 mt-2 rounded-xl border border-zinc-200 overflow-hidden text-sm">
                  {(['efectivo', 'transferencia'] as const).map(m => (
                    <button key={m} onClick={() => setD(x => ({ ...x, metodo: x.metodo === m ? '' : m }))}
                      className={d.metodo === m ? 'bg-[#0B0E14] text-white font-medium' : 'bg-white text-zinc-600'}>
                      {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                    </button>
                  ))}
                </div>
                {hoja.tipo !== 'pagar' && <p className="text-xs text-zinc-400 text-center mt-2">Si no pagaste, déjalo vacío y queda como &ldquo;Sin pagar&rdquo;</p>}
              </div>
            )}

            {avisoHoja && <p className="text-sm text-red-600 mt-3">{avisoHoja}</p>}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setHoja(null)} className="flex-1 h-12 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700">Cancelar</button>
              <button onClick={confirmar} className="flex-[1.4] h-12 rounded-xl bg-[#0B0E14] text-white text-sm font-semibold active:scale-[0.98] transition-transform">
                {hoja.tipo === 'pagar' ? 'Guardar pago' : hoja.tipo === 'entregar' ? 'Sí, lo entregué' : hoja.tipo === 'dejar' ? 'Sí, lo dejé' : 'Sí, lo recogí'}
              </button>
            </div>
          </div>
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
  // Filtro de sucursal DENTRO de laboratorio — solo aplica a quien ve varias (sucursal='Todas').
  // A las vendedoras (fijas a una óptica) no se les muestra ni afecta.
  const multiSucursal = sucursal === 'Todas'
  const [filtroSuc, setFiltroSuc] = useState('Todas')
  const SUCS_LAB = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

  const q = busquedaLocal.toLowerCase().trim()
  const pendientes = ordenes
    .filter(o => {
      const matchSucursal = multiSucursal
        ? (filtroSuc === 'Todas' || o.sucursal === filtroSuc)   // admin/gerente/repartidor: eligen
        : o.sucursal === sucursal                                // vendedora: fija a su óptica
      // Sin búsqueda: solo activas. Con búsqueda: también entregadas/archivadas (para reimprimir notas viejas).
      const matchEstado   = q ? true : (o.estado !== 'entregado' && !o.archivado)
      const matchBusqueda = !q ||
        o.paciente.toLowerCase().includes(q) ||
        o.folio.toLowerCase().includes(q) ||
        o.tipoMica.toLowerCase().includes(q)
      return matchSucursal && matchEstado && matchBusqueda
    })
    .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso)) // más recientes primero

  const listos   = pendientes.filter(o => o.estado === 'listo')
  const enCamino = pendientes.filter(o => o.estado === 'en_camino')
  const otros    = pendientes.filter(o => !['listo', 'en_camino', 'entregado', 'problema'].includes(o.estado))
  const problemas = pendientes.filter(o => o.estado === 'problema')
  const entregadas = pendientes.filter(o => o.estado === 'entregado')   // solo aparecen al buscar

  const EntregaCard = ({ o }: { o: OrdenLab }) => {
    const [showProblema, setShowProblema] = useState(false)
    const [motivoInput, setMotivoInput]   = useState('')
    const [confirmarEntrega, setConfirmarEntrega] = useState(false)

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
                {o.estado === 'recibido' && o.recogidoAt && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded">Sergio ya lo recogió</span>
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
              {esUrgente(o) && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-600 text-white rounded uppercase tracking-wide mr-1.5">Urgente</span>}
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

          {/* Orden problema: esperando a Sergio + archivar cuando lo recoge */}
          {o.estado === 'problema' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-zinc-50 rounded px-3 py-2 text-xs text-zinc-500">
                <Truck className="w-3 h-3 flex-shrink-0 text-zinc-400" />
                Esperando a que Sergio recoja el lente
              </div>
              <button
                onClick={() => onUpdate(o.id, { archivado: true })}
                className="w-full flex items-center justify-center gap-2 py-2 border border-zinc-300 text-zinc-600 text-xs font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Sergio recogió el lente — archivar
              </button>
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
              {!confirmarEntrega ? (
                <button
                  disabled={rol === 'administrador' && o.costoLab === 0 && !o.esGarantia}
                  onClick={() => setConfirmarEntrega(true)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-colors ${
                    rol !== 'administrador' || o.costoLab > 0 || o.esGarantia
                      ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                      : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Entregado al paciente
                </button>
              ) : (
                <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 space-y-2">
                  <p className="text-xs font-semibold text-zinc-700 text-center">¿Confirmar entrega al paciente?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmarEntrega(false)}
                      className="flex-1 py-2 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { setConfirmarEntrega(false); onUpdate(o.id, { estado: 'entregado', fechaEntrega: hoyLocal() }) }}
                      className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Sí, entregar
                    </button>
                  </div>
                </div>
              )}
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

      {/* Filtro de sucursal (solo admin/gerente/repartidor) */}
      {multiSucursal && (
        <div className="flex flex-wrap gap-1.5">
          {['Todas', ...SUCS_LAB].map(s => (
            <button key={s} onClick={() => setFiltroSuc(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filtroSuc === s ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}

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
        <>
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

        {/* Regresar al lab: órdenes defectuosas esperando que el repartidor las recoja */}
        {problemas.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-red-100">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Regresar al lab · defectuosos por recoger
              </p>
              <span className="text-xs font-bold text-red-400">· {problemas.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {problemas.map(o => <EntregaCard key={o.id} o={o} />)}
            </div>
          </div>
        )}

        {/* Entregadas — solo aparecen al buscar, para reimprimir notas viejas */}
        {entregadas.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-zinc-200">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Entregadas · historial (reimprimir)
              </p>
              <span className="text-xs font-bold text-zinc-400">· {entregadas.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {entregadas.map(o => <EntregaCard key={o.id} o={o} />)}
            </div>
          </div>
        )}
        </>
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
    ventaId: (r.venta_id as string) ?? '',
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
    tratamiento: (r.tratamiento as string) ?? '',
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
    recogidoAt:     (r.recogido_at as string) ?? '',
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
  // Función reutilizable: se llama al montar Y después de crear/modificar órdenes
  const recargarOrdenes = useCallback(async () => {
    try {
      let legacyU: { rol?: string; sucursal?: string; nombre?: string } = {}
      try { legacyU = JSON.parse(localStorage.getItem('optios_demo_user') || '{}') } catch { /* noop */ }
      const user = {
        rol:      sessionUser?.rol      || legacyU.rol      || 'vendedor',
        sucursal: getSucursalFiltro(),
        nombre:   sessionUser?.nombre   || legacyU.nombre   || '',
      }
      setDemoUser(user as { rol: string; sucursal: string; nombre: string })
      setSucursalCrear(getSucursalActual())

      const supabase = createClient()
      let q = supabase.from('ordenes_lab').select('*').order('fecha_ingreso', { ascending: true })
      if (user?.rol === 'vendedor' && user?.sucursal && user.sucursal !== 'Todas') {
        q = q.eq('sucursal', user.sucursal)
      }
      const { data, error } = await q
      if (data && !error) {
        setOrdenes(data.map((r, i) => rowToOrden(r as Record<string, unknown>, i)))
      }
    } catch (e) {
      console.warn('Error al cargar órdenes:', e)
    }
  }, [sessionUser?.rol, sessionUser?.sucursal, sessionUser?.nombre])

  useEffect(() => {
    setCargando(true)
    recargarOrdenes().finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargarOrdenes])

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
    if (changes.recogidoAt         !== undefined) dbChanges.recogido_at          = changes.recogidoAt || null
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

  const vincularVenta = async (v: VentaRef) => {
    // Si es un paciente (venta vieja no en el sistema) NO se marca como venta vinculada:
    // solo autocompletamos su info y su graduación, y los campos siguen editables.
    if (!v.esPaciente) setVentaVinculada(v)
    setForm(prev => ({
      ...prev,
      folioVenta: v.esPaciente ? prev.folioVenta : v.folio,
      ventaId: v.esPaciente ? prev.ventaId : v.id,
      pacienteId: v.pacienteId,
      paciente: v.paciente,
      telefono: v.telefono,
      sucursal: normalizarSucursal(v.sucursal) || prev.sucursal,
    }))

    const supabase = createClient()

    // 1. Productos de la venta → mica (lo que compró), tratamiento (filtros), armazón
    if (v.id) {
      const { data: items } = await supabase.from('ventas_items').select('nombre').eq('venta_id', v.id)
      const nombres = (items ?? []).map(i => (i.nombre as string) ?? '').filter(Boolean)
      const micas   = nombres.filter(esMicaProd)
      // Tratamiento = filtros que NO son mica (evita duplicar micas-combo en tratamiento)
      const filtros = nombres.filter(n => esFiltroProd(n) && !esMicaProd(n))
      const armazon = nombres.find(n => !esMicaProd(n) && !esFiltroProd(n)) ?? ''
      setForm(prev => ({
        ...prev,
        tipoMica:           micas.join(' + ') || prev.tipoMica,
        tratamiento:        filtros.join(', '),
        descripcionArmazon: armazon || prev.descripcionArmazon,
      }))
    }

    // 2. ÚLTIMA receta del paciente → graduación (clave: en garantías por cambio de
    //    graduación se usa la más reciente, no la de la venta original)
    if (v.pacienteId) {
      const { data: rec } = await supabase.from('recetas')
        .select('od_esfera,od_cilindro,od_eje,od_add,oi_esfera,oi_cilindro,oi_eje,oi_add,dp_od,dp_oi,fecha')
        .eq('paciente_id', v.pacienteId)
        .order('fecha', { ascending: false })
        .limit(1).maybeSingle()
      if (rec) {
        const r = rec as Record<string, string>
        // Nunca recorrer el cilindro a la esfera (ver lib/graduacion.ts)
        const fmtOjo = textoOjo
        setForm(prev => ({
          ...prev,
          od:  fmtOjo(r.od_esfera, r.od_cilindro, r.od_eje),
          oi:  fmtOjo(r.oi_esfera, r.oi_cilindro, r.oi_eje),
          add: r.od_add || '',
          dp:  (r.dp_od || r.dp_oi) ? `${r.dp_od ?? ''}/${r.dp_oi ?? ''}` : '',
        }))
      }
    }
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
    // Validación clara (antes fallaba en silencio)
    if (!form.paciente?.trim()) { alert('Falta el nombre del paciente.'); return }
    if (!form.tipoMica?.trim()) { alert('Falta el tipo de mica (lo que compró).'); return }

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
    const { data: inserted, error: errorInsert } = await supabase.from('ordenes_lab').insert({
      folio,
      folio_venta:         form.folioVenta,
      venta_id:            form.ventaId || null,
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
      es_garantia:         form.esGarantia,
      motivo_problema:     form.esGarantia ? form.motivoProblema : '',
    }).select('id').single()

    // Si el insert falló, avisar el motivo real en vez de quedarse callado
    if (errorInsert || !inserted?.id) {
      alert('No se pudo crear la orden: ' + (errorInsert?.message ?? 'error desconocido') + '\n\nToma captura de este mensaje y compártelo.')
      return
    }

    // Registrar evento de creación en el historial
    if (inserted?.id) {
      await supabase.from('ordenes_lab_historial').insert({
        orden_id:       inserted.id,
        evento:         'estado',
        estado_antes:   null,
        estado_despues: 'recibido',
        registrado_por: demoUser?.nombre ?? '',
        notas:          form.esGarantia ? 'Orden de garantía creada' : 'Orden creada',
      })
    }

    // Re-cargar todas las órdenes de la DB para asegurar que aparezca
    await recargarOrdenes()
    setModal(false)
    setVentaVinculada(null)
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

            const { data: inserted, error: errorGar } = await supabase.from('ordenes_lab').insert({
              folio:               folioNuevo,
              folio_venta:         original.folioVenta,
              venta_id:            original.ventaId || null,
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
              creado_por:          demoUser?.nombre ?? '',
            }).select('id').single()

            if (errorGar || !inserted?.id) {
              alert('No se pudo crear la orden de garantía: ' + (errorGar?.message ?? 'error desconocido') + '\n\nToma captura de este mensaje.')
              return
            }

            // Registrar historial de la nueva orden de garantía
            await supabase.from('ordenes_lab_historial').insert({
              orden_id:       inserted.id,
              evento:         'estado',
              estado_antes:   null,
              estado_despues: 'recibido',
              registrado_por: demoUser?.nombre ?? '',
              notas:          `Garantía creada desde ${original.folio} — ${motivo}`,
            })

            // 3. Re-cargar órdenes de la DB para que aparezca
            await recargarOrdenes()
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
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <div className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 text-zinc-600">
                    {form.sucursal}
                  </div>
                </div>
              </div>

              {/* Tipo de mica (el laboratorio no se muestra a los empleados; se asigna al llevar al lab) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de mica * <span className="font-normal text-zinc-400">(lo que compró)</span></label>
                <input value={form.tipoMica} onChange={e => f('tipoMica', e.target.value.toUpperCase())}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case"
                  placeholder="Ej: MICA PROGRESIVA POLY PLUS 1.58" />
              </div>

              {/* Armazón */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Armazón</label>
                <div className="flex gap-2 mb-2">
                  {[{ v: 'comprado', l: 'Comprado con nosotros' }, { v: 'propio', l: 'Propio del cliente' }].map(opt => (
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

                  {/* Tratamiento (texto libre: filtros que compró) */}
                  <div className="border-t border-zinc-200 pt-3">
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Tratamiento <span className="font-normal text-zinc-400">(filtros que compró)</span></p>
                    <input value={form.tratamiento === 'ninguno' ? '' : form.tratamiento}
                      onChange={e => f('tratamiento', e.target.value.toUpperCase())}
                      className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase placeholder:normal-case"
                      placeholder="Ej: FILTRO ANTIRREFLEJO, FILTRO TRANSITION" />
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

              {/* Garantía */}
              <button type="button"
                onClick={() => {
                  const nuevo = !form.esGarantia
                  setForm(prev => ({ ...prev, esGarantia: nuevo, ...(nuevo ? { precioCliente: 0, anticipo: 0 } : {}) }))
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-black tracking-widest border-2 transition-all ${
                  form.esGarantia
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'border-zinc-300 text-zinc-400 hover:border-purple-300 hover:text-purple-500'
                }`}>
                🔄 {form.esGarantia ? 'GARANTÍA · sin cobro al cliente' : 'Marcar como garantía'}
              </button>
              {form.esGarantia && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Motivo de la garantía</label>
                  <textarea value={form.motivoProblema} onChange={e => f('motivoProblema', e.target.value.toUpperCase())} rows={2}
                    className="w-full border border-purple-200 rounded px-3 py-2 text-sm bg-purple-50/40 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none uppercase placeholder:normal-case"
                    placeholder="Ej: no se adaptó al progresivo, graduación incorrecta..." />
                </div>
              )}

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
