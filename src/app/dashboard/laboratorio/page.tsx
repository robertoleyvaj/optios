'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Save, ChevronDown, ChevronLeft, Filter,
  Clock, CheckCircle2, AlertTriangle, Truck,
  Package, Eye, Phone, Calendar, FileText,
  ArrowRight, Printer, Link2, User, DollarSign,
} from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type EstadoOrden =
  | 'recibido'
  | 'en_laboratorio'
  | 'en_camino'
  | 'listo'
  | 'entregado'
  | 'problema'

type Tratamiento = 'ninguno' | 'tinte' | 'fotocromatico' | 'polarizado'

type OrdenLab = {
  id: number
  supabaseId: string   // UUID real en Supabase ('' en mock)
  folio: string
  folioVenta: string   // vínculo con venta
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
}

// ─────────────────────────────────────────
// Ventas mock  (espejo del módulo de ventas)
// ─────────────────────────────────────────
const VENTAS_REF = [
  { folio: 'V-0041', paciente: 'María González',  telefono: '686 123 4567', sucursal: 'Baja Visión',    od: '-2.50 -0.75 x170', oi: '-2.25 -0.50 x005', add: '+2.00', dp: '62', armazon: 'Ray-Ban RB5154 negro' },
  { folio: 'V-0040', paciente: 'Carlos Ruiz',     telefono: '686 234 5678', sucursal: '5 de Mayo',      od: '+1.00',            oi: '+1.25 -0.25 x090', add: '',      dp: '64', armazon: '' },
  { folio: 'V-0039', paciente: 'Ana López',       telefono: '686 345 6789', sucursal: 'Plaza Laureles', od: '-3.00 -1.25 x082', oi: '-3.25 -1.00 x095', add: '+2.50', dp: '60', armazon: 'Armazón básico' },
  { folio: 'V-0038', paciente: 'Pedro Sánchez',   telefono: '686 456 7890', sucursal: 'Baja Visión',    od: '-1.00',            oi: '-0.75',            add: '',      dp: '65', armazon: 'Armazón básico' },
  { folio: 'V-0037', paciente: 'Laura Martínez',  telefono: '686 567 8901', sucursal: 'Baja Visión',    od: '-4.50',            oi: '-4.25',            add: '',      dp: '61', armazon: '' },
  { folio: 'V-0036', paciente: 'Jorge Herrera',   telefono: '686 678 9012', sucursal: 'Plaza Laureles', od: '+2.00 -0.50 x100', oi: '+2.25 -0.75 x085', add: '+2.25', dp: '63', armazon: 'Ray-Ban progresivo' },
]

// ─────────────────────────────────────────
// Config estados
// ─────────────────────────────────────────
const ESTADO_CONFIG: Record<EstadoOrden, { label: string; bg: string; text: string; dot: string; icon: React.ElementType }> = {
  recibido:       { label: 'Recibido',            bg: 'bg-slate-100',  text: 'text-slate-600',   dot: '#94A3B8', icon: Package },
  en_laboratorio: { label: 'En laboratorio',      bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: '#6366F1', icon: Clock },
  en_camino:      { label: 'En camino',           bg: 'bg-blue-50',    text: 'text-blue-700',    dot: '#3B82F6', icon: Truck },
  listo:          { label: 'Listo para entregar', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: '#10B981', icon: CheckCircle2 },
  entregado:      { label: 'Entregado',           bg: 'bg-slate-100',  text: 'text-slate-400',   dot: '#CBD5E1', icon: CheckCircle2 },
  problema:       { label: 'Con problema',        bg: 'bg-red-50',     text: 'text-red-600',     dot: '#EF4444', icon: AlertTriangle },
}

const FLUJO: EstadoOrden[] = ['recibido', 'en_laboratorio', 'en_camino', 'listo', 'entregado']

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

const LABORATORIOS = ['Laboratorio Visión', 'Óptika Lab', 'Laboratorio Sur', 'Externo / cliente']
const SUCURSALES   = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

// ─────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────
const dias = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}

const ORDENES_MOCK: OrdenLab[] = [
  { id: 1, supabaseId: '', folio: 'LAB-0041', folioVenta: 'V-0041', paciente: 'María González',  telefono: '686 123 4567', sucursal: 'Baja Visión',    laboratorio: 'Laboratorio Visión', tipoMica: 'Progresiva antirreflejante', armazon: 'comprado', descripcionArmazon: 'Ray-Ban RB5154 negro', od: '-2.50 -0.75 x170', oi: '-2.25 -0.50 x005', add: '+2.00', dp: '62', altura: '18', tratamiento: 'ninguno',     colorTratamiento: '', urgente: false, fechaIngreso: dias(-4), fechaPromesa: dias(3),  fechaEntrega: '', fechaEnvioLab: dias(-3), fechaRecogidaLab: '',       pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const, estado: 'en_laboratorio', costoLab: 1200, precioCliente: 3200, anticipo: 1000, notas: 'Antirreflejante premium' },
  { id: 2, supabaseId: '', folio: 'LAB-0040', folioVenta: 'V-0036', paciente: 'Jorge Herrera',   telefono: '686 678 9012', sucursal: '5 de Mayo',      laboratorio: 'Óptika Lab',          tipoMica: 'Progresiva transitions',   armazon: 'comprado', descripcionArmazon: 'Oakley gris',          od: '+2.00 -0.50 x100', oi: '+2.25 -0.75 x085', add: '+2.25', dp: '63', altura: '20', tratamiento: 'tinte',       colorTratamiento: 'café', urgente: false, fechaIngreso: dias(-6), fechaPromesa: dias(1),  fechaEntrega: '', fechaEnvioLab: dias(-5), fechaRecogidaLab: dias(-1), pagadoLab: true,  fechaPagoLab: dias(-1), metodoPagoLab: 'transferencia' as const, estado: 'listo',          costoLab: 1800, precioCliente: 4800, anticipo: 2000, notas: '' },
  { id: 3, supabaseId: '', folio: 'LAB-0039', folioVenta: 'V-0039', paciente: 'Ana López',       telefono: '686 345 6789', sucursal: 'Plaza Laureles', laboratorio: 'Laboratorio Visión',   tipoMica: 'Bifocal',                  armazon: 'comprado', descripcionArmazon: 'Armazón básico',       od: '-3.00 -1.25 x082', oi: '-3.25 -1.00 x095', add: '+2.50', dp: '60', altura: '16', tratamiento: 'ninguno',     colorTratamiento: '', urgente: false, fechaIngreso: dias(-3), fechaPromesa: dias(4),  fechaEntrega: '', fechaEnvioLab: dias(-2), fechaRecogidaLab: dias(0),  pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const, estado: 'en_camino',      costoLab: 900,  precioCliente: 2600, anticipo: 1000, notas: '' },
  { id: 4, supabaseId: '', folio: 'LAB-0038', folioVenta: 'V-0037', paciente: 'Laura Martínez',  telefono: '686 567 8901', sucursal: 'Baja Visión',    laboratorio: 'Laboratorio Sur',      tipoMica: 'Lentes de contacto blandos', armazon: 'propio', descripcionArmazon: '',                  od: '-4.50',            oi: '-4.25',            add: '',      dp: '61', altura: '',   tratamiento: 'ninguno',     colorTratamiento: '', urgente: false, fechaIngreso: dias(-2), fechaPromesa: dias(5),  fechaEntrega: '', fechaEnvioLab: dias(-1), fechaRecogidaLab: '',       pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const, estado: 'en_laboratorio', costoLab: 600,  precioCliente: 1800, anticipo: 900,  notas: 'Mensuales Acuvue Oasys' },
  { id: 5, supabaseId: '', folio: 'LAB-0037', folioVenta: 'V-0038', paciente: 'Pedro Sánchez',   telefono: '686 456 7890', sucursal: 'Baja Visión',    laboratorio: '',                     tipoMica: 'Monofocal antirreflejante', armazon: 'comprado', descripcionArmazon: 'Armazón básico',   od: '-1.00',            oi: '-0.75',            add: '',      dp: '65', altura: '',   tratamiento: 'polarizado',  colorTratamiento: 'gris', urgente: false, fechaIngreso: dias(0),  fechaPromesa: dias(7),  fechaEntrega: '', fechaEnvioLab: '',       fechaRecogidaLab: '',       pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const, estado: 'recibido',       costoLab: 0,    precioCliente: 1400, anticipo: 700,  notas: '' },
  { id: 6, supabaseId: '', folio: 'LAB-0036', folioVenta: 'V-0040', paciente: 'Carlos Ruiz',     telefono: '686 234 5678', sucursal: '5 de Mayo',      laboratorio: 'Laboratorio Visión',   tipoMica: 'Monofocal blanca',         armazon: 'propio',   descripcionArmazon: 'Marco propio',         od: '+1.00',            oi: '+1.25 -0.25 x090', add: '',      dp: '64', altura: '',   tratamiento: 'ninguno',     colorTratamiento: '', urgente: false, fechaIngreso: dias(-8), fechaPromesa: dias(-1), fechaEntrega: dias(-1), fechaEnvioLab: dias(-7), fechaRecogidaLab: dias(-2), pagadoLab: true,  fechaPagoLab: dias(-2), metodoPagoLab: 'efectivo' as const, estado: 'entregado',       costoLab: 350,  precioCliente: 900,  anticipo: 900,  notas: '' },
  { id: 7, supabaseId: '', folio: 'LAB-0035', folioVenta: '',       paciente: 'Sofía Ramos',     telefono: '686 789 0123', sucursal: 'Baja Visión',    laboratorio: 'Óptika Lab',           tipoMica: 'Progresiva estándar',      armazon: 'comprado', descripcionArmazon: 'Silhouette titanio',   od: '-1.50 -0.50 x160', oi: '-1.75 -0.25 x020', add: '+1.50', dp: '60', altura: '19', tratamiento: 'fotocromatico', colorTratamiento: '', urgente: false, fechaIngreso: dias(-5), fechaPromesa: dias(0),  fechaEntrega: '', fechaEnvioLab: dias(-4), fechaRecogidaLab: '',       pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const, estado: 'problema',       costoLab: 1400, precioCliente: 3800, anticipo: 1500, notas: 'Micas llegaron con raya. Reposición en proceso.' },
  { id: 8, supabaseId: '', folio: 'LAB-0042', folioVenta: 'V-0042', paciente: 'Daniela Fuentes', telefono: '661 234 5678', sucursal: '5 de Mayo',      laboratorio: '',                     tipoMica: 'Monofocal antirreflejante', armazon: 'comprado', descripcionArmazon: 'Armazón Guess dorado', od: '-1.75 -0.50 x180', oi: '-2.00 -0.25 x005', add: '',      dp: '63', altura: '',   tratamiento: 'ninguno',     colorTratamiento: '', urgente: false, fechaIngreso: dias(0),  fechaPromesa: dias(5),  fechaEntrega: '', fechaEnvioLab: '',       fechaRecogidaLab: '',       pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const, estado: 'recibido',       costoLab: 0,    precioCliente: 1600, anticipo: 800,  notas: '' },
]

const formVacio = (): Omit<OrdenLab, 'id' | 'folio'> => ({
  supabaseId: '',
  folioVenta: '', paciente: '', telefono: '', sucursal: 'Baja Visión',
  laboratorio: 'Laboratorio Visión', tipoMica: 'Monofocal antirreflejante',
  armazon: 'comprado', descripcionArmazon: '',
  od: '', oi: '', add: '', dp: '', altura: '', tratamiento: 'ninguno', colorTratamiento: '', urgente: false,
  fechaIngreso: dias(0), fechaPromesa: dias(7), fechaEntrega: '',
  fechaEnvioLab: '', fechaRecogidaLab: '',
  pagadoLab: false, fechaPagoLab: '', metodoPagoLab: '' as const,
  estado: 'recibido', costoLab: 0, precioCliente: 0, anticipo: 0, notas: '',
})

function diasRestantes(fecha: string) {
  if (!fecha) return null
  return Math.round((new Date(fecha).getTime() - Date.now()) / 86400000)
}

// ─────────────────────────────────────────
// Componente: buscador de venta
// ─────────────────────────────────────────
function BuscadorVenta({ onSelect }: { onSelect: (v: typeof VENTAS_REF[0]) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const resultados = query.length > 1
    ? VENTAS_REF.filter(v =>
        v.folio.toLowerCase().includes(query.toLowerCase()) ||
        v.paciente.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : []

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full border border-slate-200 rounded pl-9 pr-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
          placeholder="Buscar por folio (V-0041) o nombre de paciente..."
        />
      </div>
      {open && resultados.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {resultados.map(v => (
            <button key={v.folio}
              onClick={() => { onSelect(v); setQuery(''); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0">
              <div className="w-8 h-8 rounded bg-[#0B1A35] flex items-center justify-center flex-shrink-0">
                <Link2 className="w-3.5 h-3.5 text-[#2BBFB3]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{v.folio}</span>
                  <span className="text-sm font-semibold text-slate-700">{v.paciente}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{v.sucursal} · {v.telefono}</p>
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
  const parts = grad.trim().split(/\s+/)
  return { esf: parts[0] || '—', cil: parts[1] || '—', eje: parts[2]?.replace('x','').replace('X','') || '—' }
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

    const win = window.open('', '_blank', 'width=420,height=640')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${orden.folio}</title>
<style>
  @page { size: 4in 6in; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #000; width: 100%; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .hdr-left h1 { font-size: 15px; font-weight: 900; letter-spacing: -0.3px; }
  .hdr-left p { font-size: 9px; color: #555; }
  .hdr-right { text-align: right; }
  .folio { font-size: 14px; font-weight: 900; font-family: monospace; }
  .fecha { font-size: 9px; color: #555; }
  .paciente { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
  .sucursal { font-size: 9px; color: #555; margin-bottom: 8px; }
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
  ${orden.urgente ? `<div style="background:#000;color:#fff;text-align:center;font-size:22px;font-weight:900;letter-spacing:3px;padding:7px 0;margin-bottom:8px;border-radius:3px;">⚡ URGENTE</div>` : ''}

  <div class="hdr">
    <div class="hdr-left">
      <h1>${SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea1 ?? orden.sucursal}</h1>
      <p>${SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea2 ? SUCURSAL_CONFIG[orden.sucursal].nombreLinea2 + ' · ' : ''}Orden de laboratorio</p>
    </div>
    <div class="hdr-right">
      <div class="folio">${orden.folio}</div>
      <div class="fecha">${fecha}</div>
      ${orden.folioVenta ? `<div class="folio-ref">${orden.folioVenta}</div>` : ''}
    </div>
  </div>

  <div class="paciente">${orden.paciente}</div>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Vista previa — {orden.folio}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{orden.paciente} · {orden.sucursal}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#0B1A35] text-white rounded text-sm font-semibold hover:bg-[#0d2145] transition-colors">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Vista previa de la hoja 4×6" */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vista previa · Hoja 4×6&quot; (térmica)</p>
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">100 × 150 mm</span>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
              {/* Banner urgente */}
              {orden.urgente && (
                <div className="bg-black text-white text-center text-sm font-black tracking-widest py-2">
                  ⚡ URGENTE
                </div>
              )}
              {/* Header */}
              <div className="bg-[#0B1A35] px-5 py-4 flex justify-between items-start">
                <div>
                  <p className="text-white font-bold text-base">{SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea1 ?? orden.sucursal}</p>
                  {SUCURSAL_CONFIG[orden.sucursal]?.nombreLinea2 && (
                    <p className="text-white/70 text-xs">{SUCURSAL_CONFIG[orden.sucursal].nombreLinea2}</p>
                  )}
                  <p className="text-white/60 text-xs">Orden de laboratorio</p>
                </div>
                <div className="text-right">
                  <p className="text-[#2BBFB3] font-mono font-bold">{orden.folio}</p>
                  <p className="text-white/60 text-xs">{fecha}</p>
                </div>
              </div>

              <div className="p-5 grid grid-cols-2 gap-6">
                {/* Columna izquierda */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Paciente</p>
                    <p className="font-bold text-slate-800">{orden.paciente}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Sucursal</p>
                    <p className="text-slate-700">{orden.sucursal}</p>
                  </div>
                  {orden.folioVenta && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Folio de venta</p>
                      <p className="font-mono text-slate-700">{orden.folioVenta}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Tipo de mica</p>
                    <p className="font-bold text-slate-800">{orden.tipoMica}</p>
                    {tratFull && <p className="text-xs text-slate-600 mt-0.5 font-semibold">{tratFull}</p>}
                  </div>
                  {orden.descripcionArmazon && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Armazón</p>
                      <p className="text-slate-700">{orden.descripcionArmazon}</p>
                      <p className="text-xs text-slate-400">{orden.armazon === 'propio' ? 'Del cliente' : 'Comprado en tienda'}</p>
                    </div>
                  )}
                </div>

                {/* Columna derecha: graduación */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Graduación</p>
                  <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold"></th>
                        <th className="text-center px-2 py-2 text-slate-500 font-semibold">Esf</th>
                        <th className="text-center px-2 py-2 text-slate-500 font-semibold">Cil</th>
                        <th className="text-center px-2 py-2 text-slate-500 font-semibold">Eje</th>
                        {orden.add && <th className="text-center px-2 py-2 text-slate-500 font-semibold">ADD</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { label: 'OD', grad: orden.od },
                        { label: 'OI', grad: orden.oi },
                      ].map(r => {
                        const g = parseGrad(r.grad)
                        return (
                          <tr key={r.label}>
                            <td className="px-3 py-2 font-bold text-slate-600">{r.label}</td>
                            <td className="text-center px-2 py-2 font-mono text-slate-800">{g.esf}</td>
                            <td className="text-center px-2 py-2 font-mono text-slate-800">{g.cil}</td>
                            <td className="text-center px-2 py-2 font-mono text-slate-800">{g.eje}°</td>
                            {orden.add && <td className="text-center px-2 py-2 font-mono text-slate-800">{orden.add}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span><span className="font-semibold">D.P.:</span> {orden.dp} mm</span>
                    {orden.altura && <span><span className="font-semibold">Altura:</span> {orden.altura} mm</span>}
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-400">Fecha de ingreso</p>
                  <p className="text-slate-700 mt-0.5">{orden.fechaIngreso}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400">Fecha promesa</p>
                  <p className="text-slate-700 mt-0.5 font-semibold">{orden.fechaPromesa}</p>
                </div>
              </div>

              {orden.notas && (
                <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-400">Observaciones: </span>{orden.notas}
                </div>
              )}

              {/* Footer firma */}
              <div className="border-t border-slate-200 px-5 py-4 flex justify-end">
                <div className="text-center text-xs text-slate-400">
                  <div className="border-t border-slate-300 w-48 mb-1"></div>
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
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function VistaRepartidor({ ordenes, onUpdate }: {
  ordenes: OrdenLab[]
  onUpdate: (id: number, changes: Partial<OrdenLab>) => void
}) {
  const [selectedId,  setSelectedId] = useState<number | null>(null)
  const [editMode,    setEditMode]   = useState(false)
  const [savedNext,   setSavedNext]  = useState<number | null | 'none'>('none') // null=no next, number=nextId, 'none'=not saved
  const [draft, setDraft] = useState<{
    estado: EstadoOrden
    laboratorio: string
    costoLab: string
    metodoPagoLab: 'transferencia' | 'efectivo' | ''
    pagadoLab: boolean
    fechaPromesa: string
    notas: string
  } | null>(null)

  const lista = ordenes
    .filter(o => o.estado !== 'entregado' && o.estado !== 'problema')
    .sort((a, b) => (a.fechaIngreso ?? '').localeCompare(b.fechaIngreso ?? '') || a.folio.localeCompare(b.folio))

  const ESTADO_OPTS = [
    { value: 'recibido'       as EstadoOrden, label: 'Por llevar',      dot: 'bg-slate-400'   },
    { value: 'en_laboratorio' as EstadoOrden, label: 'En laboratorio',  dot: 'bg-indigo-500'  },
    { value: 'en_camino'      as EstadoOrden, label: 'En camino',       dot: 'bg-blue-500'    },
    { value: 'listo'          as EstadoOrden, label: 'Listo',           dot: 'bg-emerald-500' },
  ]

  const BADGE: Record<string, { bg: string; text: string; label: string }> = {
    recibido:       { bg: 'bg-slate-100',  text: 'text-slate-600',   label: 'Por llevar'      },
    en_laboratorio: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  label: 'En laboratorio'  },
    en_camino:      { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'En camino'       },
    listo:          { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Listo'           },
  }

  const DOT: Record<string, string> = {
    recibido: 'bg-slate-400', en_laboratorio: 'bg-indigo-500',
    en_camino: 'bg-blue-500', listo: 'bg-emerald-500',
  }

  const counts = {
    porLlevar:  lista.filter(o => o.estado === 'recibido').length,
    enLab:      lista.filter(o => o.estado === 'en_laboratorio').length,
    enCamino:   lista.filter(o => o.estado === 'en_camino').length,
    listos:     lista.filter(o => o.estado === 'listo').length,
    sinPagar:   lista.filter(o => o.costoLab > 0 && !o.pagadoLab).length,
    atrasados:  lista.filter(o => o.fechaPromesa && new Date(o.fechaPromesa) < new Date(new Date().toDateString())).length,
  }

  const getNextId = (currentId: number) => {
    const idx = lista.findIndex(o => o.id === currentId)
    for (let i = idx + 1; i < lista.length; i++) {
      if (lista[i].estado !== 'listo') return lista[i].id
    }
    return null
  }

  const getHistorial = (o: OrdenLab) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 15)
    const dentro = (f: string) => f && new Date(f) >= cutoff

    const ev: { fecha: string; label: string }[] = []
    if (o.fechaIngreso     && dentro(o.fechaIngreso))    ev.push({ fecha: o.fechaIngreso,    label: 'Orden creada' })
    if (o.fechaEnvioLab    && dentro(o.fechaEnvioLab))   ev.push({ fecha: o.fechaEnvioLab,   label: 'Llevada al laboratorio' })
    if (o.fechaRecogidaLab && dentro(o.fechaRecogidaLab))ev.push({ fecha: o.fechaRecogidaLab,label: 'Recogida del laboratorio' })
    if (o.fechaPagoLab     && dentro(o.fechaPagoLab))    ev.push({ fecha: o.fechaPagoLab,    label: `Pago registrado · ${o.metodoPagoLab === 'efectivo' ? 'Efectivo' : 'Transferencia'}` })
    if (o.fechaEntrega     && dentro(o.fechaEntrega))    ev.push({ fecha: o.fechaEntrega,    label: 'Entregada en óptica' })
    return ev
  }

  const openOrder = (id: number) => {
    setSelectedId(id)
    setEditMode(false)
    setSavedNext('none')
    setDraft(null)
  }

  const startEdit = (o: OrdenLab) => {
    setDraft({
      estado: o.estado as EstadoOrden,
      laboratorio: o.laboratorio,
      costoLab: o.costoLab > 0 ? String(o.costoLab) : '',
      metodoPagoLab: o.metodoPagoLab,
      pagadoLab: o.pagadoLab,
      fechaPromesa: o.fechaPromesa,
      notas: o.notas,
    })
    setEditMode(true)
  }

  const saveEdit = (o: OrdenLab) => {
    if (!draft) return
    const changes: Partial<OrdenLab> = {
      estado: draft.estado,
      laboratorio: draft.laboratorio,
      costoLab: Number(draft.costoLab) || 0,
      metodoPagoLab: draft.metodoPagoLab,
      pagadoLab: draft.pagadoLab,
      fechaPromesa: draft.fechaPromesa,
      notas: draft.notas,
    }
    if (draft.estado === 'en_laboratorio' && !o.fechaEnvioLab)  changes.fechaEnvioLab    = dias(0)
    if (draft.estado === 'en_camino'      && !o.fechaRecogidaLab) changes.fechaRecogidaLab = dias(0)
    if (draft.estado === 'listo'          && !o.fechaEntrega)    changes.fechaEntrega     = dias(0)
    if (draft.pagadoLab && !o.pagadoLab)                         changes.fechaPagoLab     = dias(0)
    onUpdate(o.id, changes)
    setSavedNext(getNextId(o.id))
    setEditMode(false)
    setDraft(null)
  }

  const selected = lista.find(o => o.id === selectedId) ?? null

  // ── Pantalla "¡Guardado!" ──────────────────────────────────
  if (savedNext !== 'none' && selected) {
    const nextOrder = savedNext !== null ? lista.find(o => o.id === savedNext) : null
    return (
      <div className="max-w-sm mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">¡Guardado!</p>
            <p className="text-sm text-slate-400 mt-1">
              {nextOrder ? 'Vamos con la siguiente orden' : 'No hay más órdenes pendientes'}
            </p>
          </div>
          {nextOrder && (
            <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-100">
              <p className="text-xs font-bold text-slate-400">{nextOrder.folio}</p>
              <p className="text-base font-bold text-slate-800 mt-1">{nextOrder.paciente}</p>
              <p className="text-xs text-slate-400 mt-0.5">{nextOrder.tipoMica}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2 h-2 rounded-full ${DOT[nextOrder.estado]}`} />
                <span className="text-xs text-slate-500">{BADGE[nextOrder.estado]?.label}</span>
                <span className="text-xs text-slate-400 ml-auto">{nextOrder.sucursal}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setSelectedId(null); setSavedNext('none') }}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50">
              Ver lista
            </button>
            {nextOrder ? (
              <button onClick={() => openOrder(nextOrder.id)}
                className="flex-1 py-2.5 bg-[#0B1A35] text-white text-sm font-bold rounded-xl">
                Siguiente →
              </button>
            ) : (
              <button onClick={() => { setSelectedId(null); setSavedNext('none') }}
                className="flex-1 py-2.5 bg-[#0B1A35] text-white text-sm font-bold rounded-xl">
                Terminar
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Vista detalle ──────────────────────────────────────────
  if (selected) {
    const o = selected
    const badge = BADGE[o.estado]
    const hist  = getHistorial(o)
    const hasCosto = o.costoLab > 0 || (draft && Number(draft.costoLab) > 0)

    return (
      <div className="max-w-sm mx-auto space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setSelectedId(null); setEditMode(false); setDraft(null) }}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-4 h-4" /> Órdenes
          </button>
          <span className="text-sm font-bold text-slate-500">{o.folio}</span>
          <div className="w-20" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Paciente */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <p className="text-lg font-bold text-slate-800">{o.paciente}</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {o.tipoMica}{o.descripcionArmazon ? ` · ${o.descripcionArmazon}` : ''}
            </p>
          </div>

          {/* Filas de campos */}
          <div className="px-4">
            <FormRow label="Sucursal">
              <span className="text-sm font-medium text-slate-700">{o.sucursal}</span>
            </FormRow>

            <FormRow label="Laboratorio">
              {editMode && draft ? (
                <select value={draft.laboratorio}
                  onChange={e => setDraft(d => d ? { ...d, laboratorio: e.target.value } : d)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#2BBFB3]">
                  <option value="">Sin asignar</option>
                  {LABORATORIOS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : (
                <span className="text-sm font-medium text-slate-700">{o.laboratorio || '—'}</span>
              )}
            </FormRow>

            <FormRow label="Estado">
              {editMode && draft ? (
                <div className="space-y-1.5">
                  {ESTADO_OPTS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setDraft(d => d ? { ...d, estado: opt.value } : d)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        draft.estado === opt.value
                          ? 'bg-[#0B1A35] text-white'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  {o.costoLab > 0 && !o.pagadoLab && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                      Pago pendiente
                    </span>
                  )}
                  {o.urgente && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">URGENTE</span>
                  )}
                </div>
              )}
            </FormRow>

            <FormRow label="Costo">
              {editMode && draft ? (
                <input type="number" value={draft.costoLab} placeholder="$0"
                  onChange={e => setDraft(d => d ? { ...d, costoLab: e.target.value } : d)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#2BBFB3] w-32" />
              ) : (
                <span className="text-sm font-semibold text-slate-800">
                  {o.costoLab > 0 ? `$${o.costoLab.toLocaleString('es-MX')}` : '—'}
                </span>
              )}
            </FormRow>

            {hasCosto && (
              <FormRow label="Pago al lab">
                {editMode && draft ? (
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { v: '' as const,              label: 'Pendiente'     },
                      { v: 'transferencia' as const, label: 'Transferencia' },
                      { v: 'efectivo' as const,      label: 'Efectivo'      },
                    ]).map(m => (
                      <button key={m.v}
                        onClick={() => setDraft(d => d ? { ...d, metodoPagoLab: m.v, pagadoLab: m.v !== '' } : d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          draft.metodoPagoLab === m.v
                            ? 'bg-[#0B1A35] text-white border-[#0B1A35]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`text-sm font-medium ${o.pagadoLab ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {o.pagadoLab
                      ? `Pagado · ${o.metodoPagoLab === 'efectivo' ? 'Efectivo' : 'Transferencia'}`
                      : 'Pendiente'}
                  </span>
                )}
              </FormRow>
            )}

            <FormRow label="Observaciones">
              {editMode && draft ? (
                <textarea value={draft.notas} rows={2} placeholder="—"
                  onChange={e => setDraft(d => d ? { ...d, notas: e.target.value } : d)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#2BBFB3] resize-none" />
              ) : (
                <span className="text-sm text-slate-500">{o.notas || '—'}</span>
              )}
            </FormRow>
          </div>

          {/* Historial */}
          {hist.length > 0 && (
            <div className="px-4 pb-4 pt-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Historial</p>
              <div className="space-y-2">
                {hist.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                    <span className="text-slate-400 flex-shrink-0">{ev.fecha}</span>
                    <span className="text-slate-600 font-medium">{ev.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        {editMode && draft ? (
          <div className="flex gap-2">
            <button onClick={() => { setEditMode(false); setDraft(null) }}
              className="flex-1 py-3 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => saveEdit(o)}
              className="flex-1 py-3 bg-[#0B1A35] text-white text-sm font-bold rounded-xl hover:bg-slate-700">
              Guardar
            </button>
          </div>
        ) : (
          <button onClick={() => startEdit(o)}
            className="w-full py-3.5 bg-[#0B1A35] text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors">
            Editar estado
          </button>
        )}
      </div>
    )
  }

  // ── Lista ──────────────────────────────────────────────────
  return (
    <div className="max-w-sm mx-auto space-y-4">

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Por llevar', n: counts.porLlevar,  bg: 'bg-slate-100',  text: 'text-slate-700'   },
          { label: 'En lab',     n: counts.enLab,      bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
          { label: 'En camino',  n: counts.enCamino,   bg: 'bg-blue-50',    text: 'text-blue-700'    },
          { label: 'Listos',     n: counts.listos,     bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'Sin pagar',  n: counts.sinPagar,   bg: 'bg-amber-50',   text: 'text-amber-700'   },
          { label: 'Atrasados',  n: counts.atrasados,  bg: 'bg-red-50',     text: 'text-red-700'     },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-lg py-2.5 text-center`}>
            <p className={`text-xl font-bold ${s.text}`}>{s.n}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {lista.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">Sin órdenes activas</p>
        )}
        {lista.map(o => {
          const b = BADGE[o.estado]
          const vencida = o.fechaPromesa && new Date(o.fechaPromesa) < new Date(new Date().toDateString())
          const sinPagar = o.costoLab > 0 && !o.pagadoLab

          return (
            <button key={o.id} onClick={() => openOrder(o.id)}
              className="w-full flex items-stretch hover:bg-slate-50 transition-colors text-left group">
              {/* Dot de estado al lado izquierdo */}
              <div className="flex items-center pl-4 pr-3">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[o.estado]}`} />
              </div>
              <div className="flex-1 py-3.5 pr-4 min-w-0 border-l border-slate-100 ml-0">
                {/* Folio + fecha */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-400">{o.folio}</span>
                  {o.fechaPromesa && (
                    <span className={`text-xs ${vencida ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                      {o.fechaPromesa.replace(/^\d{4}-/, '').replace('-', ' ')}
                    </span>
                  )}
                </div>
                {/* Nombre */}
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {o.paciente}
                  {o.urgente && <span className="ml-1 text-red-500 text-xs">⚡</span>}
                </p>
                {/* Óptica + badges */}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-400">{o.sucursal}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.bg} ${b.text}`}>
                    {b.label}
                  </span>
                  {sinPagar && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                      Pago pendiente
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Vista simplificada para vendedor
// ─────────────────────────────────────────
function VistaVendedor({ ordenes, sucursal, onCambiarEstado, onPrint }: {
  ordenes: OrdenLab[]
  sucursal: string
  onCambiarEstado: (id: number, estado: EstadoOrden) => void
  onPrint: (o: OrdenLab) => void
}) {
  const pendientes = ordenes.filter(o =>
    (sucursal === 'Todas' || o.sucursal === sucursal) &&
    o.estado !== 'entregado'
  )

  const listos   = pendientes.filter(o => o.estado === 'listo')
  const enCamino = pendientes.filter(o => o.estado === 'en_camino')
  const otros    = pendientes.filter(o => !['listo', 'en_camino', 'entregado'].includes(o.estado))
  const problemas = pendientes.filter(o => o.estado === 'problema')

  const EntregaCard = ({ o }: { o: OrdenLab }) => {
    const cfg = ESTADO_CONFIG[o.estado]
    const Icon = cfg.icon
    const dr = diasRestantes(o.fechaPromesa)
    const vencida = dr !== null && dr < 0

    return (
      <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
        o.estado === 'listo' ? 'border-emerald-200' :
        o.estado === 'problema' ? 'border-red-200' :
        vencida ? 'border-amber-200' : 'border-slate-100'
      }`}>
        {/* Banda de color según estado */}
        {o.estado === 'listo' && <div className="h-1 bg-emerald-400" />}
        {o.estado === 'problema' && <div className="h-1 bg-red-400" />}
        {vencida && o.estado !== 'listo' && <div className="h-1 bg-amber-400" />}

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800">{o.paciente}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.telefono} · {o.folio}</p>
              {o.folioVenta && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
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
            <span className="text-slate-600 font-medium">
              {o.urgente && <span className="text-xs font-black text-black mr-1.5">⚡ URGENTE ·</span>}
              {o.tipoMica}
            </span>
            <span className={`${vencida ? 'text-red-500 font-semibold' : dr === 0 ? 'text-amber-500 font-semibold' : dr !== null && dr <= 2 ? 'text-amber-500' : 'text-slate-400'}`}>
              {dr === null ? '' : vencida ? `Venció hace ${Math.abs(dr)}d` : dr === 0 ? 'Hoy' : `${dr} días`}
              {' · '}{o.fechaPromesa}
            </span>
          </div>

          {/* Notas si hay problema */}
          {o.estado === 'problema' && o.notas && (
            <div className="flex items-start gap-2 bg-red-50 rounded px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-red-500" />
              {o.notas}
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            {o.estado === 'en_camino' && (
              <button
                onClick={() => onCambiarEstado(o.id, 'listo')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Llegó del laboratorio
              </button>
            )}
            {o.estado === 'listo' && (
              <button
                onClick={() => onCambiarEstado(o.id, 'entregado')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0B1A35] text-white rounded text-xs font-bold hover:bg-[#0d2145] transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Entregar al cliente
              </button>
            )}
            {o.estado === 'recibido' && (
              <button
                onClick={() => onCambiarEstado(o.id, 'en_laboratorio')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Enviar al laboratorio
              </button>
            )}
            {o.estado === 'en_laboratorio' && (
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-slate-400 text-xs">
                <Clock className="w-3.5 h-3.5" /> Fabricando...
              </div>
            )}
            <button
              onClick={() => onPrint(o)}
              className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mis órdenes de laboratorio</h1>
        <p className="text-sm text-slate-400 mt-0.5">{sucursal} · {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Listas para entregar', n: listos.length,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'En camino',            n: enCamino.length, color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: 'Con problema',         n: problemas.length,color: 'text-red-600',     bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-lg px-4 py-3 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.n}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Listas primero */}
      {listos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> LISTAS PARA ENTREGAR ({listos.length})
          </p>
          <div className="space-y-3">
            {listos.map(o => <EntregaCard key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {/* En camino */}
      {enCamino.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> EN CAMINO ({enCamino.length})
          </p>
          <div className="space-y-3">
            {enCamino.map(o => <EntregaCard key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {/* Otras */}
      {otros.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">EN PROCESO ({otros.length})</p>
          <div className="space-y-3">
            {otros.map(o => <EntregaCard key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {pendientes.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          Sin órdenes pendientes
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
  }
}

export default function LaboratorioPage() {
  const [ordenes, setOrdenes] = useState<OrdenLab[]>(ORDENES_MOCK)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | 'todas'>('todas')
  const [filtroSucursal, setFiltroSucursal] = useState('Todas')
  const [detalle, setDetalle] = useState<OrdenLab | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Omit<OrdenLab, 'id' | 'folio'>>(formVacio())
  const [ventaVinculada, setVentaVinculada] = useState<typeof VENTAS_REF[0] | null>(null)
  const [printModal, setPrintModal] = useState<OrdenLab | null>(null)

  // Usuario activo (demo) — leído en useEffect para evitar hidratación SSR/cliente
  const [demoUser, setDemoUser] = useState<{ rol: string; sucursal: string; nombre: string } | null>(null)
  useEffect(() => {
    try { setDemoUser(JSON.parse(localStorage.getItem('optios_demo_user') || '{}')) } catch { /* noop */ }
  }, [])

  // ── Cargar órdenes desde Supabase ──────────────────────────
  useEffect(() => {
    const fetchOrdenes = async () => {
      setCargando(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('ordenes_lab')
          .select('*')
          .order('fecha_ingreso', { ascending: true })
        if (data && !error) {
          setOrdenes(data.map((r, i) => rowToOrden(r as Record<string, unknown>, i)))
        }
      } catch (e) {
        console.warn('Supabase no disponible, usando datos de ejemplo:', e)
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
    if (changes.fechaRecogidaLab !== undefined) dbChanges.fecha_recogida_lab  = changes.fechaRecogidaLab
    if (changes.fechaEntrega     !== undefined) dbChanges.fecha_entrega       = changes.fechaEntrega
    await supabase.from('ordenes_lab').update(dbChanges).eq('id', supabaseId)
  }, [])
  const esVendedor   = demoUser?.rol === 'vendedor'
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
  const listas       = activas.filter(o => o.estado === 'listo').length
  const problemas    = activas.filter(o => o.estado === 'problema').length
  const sinPagar     = ordenes.filter(o => o.costoLab > 0 && !o.pagadoLab).length
  const totalPendLab = ordenes.reduce((s, o) => s + (o.costoLab > 0 && !o.pagadoLab ? o.costoLab : 0), 0)

  const nextFolio = `LAB-${String(ordenes.length + 42).padStart(4, '0')}`

  const vincularVenta = (v: typeof VENTAS_REF[0]) => {
    setVentaVinculada(v)
    setForm(prev => ({
      ...prev,
      folioVenta: v.folio,
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

  const cambiarEstado = (id: number, estado: EstadoOrden) => {
    setOrdenes(prev => prev.map(o => o.id === id
      ? { ...o, estado, ...(estado === 'entregado' ? { fechaEntrega: dias(0) } : {}) }
      : o
    ))
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, estado } : null)
  }

  const guardar = async () => {
    const supabase = createClient()
    const { data: folioData } = await supabase.rpc('siguiente_folio', { prefijo: 'L' })
    const folio: string = folioData ?? nextFolio

    // Insertar en Supabase
    const { data: inserted } = await supabase.from('ordenes_lab').insert({
      folio,
      folio_venta:         form.folioVenta,
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
    }).select('id').single()

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

  // Vista vendedor — simple y sin costos
  if (esVendedor) {
    return (
      <>
        <VistaVendedor
          ordenes={ordenes}
          sucursal={demoUser?.sucursal ?? 'Todas'}
          onCambiarEstado={cambiarEstado}
          onPrint={o => setPrintModal(o)}
        />
        {printModal && <PrintModal orden={printModal} onClose={() => setPrintModal(null)} />}
      </>
    )
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
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Laboratorio</h1>
          {/* Compact summary — single line */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {[
              { n: porLlevar, label: 'por llevar',     dot: 'bg-slate-300',   text: 'text-slate-700' },
              { n: enLab,     label: 'en lab',         dot: 'bg-indigo-400',  text: 'text-indigo-600' },
              { n: enCamino,  label: 'en camino',      dot: 'bg-blue-400',    text: 'text-blue-600' },
              { n: listas,    label: 'listos',         dot: 'bg-emerald-400', text: 'text-emerald-600' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span className="text-slate-200 text-xs">·</span>}
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className={`font-semibold ${s.text}`}>{s.n}</span> {s.label}
                </span>
              </React.Fragment>
            ))}
            {sinPagar > 0 && (
              <>
                <span className="text-slate-200 text-xs">·</span>
                <span className="text-sm text-amber-500 font-medium">{sinPagar} sin pagar · ${totalPendLab.toLocaleString('es-MX')}</span>
              </>
            )}
            {problemas > 0 && (
              <>
                <span className="text-slate-200 text-xs">·</span>
                <span className="text-sm text-red-500 font-medium">{problemas} con problema</span>
              </>
            )}
          </div>
        </div>
        <button onClick={() => { setForm(formVacio()); setVentaVinculada(null); setModal(true) }}
          className="flex items-center gap-2 text-sm font-medium text-white bg-slate-900 px-4 py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex-shrink-0">
          <Plus className="w-4 h-4" /> Nueva orden
        </button>
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setFiltroEstado('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtroEstado === 'todas' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}>
            Todas <span className={`ml-1 ${filtroEstado === 'todas' ? 'text-slate-400' : 'text-slate-300'}`}>{activas.length}</span>
          </button>
          {([
            { key: 'recibido'       as EstadoOrden, label: 'Por llevar',    dot: 'bg-slate-300',   n: porLlevar },
            { key: 'en_laboratorio' as EstadoOrden, label: 'En lab',        dot: 'bg-indigo-400',  n: enLab },
            { key: 'en_camino'      as EstadoOrden, label: 'En camino',     dot: 'bg-blue-400',    n: enCamino },
            { key: 'listo'          as EstadoOrden, label: 'Listos',        dot: 'bg-emerald-400', n: listas },
            { key: 'entregado'      as EstadoOrden, label: 'Entregados',    dot: 'bg-slate-200',   n: ordenes.filter(o => o.estado === 'entregado').length },
            { key: 'problema'       as EstadoOrden, label: 'Problema',      dot: 'bg-red-400',     n: problemas },
          ]).map(chip => (
            <button key={chip.key} onClick={() => setFiltroEstado(chip.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtroEstado === chip.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chip.dot}`} />
              {chip.label}
              <span className={`${filtroEstado === chip.key ? 'text-slate-400' : 'text-slate-300'}`}>{chip.n}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-52 pl-8 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400 transition-all"
              placeholder="Buscar..." />
          </div>
          <div className="relative">
            <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
              className="appearance-none text-sm bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-slate-600 focus:outline-none">
              {['Todas', ...SUCURSALES].map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Main: Table + Inline detail panel ── */}
      <div className="flex gap-6 items-start">

        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Orden', 'Cliente', 'Sucursal', 'Estado', 'Promesa'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map(o => {
                  const cfg = ESTADO_CONFIG[o.estado]
                  const dr = diasRestantes(o.fechaPromesa)
                  const vencida = dr !== null && dr < 0 && o.estado !== 'entregado'
                  const isSelected = detalle?.id === o.id
                  return (
                    <tr key={o.id} onClick={() => setDetalle(isSelected ? null : o)}
                      className={`cursor-pointer transition-colors group ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                          <span className="text-xs font-mono text-slate-400">{o.folio}</span>
                          {o.urgente && <span className="text-xs text-red-500">⚡</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{o.paciente}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{o.tipoMica}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{o.sucursal}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        {o.costoLab > 0 && !o.pagadoLab && (
                          <span className="ml-1.5 text-xs text-amber-500">· sin pagar</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {o.fechaPromesa ? (
                          <div>
                            <p className={`text-xs ${vencida ? 'text-red-500 font-medium' : 'text-slate-600'}`}>{o.fechaPromesa}</p>
                            {o.estado !== 'entregado' && dr !== null && (
                              <p className={`text-xs ${vencida ? 'text-red-400' : dr <= 1 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {vencida ? `${Math.abs(dr)}d vencida` : dr === 0 ? 'Hoy' : `${dr}d`}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-sm">Sin órdenes con ese criterio</div>
            )}
          </div>

          {/* Cuentas por pagar — sutil, al fondo */}
          {totalPendLab > 0 && (
            <div className="mt-3 border border-slate-100 rounded-xl overflow-hidden bg-white">
              <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Pendiente a laboratorios
                </span>
                <span className="text-xs font-semibold text-amber-600">${totalPendLab.toLocaleString('es-MX')}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {LABORATORIOS.map(lab => {
                  const pend = ordenes.filter(o => o.laboratorio === lab && o.costoLab > 0 && !o.pagadoLab)
                  if (!pend.length) return null
                  const total = pend.reduce((s, o) => s + o.costoLab, 0)
                  return (
                    <div key={lab} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-xs text-slate-600">{lab}</span>
                      <span className="text-xs font-medium text-slate-700">${total.toLocaleString('es-MX')} · {pend.length} {pend.length === 1 ? 'orden' : 'órdenes'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Inline detail panel ── */}
        {detalle && (
          <div className="w-[360px] flex-shrink-0 sticky top-6">
            <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">

              {/* Panel header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">{detalle.folio}</span>
                    {detalle.folioVenta && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />{detalle.folioVenta}
                      </span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-slate-900 leading-tight">{detalle.paciente}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {detalle.tipoMica}{detalle.descripcionArmazon ? ` · ${detalle.descripcionArmazon}` : ''}
                  </p>
                </div>
                <div className="flex items-start gap-2 ml-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${ESTADO_CONFIG[detalle.estado].bg} ${ESTADO_CONFIG[detalle.estado].text}`}>
                    {ESTADO_CONFIG[detalle.estado].label}
                  </span>
                  <button onClick={() => setDetalle(null)}
                    className="p-1 text-slate-300 hover:text-slate-500 transition-colors rounded-md hover:bg-slate-100 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="px-5 divide-y divide-slate-50">
                {[
                  { label: 'Sucursal',    value: detalle.sucursal },
                  { label: 'Laboratorio', value: detalle.laboratorio || '—' },
                  { label: 'Fecha promesa', value: detalle.fechaPromesa || '—' },
                  ...(!esVendedor ? [{ label: 'Costo lab', value: detalle.costoLab > 0 ? `$${detalle.costoLab.toLocaleString('es-MX')}` : '—' }] : []),
                  { label: 'Precio / Anticipo', value: `$${detalle.precioCliente.toLocaleString('es-MX')} / $${detalle.anticipo.toLocaleString('es-MX')}` },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-slate-400">{row.label}</span>
                    <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                  </div>
                ))}

                {/* Pago al lab */}
                {!esVendedor && detalle.costoLab > 0 && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-slate-400">Pago al lab</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${detalle.pagadoLab ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {detalle.pagadoLab ? `Pagado${detalle.metodoPagoLab ? ` · ${detalle.metodoPagoLab}` : ''}` : 'Pendiente'}
                      </span>
                      {!detalle.pagadoLab && (
                        <button
                          onClick={() => {
                            const updated = { ...detalle, pagadoLab: true, fechaPagoLab: dias(0), metodoPagoLab: 'transferencia' as const }
                            setOrdenes(prev => prev.map(o => o.id === detalle.id ? updated : o))
                            setDetalle(updated)
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">
                          Marcar pagado
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {detalle.notas && (
                  <div className="py-2.5">
                    <p className="text-xs text-slate-400 mb-1">Observaciones</p>
                    <p className="text-sm text-slate-600">{detalle.notas}</p>
                  </div>
                )}
              </div>

              {/* Graduación */}
              <div className="px-5 py-4 border-t border-slate-50 bg-slate-50/40">
                <p className="text-xs font-medium text-slate-400 mb-2.5">Graduación</p>
                <div className="space-y-1.5">
                  {[{ l: 'OD', v: detalle.od }, { l: 'OI', v: detalle.oi }].map(r => (
                    <div key={r.l} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-6">{r.l}</span>
                      <span className="text-xs font-mono text-slate-600">{r.v || '—'}</span>
                    </div>
                  ))}
                  {detalle.add && <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400 w-6">ADD</span><span className="text-xs font-mono text-slate-600">{detalle.add}</span></div>}
                  <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400 w-6">DP</span><span className="text-xs font-mono text-slate-600">{detalle.dp} mm</span></div>
                </div>
              </div>

              {/* Historial timeline */}
              {[detalle.fechaIngreso, detalle.fechaEnvioLab, detalle.fechaRecogidaLab, detalle.fechaPagoLab, detalle.fechaEntrega].some(Boolean) && (
                <div className="px-5 py-4 border-t border-slate-50">
                  <p className="text-xs font-medium text-slate-400 mb-3">Historial</p>
                  <div className="space-y-2">
                    {[
                      { f: detalle.fechaIngreso,    l: 'Orden creada' },
                      { f: detalle.fechaEnvioLab,   l: 'Enviada al laboratorio' },
                      { f: detalle.fechaRecogidaLab,l: 'Recogida del laboratorio' },
                      { f: detalle.fechaPagoLab,    l: 'Pago registrado' },
                      { f: detalle.fechaEntrega,    l: 'Entregada al cliente' },
                    ].filter(e => e.f).map((e, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0 mt-1" />
                        <span className="text-slate-400 flex-shrink-0 tabular-nums">{e.f}</span>
                        <span className="text-slate-600">{e.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 py-4 border-t border-slate-100 space-y-2">
                {/* Primary action */}
                {detalle.estado === 'listo' && (
                  <button onClick={() => cambiarEstado(detalle.id, 'entregado')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Marcar como entregado
                  </button>
                )}
                {detalle.estado === 'en_camino' && (
                  <button onClick={() => cambiarEstado(detalle.id, 'listo')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Llegó del lab — marcar listo
                  </button>
                )}

                {/* Secondary actions */}
                <div className="flex gap-2">
                  <button onClick={() => setPrintModal(detalle)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                  {detalle.estado !== 'entregado' && (
                    <div className="flex-1 relative">
                      <select onChange={e => cambiarEstado(detalle.id, e.target.value as EstadoOrden)}
                        value={detalle.estado}
                        className="w-full appearance-none text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-2 pr-7 bg-white focus:outline-none cursor-pointer hover:bg-slate-50 transition-colors">
                        {FLUJO.map(e => <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>)}
                        <option value="problema">Con problema</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL IMPRIMIR ── */}
      {printModal && <PrintModal orden={printModal} onClose={() => setPrintModal(null)} />}

      {/* ── MODAL NUEVA ORDEN ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Nueva orden de laboratorio</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{nextFolio}</p>
              </div>
              <button onClick={() => setModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Vincular a venta */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Vincular a venta existente
                </p>
                {ventaVinculada ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-700">{ventaVinculada.folio} — {ventaVinculada.paciente}</p>
                        <p className="text-xs text-slate-400">Datos auto-completados desde la venta</p>
                      </div>
                    </div>
                    <button onClick={() => { setVentaVinculada(null); setForm(formVacio()) }}
                      className="p-2 rounded border border-slate-200 hover:bg-white text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <BuscadorVenta onSelect={vincularVenta} />
                )}
              </div>

              {/* Paciente — si no hay venta vinculada */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    <User className="inline w-3 h-3 mr-1 -mt-0.5" /> Paciente *
                  </label>
                  <input value={form.paciente} onChange={e => f('paciente', e.target.value)}
                    className={`w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 ${ventaVinculada ? 'text-slate-400' : ''}`}
                    placeholder="Nombre completo" readOnly={!!ventaVinculada} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Teléfono</label>
                  <input value={form.telefono} onChange={e => f('telefono', e.target.value)}
                    className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                    placeholder="686 000 0000" readOnly={!!ventaVinculada} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Sucursal</label>
                  <div className="relative">
                    <select value={form.sucursal} onChange={e => f('sucursal', e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none pr-8">
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Tipo + laboratorio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de mica *</label>
                  <div className="relative">
                    <select value={form.tipoMica} onChange={e => f('tipoMica', e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none pr-8">
                      {TIPOS_MICA.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Laboratorio</label>
                  <div className="relative">
                    <select value={form.laboratorio} onChange={e => f('laboratorio', e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none pr-8">
                      {LABORATORIOS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Armazón */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Armazón</label>
                <div className="flex gap-2 mb-2">
                  {[{ v: 'comprado', l: 'Comprado en tienda' }, { v: 'propio', l: 'Propio del cliente' }].map(opt => (
                    <button key={opt.v} onClick={() => f('armazon', opt.v as 'comprado' | 'propio')}
                      className={`flex-1 py-2 rounded text-xs font-semibold border transition-all ${form.armazon === opt.v ? 'bg-[#0B1A35] border-[#0B1A35] text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <input value={form.descripcionArmazon} onChange={e => f('descripcionArmazon', e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                  placeholder="Marca, color, modelo..." />
              </div>

              {/* Graduación */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">Graduación</p>
                  {ventaVinculada && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Auto-llenado desde venta</span>}
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: 'OD', field: 'od' as const, ph: 'ej. -2.50 -0.75 x170' },
                    { label: 'OI', field: 'oi' as const, ph: 'ej. -2.25 -0.50 x005' },
                  ].map(row => (
                    <div key={row.field} className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-slate-100 px-2 py-1.5 rounded text-slate-600 w-10 text-center flex-shrink-0">{row.label}</span>
                      <input value={form[row.field]} onChange={e => f(row.field, e.target.value)}
                        className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
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
                        <span className="text-xs font-bold bg-slate-100 px-2 py-1.5 rounded text-slate-600 min-w-[42px] text-center flex-shrink-0">{row.l}</span>
                        <input value={form[row.f]} onChange={e => f(row.f, e.target.value)}
                          className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                          placeholder={row.ph} />
                      </div>
                    ))}
                  </div>

                  {/* Tratamiento */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Tratamiento</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {([
                        { v: 'ninguno',      l: 'Ninguno' },
                        { v: 'tinte',        l: 'Tinte' },
                        { v: 'fotocromatico',l: 'Fotocromático' },
                        { v: 'polarizado',   l: 'Polarizado' },
                      ] as { v: Tratamiento; l: string }[]).map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => { f('tratamiento', opt.v); if (opt.v !== 'tinte' && opt.v !== 'polarizado') f('colorTratamiento', '') }}
                          className={`py-2 rounded text-xs font-semibold border transition-all ${form.tratamiento === opt.v ? 'bg-[#0B1A35] border-[#0B1A35] text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {(form.tratamiento === 'tinte' || form.tratamiento === 'polarizado') && (
                      <input
                        value={form.colorTratamiento}
                        onChange={e => f('colorTratamiento', e.target.value)}
                        className="w-full border border-slate-200 rounded px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                        placeholder={form.tratamiento === 'tinte' ? 'Color del tinte (ej. café, gris, rosa...)' : 'Color de polarizado (ej. gris, café, verde...)'}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fecha de ingreso</label>
                  <input type="date" value={form.fechaIngreso} onChange={e => f('fechaIngreso', e.target.value)}
                    className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fecha promesa al cliente</label>
                  <input type="date" value={form.fechaPromesa} onChange={e => f('fechaPromesa', e.target.value)}
                    className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30" />
                </div>
              </div>

              {/* Financiero */}
              <div className={`grid gap-4 ${esVendedor ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {[
                  ...(!esVendedor ? [{ l: 'Costo laboratorio', f: 'costoLab' as const }] : []),
                  { l: 'Precio al cliente',  f: 'precioCliente' as const },
                  { l: 'Anticipo recibido',  f: 'anticipo' as const },
                ].map(item => (
                  <div key={item.f}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">{item.l}</label>
                    <input type="number" value={form[item.f] || ''} onChange={e => f(item.f, parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
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
                    : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                }`}>
                ⚡ {form.urgente ? 'URGENTE (activo)' : 'Marcar como urgente'}
              </button>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notas</label>
                <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={3}
                  className="w-full border border-slate-200 rounded px-3 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 resize-none placeholder:text-slate-400"
                  placeholder="Indicaciones especiales, observaciones..." />
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.paciente}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
                <Save className="w-4 h-4" /> Registrar orden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
