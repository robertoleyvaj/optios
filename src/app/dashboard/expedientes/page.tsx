'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, X, Save, ChevronRight,
  User, Phone, Calendar, FileText,
  Eye, ShoppingBag, Clock, ChevronDown,
  Printer, Edit2, AlertCircle,
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
  fecha: new Date().toISOString().split('T')[0],
  tipo: 'Lejos',
  od_esfera: '', od_cilindro: '', od_eje: '', od_add: '',
  oi_esfera: '', oi_cilindro: '', oi_eje: '', oi_add: '',
  dp: '', optometrista: getOptometristaDefault(), observaciones: '',
})

const formVacioPaciente = (): Omit<Paciente, 'id' | 'recetas' | 'citas' | 'ventas'> => ({
  nombre: '', apellido: '', telefono: '', email: '',
  fechaNacimiento: '', sucursalPrincipal: 'Baja Visión', notas: '',
})

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
function ExpedientesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [pacientes, setPacientes] = useState<Paciente[]>(PACIENTES_MOCK)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Paciente | null>(PACIENTES_MOCK[0])
  const [tabActiva, setTabActiva] = useState<'recetas' | 'citas' | 'ventas'>('recetas')

  // Modal detalle compra
  const [ventaAbierta, setVentaAbierta] = useState<HistorialVenta | null>(null)

  // Modal nueva receta
  const [modalReceta, setModalReceta] = useState(false)
  const [formReceta, setFormReceta] = useState<Omit<Receta, 'id'>>(formVacioReceta())
  const [erroresReceta, setErroresReceta] = useState<Record<string, string>>({})

  // Modal nuevo paciente
  const [modalPaciente, setModalPaciente] = useState(false)
  const [formPaciente, setFormPaciente] = useState<Omit<Paciente, 'id' | 'recetas' | 'citas' | 'ventas'>>(formVacioPaciente())

  // Historial BV
  const [historialResultados, setHistorialResultados] = useState<HistorialBV[]>([])
  const [buscandoHistorial, setBuscandoHistorial] = useState(false)

  // Modal editar paciente
  const [modalEditar, setModalEditar] = useState(false)
  const [formEditar, setFormEditar] = useState<Omit<Paciente, 'id' | 'recetas' | 'citas' | 'ventas'>>(formVacioPaciente())

  // Abrir modal automáticamente si viene de ?nuevo=true
  // Pre-llenar búsqueda si viene de ?search=... (desde el buscador del header)
  useEffect(() => {
    if (searchParams.get('nuevo') === 'true') {
      setModalPaciente(true)
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
          setSeleccionado(mapped[0] ?? null)
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
        const [recRes, venRes] = await Promise.all([
          supabase.from('recetas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
          supabase.from('ventas').select('id, folio, total, created_at, notas, estado, metodo_pago, atendido_por, ventas_items(id, nombre, sku, precio_unitario, cantidad, descuento, subtotal)').eq('paciente_id', id).order('created_at', { ascending: false }),
        ])
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
    setTabActiva('recetas')
  }

  const guardarPaciente = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('pacientes').insert({
        nombre:             formPaciente.nombre,
        apellido:           formPaciente.apellido,
        telefono:           formPaciente.telefono,
        email:              formPaciente.email,
        fecha_nacimiento:   formPaciente.fechaNacimiento || null,
        sucursal_principal: formPaciente.sucursalPrincipal,
        notas:              formPaciente.notas,
      }).select('id').single()

      const id = data?.id ?? Date.now()
      if (error) console.error(error)

      const nuevo: Paciente = { id, ...formPaciente, recetas: [], citas: [], ventas: [] }
      setPacientes(prev => [nuevo, ...prev])
      setSeleccionado(nuevo)
    } catch (e) {
      console.error(e)
      const nuevo: Paciente = { id: Date.now(), ...formPaciente, recetas: [], citas: [], ventas: [] }
      setPacientes(prev => [nuevo, ...prev])
      setSeleccionado(nuevo)
    }
    setModalPaciente(false)
    setFormPaciente(formVacioPaciente())
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
    try {
      const supabase = createClient()
      await supabase.from('pacientes').update({
        nombre:             formEditar.nombre,
        apellido:           formEditar.apellido,
        telefono:           formEditar.telefono,
        email:              formEditar.email,
        fecha_nacimiento:   formEditar.fechaNacimiento || null,
        sucursal_principal: formEditar.sucursalPrincipal,
        notas:              formEditar.notas,
      }).eq('id', seleccionado.id)
    } catch (e) { console.error(e) }

    const actualizado = { ...seleccionado, ...formEditar }
    setPacientes(prev => prev.map(p => p.id === seleccionado.id ? actualizado : p))
    setSeleccionado(actualizado)
    setModalEditar(false)
  }

  const rv = recetaVigente(seleccionado ?? { recetas: [] } as unknown as Paciente)

  return (
    <div className="flex gap-5 h-[calc(100vh-140px)]">

      {/* ── PANEL IZQUIERDO: lista de pacientes ── */}
      <div className="w-72 flex-shrink-0 bg-white rounded-lg border border-zinc-200/80 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-zinc-700">Expedientes</span>
            <span className="text-xs text-zinc-400">{pacientes.length} pacientes</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              placeholder="Buscar paciente..." />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
          {filtrados.map(p => {
            const fechaMostrar = p._ultimaRecetaFecha
            const esSeleccionado = seleccionado?.id === p.id
            return (
              <button key={p.id} onClick={() => setSeleccionado(p)}
                className={`w-full text-left px-4 py-3.5 transition-colors flex items-center gap-3 ${esSeleccionado ? 'bg-[#0B0E14]' : 'hover:bg-zinc-50'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${esSeleccionado ? 'bg-[#0D9488]/20 text-[#0D9488]' : 'bg-zinc-100 text-zinc-500'}`}>
                  {p.nombre[0]}{p.apellido[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${esSeleccionado ? 'text-white' : 'text-zinc-700'}`}>
                    {p.nombre} {p.apellido}
                  </p>
                  <p className={`text-xs truncate ${esSeleccionado ? 'text-white/50' : 'text-zinc-400'}`}>
                    {fechaMostrar ? `Última receta: ${fechaMostrar.split('-').slice(0,2).join('/')}` : 'Sin receta'}
                  </p>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${esSeleccionado ? 'text-white/40' : 'text-zinc-300'}`} />
              </button>
            )
          })}
          {filtrados.length === 0 && busqueda.length < 3 && (
            <div className="text-center py-10 text-sm text-zinc-400">Sin resultados</div>
          )}

          {/* ── Resultados de historial_bv ── */}
          {busqueda.length >= 3 && (
            <>
              {filtrados.length === 0 && (
                <div className="text-center py-6 text-sm text-zinc-400">Sin expedientes activos</div>
              )}
              {filtrados.length === 0 && (historialResultados.length > 0 || buscandoHistorial) && (
                <div className="border-t border-dashed border-zinc-200 mt-1">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Historial anterior
                  </p>
                  {buscandoHistorial && (
                    <div className="px-4 py-3 text-xs text-zinc-400">Buscando...</div>
                  )}
                  {historialResultados.map(h => (
                    <button key={h.id} onClick={() => crearDesdeHistorial(h)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center gap-3 border-b border-zinc-50">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {h.nombre[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-600 truncate">{h.nombre}</p>
                        <p className="text-xs text-zinc-400 truncate">{h.sucursal} · ${h.total.toLocaleString('es-MX')}</p>
                      </div>
                      <span className="text-xs text-amber-600 font-medium flex-shrink-0">Crear →</span>
                    </button>
                  ))}
                  {!buscandoHistorial && historialResultados.length === 0 && (
                    <div className="px-4 py-3 text-xs text-zinc-400">Sin historial encontrado</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100">
          <button onClick={() => router.push('/dashboard/expedientes/nuevo')}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-[#1A1D27] transition-colors">
            <Plus className="w-4 h-4" /> Nuevo paciente
          </button>
        </div>
      </div>

      {/* ── PANEL DERECHO: detalle ── */}
      {seleccionado ? (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">

          {/* Info del paciente */}
          <div className="bg-white rounded-lg border border-zinc-200/80 p-5 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#0B0E14] text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {seleccionado.nombre[0]}{seleccionado.apellido[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-800">{seleccionado.nombre} {seleccionado.apellido}</h2>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                      <Phone className="w-3.5 h-3.5" /> {seleccionado.telefono}
                    </span>
                    {seleccionado.email && (
                      <span className="text-sm text-zinc-500">{seleccionado.email}</span>
                    )}
                    {seleccionado.fechaNacimiento && (
                      <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                        <Calendar className="w-3.5 h-3.5" /> {calcEdad(seleccionado.fechaNacimiento)}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                      {seleccionado.sucursalPrincipal}
                    </span>
                  </div>
                  {seleccionado.notas && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{seleccionado.notas}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={abrirEditar} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => router.push(`/dashboard/expedientes/nuevo?pacienteId=${seleccionado.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#0D9488] text-white rounded text-xs font-semibold hover:bg-teal-500 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nueva consulta
                </button>
              </div>
            </div>

            {/* Stats rápidos */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-zinc-800">{seleccionado.recetas.length}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Receta{seleccionado.recetas.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-center border-x border-zinc-100">
                <p className="text-2xl font-bold text-zinc-800">{seleccionado.citas.length}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Citas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-zinc-800">
                  ${seleccionado.ventas.reduce((s, v) => s + v.total, 0).toLocaleString('es-MX')}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">Total compras</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-zinc-200/80 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-zinc-100 px-2">
              {([
                { key: 'recetas', label: 'Recetas', icon: Eye },
                { key: 'citas',   label: 'Historial de citas', icon: Clock },
                { key: 'ventas',  label: 'Compras', icon: ShoppingBag },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setTabActiva(key)}
                  className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tabActiva === key ? 'border-[#0D9488] text-[#0B0E14]' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
              {tabActiva === 'recetas' && (
                <button onClick={() => { setFormReceta(formVacioReceta()); setErroresReceta({}); setModalReceta(true) }}
                  className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-2 bg-[#0B0E14] text-white rounded text-xs font-semibold hover:bg-[#1A1D27] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nueva receta
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">

              {/* ── TAB RECETAS ── */}
              {tabActiva === 'recetas' && (
                <div className="space-y-4">
                  {seleccionado.recetas.length === 0 && (
                    <div className="text-center py-16 text-zinc-400 text-sm">
                      Sin recetas registradas. Agrega la primera.
                    </div>
                  )}
                  {seleccionado.recetas.sort((a, b) => b.fecha.localeCompare(a.fecha)).map((r, i) => (
                    <div key={r.id} className={`rounded-lg border ${i === 0 ? 'border-[#0D9488]/40 bg-[#0D9488]/5' : 'border-zinc-200 bg-white'}`}>
                      {/* Header receta */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
                        <div className="flex items-center gap-3">
                          <div className={`text-xs font-bold px-2 py-1 rounded ${i === 0 ? 'bg-[#0D9488] text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                            {i === 0 ? 'Vigente' : 'Anterior'}
                          </div>
                          <span className="text-sm font-semibold text-zinc-700">{r.fecha}</span>
                          <span className="text-xs text-zinc-400">· {r.tipo} · {r.optometrista}</span>
                        </div>
                        <button className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                      </div>

                      {/* Tabla graduación */}
                      <div className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-zinc-400">
                                <th className="text-left py-1.5 pr-4 font-medium w-12"></th>
                                <th className="text-center py-1.5 px-3 font-medium">Esfera</th>
                                <th className="text-center py-1.5 px-3 font-medium">Cilindro</th>
                                <th className="text-center py-1.5 px-3 font-medium">Eje</th>
                                {(r.od_add || r.oi_add) && <th className="text-center py-1.5 px-3 font-medium">Adición</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              <tr>
                                <td className="py-2.5 pr-4">
                                  <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">OD</span>
                                </td>
                                <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.od_esfera || '—'}</td>
                                <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.od_cilindro || '—'}</td>
                                <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.od_eje || '—'}°</td>
                                {(r.od_add || r.oi_add) && <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.od_add || '—'}</td>}
                              </tr>
                              <tr>
                                <td className="py-2.5 pr-4">
                                  <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">OI</span>
                                </td>
                                <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.oi_esfera || '—'}</td>
                                <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.oi_cilindro || '—'}</td>
                                <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.oi_eje || '—'}°</td>
                                {(r.od_add || r.oi_add) && <td className="text-center py-2.5 px-3 font-mono font-semibold text-zinc-800">{r.oi_add || '—'}</td>}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100">
                          <span className="text-xs text-zinc-500"><span className="font-semibold text-zinc-600">D.P.:</span> {r.dp} mm</span>
                          {r.observaciones && (
                            <span className="text-xs text-zinc-500"><span className="font-semibold text-zinc-600">Obs.:</span> {r.observaciones}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB CITAS ── */}
              {tabActiva === 'citas' && (
                <div className="space-y-2">
                  {seleccionado.citas.length === 0 && (
                    <div className="text-center py-16 text-zinc-400 text-sm">Sin citas registradas.</div>
                  )}
                  {[...seleccionado.citas].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((c, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors">
                      <div className="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-700">{c.tipo}</p>
                        <p className="text-xs text-zinc-400">{c.sucursal} · {c.fecha}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded ${
                        c.estado === 'Atendida' ? 'bg-blue-50 text-blue-600' :
                        c.estado === 'Confirmada' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>{c.estado}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB VENTAS ── */}
              {tabActiva === 'ventas' && (
                <div className="space-y-2">
                  {seleccionado.ventas.length === 0 && (
                    <div className="text-center py-16 text-zinc-400 text-sm">Sin compras registradas.</div>
                  )}
                  {[...seleccionado.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((v, i) => (
                    <button key={i} onClick={() => setVentaAbierta(v)}
                      className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors">
                      <div className="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-700">{v.folio}</p>
                        <p className="text-xs text-zinc-400">{v.fecha}{v.items.length > 0 ? ` · ${v.items.length} producto${v.items.length !== 1 ? 's' : ''}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {v.estado === 'cancelada' && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Cancelada</span>
                        )}
                        <span className="text-sm font-bold text-zinc-800">${v.total.toLocaleString('es-MX')}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-300" />
                      </div>
                    </button>
                  ))}
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
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input value={formEditar.telefono} onChange={e => setFormEditar(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-zinc-200 rounded pl-9 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
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
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
                  <input value={formPaciente.telefono} onChange={e => setFormPaciente(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-zinc-200 rounded pl-9 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="686 000 0000" />
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
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
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
              <button onClick={guardarPaciente} disabled={!formPaciente.nombre || !formPaciente.apellido || !formPaciente.telefono}
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
