'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fecha'
import React from 'react'
import {
  Search, Plus, X, Save, ChevronRight, ChevronLeft,
  User, Phone, FileText, Calendar, MessageCircle,
  Eye, ShoppingBag, ChevronDown,
  Printer, Edit2, AlertCircle, MoreHorizontal,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type HistorialBV = {
  id: string
  nombre: string
  telefono: string
  sucursal: string
  año: number | null
  material: string
  total: number
}

type Receta = {
  id: number
  fecha: string
  tipo: 'Lejos' | 'Cerca' | 'Progresivo' | 'Bifocal'
  od_esfera: string
  od_cilindro: string
  od_eje: string
  od_add: string
  oi_esfera: string
  oi_cilindro: string
  oi_eje: string
  oi_add: string
  dp: string
  optometrista: string
  observaciones: string
}

type HistorialCita = {
  fecha: string
  tipo: string
  sucursal: string
  estado: string
}

type VentaItem = {
  id: string
  nombre: string
  sku: string
  precio_unitario: number
  cantidad: number
  descuento: number
  subtotal: number
}

type HistorialVenta = {
  id: string
  fecha: string
  folio: string
  total: number
  notas: string
  estado: string
  metodo_pago: string
  atendido_por: string
  items: VentaItem[]
}

type Paciente = {
  id: number
  nombre: string
  apellido: string
  telefono: string
  email: string
  fechaNacimiento: string
  sucursalPrincipal: string
  notas: string
  recetas: Receta[]
  citas: HistorialCita[]
  ventas: HistorialVenta[]
  _ultimaRecetaFecha?: string | null
}

// ─────────────────────────────────────────
// Datos mock
// ─────────────────────────────────────────
const PACIENTES_MOCK: Paciente[] = [
  {
    id: 1, nombre: 'María', apellido: 'González', telefono: '686 123 4567',
    email: 'maria.gonzalez@gmail.com', fechaNacimiento: '1985-03-12',
    sucursalPrincipal: 'Baja Visión', notas: 'Diabética. Sensible a reflejos.',
    recetas: [
      { id: 1, fecha: '2026-04-10', tipo: 'Progresivo', od_esfera: '-2.50', od_cilindro: '-0.75', od_eje: '170', od_add: '+2.00', oi_esfera: '-2.25', oi_cilindro: '-0.50', oi_eje: '005', oi_add: '+2.00', dp: '62', optometrista: 'Dr. Leyva', observaciones: 'Antirreflejante recomendado' },
      { id: 2, fecha: '2025-02-18', tipo: 'Progresivo', od_esfera: '-2.25', od_cilindro: '-0.75', od_eje: '168', od_add: '+1.75', oi_esfera: '-2.00', oi_cilindro: '-0.50', oi_eje: '003', oi_add: '+1.75', dp: '62', optometrista: 'Dr. Leyva', observaciones: '' },
    ],
    citas: [
      { fecha: '2026-04-10', tipo: 'Examen visual', sucursal: 'Baja Visión', estado: 'Atendida' },
      { fecha: '2026-06-25', tipo: 'Revisión · Seguimiento 1', sucursal: 'Baja Visión', estado: 'Confirmada' },
    ],
    ventas: [
      { id: 'mock-1', fecha: '2026-04-10', folio: 'V-0028', total: 5200, notas: '', estado: 'activa', metodo_pago: 'efectivo', atendido_por: '', items: [{ id: 'i1', nombre: 'Armazón Ray-Ban', sku: '', precio_unitario: 2200, cantidad: 1, descuento: 0, subtotal: 2200 }, { id: 'i2', nombre: 'Micas progresivas', sku: '', precio_unitario: 3000, cantidad: 1, descuento: 0, subtotal: 3000 }] },
      { id: 'mock-2', fecha: '2025-02-18', folio: 'V-0011', total: 4800, notas: '', estado: 'activa', metodo_pago: 'tarjeta', atendido_por: '', items: [] },
    ],
  },
  {
    id: 2, nombre: 'Carlos', apellido: 'Ruiz', telefono: '686 234 5678',
    email: '', fechaNacimiento: '1992-07-30',
    sucursalPrincipal: '5 de Mayo', notas: '',
    recetas: [
      { id: 3, fecha: '2026-03-05', tipo: 'Lejos', od_esfera: '+1.00', od_cilindro: '0.00', od_eje: '000', od_add: '', oi_esfera: '+1.25', oi_cilindro: '-0.25', oi_eje: '090', oi_add: '', dp: '64', optometrista: 'Dr. Leyva', observaciones: '' },
    ],
    citas: [
      { fecha: '2026-03-05', tipo: 'Examen visual', sucursal: '5 de Mayo', estado: 'Atendida' },
      { fecha: '2026-06-25', tipo: 'Cita web', sucursal: '5 de Mayo', estado: 'Confirmada' },
    ],
    ventas: [
      { id: 'mock-3', fecha: '2026-03-05', folio: 'V-0019', total: 1200, notas: '', estado: 'activa', metodo_pago: 'efectivo', atendido_por: '', items: [] },
    ],
  },
  {
    id: 3, nombre: 'Ana', apellido: 'López', telefono: '686 345 6789',
    email: 'ana.lopez@outlook.com', fechaNacimiento: '1978-11-22',
    sucursalPrincipal: 'Plaza Laureles', notas: 'Trae receta de oftalmólogo externo.',
    recetas: [
      { id: 4, fecha: '2026-05-20', tipo: 'Bifocal', od_esfera: '-3.00', od_cilindro: '-1.25', od_eje: '082', od_add: '+2.50', oi_esfera: '-3.25', oi_cilindro: '-1.00', oi_eje: '095', oi_add: '+2.50', dp: '60', optometrista: 'Dr. Leyva', observaciones: 'Receta externa' },
    ],
    citas: [
      { fecha: '2026-05-20', tipo: 'Consulta', sucursal: 'Plaza Laureles', estado: 'Atendida' },
      { fecha: '2026-06-25', tipo: 'Consulta', sucursal: 'Baja Visión', estado: 'Confirmada' },
    ],
    ventas: [
      { id: 'mock-4', fecha: '2026-05-20', folio: 'V-0033', total: 6200, notas: '', estado: 'activa', metodo_pago: 'efectivo', atendido_por: '', items: [] },
    ],
  },
  {
    id: 4, nombre: 'Pedro', apellido: 'Sánchez', telefono: '686 456 7890',
    email: '', fechaNacimiento: '2001-05-14',
    sucursalPrincipal: 'Baja Visión', notas: '',
    recetas: [
      { id: 5, fecha: '2026-06-25', tipo: 'Lejos', od_esfera: '-1.00', od_cilindro: '0.00', od_eje: '000', od_add: '', oi_esfera: '-0.75', oi_cilindro: '0.00', oi_eje: '000', oi_add: '', dp: '65', optometrista: 'Dr. Leyva', observaciones: '' },
    ],
    citas: [
      { fecha: '2026-06-25', tipo: 'Examen visual', sucursal: 'Plaza Laureles', estado: 'Atendida' },
    ],
    ventas: [],
  },
  {
    id: 5, nombre: 'Laura', apellido: 'Martínez', telefono: '686 567 8901',
    email: 'lauramtz@gmail.com', fechaNacimiento: '1995-09-08',
    sucursalPrincipal: 'Baja Visión', notas: 'Usa lentes de contacto blandos.',
    recetas: [
      { id: 6, fecha: '2025-11-15', tipo: 'Lejos', od_esfera: '-4.50', od_cilindro: '0.00', od_eje: '000', od_add: '', oi_esfera: '-4.25', oi_cilindro: '-0.25', oi_eje: '180', oi_add: '', dp: '61', optometrista: 'Dr. Leyva', observaciones: 'LC blandas mensuales' },
    ],
    citas: [
      { fecha: '2025-11-15', tipo: 'Lentes de contacto', sucursal: 'Baja Visión', estado: 'Atendida' },
      { fecha: '2026-06-25', tipo: 'Lentes de contacto', sucursal: 'Baja Visión', estado: 'Confirmada' },
    ],
    ventas: [
      { id: 'mock-5', fecha: '2025-11-15', folio: 'V-0004', total: 2800, notas: '', estado: 'activa', metodo_pago: 'efectivo', atendido_por: '', items: [] },
    ],
  },
  {
    id: 6, nombre: 'Jorge', apellido: 'Herrera', telefono: '686 678 9012',
    email: '', fechaNacimiento: '1968-01-25',
    sucursalPrincipal: '5 de Mayo', notas: 'Hipertenso. Revisión cada 6 meses.',
    recetas: [
      { id: 7, fecha: '2026-01-10', tipo: 'Progresivo', od_esfera: '+2.00', od_cilindro: '-0.50', od_eje: '100', od_add: '+2.25', oi_esfera: '+2.25', oi_cilindro: '-0.75', oi_eje: '085', oi_add: '+2.25', dp: '63', optometrista: 'Dr. Leyva', observaciones: '' },
    ],
    citas: [
      { fecha: '2026-01-10', tipo: 'Examen visual', sucursal: '5 de Mayo', estado: 'Atendida' },
      { fecha: '2026-06-25', tipo: 'Revisión · Seguimiento 2', sucursal: '5 de Mayo', estado: 'Agendada' },
    ],
    ventas: [
      { id: 'mock-6', fecha: '2026-01-10', folio: 'V-0009', total: 7400, notas: '', estado: 'activa', metodo_pago: 'efectivo', atendido_por: '', items: [] },
    ],
  },
]

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

// ─────────────────────────────────────────
// Tipos y helpers del historial
// ─────────────────────────────────────────
type HistorialEvento = {
  fecha: string
  tipo: 'consulta' | 'venta' | 'cita'
  titulo: string
  subtitulo?: string
  tags?: string[]
  monto?: number
}

function primeraFechaRef(p: Paciente): string {
  const fechas = [...p.recetas.map(r => r.fecha), ...p.ventas.map(v => v.fecha)].filter(Boolean).sort()
  return fechas[0]?.split('-')[0] ?? ''
}

function getTagsPaciente(p: Paciente, rv: Receta | null): { label: string; icon: string; color: string }[] {
  const tags: { label: string; icon: string; color: string }[] = []
  const now = new Date()
  if (p.ventas.length >= 3)
    tags.push({ label: 'Cliente frecuente', icon: '⭐', color: 'bg-amber-50 text-amber-700 border border-amber-200' })
  if (rv) {
    const dias = Math.floor((now.getTime() - new Date(rv.fecha).getTime()) / 86400000)
    if (dias > 300)
      tags.push({ label: 'Revisión anual recomendada', icon: '🔔', color: 'bg-orange-50 text-orange-700 border border-orange-200' })
  }
  const lastVenta = [...p.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  if (lastVenta) {
    const dias = Math.floor((now.getTime() - new Date(lastVenta.fecha).getTime()) / 86400000)
    if (dias < 365)
      tags.push({ label: 'Garantía vigente', icon: '✓', color: 'bg-sky-50 text-sky-700 border border-sky-200' })
  }
  if ((p.notas || '').toLowerCase().includes('fotocrom'))
    tags.push({ label: 'Prefiere fotocromáticos', icon: '🕶', color: 'bg-violet-50 text-violet-700 border border-violet-200' })
  return tags
}

function getHistorialMezclado(p: Paciente): HistorialEvento[] {
  const eventos: HistorialEvento[] = []
  p.recetas.forEach(r => eventos.push({
    fecha: r.fecha, tipo: 'consulta', titulo: 'Consulta visual',
    tags: r.tipo && r.tipo !== 'Lejos' ? [r.tipo] : [],
    subtitulo: r.optometrista ? `Nueva receta · ${r.optometrista}` : 'Nueva receta',
  }))
  p.ventas.forEach(v => eventos.push({
    fecha: v.fecha, tipo: 'venta', titulo: 'Compra',
    tags: v.items.length > 0 ? v.items.slice(0, 2).map(i => i.nombre) : undefined,
    monto: v.total,
    subtitulo: v.items.length === 0 ? 'Sin desglose de productos' : undefined,
  }))
  return eventos.filter(e => e.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6)
}

function formatFechaHistorial(fecha: string): { dia: string; mes: string; año: string } {
  const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
  const [y, m, d] = fecha.split('-')
  return { dia: d ?? '', mes: MESES[parseInt(m ?? '1') - 1] ?? '', año: y ?? '' }
}

function calcFrecuencia(p: Paciente): string {
  const fechas = [...p.recetas.map(r => r.fecha), ...p.ventas.map(v => v.fecha)].filter(Boolean).sort()
  if (fechas.length < 2) return '—'
  const meses = Math.round((new Date(fechas[fechas.length - 1]).getTime() - new Date(fechas[0]).getTime()) / (30 * 86400000))
  if (meses < 1) return '< 1 mes'
  if (meses < 12) return `${meses} meses`
  const años = Math.round(meses / 12)
  return `${años} año${años > 1 ? 's' : ''}`
}

function getInfoClinica(p: Paciente, rv: Receta | null): string[] {
  const tags: string[] = []
  const notas = (p.notas || '').toLowerCase()
  if (notas.includes('astigmat')) tags.push('Astigmatismo')
  if (notas.includes('diabet')) tags.push('Diabetes')
  if (notas.includes('hiperten')) tags.push('Hipertensión')
  if (notas.includes('fotocrom')) tags.push('Uso de fotocromáticos')
  if (notas.includes('baja visión') || notas.includes('baja vision')) tags.push('Baja visión')
  if (notas.includes('contacto')) tags.push('Lentes de contacto')
  if (notas.includes('sin alergi')) tags.push('Sin alergias conocidas')
  else if (notas.match(/alergi/)) tags.push('Alergias')
  if (rv && (parseFloat(rv.od_add || '0') !== 0 || parseFloat(rv.oi_add || '0') !== 0))
    tags.push('Necesita adición')
  return tags.length > 0 ? tags : ['Sin notas clínicas']
}

const TAG_COLORES: Record<string, string> = {
  'Astigmatismo':          'bg-teal-100 text-teal-700',
  'Baja visión':           'bg-blue-100 text-blue-700',
  'Uso de fotocromáticos': 'bg-indigo-100 text-indigo-700',
  'Diabetes':              'bg-orange-100 text-orange-700',
  'Hipertensión':          'bg-red-100 text-red-700',
  'Sin alergias conocidas':'bg-zinc-100 text-zinc-500',
  'Alergias':              'bg-red-100 text-red-700',
  'Lentes de contacto':    'bg-purple-100 text-purple-700',
  'Necesita adición':      'bg-amber-100 text-amber-700',
}
function tagColor(tag: string): string {
  return TAG_COLORES[tag] ?? 'bg-zinc-100 text-zinc-600'
}

function garantiaVigenteInfo(p: Paciente): string | null {
  const last = [...p.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  if (!last) return null
  const dias = Math.floor((new Date().getTime() - new Date(last.fecha).getTime()) / 86400000)
  if (dias >= 365) return null
  const vence = new Date(new Date(last.fecha).getTime() + 365 * 86400000)
  return `Vigente hasta ${vence.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}`
}

function calcEdad(fechaNac: string) {
  if (!fechaNac) return ''
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return `${edad} años`
}

function recetaVigente(p: Paciente) {
  if (!p.recetas.length) return null
  return p.recetas.sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
}

// ── Helpers de validación óptica ──
function getOptometristaDefault(): string {
  if (typeof window === 'undefined') return 'Dr. Leyva'
  try {
    const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
    return u.nombreReceta || 'Dr. Leyva'
  } catch { return 'Dr. Leyva' }
}

/** Formatea un valor de esfera/cilindro a ±0.00 */
function formatGradValue(val: string): string {
  if (!val || val.trim() === '') return ''
  const lower = val.toLowerCase().replace(/\s/g, '')
  if (lower === 'pl' || lower === 'plano') return '0.00'
  const num = parseFloat(val.replace(',', '.'))
  if (isNaN(num)) return val
  if (num === 0) return '0.00'
  return (num > 0 ? '+' : '') + num.toFixed(2)
}

/** Formatea eje a 3 dígitos: "5" → "005", "90" → "090" */
function formatEjeValue(val: string): string {
  if (!val || val.trim() === '') return ''
  const num = parseInt(val)
  if (isNaN(num)) return val
  return Math.max(0, Math.min(180, num)).toString().padStart(3, '0')
}

const formVacioReceta = (): Omit<Receta, 'id'> => ({
  fecha: hoyLocal(),
  tipo: 'Lejos',
  od_esfera: '', od_cilindro: '', od_eje: '', od_add: '',
  oi_esfera: '', oi_cilindro: '', oi_eje: '', oi_add: '',
  dp: '', optometrista: getOptometristaDefault(), observaciones: '',
})

const formVacioPaciente = (): Omit<Paciente, 'id' | 'recetas' | 'citas' | 'ventas'> => ({
  nombre: '', apellido: '', telefono: '', email: '',
  fechaNacimiento: '', sucursalPrincipal: 'Baja Visión', notas: '',
})

const PAISES_LADA = [
  { code: '+52',  label: 'MX +52'  },
  { code: '+1',   label: 'US +1'   },
  { code: '+1',   label: 'CA +1'   },
  { code: '+34',  label: 'ES +34'  },
  { code: '+33',  label: 'FR +33'  },
  { code: '+49',  label: 'DE +49'  },
  { code: '+39',  label: 'IT +39'  },
  { code: '+44',  label: 'UK +44'  },
  { code: '+31',  label: 'NL +31'  },
  { code: '+57',  label: 'CO +57'  },
  { code: '+54',  label: 'AR +54'  },
  { code: '+56',  label: 'CL +56'  },
  { code: '+55',  label: 'BR +55'  },
  { code: '+51',  label: 'PE +51'  },
  { code: '+58',  label: 'VE +58'  },
  { code: '+593', label: 'EC +593' },
  { code: '+502', label: 'GT +502' },
  { code: '+503', label: 'SV +503' },
]

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
function ExpedientesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [pacientes, setPacientes] = useState<Paciente[]>(PACIENTES_MOCK)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Paciente | null>(PACIENTES_MOCK[0])
  // tabActiva removido (vista sin tabs)

  // Modal detalle compra
  const [ventaAbierta, setVentaAbierta] = useState<HistorialVenta | null>(null)

  // Modal nueva receta
  const [modalReceta, setModalReceta] = useState(false)
  const [formReceta, setFormReceta] = useState<Omit<Receta, 'id'>>(formVacioReceta())
  const [erroresReceta, setErroresReceta] = useState<Record<string, string>>({})

  // Modal nuevo paciente
  const [modalPaciente, setModalPaciente] = useState(false)
  const [formPaciente, setFormPaciente] = useState<Omit<Paciente, 'id' | 'recetas' | 'citas' | 'ventas'>>(formVacioPaciente())
  const [ladaNuevo, setLadaNuevo] = useState('+52')

  // Historial BV
  const [historialResultados, setHistorialResultados] = useState<HistorialBV[]>([])
  const [buscandoHistorial, setBuscandoHistorial] = useState(false)

  // Modal editar paciente
  const [modalEditar, setModalEditar] = useState(false)
  const [formEditar, setFormEditar] = useState<Omit<Paciente, 'id' | 'recetas' | 'citas' | 'ventas'>>(formVacioPaciente())
  const [ladaEditar, setLadaEditar] = useState('+52')

  // Panel izquierdo colapsable
  const [panelAbierto, setPanelAbierto] = useState(true)

  // Menú de acciones del paciente
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Consultas count del paciente seleccionado
  const [consultasCount, setConsultasCount] = useState(0)

  // Si viene de ?nuevo=true, redirigir al wizard en vez de abrir el modal
  // Pre-llenar búsqueda si viene de ?search=... (desde el buscador del header)
  useEffect(() => {
    if (searchParams.get('nuevo') === 'true') {
      router.replace('/dashboard/expedientes/nuevo')
      return
    }
    const q = searchParams.get('search')
    if (q) setBusqueda(q)
  }, [searchParams])

  // ── Cargar pacientes desde Supabase (paginado) ────────────
  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const supabase = createClient()
        const PAGE = 1000
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = []
        let from = 0
        while (true) {
          const { data } = await supabase
            .from('pacientes')
            .select('id, nombre, apellido, telefono, email, fecha_nacimiento, sucursal_principal, notas, recetas(fecha)')
            .order('apellido', { ascending: true })
            .order('nombre', { ascending: true })
            .range(from, from + PAGE - 1)
          if (!data || data.length === 0) break
          all.push(...data)
          if (data.length < PAGE) break
          from += PAGE
        }
        if (all.length > 0) {
          const mapped: Paciente[] = all.map((p) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fechas: string[] = (p.recetas ?? []).map((r: any) => r.fecha as string).filter(Boolean)
            const ultimaFecha = fechas.sort().reverse()[0] ?? null
            return {
              id: p.id,
              nombre: p.nombre,
              apellido: p.apellido,
              telefono: p.telefono ?? '',
              email: p.email ?? '',
              fechaNacimiento: p.fecha_nacimiento ?? '',
              sucursalPrincipal: p.sucursal_principal ?? '',
              notas: p.notas ?? '',
              _ultimaRecetaFecha: ultimaFecha,
              recetas: [],
              citas: [],
              ventas: [],
            }
          })
          setPacientes(mapped)
          const idParam = searchParams.get('id')
          const inicial = idParam
            ? (mapped.find(p => String(p.id) === idParam) ?? mapped[0] ?? null)
            : (mapped[0] ?? null)
          setSeleccionado(inicial)
        }
      } catch (e) {
        console.warn('Usando expedientes de ejemplo:', e)
      }
    }
    fetchPacientes()
  }, [])

  // ── Cargar recetas + ventas al seleccionar paciente ────────
  useEffect(() => {
    if (!seleccionado) return
    const id = seleccionado.id
    const loadDetalle = async () => {
      try {
        const supabase = createClient()
        const [recRes, venRes, consRes] = await Promise.all([
          supabase.from('recetas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
          supabase.from('ventas').select('id, folio, total, created_at, notas, estado, metodo_pago, atendido_por, ventas_items(id, nombre, sku, precio_unitario, cantidad, descuento, subtotal)').eq('paciente_id', id).eq('es_cotizacion', false).order('created_at', { ascending: false }),
          supabase.from('consultas').select('id', { count: 'exact', head: true }).eq('paciente_id', id),
        ])
        setConsultasCount(consRes.count ?? 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recetas: Receta[] = (recRes.data ?? []).map((r: any) => ({
          id: r.id, fecha: r.fecha as string,
          tipo: (r.tipo || 'Lejos') as Receta['tipo'],
          od_esfera: r.od_esfera ?? '', od_cilindro: r.od_cilindro ?? '',
          od_eje: r.od_eje ?? '', od_add: r.od_add ?? '',
          oi_esfera: r.oi_esfera ?? '', oi_cilindro: r.oi_cilindro ?? '',
          oi_eje: r.oi_eje ?? '', oi_add: r.oi_add ?? '',
          dp: r.dp ?? '', optometrista: r.optometrista ?? '', observaciones: r.observaciones ?? '',
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ventas: HistorialVenta[] = (venRes.data ?? []).map((v: any) => ({
          id: v.id ?? '',
          fecha: v.created_at ? (v.created_at as string).split('T')[0] : '',
          folio: v.folio ?? '',
          total: parseFloat(v.total as string) || 0,
          notas: v.notas ?? '',
          estado: v.estado ?? '',
          metodo_pago: v.metodo_pago ?? '',
          atendido_por: v.atendido_por ?? '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: (v.ventas_items ?? []).map((i: any) => ({
            id: i.id ?? '',
            nombre: i.nombre ?? '',
            sku: i.sku ?? '',
            precio_unitario: parseFloat(i.precio_unitario) || 0,
            cantidad: i.cantidad || 1,
            descuento: i.descuento || 0,
            subtotal: parseFloat(i.subtotal) || 0,
          })),
        }))
        setSeleccionado(prev => {
          if (!prev || prev.id !== id) return prev
          return { ...prev, recetas, ventas }
        })
      } catch (e) { console.error('Error cargando detalle:', e) }
    }
    loadDetalle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado?.id])

  // Buscar en historial_bv cuando hay búsqueda y no hay resultados en pacientes
  useEffect(() => {
    if (busqueda.length < 3) { setHistorialResultados([]); return }
    const timer = setTimeout(async () => {
      setBuscandoHistorial(true)
      try {
        const supabase = createClient()
        const q = busqueda.trim()
        const { data } = await supabase
          .from('historial_bv')
          .select('id, nombre, telefono, sucursal, material, total')
          .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
          .limit(5)
        setHistorialResultados((data ?? []) as unknown as HistorialBV[])
      } catch { setHistorialResultados([]) }
      finally { setBuscandoHistorial(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [busqueda])

  // ── ESC para cerrar modales ────────────────────────────────
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menuAbierto) { setMenuAbierto(false); return }
      if (ventaAbierta) { setVentaAbierta(null); return }
      if (modalReceta) { setModalReceta(false); setErroresReceta({}); return }
      if (modalEditar) { setModalEditar(false); return }
      if (modalPaciente) { setModalPaciente(false); return }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [menuAbierto, ventaAbierta, modalReceta, modalEditar, modalPaciente])

  const crearDesdeHistorial = (h: HistorialBV) => {
    const partes = h.nombre.trim().split(' ')
    const nombre = partes[0] ?? ''
    const apellido = partes.slice(1).join(' ')
    setFormPaciente({
      nombre,
      apellido,
      telefono: h.telefono,
      email: '',
      fechaNacimiento: '',
      sucursalPrincipal: h.sucursal || 'Baja Visión',
      notas: `Historial BV ${h.año ?? ''}`.trim(),
    })
    setModalPaciente(true)
  }

  const filtrados = pacientes.filter(p => {
    const q = busqueda.toLowerCase()
    return (
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
      p.telefono.includes(q)
    )
  })

  const fr = <K extends keyof typeof formReceta>(k: K, v: typeof formReceta[K]) =>
    setFormReceta(prev => ({ ...prev, [k]: v }))

  const guardarReceta = async () => {
    if (!seleccionado) return
    const errs: Record<string, string> = {}

    // DP obligatorio
    if (!formReceta.dp || formReceta.dp.trim() === '') errs.dp = 'La distancia pupilar es obligatoria'

    // Si hay cilindro ≠ 0, el eje es obligatorio
    const odCil = parseFloat(formReceta.od_cilindro)
    const oiCil = parseFloat(formReceta.oi_cilindro)
    if (!isNaN(odCil) && odCil !== 0 && (!formReceta.od_eje || formReceta.od_eje.trim() === ''))
      errs.od_eje = 'Requerido'
    if (!isNaN(oiCil) && oiCil !== 0 && (!formReceta.oi_eje || formReceta.oi_eje.trim() === ''))
      errs.oi_eje = 'Requerido'

    if (Object.keys(errs).length > 0) { setErroresReceta(errs); return }
    setErroresReceta({})

    let recetaId: number | string = Date.now()
    try {
      const supabase = createClient()
      const { data } = await supabase.from('recetas').insert({
        paciente_id:    seleccionado.id,
        fecha:          formReceta.fecha,
        tipo:           formReceta.tipo,
        od_esfera:      formReceta.od_esfera,
        od_cilindro:    formReceta.od_cilindro,
        od_eje:         formReceta.od_eje,
        od_add:         formReceta.od_add,
        oi_esfera:      formReceta.oi_esfera,
        oi_cilindro:    formReceta.oi_cilindro,
        oi_eje:         formReceta.oi_eje,
        oi_add:         formReceta.oi_add,
        dp:             formReceta.dp,
        optometrista:   formReceta.optometrista,
        observaciones:  formReceta.observaciones,
      }).select('id').single()
      if (data?.id) recetaId = data.id
    } catch (e) { console.error(e) }

    const nueva: Receta = { id: recetaId as number, ...formReceta }
    setPacientes(prev => prev.map(p =>
      p.id === seleccionado.id
        ? { ...p, recetas: [nueva, ...p.recetas] }
        : p
    ))
    setSeleccionado(prev => prev ? { ...prev, recetas: [nueva, ...prev.recetas] } : null)
    setModalReceta(false)
  }

  const guardarPaciente = async () => {
    const telefonoFull = formPaciente.telefono
      ? `${ladaNuevo}${formPaciente.telefono}`
      : ''
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('pacientes').insert({
        nombre:             formPaciente.nombre,
        apellido:           formPaciente.apellido,
        telefono:           telefonoFull,
        email:              formPaciente.email,
        fecha_nacimiento:   formPaciente.fechaNacimiento || null,
        sucursal_principal: formPaciente.sucursalPrincipal,
        notas:              formPaciente.notas,
      }).select('id').single()

      const id = data?.id ?? Date.now()
      if (error) console.error(error)

      const nuevo: Paciente = { id, ...formPaciente, telefono: telefonoFull, recetas: [], citas: [], ventas: [] }
      setPacientes(prev => [nuevo, ...prev])
      setSeleccionado(nuevo)
    } catch (e) {
      console.error(e)
      const nuevo: Paciente = { id: Date.now(), ...formPaciente, telefono: telefonoFull, recetas: [], citas: [], ventas: [] }
      setPacientes(prev => [nuevo, ...prev])
      setSeleccionado(nuevo)
    }
    setModalPaciente(false)
    setFormPaciente(formVacioPaciente())
    setLadaNuevo('+52')
  }

  const abrirEditar = () => {
    if (!seleccionado) return
    setFormEditar({
      nombre:             seleccionado.nombre,
      apellido:           seleccionado.apellido,
      telefono:           seleccionado.telefono,
      email:              seleccionado.email,
      fechaNacimiento:    seleccionado.fechaNacimiento,
      sucursalPrincipal:  seleccionado.sucursalPrincipal,
      notas:              seleccionado.notas,
    })
    setModalEditar(true)
  }

  const guardarEdicion = async () => {
    if (!seleccionado) return
    const telefonoFull = formEditar.telefono
      ? `${ladaEditar}${formEditar.telefono}`
      : ''
    try {
      const supabase = createClient()
      await supabase.from('pacientes').update({
        nombre:             formEditar.nombre,
        apellido:           formEditar.apellido,
        telefono:           telefonoFull,
        email:              formEditar.email,
        fecha_nacimiento:   formEditar.fechaNacimiento || null,
        sucursal_principal: formEditar.sucursalPrincipal,
        notas:              formEditar.notas,
      }).eq('id', seleccionado.id)
    } catch (e) { console.error(e) }

    const actualizado = { ...seleccionado, ...formEditar, telefono: telefonoFull }
    setPacientes(prev => prev.map(p => p.id === seleccionado.id ? actualizado : p))
    setSeleccionado(actualizado)
    setModalEditar(false)
  }

  const rv = recetaVigente(seleccionado ?? { recetas: [] } as unknown as Paciente)

  return (
    <div className="flex gap-3 h-[calc(100vh-140px)]">

      {/* ── PANEL IZQUIERDO: lista de pacientes (colapsable) ── */}
      <div className={`flex-shrink-0 bg-white rounded-lg border border-zinc-200/80 flex flex-col overflow-hidden transition-all duration-200 ${panelAbierto ? 'w-60' : 'w-12'}`}>
        {panelAbierto ? (
          <>
            <div className="p-3 border-b border-zinc-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Expedientes</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400">{pacientes.length}</span>
                  <button onClick={() => setPanelAbierto(false)}
                    className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  placeholder="Buscar paciente..." />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtrados.map(p => {
                const esSeleccionado = seleccionado?.id === p.id
                return (
                  <button key={p.id} onClick={() => { setSeleccionado(p); router.replace(`/dashboard/expedientes?id=${p.id}`, { scroll: false }) }}
                    className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2.5 border-b border-zinc-50 ${esSeleccionado ? 'bg-[#0B0E14]' : 'hover:bg-zinc-50'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${esSeleccionado ? 'bg-[#0D9488]/20 text-[#0D9488]' : 'bg-zinc-100 text-zinc-500'}`}>
                      {p.nombre[0]}{p.apellido[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate leading-tight ${esSeleccionado ? 'text-white' : 'text-zinc-700'}`}>
                        {p.nombre} {p.apellido}
                      </p>
                      <p className={`text-[10px] truncate ${esSeleccionado ? 'text-white/50' : 'text-zinc-400'}`}>
                        {p._ultimaRecetaFecha ? `Última receta: ${p._ultimaRecetaFecha}` : 'Sin receta'}
                      </p>
                    </div>
                    {esSeleccionado && <div className="w-1.5 h-1.5 rounded-full bg-[#0D9488] flex-shrink-0" />}
                  </button>
                )
              })}
              {filtrados.length === 0 && busqueda.length < 3 && (
                <div className="text-center py-8 text-xs text-zinc-400">Sin resultados</div>
              )}
              {busqueda.length >= 3 && filtrados.length === 0 && (historialResultados.length > 0 || buscandoHistorial) && (
                <div className="border-t border-dashed border-zinc-200">
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Historial anterior</p>
                  {buscandoHistorial && <div className="px-3 py-2 text-xs text-zinc-400">Buscando...</div>}
                  {historialResultados.map(h => (
                    <button key={h.id} onClick={() => crearDesdeHistorial(h)}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors flex items-center gap-2 border-b border-zinc-50">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {h.nombre[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-zinc-600 truncate">{h.nombre}</p>
                        <p className="text-[10px] text-zinc-400">${h.total.toLocaleString('es-MX')}</p>
                      </div>
                      <span className="text-[10px] text-amber-600 font-semibold">Crear</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-zinc-100 flex-shrink-0">
              <button onClick={() => router.push('/dashboard/expedientes/nuevo')}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#0B0E14] text-white rounded text-xs font-semibold hover:bg-[#1A1D27] transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nuevo paciente
              </button>
            </div>
          </>
        ) : (
          /* Estado colapsado */
          <div className="flex flex-col items-center py-3 gap-2 h-full">
            <button onClick={() => setPanelAbierto(true)}
              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors flex-shrink-0">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex flex-col items-center gap-1.5 flex-1 overflow-y-auto py-1 w-full px-1.5">
              {filtrados.map(p => {
                const esSeleccionado = seleccionado?.id === p.id
                return (
                  <button key={p.id} onClick={() => { setSeleccionado(p); router.replace(`/dashboard/expedientes?id=${p.id}`, { scroll: false }) }}
                    title={`${p.nombre} ${p.apellido}`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${esSeleccionado ? 'bg-[#0D9488] text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>
                    {p.nombre[0]}{p.apellido[0]}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL DERECHO: detalle ── */}
      {seleccionado ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0">

          {/* ─── CARD DE ENCABEZADO ─── */}
          <div className="bg-white rounded-lg border border-zinc-200/80 p-4 flex-shrink-0">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-[#0B0E14] text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                {seleccionado.nombre[0]}{seleccionado.apellido[0]}
              </div>

              {/* Info principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-zinc-800">{seleccionado.nombre} {seleccionado.apellido}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">Paciente activo</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {seleccionado.telefono && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Phone className="w-3 h-3" /> {seleccionado.telefono}
                    </span>
                  )}
                  {seleccionado.email && <span className="text-xs text-zinc-400">✉ {seleccionado.email}</span>}
                  {seleccionado.fechaNacimiento && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Calendar className="w-3 h-3" /> {calcEdad(seleccionado.fechaNacimiento)}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">{seleccionado.sucursalPrincipal}</span>
                  {primeraFechaRef(seleccionado) && (
                    <span className="text-xs text-zinc-400">Cliente desde {primeraFechaRef(seleccionado)}</span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={abrirEditar}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <div className="relative">
                  <button onClick={() => setMenuAbierto(o => !o)}
                    className="w-7 h-7 border border-zinc-200 rounded flex items-center justify-center text-zinc-400 hover:bg-zinc-50 transition-colors">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {menuAbierto && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
                      <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 min-w-48 py-1">
                        <button onClick={() => { router.push(`/dashboard/expedientes/${seleccionado.id}/resumen`); setMenuAbierto(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                          <FileText className="w-3.5 h-3.5 text-zinc-400" /> Expediente clínico
                        </button>
                        <button onClick={() => { router.push(`/dashboard/expedientes/${seleccionado.id}/hoja`); setMenuAbierto(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                          <Printer className="w-3.5 h-3.5 text-zinc-400" /> Hoja del paciente
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => router.push(`/dashboard/expedientes/nuevo?pacienteId=${seleccionado.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#0D9488] text-white rounded text-xs font-semibold hover:bg-teal-500 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nueva consulta
                </button>
              </div>
            </div>

            {/* Stats — 5 columnas */}
            <div className="grid grid-cols-5 divide-x divide-zinc-100 mt-3 pt-3 border-t border-zinc-100">
              <div className="text-center px-2">
                <p className="text-base font-bold text-zinc-800">{seleccionado.recetas.length}</p>
                <p className="text-xs text-zinc-400">Recetas</p>
                {seleccionado.recetas[0] && <p className="text-[10px] text-zinc-300">Última {seleccionado.recetas[0].fecha.slice(0,7)}</p>}
              </div>
              <div className="text-center px-2">
                <p className="text-base font-bold text-zinc-800">{consultasCount || seleccionado.recetas.length}</p>
                <p className="text-xs text-zinc-400">Consultas</p>
              </div>
              <div className="text-center px-2">
                <p className="text-base font-bold text-zinc-800">{seleccionado.ventas.length}</p>
                <p className="text-xs text-zinc-400">Compras</p>
                {seleccionado.ventas[0] && <p className="text-[10px] text-zinc-300">Última {seleccionado.ventas[0].fecha.slice(0,7)}</p>}
              </div>
              <div className="text-center px-2">
                <p className="text-base font-bold text-zinc-800">
                  ${seleccionado.ventas.reduce((s, v) => s + v.total, 0).toLocaleString('es-MX')}
                </p>
                <p className="text-xs text-zinc-400">Total gastado</p>
              </div>
              <div className="text-center px-2">
                <p className="text-base font-bold text-zinc-800">{calcFrecuencia(seleccionado)}</p>
                <p className="text-xs text-zinc-400">Frecuencia</p>
                <p className="text-[10px] text-zinc-300">Promedio visitas</p>
              </div>
            </div>

            {/* Tags inteligentes */}
            {getTagsPaciente(seleccionado, rv).length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {getTagsPaciente(seleccionado, rv).map(t => (
                  <span key={t.label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.color}`}>
                    {t.icon} {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CONTENIDO PRINCIPAL: receta primero, historial segundo */}
          <div className="flex-1 flex gap-3 min-h-0">

            {/* Centro: receta vigente (PRIMERO) → historial */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">

              {/* ── Receta vigente — primero y más prominente ── */}
              {rv ? (
                <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Receta vigente</h3>
                      <span className="text-xs bg-[#0D9488] text-white px-2 py-0.5 rounded-full font-semibold">Vigente</span>
                    </div>
                    <span className="text-xs text-zinc-400">{rv.fecha}</span>
                  </div>
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-zinc-400">
                          <th className="text-left py-1 w-10"></th>
                          <th className="text-center py-1 font-medium px-3">Esfera</th>
                          <th className="text-center py-1 font-medium px-3">Cilindro</th>
                          <th className="text-center py-1 font-medium px-3">Eje</th>
                          {(rv.od_add || rv.oi_add) && <th className="text-center py-1 font-medium px-3">Adición</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        <tr>
                          <td className="py-2.5"><span className="text-xs font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500">OD</span></td>
                          <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.od_esfera || '—'}</td>
                          <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.od_cilindro || '—'}</td>
                          <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.od_eje || '—'}°</td>
                          {(rv.od_add || rv.oi_add) && <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.od_add || '—'}</td>}
                        </tr>
                        <tr>
                          <td className="py-2.5"><span className="text-xs font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500">OI</span></td>
                          <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.oi_esfera || '—'}</td>
                          <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.oi_cilindro || '—'}</td>
                          <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.oi_eje || '—'}°</td>
                          {(rv.od_add || rv.oi_add) && <td className="text-center px-3 font-mono font-semibold text-zinc-800">{rv.oi_add || '—'}</td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 pb-3 border-b border-zinc-100">
                    <span><span className="font-semibold text-zinc-600">DP:</span> {rv.dp} mm</span>
                    <span><span className="font-semibold text-zinc-600">Tipo:</span> {rv.tipo}</span>
                  </div>
                  {rv.observaciones && (
                    <div className="grid grid-cols-2 gap-4 pt-3 pb-3 border-b border-zinc-100">
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 mb-1">Observaciones</p>
                        <p className="text-xs text-zinc-600">{rv.observaciones}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">
                      <Eye className="w-3 h-3" /> Ver receta
                    </button>
                    <button onClick={() => { setFormReceta({
                      fecha: rv.fecha, tipo: rv.tipo,
                      od_esfera: rv.od_esfera, od_cilindro: rv.od_cilindro, od_eje: rv.od_eje, od_add: rv.od_add,
                      oi_esfera: rv.oi_esfera, oi_cilindro: rv.oi_cilindro, oi_eje: rv.oi_eje, oi_add: rv.oi_add,
                      dp: rv.dp, optometrista: rv.optometrista, observaciones: rv.observaciones,
                    }); setErroresReceta({}); setModalReceta(true) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">
                      Duplicar
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 bg-[#0D9488] text-white rounded text-xs font-medium hover:bg-teal-500 transition-colors ml-auto">
                      <Printer className="w-3 h-3" /> Imprimir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200/80 p-6 text-center">
                  <p className="text-xs text-zinc-400">Sin receta vigente</p>
                  <button onClick={() => { setFormReceta(formVacioReceta()); setErroresReceta({}); setModalReceta(true) }}
                    className="mt-3 flex items-center gap-1.5 px-3 py-2 bg-[#0D9488] text-white rounded text-xs font-semibold hover:bg-teal-500 transition-colors mx-auto">
                    <Plus className="w-3.5 h-3.5" /> Agregar receta
                  </button>
                </div>
              )}

              {/* ── Historial del paciente — debajo de la receta ── */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Historial del paciente</h3>
                  <span className="text-xs text-zinc-400">Ver todo</span>
                </div>
                <div>
                  {getHistorialMezclado(seleccionado).map((ev, i, arr) => {
                    const fd = formatFechaHistorial(ev.fecha)
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="w-11 text-right flex-shrink-0 pt-0.5">
                          <span className="text-xs font-bold text-[#0D9488] block leading-none">{fd.dia}</span>
                          <span className="text-[10px] text-zinc-400 uppercase block">{fd.mes}</span>
                          <span className="text-[10px] text-zinc-300 block">{fd.año}</span>
                        </div>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            ev.tipo === 'consulta' ? 'bg-[#0D9488]' : ev.tipo === 'venta' ? 'bg-blue-400' : 'bg-zinc-300'
                          }`} />
                          {i < arr.length - 1 && <div className="w-px flex-1 bg-zinc-100 min-h-6 mt-1" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-zinc-700">{ev.titulo}</p>
                            {ev.monto !== undefined && (
                              <span className="text-xs font-semibold text-zinc-500">${ev.monto.toLocaleString('es-MX')}</span>
                            )}
                          </div>
                          {ev.tags && ev.tags.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {ev.tags.map(t => (
                                <span key={t} className="text-[10px] bg-[#0D9488]/10 text-[#0D9488] px-1.5 py-0.5 rounded-full font-medium">{t}</span>
                              ))}
                            </div>
                          )}
                          {ev.subtitulo && <p className="text-[10px] text-zinc-400 mt-0.5">{ev.subtitulo}</p>}
                        </div>
                      </div>
                    )
                  })}
                  {getHistorialMezclado(seleccionado).length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-6">Sin historial registrado</p>
                  )}
                </div>
              </div>
            </div>

            {/* ─── SIDEBAR DERECHO ─── */}
            <div className="w-56 flex flex-col gap-3 overflow-y-auto flex-shrink-0">

              {/* Acciones rápidas — grid 2x2 */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Acciones rápidas</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Nueva venta',    Icon: ShoppingBag, color: 'bg-[#0D9488]/10 text-[#0D9488]', action: () => router.push(`/dashboard/ventas/nueva?pacienteId=${seleccionado.id}`) },
                    { label: 'Agendar cita',   Icon: Calendar,    color: 'bg-blue-50 text-blue-600',        action: () => router.push('/dashboard/agenda') },
                    { label: 'Enviar mensaje', Icon: MessageCircle,color:'bg-emerald-50 text-emerald-600',  action: () => window.open(`https://wa.me/52${seleccionado.telefono.replace(/\D/g,'')}`, '_blank') },
                    { label: 'Imprimir hoja del paciente', Icon: Printer, color: 'bg-zinc-100 text-zinc-500', action: () => router.push(`/dashboard/expedientes/${seleccionado.id}/hoja`) },
                  ].map(({ label, Icon, color, action }) => (
                    <button key={label} onClick={action}
                      className="flex flex-col items-center gap-2 p-3 border border-zinc-100 rounded-lg hover:bg-zinc-50 transition-colors text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-zinc-600 leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Información clínica */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Información clínica</h3>
                  <button onClick={abrirEditar} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-0.5 transition-colors">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                </div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Diagnóstico</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {getInfoClinica(seleccionado, rv).map(tag => (
                    <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tagColor(tag)}`}>{tag}</span>
                  ))}
                </div>
                {seleccionado.notas && (
                  <>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Notas clínicas</p>
                    <ul className="space-y-1">
                      {seleccionado.notas.split(/[.;\n]/).filter(n => n.trim().length > 2).map((nota, i) => (
                        <li key={i} className="text-[10px] text-zinc-500 flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-zinc-400 mt-1.5 flex-shrink-0" />
                          {nota.trim()}.
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* Garantías vigentes */}
              {garantiaVigenteInfo(seleccionado) && (
                <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Garantías vigentes</h3>
                  <div className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[10px] font-bold">✓</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-700">Lentes graduados</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{garantiaVigenteInfo(seleccionado)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Últimas compras */}
              {seleccionado.ventas.length > 0 && (
                <div className="bg-white rounded-lg border border-zinc-200/80 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Últimas compras</h3>
                    <span className="text-[10px] text-zinc-400">Ver todas</span>
                  </div>
                  <div className="space-y-1.5">
                    {[...seleccionado.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3).map((v, i) => (
                      <button key={i} onClick={() => setVentaAbierta(v)}
                        className="w-full flex items-center justify-between text-left hover:bg-zinc-50 rounded px-1 py-1 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium text-zinc-500">{v.fecha}</p>
                          <p className="text-[10px] text-zinc-400 truncate">
                            {v.items.length > 0 ? v.items.slice(0, 2).map(it => it.nombre).join(' + ') : 'Sin desglose'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-zinc-700 ml-2 flex-shrink-0">
                          ${v.total.toLocaleString('es-MX')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
          Selecciona un paciente para ver su expediente
        </div>
      )}

      {/* ── MODAL DETALLE COMPRA ── */}
      {ventaAbierta && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-bold text-zinc-800">{ventaAbierta.folio}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {ventaAbierta.fecha}
                  {ventaAbierta.atendido_por ? ` · ${ventaAbierta.atendido_por}` : ''}
                  {ventaAbierta.metodo_pago ? ` · ${ventaAbierta.metodo_pago}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {ventaAbierta.estado === 'cancelada' && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Cancelada</span>
                )}
                <button onClick={() => setVentaAbierta(null)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Productos */}
              {ventaAbierta.items.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Productos</p>
                  <div className="space-y-2">
                    {ventaAbierta.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-700">{item.nombre}</p>
                          {item.sku && <p className="text-xs text-zinc-400">{item.sku}</p>}
                          <p className="text-xs text-zinc-400">
                            {item.cantidad} × ${item.precio_unitario.toLocaleString('es-MX')}
                            {item.descuento > 0 ? ` · ${item.descuento}% desc.` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-zinc-700 flex-shrink-0">
                          ${item.subtotal.toLocaleString('es-MX')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-400 text-sm bg-zinc-50 rounded-lg">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                  Sin desglose de productos disponible
                  <p className="text-xs mt-1 text-zinc-300">(venta migrada desde el sistema anterior)</p>
                </div>
              )}

              {/* Notas */}
              {ventaAbierta.notas && (
                <div className="bg-amber-50 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Notas</p>
                  <p className="text-sm text-zinc-600">{ventaAbierta.notas}</p>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <span className="text-sm font-semibold text-zinc-500">Total</span>
                <span className="text-xl font-bold text-zinc-800">${ventaAbierta.total.toLocaleString('es-MX')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA RECETA ── */}
      {modalReceta && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-bold text-zinc-800">Nueva receta</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{seleccionado?.nombre} {seleccionado?.apellido}</p>
              </div>
              <button onClick={() => { setModalReceta(false); setErroresReceta({}) }}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Fecha, tipo, optometrista */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha</label>
                  <input type="date" value={formReceta.fecha} onChange={e => fr('fecha', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo</label>
                  <div className="relative">
                    <select value={formReceta.tipo} onChange={e => fr('tipo', e.target.value as Receta['tipo'])}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {['Lejos', 'Cerca', 'Progresivo', 'Bifocal'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Optometrista</label>
                  <input value={formReceta.optometrista} onChange={e => fr('optometrista', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
              </div>

              {/* Tabla graduación */}
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200">
                  <p className="text-xs font-semibold text-zinc-500">Graduación</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="text-left text-xs text-zinc-400 font-medium px-4 py-2.5 w-16"></th>
                      <th className="text-center text-xs text-zinc-400 font-medium px-2 py-2.5">Esfera</th>
                      <th className="text-center text-xs text-zinc-400 font-medium px-2 py-2.5">Cilindro</th>
                      <th className="text-center text-xs text-zinc-400 font-medium px-2 py-2.5">Eje</th>
                      {(formReceta.tipo === 'Progresivo' || formReceta.tipo === 'Bifocal') && (
                        <th className="text-center text-xs text-zinc-400 font-medium px-2 py-2.5">Adición</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {[
                      { label: 'OD', fields: ['od_esfera', 'od_cilindro', 'od_eje', 'od_add'] },
                      { label: 'OI', fields: ['oi_esfera', 'oi_cilindro', 'oi_eje', 'oi_add'] },
                    ].map(row => (
                      <tr key={row.label}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded">{row.label}</span>
                        </td>
                        {row.fields.slice(0, (formReceta.tipo === 'Progresivo' || formReceta.tipo === 'Bifocal') ? 4 : 3).map(field => {
                          const isEje = field.includes('eje')
                          const isAdd = field.includes('add')
                          const hasError = !!erroresReceta[field]
                          return (
                            <td key={field} className="px-2 py-3">
                              <input
                                value={formReceta[field as keyof typeof formReceta] as string}
                                onChange={e => {
                                  fr(field as keyof typeof formReceta, e.target.value)
                                  if (erroresReceta[field]) setErroresReceta(prev => { const {[field]: _, ...rest} = prev; return rest })
                                }}
                                onBlur={e => {
                                  const v = e.target.value
                                  if (!v) return
                                  if (isEje) fr(field as keyof typeof formReceta, formatEjeValue(v))
                                  else if (!isAdd) fr(field as keyof typeof formReceta, formatGradValue(v))
                                }}
                                className={`w-full text-center border rounded px-2 py-2 text-sm font-mono bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 ${hasError ? 'border-red-400 bg-red-50 ring-1 ring-red-300' : 'border-zinc-200'}`}
                                placeholder={isEje ? '000' : isAdd ? '+0.00' : '±0.00'}
                              />
                              {hasError && <p className="text-xs text-red-500 text-center mt-0.5">{erroresReceta[field]}</p>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* DP */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                    D.P. (mm) <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formReceta.dp}
                    onChange={e => { fr('dp', e.target.value); if (erroresReceta.dp) setErroresReceta(prev => { const {dp: _, ...rest} = prev; return rest }) }}
                    onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) fr('dp', n.toFixed(0)) }}
                    className={`w-full border rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 font-mono ${erroresReceta.dp ? 'border-red-400 bg-red-50' : 'border-zinc-200'}`}
                    placeholder="62"
                  />
                  {erroresReceta.dp && <p className="text-xs text-red-500 mt-1">{erroresReceta.dp}</p>}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  <FileText className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Observaciones
                </label>
                <textarea value={formReceta.observaciones} onChange={e => fr('observaciones', e.target.value)} rows={3}
                  className="w-full border border-zinc-200 rounded px-3 py-3 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none placeholder:text-zinc-400"
                  placeholder="Antirreflejante recomendado, lentes de contacto, indicaciones especiales..." />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => { setModalReceta(false); setErroresReceta({}) }}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={guardarReceta}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27]">
                <Save className="w-4 h-4" /> Guardar receta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PACIENTE ── */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-800">Editar expediente</h2>
              <button onClick={() => setModalEditar(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Nombre *</label>
                  <input value={formEditar.nombre} onChange={e => setFormEditar(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Apellido *</label>
                  <input value={formEditar.apellido} onChange={e => setFormEditar(p => ({ ...p, apellido: e.target.value }))}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono</label>
                <div className="flex gap-2">
                  <select value={ladaEditar} onChange={e => setLadaEditar(e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-2.5 bg-zinc-50 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 cursor-pointer">
                    {PAISES_LADA.map((p, i) => <option key={i} value={p.code}>{p.label}</option>)}
                  </select>
                  <input value={formEditar.telefono} onChange={e => setFormEditar(p => ({ ...p, telefono: e.target.value }))}
                    className="flex-1 border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="661 000 0000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Email</label>
                <input value={formEditar.email} onChange={e => setFormEditar(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" type="email" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha de nacimiento</label>
                  <input type="date" value={formEditar.fechaNacimiento} onChange={e => setFormEditar(p => ({ ...p, fechaNacimiento: e.target.value }))}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <div className="relative">
                    <select value={formEditar.sucursalPrincipal} onChange={e => setFormEditar(p => ({ ...p, sucursalPrincipal: e.target.value }))}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notas médicas</label>
                <textarea value={formEditar.notas} onChange={e => setFormEditar(p => ({ ...p, notas: e.target.value }))} rows={3}
                  className="w-full border border-zinc-200 rounded px-3 py-3 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModalEditar(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={!formEditar.nombre || !formEditar.apellido}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40">
                <Save className="w-4 h-4" /> Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO PACIENTE ── */}
      {modalPaciente && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-800">Nuevo paciente</h2>
              <button onClick={() => setModalPaciente(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Nombre *</label>
                  <input value={formPaciente.nombre} onChange={e => setFormPaciente(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="Nombre" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Apellido *</label>
                  <input value={formPaciente.apellido} onChange={e => setFormPaciente(p => ({ ...p, apellido: e.target.value }))}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="Apellido" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono</label>
                <div className="flex gap-2">
                  <select value={ladaNuevo} onChange={e => setLadaNuevo(e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-2.5 bg-zinc-50 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 cursor-pointer">
                    {PAISES_LADA.map((p, i) => <option key={i} value={p.code}>{p.label}</option>)}
                  </select>
                  <input value={formPaciente.telefono} onChange={e => setFormPaciente(p => ({ ...p, telefono: e.target.value }))}
                    className="flex-1 border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="661 000 0000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Email</label>
                <input value={formPaciente.email} onChange={e => setFormPaciente(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  placeholder="opcional" type="email" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha de nacimiento</label>
                  <input type="date" value={formPaciente.fechaNacimiento} onChange={e => setFormPaciente(p => ({ ...p, fechaNacimiento: e.target.value }))}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal principal</label>
                  <div className="relative">
                    <select value={formPaciente.sucursalPrincipal} onChange={e => setFormPaciente(p => ({ ...p, sucursalPrincipal: e.target.value }))}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notas médicas</label>
                <textarea value={formPaciente.notas} onChange={e => setFormPaciente(p => ({ ...p, notas: e.target.value }))} rows={3}
                  className="w-full border border-zinc-200 rounded px-3 py-3 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none placeholder:text-zinc-400"
                  placeholder="Alergias, condiciones médicas relevantes (diabetes, hipertensión, etc.)..." />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModalPaciente(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={guardarPaciente} disabled={!formPaciente.nombre || !formPaciente.apellido}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40">
                <User className="w-4 h-4" /> Crear expediente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { Suspense } from 'react'
export default function ExpedientesPage() {
  return (
    <Suspense>
      <ExpedientesContent />
    </Suspense>
  )
}
