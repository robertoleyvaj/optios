'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronRight, ChevronLeft, Check, User, ClipboardList,
  Eye, Activity, Stethoscope, Brain, Star, FileText,
  ShoppingBag, X, Plus, AlertCircle, Sparkles,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type RxEye = { esfera: string; cilindro: string; eje: string; add: string }
type RxSubjetiva = { od: RxEye; oi: RxEye; dp_od: string; dp_oi: string }

type Habitos = {
  horas_computadora: number
  horas_celular: number
  horas_lectura: number
  horas_videojuegos: number
  maneja_noche: boolean
  lentes_sol: boolean
  lentes_seguridad: boolean
  actividad_laboral: string
  distancia_trabajo: string
}

type Diagnostico = { nombre: string; confirmado: boolean }
type RecClinica = { texto: string; activa: boolean }
type RecComercial = { producto: string; razon: string; prioridad: 'alta' | 'media' | 'opcional' }

const STEPS = [
  { id: 1, label: 'Paciente',    icon: User },
  { id: 2, label: 'Historia',    icon: ClipboardList },
  { id: 3, label: 'Hábitos',     icon: Activity },
  { id: 4, label: 'Síntomas',    icon: AlertCircle },
  { id: 5, label: 'Consulta',    icon: Eye },
  { id: 6, label: 'Diagnóstico', icon: Brain },
  { id: 7, label: 'Rec. Clínica',icon: Stethoscope },
  { id: 8, label: 'Prescripción',icon: FileText },
  { id: 9, label: 'Comercial',   icon: ShoppingBag },
]

const MOTIVOS = [
  'Primera consulta', 'Revisión anual', 'Cambio de graduación',
  'Lentes dañados', 'Problemas de visión', 'Adaptación de lentes de contacto', 'Otro',
]

const ANTEC_MEDICOS = ['Diabetes', 'Hipertensión', 'Enf. tiroideas', 'Migraña', 'Enf. autoinmunes']
const ANTEC_OCULARES = ['Usa lentes', 'Usa lentes de contacto', 'Cirugías', 'Traumatismos', 'Ojo seco', 'Estrabismo', 'Ambliopía']
const ANTEC_FAMILIARES = ['Glaucoma', 'Diabetes', 'Catarata', 'Miopía alta', 'Estrabismo']

const SINTOMAS_LISTA = [
  'Visión borrosa de lejos', 'Visión borrosa de cerca', 'Cefalea', 'Fatiga visual',
  'Ardor', 'Lagrimeo', 'Picazón', 'Ojo seco', 'Fotofobia',
  'Dificultad para manejar de noche', 'Deslumbramiento', 'Halos', 'Diplopía', 'Visión fluctuante',
]

const DISTANCIAS = ['< 30 cm', '30–50 cm', '50–70 cm', '> 70 cm', 'Variable']

const rxVacia = (): RxEye => ({ esfera: '', cilindro: '', eje: '', add: '' })

// ─────────────────────────────────────────────
// Motor de diagnóstico
// ─────────────────────────────────────────────
function parseRx(v: string): number {
  if (!v || v.trim() === '' || v.toLowerCase() === 'pl') return 0
  return parseFloat(v.replace(',', '.')) || 0
}

function generarDiagnosticos(rx: RxSubjetiva, edad: number, habitos: Habitos, sintomas: string[]): string[] {
  const diags: string[] = []
  const odEsf = parseRx(rx.od.esfera)
  const odCil = parseRx(rx.od.cilindro)
  const oiEsf = parseRx(rx.oi.esfera)
  const oiCil = parseRx(rx.oi.cilindro)
  const odAdd = parseRx(rx.od.add)
  const oiAdd = parseRx(rx.oi.add)

  const tieneMiopia = odEsf <= -0.25 || oiEsf <= -0.25
  const tieneHipermetropía = odEsf >= +0.25 || oiEsf >= +0.25
  const tieneCilOD = Math.abs(odCil) >= 0.25
  const tieneCilOI = Math.abs(oiCil) >= 0.25
  const tieneAstigmatismo = tieneCilOD || tieneCilOI

  if (tieneMiopia && !tieneAstigmatismo)  diags.push('Miopía')
  if (tieneHipermetropía && !tieneMiopia && !tieneAstigmatismo) diags.push('Hipermetropía')

  if (tieneAstigmatismo) {
    const eye = tieneCilOD ? { esf: odEsf, cil: odCil, eje: parseRx(rx.od.eje) } : { esf: oiEsf, cil: oiCil, eje: parseRx(rx.oi.eje) }
    const esfTotal = eye.esf + eye.cil

    if (eye.esf < 0 && esfTotal < 0)      diags.push('Astigmatismo miópico compuesto')
    else if (eye.esf < 0 && esfTotal > 0) diags.push('Astigmatismo mixto')
    else if (eye.esf > 0 && esfTotal > 0) diags.push('Astigmatismo hipermetrópico compuesto')
    else if (eye.esf === 0)               diags.push('Astigmatismo simple')
    else                                   diags.push('Astigmatismo')

    // Tipo de eje
    const eje = eye.eje
    if (eje >= 170 || eje <= 10)       diags.push('Astigmatismo con la regla')
    else if (eje >= 80 && eje <= 100)  diags.push('Astigmatismo contra la regla')
    else if ((eje > 10 && eje < 80) || (eje > 100 && eje < 170)) diags.push('Astigmatismo oblicuo')
  }

  // Presbicia
  if (odAdd >= 0.75 || oiAdd >= 0.75 || (edad >= 40 && !diags.some(d => d.includes('Lejos')))) {
    if (odAdd > 0 || oiAdd > 0 || edad >= 40) diags.push('Presbicia')
  }

  // Anisometropía
  if (Math.abs(odEsf - oiEsf) >= 1.0) diags.push('Anisometropía')

  // Fatiga digital
  const pantallasTotales = (habitos.horas_computadora || 0) + (habitos.horas_celular || 0)
  if (pantallasTotales >= 6 || sintomas.includes('Fatiga visual')) diags.push('Fatiga visual digital')

  // Ojo seco
  if (sintomas.includes('Ojo seco') || sintomas.includes('Ardor') || sintomas.includes('Lagrimeo'))
    diags.push('Sospecha de ojo seco')

  return [...new Set(diags)]
}

// ─────────────────────────────────────────────
// Recomendaciones clínicas
// ─────────────────────────────────────────────
function generarRecClinicas(diags: string[], habitos: Habitos, sintomas: string[]): string[] {
  const recs: string[] = []
  const pantallasTotales = (habitos.horas_computadora || 0) + (habitos.horas_celular || 0)

  if (pantallasTotales >= 6) recs.push('Aplicar regla 20-20-20: cada 20 min, mirar a 20 pies por 20 segundos')
  if (diags.includes('Sospecha de ojo seco')) recs.push('Aplicar lubricantes oculares sin conservadores 3-4 veces al día')
  if (diags.includes('Presbicia')) recs.push('Evaluar necesidad de lente progresivo o bifocal según actividades del paciente')
  if (diags.some(d => d.includes('Miopía')) && pantallasTotales >= 4) recs.push('Limitar uso de pantallas antes de dormir para evitar progresión')
  if (sintomas.includes('Cefalea')) recs.push('Verificar postura y altura del monitor; revisar iluminación del área de trabajo')
  if (sintomas.includes('Fotofobia')) recs.push('Evitar exposición directa a luz fluorescente; considerar filtro fotocromático')
  if (habitos.maneja_noche) recs.push('Uso estricto de antirreflejante para conducción nocturna')
  if (habitos.lentes_sol === false) recs.push('Recomendar protección UV 400 para exteriores, incluso en días nublados')

  return recs
}

// ─────────────────────────────────────────────
// Recomendaciones comerciales
// ─────────────────────────────────────────────
function generarRecComerciales(diags: string[], habitos: Habitos, rx: RxSubjetiva): RecComercial[] {
  const recs: RecComercial[] = []
  const odEsf = parseRx(rx.od.esfera)
  const oiEsf = parseRx(rx.oi.esfera)
  const odCil = parseRx(rx.od.cilindro)
  const oiCil = parseRx(rx.oi.cilindro)
  const minEsf = Math.min(odEsf, oiEsf)
  const maxCil = Math.max(Math.abs(odCil), Math.abs(oiCil))

  // AR premium
  if (habitos.maneja_noche || maxCil >= 1.0 || diags.some(d => d.includes('Astigmatismo'))) {
    recs.push({ producto: 'Antirreflejante premium', razon: habitos.maneja_noche ? 'Reduce encandilamiento y mejora visión nocturna' : 'El astigmatismo genera reflejos molestos; el AR mejora el contraste visual', prioridad: 'alta' })
  }

  // Filtro luz azul
  const hComp = habitos.horas_computadora || 0
  if (hComp >= 4) {
    recs.push({ producto: 'Filtro para luz azul', razon: `${hComp}h frente a pantalla al día — reduce fatiga y mejora calidad del sueño`, prioridad: hComp >= 8 ? 'alta' : 'media' })
  }

  // Índice alto
  if (minEsf <= -4.0 || minEsf >= +4.0) {
    recs.push({ producto: 'Material índice alto (1.60 o 1.67)', razon: `Graduación ${Math.abs(minEsf).toFixed(2)} — material delgado y liviano reduce peso y grosor del lente`, prioridad: 'alta' })
  }

  // Progresivo
  if (diags.includes('Presbicia')) {
    recs.push({ producto: 'Lente progresivo', razon: 'Presbicia diagnosticada — una sola mica para lejos, intermedio y cerca', prioridad: 'alta' })
  }

  // Fotocromático
  if (habitos.lentes_sol === false || diags.includes('Fotofobia')) {
    recs.push({ producto: 'Fotocromático (transitions)', razon: 'Se aclara en interiores y obscurece al sol — protección UV y comodidad en uno', prioridad: 'media' })
  }

  // Diseño ocupacional
  if (hComp >= 6) {
    recs.push({ producto: 'Diseño ocupacional', razon: `${hComp}h en pantalla — lente diseñado para distancias de trabajo: monitor, teclado y lectura`, prioridad: 'media' })
  }

  // Lentes de contacto si tiene LC en antecedentes no aplica sugerir armazón extra
  // Armazón pequeño para gradución alta
  if (minEsf <= -5.0) {
    recs.push({ producto: 'Armazón de tamaño pequeño o mediano', razon: 'Graduaciones altas se benefician de armazones pequeños para reducir el grosor periférico del lente', prioridad: 'opcional' })
  }

  return recs
}

// ─────────────────────────────────────────────
// Componente campo de graduación
// ─────────────────────────────────────────────
function RxField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-zinc-400 mb-1 uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm font-mono text-zinc-800 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 text-center"
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function NuevaConsultaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pacienteIdParam = searchParams.get('pacienteId')

  const [paso, setPaso]         = useState(pacienteIdParam ? 2 : 1)
  const [guardando, setGuardando] = useState(false)
  const [consultaId, setConsultaId] = useState<string | null>(null)
  const [pacienteId, setPacienteId] = useState<string | null>(pacienteIdParam)
  const [pacienteNombre, setPacienteNombre] = useState('')

  // ── Datos paso 1: Paciente ──
  const [pNombre, setPNombre]             = useState('')
  const [pApellido, setPApellido]         = useState('')
  const [pFechaNac, setPFechaNac]         = useState('')
  const [pSexo, setPSexo]                 = useState('')
  const [pTelefono, setPTelefono]         = useState('')
  const [pWhatsapp, setPWhatsapp]         = useState('')
  const [pEmail, setPEmail]               = useState('')
  const [pDireccion, setPDireccion]       = useState('')
  const [pOcupacion, setPOcupacion]       = useState('')
  const [pEmpresa, setPEmpresa]           = useState('')

  // ── Datos paso 2: Historia ──
  const [motivo, setMotivo]               = useState('')
  const [sintomaPrincipal, setSintomaPrincipal] = useState('')
  const [antecMedicos, setAntecMedicos]   = useState<string[]>([])
  const [antecOculares, setAntecOculares] = useState<string[]>([])
  const [antecFamiliares, setAntecFamiliares] = useState<string[]>([])
  const [medicamentos, setMedicamentos]   = useState('')
  const [alergias, setAlergias]           = useState('')

  // ── Datos paso 3: Hábitos ──
  const [habitos, setHabitos] = useState<Habitos>({
    horas_computadora: 0, horas_celular: 0, horas_lectura: 0, horas_videojuegos: 0,
    maneja_noche: false, lentes_sol: false, lentes_seguridad: false,
    actividad_laboral: '', distancia_trabajo: '',
  })

  // ── Datos paso 4: Síntomas ──
  const [sintomasSeleccionados, setSintomasSeleccionados] = useState<string[]>([])
  const [sintomasObs, setSintomasObs] = useState('')

  // ── Datos paso 5: Consulta ──
  const [avVlOd, setAvVlOd] = useState('') ; const [avVlOi, setAvVlOi] = useState('')
  const [avVcOd, setAvVcOd] = useState('') ; const [avVcOi, setAvVcOi] = useState('')
  const [avScOd, setAvScOd] = useState('') ; const [avScOi, setAvScOi] = useState('')
  const [lensOd, setLensOd] = useState<RxEye>(rxVacia())
  const [lensOi, setLensOi] = useState<RxEye>(rxVacia())
  const [autoOd, setAutoOd] = useState<RxEye>(rxVacia())
  const [autoOi, setAutoOi] = useState<RxEye>(rxVacia())
  const [rxOd, setRxOd]     = useState<RxEye>(rxVacia())
  const [rxOi, setRxOi]     = useState<RxEye>(rxVacia())
  const [rxDpOd, setRxDpOd] = useState('') ; const [rxDpOi, setRxDpOi] = useState('')
  const [obsClinicas, setObsClinicas] = useState('')

  // ── Datos paso 6: Diagnóstico ──
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [diagManual, setDiagManual]     = useState('')
  const [diagGenerado, setDiagGenerado] = useState(false)

  // ── Datos paso 7: Rec. clínicas ──
  const [recClinicas, setRecClinicas]   = useState<RecClinica[]>([])
  const [recManual, setRecManual]       = useState('')

  // ── Datos paso 8: Prescripción ──
  const [rxFinal, setRxFinal]           = useState<RxSubjetiva>({ od: rxVacia(), oi: rxVacia(), dp_od: '', dp_oi: '' })
  const [rxTipo, setRxTipo]             = useState('Lejos')
  const [rxOptometrista, setRxOptometrista] = useState('')
  const [rxObservaciones, setRxObservaciones] = useState('')

  // ── Datos paso 9: Rec. comerciales ──
  const [recComerciales, setRecComerciales] = useState<RecComercial[]>([])

  // Auto-load nombre si paciente existente
  useEffect(() => {
    if (pacienteIdParam) {
      const supabase = createClient()
      supabase.from('pacientes').select('nombre, apellido').eq('id', pacienteIdParam).single().then(({ data }) => {
        if (data) setPacienteNombre(`${data.nombre} ${data.apellido}`)
      })
    }
    // Default optometrista
    try {
      const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}')
      setRxOptometrista(u.nombreReceta || u.nombre || 'Dr. Leyva')
    } catch {}
  }, [pacienteIdParam])

  // Pre-fill prescripción desde Rx subjetiva cuando llega al paso 8
  useEffect(() => {
    if (paso === 8) {
      setRxFinal({ od: { ...rxOd }, oi: { ...rxOi }, dp_od: rxDpOd, dp_oi: rxDpOi })
    }
  }, [paso])

  // Generar diagnósticos al llegar al paso 6
  useEffect(() => {
    if (paso === 6 && !diagGenerado) {
      const edad = pFechaNac ? calcEdad(pFechaNac) : 0
      const sugeridos = generarDiagnosticos({ od: rxOd, oi: rxOi, dp_od: rxDpOd, dp_oi: rxDpOi }, edad, habitos, sintomasSeleccionados)
      setDiagnosticos(sugeridos.map(n => ({ nombre: n, confirmado: true })))
      setDiagGenerado(true)
    }
  }, [paso])

  // Generar rec clínicas al llegar al paso 7
  useEffect(() => {
    if (paso === 7 && recClinicas.length === 0) {
      const diags = diagnosticos.filter(d => d.confirmado).map(d => d.nombre)
      const sugeridas = generarRecClinicas(diags, habitos, sintomasSeleccionados)
      setRecClinicas(sugeridas.map(t => ({ texto: t, activa: true })))
    }
  }, [paso])

  // Generar rec comerciales al llegar al paso 9
  useEffect(() => {
    if (paso === 9 && recComerciales.length === 0) {
      const diags = diagnosticos.filter(d => d.confirmado).map(d => d.nombre)
      const sugeridas = generarRecComerciales(diags, habitos, { od: rxFinal.od, oi: rxFinal.oi, dp_od: rxFinal.dp_od, dp_oi: rxFinal.dp_oi })
      setRecComerciales(sugeridas)
    }
  }, [paso])

  function calcEdad(fechaNac: string): number {
    const hoy = new Date(); const nac = new Date(fechaNac)
    let edad = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
    return edad
  }

  function toggleCheck(arr: string[], setArr: (a: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const getSucursalActual = () => {
    try { return JSON.parse(localStorage.getItem('optios_demo_user') || '{}')?.sucursal || '' } catch { return '' }
  }

  // ── Guardar / avanzar ──
  const avanzar = async () => {
    setGuardando(true)
    try {
      const supabase = createClient()

      // Paso 1: crear paciente
      if (paso === 1) {
        const { data, error } = await supabase.from('pacientes').insert({
          nombre: pNombre.trim(),
          apellido: pApellido.trim(),
          telefono: pTelefono,
          whatsapp: pWhatsapp || pTelefono,
          email: pEmail,
          direccion: pDireccion,
          ocupacion: pOcupacion,
          empresa: pEmpresa,
          sexo: pSexo,
          fecha_nacimiento: pFechaNac || null,
          sucursal_principal: getSucursalActual(),
          notas: '',
        }).select('id').single()
        if (error || !data) { alert('Error al guardar paciente: ' + error?.message); return }
        setPacienteId(data.id)
        setPacienteNombre(`${pNombre} ${pApellido}`)
      }

      // Paso 2: crear consulta (si no existe aún)
      if (paso === 2 && !consultaId) {
        const { data, error } = await supabase.from('consultas').insert({
          paciente_id: pacienteId || pacienteIdParam,
          sucursal: getSucursalActual(),
          atendido_por: rxOptometrista,
          motivo,
          sintoma_principal: sintomaPrincipal,
          antecedentes_medicos: Object.fromEntries(antecMedicos.map(k => [k, true])),
          antecedentes_oculares: Object.fromEntries(antecOculares.map(k => [k, true])),
          antecedentes_familiares: Object.fromEntries(antecFamiliares.map(k => [k, true])),
          medicamentos,
          alergias,
          paso_actual: 3,
        }).select('id').single()
        if (error || !data) { alert('Error al guardar consulta: ' + error?.message); return }
        setConsultaId(data.id)
      }

      // Pasos 3-5: actualizar consulta con datos adicionales
      if (consultaId) {
        const updates: Record<string, unknown> = { paso_actual: paso + 1 }

        if (paso === 3) Object.assign(updates, { habitos })
        if (paso === 4) Object.assign(updates, { sintomas_lista: sintomasSeleccionados, sintomas_obs: sintomasObs })
        if (paso === 5) Object.assign(updates, {
          av_vl_od: avVlOd, av_vl_oi: avVlOi,
          av_vc_od: avVcOd, av_vc_oi: avVcOi,
          av_sc_od: avScOd, av_sc_oi: avScOi,
          lens_od: lensOd, lens_oi: lensOi,
          auto_od: autoOd, auto_oi: autoOi,
          rx_od: rxOd, rx_oi: rxOi,
          rx_dp_od: rxDpOd, rx_dp_oi: rxDpOi,
          observaciones_clinicas: obsClinicas,
        })
        if (paso === 6) Object.assign(updates, { diagnosticos: diagnosticos.filter(d => d.confirmado).map(d => d.nombre) })
        if (paso === 7) Object.assign(updates, { rec_clinicas: recClinicas.filter(r => r.activa).map(r => r.texto) })

        if (Object.keys(updates).length > 1) {
          await supabase.from('consultas').update(updates).eq('id', consultaId)
        }
      }

      // Paso 8: guardar receta
      if (paso === 8 && consultaId) {
        const pId = pacienteId || pacienteIdParam
        await supabase.from('recetas').insert({
          consulta_id: consultaId,
          paciente_id: pId,
          fecha: new Date().toISOString().split('T')[0],
          od_esfera: rxFinal.od.esfera, od_cilindro: rxFinal.od.cilindro,
          od_eje: rxFinal.od.eje, od_add: rxFinal.od.add,
          oi_esfera: rxFinal.oi.esfera, oi_cilindro: rxFinal.oi.cilindro,
          oi_eje: rxFinal.oi.eje, oi_add: rxFinal.oi.add,
          dp_od: rxFinal.dp_od, dp_oi: rxFinal.dp_oi,
          tipo: rxTipo, optometrista: rxOptometrista, observaciones: rxObservaciones,
          diagnostico: diagnosticos.filter(d => d.confirmado).map(d => d.nombre).join(', '),
        })
        // Guardar rec comerciales en consulta
        await supabase.from('consultas').update({
          rec_comerciales: recComerciales,
          estado: 'completada',
          paso_actual: 9,
        }).eq('id', consultaId)
      }

      setPaso(p => Math.min(p + 1, 9))
    } finally {
      setGuardando(false)
    }
  }

  const finalizar = async () => {
    setGuardando(true)
    if (consultaId) {
      const supabase = createClient()
      await supabase.from('consultas').update({
        rec_comerciales: recComerciales,
        estado: 'completada',
      }).eq('id', consultaId)
    }
    setGuardando(false)
    router.push('/dashboard/expedientes')
  }

  const puedeAvanzar = () => {
    if (paso === 1) return pNombre.trim().length > 0 && pApellido.trim().length > 0
    return true
  }

  // ─────────────────────────────────────────────
  // Render de cada paso
  // ─────────────────────────────────────────────

  const renderPaso = () => {
    switch (paso) {
      // ── PASO 1: Datos del paciente ─────────────
      case 1: return (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-bold text-zinc-800">Datos del paciente</h2>
            <p className="text-sm text-zinc-400 mt-0.5">Información básica para crear el expediente</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *" value={pNombre} onChange={setPNombre} />
            <Field label="Apellido(s) *" value={pApellido} onChange={setPApellido} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Fecha de nacimiento" value={pFechaNac} onChange={setPFechaNac} type="date" />
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sexo</label>
              <select value={pSexo} onChange={e => setPSexo(e.target.value)}
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30">
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <Field label="Teléfono" value={pTelefono} onChange={setPTelefono} type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="WhatsApp" value={pWhatsapp} onChange={setPWhatsapp} type="tel" />
            <Field label="Correo electrónico" value={pEmail} onChange={setPEmail} type="email" />
          </div>
          <Field label="Dirección" value={pDireccion} onChange={setPDireccion} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ocupación" value={pOcupacion} onChange={setPOcupacion} />
            <Field label="Empresa (opcional)" value={pEmpresa} onChange={setPEmpresa} />
          </div>
        </div>
      )

      // ── PASO 2: Historia clínica ───────────────
      case 2: return (
        <div className="space-y-5">
          <SectionTitle>Historia clínica</SectionTitle>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">Motivo de consulta</label>
            <div className="grid grid-cols-2 gap-2">
              {MOTIVOS.map(m => (
                <button key={m} onClick={() => setMotivo(m)}
                  className={`text-left px-3 py-2 rounded border text-sm transition-all ${motivo === m ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Síntoma principal (texto libre)</label>
            <textarea value={sintomaPrincipal} onChange={e => setSintomaPrincipal(e.target.value)} rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none"
              placeholder="Describe el síntoma principal del paciente..." />
          </div>
          <CheckGroup label="Antecedentes médicos" items={ANTEC_MEDICOS} selected={antecMedicos} onToggle={v => toggleCheck(antecMedicos, setAntecMedicos, v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Medicamentos actuales" value={medicamentos} onChange={setMedicamentos} />
            <Field label="Alergias" value={alergias} onChange={setAlergias} />
          </div>
          <CheckGroup label="Antecedentes oculares" items={ANTEC_OCULARES} selected={antecOculares} onToggle={v => toggleCheck(antecOculares, setAntecOculares, v)} />
          <CheckGroup label="Antecedentes familiares" items={ANTEC_FAMILIARES} selected={antecFamiliares} onToggle={v => toggleCheck(antecFamiliares, setAntecFamiliares, v)} />
        </div>
      )

      // ── PASO 3: Hábitos ────────────────────────
      case 3: return (
        <div className="space-y-5">
          <SectionTitle>Hábitos visuales</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            {([
              ['horas_computadora', 'Horas frente a computadora'],
              ['horas_celular',     'Horas usando celular'],
              ['horas_lectura',     'Horas leyendo'],
              ['horas_videojuegos', 'Horas de videojuegos'],
            ] as [keyof Habitos, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{label}</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={16} step={0.5} value={habitos[key] as number}
                    onChange={e => setHabitos(h => ({ ...h, [key]: parseFloat(e.target.value) }))}
                    className="flex-1 accent-[#0D9488]" />
                  <span className="text-sm font-bold text-zinc-700 w-10 text-right">{habitos[key]}h</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {([
              ['maneja_noche',      'Maneja de noche'],
              ['lentes_sol',        'Usa lentes de sol'],
              ['lentes_seguridad',  'Lentes de seguridad'],
            ] as [keyof Habitos, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setHabitos(h => ({ ...h, [key]: !h[key] }))}
                className={`flex items-center gap-2 px-4 py-3 rounded border text-sm font-medium transition-all ${habitos[key] ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${habitos[key] ? 'border-[#0D9488] bg-[#0D9488]' : 'border-zinc-300'}`}>
                  {habitos[key] && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Actividad laboral" value={habitos.actividad_laboral} onChange={v => setHabitos(h => ({ ...h, actividad_laboral: v }))} />
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Distancia habitual de trabajo</label>
              <select value={habitos.distancia_trabajo} onChange={e => setHabitos(h => ({ ...h, distancia_trabajo: e.target.value }))}
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30">
                <option value="">—</option>
                {DISTANCIAS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      )

      // ── PASO 4: Síntomas ───────────────────────
      case 4: return (
        <div className="space-y-5">
          <SectionTitle>Síntomas</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {SINTOMAS_LISTA.map(s => (
              <button key={s} onClick={() => toggleCheck(sintomasSeleccionados, setSintomasSeleccionados, s)}
                className={`text-left flex items-center gap-2.5 px-3 py-2.5 rounded border text-sm transition-all ${sintomasSeleccionados.includes(s) ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-medium' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${sintomasSeleccionados.includes(s) ? 'border-[#0D9488] bg-[#0D9488]' : 'border-zinc-300'}`}>
                  {sintomasSeleccionados.includes(s) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {s}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Observaciones</label>
            <textarea value={sintomasObs} onChange={e => setSintomasObs(e.target.value)} rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none" />
          </div>
        </div>
      )

      // ── PASO 5: Consulta optométrica ───────────
      case 5: return (
        <div className="space-y-5">
          <SectionTitle>Consulta optométrica</SectionTitle>

          {/* Agudeza visual */}
          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Agudeza visual</p>
            <div className="grid grid-cols-3 gap-3">
              <div />
              <div className="text-center text-xs font-semibold text-zinc-500">OD</div>
              <div className="text-center text-xs font-semibold text-zinc-500">OI</div>

              <div className="text-xs font-semibold text-zinc-500 flex items-center">V. Lejos</div>
              <input value={avVlOd} onChange={e => setAvVlOd(e.target.value)} placeholder="20/20"
                className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
              <input value={avVlOi} onChange={e => setAvVlOi(e.target.value)} placeholder="20/20"
                className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />

              <div className="text-xs font-semibold text-zinc-500 flex items-center">V. Cerca</div>
              <input value={avVcOd} onChange={e => setAvVcOd(e.target.value)} placeholder="20/20"
                className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
              <input value={avVcOi} onChange={e => setAvVcOi(e.target.value)} placeholder="20/20"
                className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />

              <div className="text-xs font-semibold text-zinc-500 flex items-center">S/C</div>
              <input value={avScOd} onChange={e => setAvScOd(e.target.value)} placeholder="20/—"
                className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
              <input value={avScOi} onChange={e => setAvScOi(e.target.value)} placeholder="20/—"
                className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
            </div>
          </div>

          {/* Lensómetro */}
          <RxSection label="Lensómetro" od={lensOd} oi={lensOi} setOd={setLensOd} setOi={setLensOi} showAdd />
          {/* Autorrefracción */}
          <RxSection label="Autorrefracción" od={autoOd} oi={autoOi} setOd={setAutoOd} setOi={setAutoOi} />
          {/* Refracción subjetiva */}
          <RxSection label="Refracción subjetiva ★" od={rxOd} oi={rxOi} setOd={setRxOd} setOi={setRxOi} showAdd showDp dpOd={rxDpOd} dpOi={rxDpOi} setDpOd={setRxDpOd} setDpOi={setRxDpOi} highlight />

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Observaciones clínicas</label>
            <textarea value={obsClinicas} onChange={e => setObsClinicas(e.target.value)} rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none" />
          </div>
        </div>
      )

      // ── PASO 6: Diagnóstico inteligente ────────
      case 6: return (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0D9488]" />
              <h2 className="text-base font-bold text-zinc-800">Diagnóstico inteligente</h2>
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">Sugerencias automáticas basadas en la refracción y síntomas. Confirma o modifica.</p>
          </div>

          {diagnosticos.length === 0 && (
            <div className="bg-zinc-50 rounded-lg p-6 text-center text-zinc-400 text-sm border border-dashed border-zinc-300">
              Sin datos de refracción suficientes para generar diagnóstico automático.<br />Agrega uno manualmente.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {diagnosticos.map((d, i) => (
              <button key={i} onClick={() => setDiagnosticos(prev => prev.map((x, j) => j === i ? { ...x, confirmado: !x.confirmado } : x))}
                className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all ${d.confirmado ? 'bg-[#0D9488] border-[#0D9488] text-white' : 'bg-white border-zinc-300 text-zinc-400 line-through'}`}>
                {d.nombre}
                <button onClick={e => { e.stopPropagation(); setDiagnosticos(prev => prev.filter((_, j) => j !== i)) }}
                  className={`ml-1 rounded-full ${d.confirmado ? 'hover:bg-white/20' : 'hover:bg-zinc-200'}`}>
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={diagManual} onChange={e => setDiagManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && diagManual.trim()) { setDiagnosticos(prev => [...prev, { nombre: diagManual.trim(), confirmado: true }]); setDiagManual('') }}}
              placeholder="Agregar diagnóstico adicional..."
              className="flex-1 border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <button onClick={() => { if (diagManual.trim()) { setDiagnosticos(prev => [...prev, { nombre: diagManual.trim(), confirmado: true }]); setDiagManual('') }}}
              className="px-4 py-2 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-[#1A1D27]">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {diagnosticos.filter(d => d.confirmado).length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              <strong>Diagnóstico confirmado:</strong> {diagnosticos.filter(d => d.confirmado).map(d => d.nombre).join(' · ')}
            </div>
          )}
        </div>
      )

      // ── PASO 7: Recomendaciones clínicas ───────
      case 7: return (
        <div className="space-y-5">
          <SectionTitle>Recomendaciones clínicas</SectionTitle>
          <p className="text-sm text-zinc-400 -mt-3">Generadas automáticamente. Activa o desactiva las que apliquen.</p>

          <div className="space-y-2">
            {recClinicas.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${r.activa ? 'border-[#0D9488]/30 bg-[#0D9488]/5' : 'border-zinc-200 bg-zinc-50 opacity-50'}`}>
                <button onClick={() => setRecClinicas(prev => prev.map((x, j) => j === i ? { ...x, activa: !x.activa } : x))}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${r.activa ? 'border-[#0D9488] bg-[#0D9488]' : 'border-zinc-300'}`}>
                  {r.activa && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className="text-sm text-zinc-700 flex-1">{r.texto}</span>
                <button onClick={() => setRecClinicas(prev => prev.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-zinc-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={recManual} onChange={e => setRecManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && recManual.trim()) { setRecClinicas(prev => [...prev, { texto: recManual.trim(), activa: true }]); setRecManual('') }}}
              placeholder="Agregar recomendación..."
              className="flex-1 border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <button onClick={() => { if (recManual.trim()) { setRecClinicas(prev => [...prev, { texto: recManual.trim(), activa: true }]); setRecManual('') }}}
              className="px-4 py-2 bg-[#0B0E14] text-white rounded text-sm font-semibold">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )

      // ── PASO 8: Prescripción ───────────────────
      case 8: return (
        <div className="space-y-5">
          <SectionTitle>Prescripción</SectionTitle>
          <p className="text-sm text-zinc-400 -mt-3">Prellenada con la refracción subjetiva. Verifica antes de guardar.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de lente</label>
              <select value={rxTipo} onChange={e => setRxTipo(e.target.value)}
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30">
                {['Lejos','Cerca','Progresivo','Bifocal','Lentes de contacto'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Field label="Optometrista" value={rxOptometrista} onChange={setRxOptometrista} />
          </div>

          {/* Tabla Rx */}
          <div className="bg-zinc-50 rounded-lg border border-zinc-200 overflow-hidden">
            <div className="grid grid-cols-6 gap-0 px-4 py-2 border-b border-zinc-200">
              <div />
              {['Esfera','Cilindro','Eje','Adición','D.P.'].map(h => (
                <div key={h} className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</div>
              ))}
            </div>
            {([
              ['OD', rxFinal.od, (v: RxEye) => setRxFinal(r => ({ ...r, od: v })), rxFinal.dp_od, (v: string) => setRxFinal(r => ({ ...r, dp_od: v }))],
              ['OI', rxFinal.oi, (v: RxEye) => setRxFinal(r => ({ ...r, oi: v })), rxFinal.dp_oi, (v: string) => setRxFinal(r => ({ ...r, dp_oi: v }))],
            ] as [string, RxEye, (v: RxEye) => void, string, (v: string) => void][]).map(([eye, rx, setRx, dp, setDp]) => (
              <div key={eye} className="grid grid-cols-6 gap-2 px-4 py-3 border-b border-zinc-100 last:border-0">
                <div className="flex items-center font-bold text-sm text-zinc-700">{eye}</div>
                {(['esfera','cilindro','eje','add'] as (keyof RxEye)[]).map(k => (
                  <input key={k} value={rx[k]} onChange={e => setRx({ ...rx, [k]: e.target.value })}
                    placeholder={k === 'eje' ? '000' : '+0.00'}
                    className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
                ))}
                <input value={dp} onChange={e => setDp(e.target.value)} placeholder="32"
                  className="border border-zinc-200 rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Observaciones</label>
            <textarea value={rxObservaciones} onChange={e => setRxObservaciones(e.target.value)} rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none" />
          </div>
        </div>
      )

      // ── PASO 9: Recomendación comercial ────────
      case 9: return (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#0D9488]" />
              <h2 className="text-base font-bold text-zinc-800">Recomendación comercial</h2>
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">Para el vendedor — basado en el diagnóstico y hábitos del paciente.</p>
          </div>

          {/* Resumen paciente */}
          <div className="bg-zinc-900 rounded-lg p-4 text-white">
            <p className="text-xs font-semibold text-zinc-400 mb-2">Perfil del paciente</p>
            <p className="font-bold">{pacienteNombre || `${pNombre} ${pApellido}`}</p>
            {diagnosticos.filter(d => d.confirmado).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {diagnosticos.filter(d => d.confirmado).map(d => (
                  <span key={d.nombre} className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{d.nombre}</span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
              {habitos.horas_computadora > 0 && <span>💻 {habitos.horas_computadora}h computadora</span>}
              {habitos.horas_celular > 0 && <span>📱 {habitos.horas_celular}h celular</span>}
              {habitos.maneja_noche && <span>🌙 Maneja de noche</span>}
            </div>
          </div>

          {recComerciales.length === 0 && (
            <div className="bg-zinc-50 rounded-lg p-6 text-center text-zinc-400 text-sm border border-dashed border-zinc-300">
              Sin datos suficientes para generar recomendaciones.<br />Verifica que se haya capturado la refracción.
            </div>
          )}

          <div className="space-y-3">
            {(['alta', 'media', 'opcional'] as const).map(prioridad => {
              const items = recComerciales.filter(r => r.prioridad === prioridad)
              if (!items.length) return null
              const colorMap = { alta: 'bg-red-50 border-red-200 text-red-700', media: 'bg-amber-50 border-amber-200 text-amber-700', opcional: 'bg-zinc-50 border-zinc-200 text-zinc-500' }
              const labelMap = { alta: 'Prioridad alta', media: 'Prioridad media', opcional: 'Opcional' }
              return (
                <div key={prioridad}>
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold mb-2 border ${colorMap[prioridad]}`}>{labelMap[prioridad]}</div>
                  <div className="space-y-2">
                    {items.map((r, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4 flex items-start gap-3">
                        <Star className={`w-4 h-4 flex-shrink-0 mt-0.5 ${prioridad === 'alta' ? 'text-red-500' : prioridad === 'media' ? 'text-amber-500' : 'text-zinc-400'}`} />
                        <div>
                          <p className="text-sm font-bold text-zinc-800">{r.producto}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{r.razon}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-700">Consulta lista para finalizar</p>
              <p className="text-xs text-emerald-600 mt-0.5">La receta y el diagnóstico han sido guardados en el expediente.</p>
            </div>
          </div>
        </div>
      )

      default: return null
    }
  }

  // ─────────────────────────────────────────────
  // Layout principal
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/expedientes')}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-600 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" /> Expedientes
        </button>
        <div className="h-4 w-px bg-zinc-200" />
        <h1 className="text-sm font-bold text-zinc-700">
          {pacienteNombre ? `Nueva consulta — ${pacienteNombre}` : 'Nuevo expediente'}
        </h1>
        <div className="ml-auto text-xs text-zinc-400">Paso {paso} de 9</div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Steps indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, idx) => {
            const done  = paso > s.id
            const activ = paso === s.id
            const Icon  = s.icon
            return (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { if (done) setPaso(s.id) }}
                  disabled={!done}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    done  ? 'bg-[#0D9488]/10 text-[#0D9488] hover:bg-[#0D9488]/20 cursor-pointer' :
                    activ ? 'bg-[#0B0E14] text-white' :
                            'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  }`}>
                  {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && <div className={`w-4 h-px ${done ? 'bg-[#0D9488]/40' : 'bg-zinc-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* Contenido del paso */}
        <div className="bg-white rounded-lg border border-zinc-200/80 p-6 min-h-[400px]">
          {renderPaso()}
        </div>

        {/* Navegación */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPaso(p => Math.max(p - 1, 1))}
            disabled={paso === 1}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {paso < 9 ? (
            <button
              onClick={avanzar}
              disabled={!puedeAvanzar() || guardando}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-all">
              {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={finalizar}
              disabled={guardando}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 disabled:opacity-40 transition-all">
              {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              <Check className="w-4 h-4" /> Finalizar consulta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Subcomponentes reutilizables
// ─────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 text-zinc-800" />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-zinc-800">{children}</h2>
}

function CheckGroup({ label, items, selected, onToggle }: { label: string; items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <button key={item} onClick={() => onToggle(item)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all ${selected.includes(item) ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${selected.includes(item) ? 'border-[#0D9488] bg-[#0D9488]' : 'border-zinc-300'}`}>
              {selected.includes(item) && <Check className="w-2 h-2 text-white" />}
            </div>
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

function RxSection({
  label, od, oi, setOd, setOi, showAdd = false, showDp = false,
  dpOd = '', dpOi = '', setDpOd, setDpOi, highlight = false
}: {
  label: string
  od: RxEye; oi: RxEye
  setOd: (v: RxEye) => void; setOi: (v: RxEye) => void
  showAdd?: boolean; showDp?: boolean
  dpOd?: string; dpOi?: string
  setDpOd?: (v: string) => void; setDpOi?: (v: string) => void
  highlight?: boolean
}) {
  const cols = showAdd && showDp ? 6 : showAdd || showDp ? 5 : 4
  const gridClass = `grid gap-2` + (cols === 6 ? ' grid-cols-6' : cols === 5 ? ' grid-cols-5' : ' grid-cols-4')

  return (
    <div className={`rounded-lg p-4 border ${highlight ? 'bg-[#0D9488]/5 border-[#0D9488]/30' : 'bg-zinc-50 border-zinc-200'}`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${highlight ? 'text-[#0D9488]' : 'text-zinc-500'}`}>{label}</p>
      <div className={gridClass}>
        <div />
        <div className="text-center text-[10px] font-semibold text-zinc-400 uppercase">Esfera</div>
        <div className="text-center text-[10px] font-semibold text-zinc-400 uppercase">Cilindro</div>
        <div className="text-center text-[10px] font-semibold text-zinc-400 uppercase">Eje</div>
        {showAdd && <div className="text-center text-[10px] font-semibold text-zinc-400 uppercase">Add</div>}
        {showDp && <div className="text-center text-[10px] font-semibold text-zinc-400 uppercase">D.P.</div>}
      </div>
      {([['OD', od, setOd, dpOd, setDpOd], ['OI', oi, setOi, dpOi, setDpOi]] as [string, RxEye, (v: RxEye) => void, string, ((v: string) => void) | undefined][]).map(([eye, rx, setRx, dp, setDp]) => (
        <div key={eye} className={gridClass + ' mt-2'}>
          <div className="flex items-center font-bold text-sm text-zinc-700">{eye}</div>
          {(['esfera','cilindro','eje'] as (keyof RxEye)[]).map(k => (
            <input key={k} value={rx[k]} onChange={e => setRx({ ...rx, [k]: e.target.value })}
              placeholder={k === 'eje' ? '000' : '+0.00'}
              className="border border-zinc-200 rounded px-1.5 py-1.5 text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
          ))}
          {showAdd && (
            <input value={rx.add} onChange={e => setRx({ ...rx, add: e.target.value })} placeholder="+0.00"
              className="border border-zinc-200 rounded px-1.5 py-1.5 text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
          )}
          {showDp && setDp && (
            <input value={dp} onChange={e => setDp(e.target.value)} placeholder="32"
              className="border border-zinc-200 rounded px-1.5 py-1.5 text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-white" />
          )}
        </div>
      ))}
    </div>
  )
}
