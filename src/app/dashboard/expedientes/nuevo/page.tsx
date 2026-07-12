'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronRight, ChevronLeft, Check, User, ClipboardList,
  Eye, Activity, Stethoscope, Brain, Star, FileText,
  ShoppingBag, X, Plus, AlertCircle, Sparkles, Pencil,
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
type RecClinica = { texto: string; titulo?: string; detalle?: string; activa: boolean }
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

// Pasos que pueden omitirse sin perder datos críticos
// NO omitibles: 1 (datos paciente), 5 (graduación/consulta), 8 (prescripción)
const PASOS_OMITIBLES = new Set([2, 3, 4, 6, 7])

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

// ─────────────────────────────────────────────
// Descripciones de diagnósticos (plain language)
// ─────────────────────────────────────────────
const DIAG_INFO: Record<string, { que_es: string; por_que: string }> = {
  'Miopía': {
    que_es: 'El ojo ve bien de cerca pero borroso a distancia. Los letreros, la pizarra o la televisión desde lejos se ven difusos.',
    por_que: 'El globo ocular es un poco más largo de lo normal, haciendo que la imagen se forme antes de llegar a la retina.',
  },
  'Hipermetropía': {
    que_es: 'Dificultad para enfocar de cerca y posible cansancio visual al leer. El ojo tiene que hacer un esfuerzo extra constante.',
    por_que: 'El globo ocular es ligeramente más corto o la córnea tiene poca curvatura; la imagen se forma detrás de la retina.',
  },
  'Astigmatismo': {
    que_es: 'La visión es borrosa o distorsionada en todas las distancias, a veces con sensación de sombra o doble imagen.',
    por_que: 'La córnea no tiene una forma perfectamente esférica — es ligeramente ovalada, haciendo que la luz se enfoque en dos puntos distintos.',
  },
  'Astigmatismo miópico compuesto': {
    que_es: 'Visión borrosa a distancia con deformación adicional de la imagen por la forma ovalada de la córnea.',
    por_que: 'El ojo es más largo de lo normal y además tiene forma ovalada. Ambos factores hacen que la imagen se enfoque antes de llegar a la retina en ambos ejes.',
  },
  'Astigmatismo mixto': {
    que_es: 'La visión se ve borrosa en todos los rangos de distancia: ni de lejos ni de cerca se ve con claridad.',
    por_que: 'La córnea tiene dos curvaturas opuestas: una genera miopía y la otra hipermetropía, haciendo que ningún punto quede completamente nítido.',
  },
  'Astigmatismo hipermetrópico compuesto': {
    que_es: 'El ojo combina dificultad para ver de cerca con una córnea ovalada, generando cansancio visual frecuente.',
    por_que: 'El ojo es corto y además tiene forma ovalada; la imagen se forma detrás de la retina en ambos ejes.',
  },
  'Astigmatismo simple': {
    que_es: 'En uno de los ejes la visión es clara, pero en el otro se ve borrosa o distorsionada.',
    por_que: 'La córnea tiene curvatura normal en un eje pero no en el otro.',
  },
  'Astigmatismo con la regla': {
    que_es: 'Tipo de astigmatismo donde el eje de mayor curvatura es vertical. Es el tipo más común.',
    por_que: 'El meridiano vertical de la córnea tiene ligeramente más curvatura que el horizontal.',
  },
  'Astigmatismo contra la regla': {
    que_es: 'El eje de mayor curvatura es horizontal. Puede generar más cansancio visual que el tipo común.',
    por_que: 'El meridiano horizontal tiene mayor curvatura, lo contrario a lo habitual.',
  },
  'Astigmatismo oblicuo': {
    que_es: 'El eje de mayor curvatura está en dirección diagonal, lo que puede ser más difícil de adaptar con un lente nuevo.',
    por_que: 'La curvatura máxima de la córnea está en un eje oblicuo (entre 20°–70° o 110°–160°).',
  },
  'Presbicia': {
    que_es: 'Dificultad para ver de cerca: el celular, libros y menús se ven borrosos. Es necesario alejar el papel para leer. Es completamente normal.',
    por_que: 'Con la edad el cristalino del ojo pierde elasticidad y ya no puede cambiar de forma para enfocar objetos cercanos. Ocurre naturalmente alrededor de los 40 años.',
  },
  'Anisometropía': {
    que_es: 'Los dos ojos tienen graduaciones muy diferentes entre sí. Puede causar dolores de cabeza o sensación de imagen desnivelada.',
    por_que: 'Cada ojo se desarrolló distinto. Si la diferencia es grande, el cerebro puede esforzarse para fusionar las imágenes, o incluso ignorar un ojo.',
  },
  'Fatiga visual digital': {
    que_es: 'Los ojos se cansan, irritan o duelen después de usar pantallas. Puede venir con dolor de cabeza, cuello tenso o visión borrosa al final del día.',
    por_que: 'Al mirar pantallas, parpadeamos mucho menos de lo normal, resecando la superficie del ojo. La luz azul y el esfuerzo constante de enfoque también contribuyen.',
  },
  'Sospecha de ojo seco': {
    que_es: 'Los ojos se sienten secos, arenosos o con ardor. A veces hay lagrimeo excesivo como reacción del ojo (lágrimas de mala calidad como compensación).',
    por_que: 'La capa de lágrimas que lubrica el ojo es insuficiente o se evapora rápido. Pantallas, aire acondicionado, calefacción y algunos medicamentos lo agravan.',
  },
}

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
function generarRecClinicas(diags: string[], habitos: Habitos, sintomas: string[]): { texto: string; titulo: string; detalle: string }[] {
  const recs: { texto: string; titulo: string; detalle: string }[] = []
  const pantallasTotales = (habitos.horas_computadora || 0) + (habitos.horas_celular || 0)

  if (pantallasTotales >= 6) recs.push({
    texto: 'Regla 20-20-20 para pantallas',
    titulo: 'Regla 20-20-20',
    detalle: `Con ${pantallasTotales}h diarias de pantalla, cada 20 minutos toma 20 segundos para mirar un punto a 6 metros de distancia. Esto relaja los músculos del enfoque y reduce la fatiga ocular acumulada.`,
  })
  if (diags.includes('Sospecha de ojo seco')) recs.push({
    texto: 'Lubricantes oculares sin conservadores',
    titulo: 'Lubricantes oculares',
    detalle: 'Aplicar gotas lubricantes sin conservadores 3–4 veces al día. Alivia el ardor, la sensación de arenilla y el lagrimeo involuntario. No generan dependencia.',
  })
  if (diags.includes('Presbicia')) recs.push({
    texto: 'Evaluar lente progresivo o bifocal',
    titulo: 'Lente progresivo o bifocal',
    detalle: 'Un lente progresivo permite ver bien a todas las distancias con una sola mica — lejos, computadora y lectura. El optometrista evaluará qué diseño se adapta mejor a tus actividades.',
  })
  if (diags.some(d => d.includes('Miopía')) && pantallasTotales >= 4) recs.push({
    texto: 'Reducir pantallas antes de dormir',
    titulo: 'Control de miopía',
    detalle: 'Limitar el uso de pantallas al menos 1 hora antes de dormir. El esfuerzo de enfoque de cerca en la oscuridad puede favorecer la progresión de la miopía, especialmente en jóvenes.',
  })
  if (sintomas.includes('Cefalea')) recs.push({
    texto: 'Revisar ergonomía visual del área de trabajo',
    titulo: 'Ergonomía visual',
    detalle: 'El dolor de cabeza relacionado con la vista mejora mucho corrigiendo la postura, ajustando la altura del monitor (al nivel de los ojos) y mejorando la iluminación del ambiente.',
  })
  if (sintomas.includes('Fotofobia')) recs.push({
    texto: 'Reducir exposición a luz fluorescente — evaluar filtro fotocromático',
    titulo: 'Sensibilidad a la luz',
    detalle: 'Evitar exposición directa a luz fluorescente y ajustar el brillo de las pantallas. Un lente fotocromático (que se oscurece al sol) o con filtro de luz azul puede reducir significativamente la molestia.',
  })
  if (habitos.maneja_noche) recs.push({
    texto: 'Antirreflejante para conducción nocturna',
    titulo: 'Antirreflejante nocturno',
    detalle: 'Sin antirreflejante, los faros del tráfico generan halos y deslumbramiento. Un antirreflejante de calidad mejora notablemente la nitidez y la seguridad al manejar de noche.',
  })
  if (habitos.lentes_sol === false) recs.push({
    texto: 'Protección UV en exteriores',
    titulo: 'Protección ultravioleta',
    detalle: 'La exposición acumulada a rayos UV sin protección favorece la formación de cataratas y otras condiciones oculares. Se recomienda lentes con filtro UV 400 en exteriores, incluso en días nublados.',
  })

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
  const [pasoMaximo, setPasoMaximo] = useState(pacienteIdParam ? 2 : 1)
  const [guardando, setGuardando] = useState(false)
  const [consultaId, setConsultaId] = useState<string | null>(null)
  const [pacienteId, setPacienteId] = useState<string | null>(pacienteIdParam)
  const [pacienteNombre, setPacienteNombre] = useState('')
  const [modoConsulta, setModoConsulta]     = useState<null | 'especializada' | 'rapida'>(null)

  // ── Datos paso 1: Paciente ──
  const [pNombre, setPNombre]             = useState('')
  const [pApellido, setPApellido]         = useState('')
  const [pFechaNac, setPFechaNac]         = useState('')
  const [pSexo, setPSexo]                 = useState('')
  const [pLada, setPLada]                 = useState('+52')
  const [pTelefono, setPTelefono]         = useState('')
  const [pWhatsapp, setPWhatsapp]         = useState('')
  const [pEmail, setPEmail]               = useState('')
  const [pDireccion, setPDireccion]       = useState('')
  const [pOcupacion, setPOcupacion]       = useState('')
  const [pEmpresa, setPEmpresa]           = useState('')
  const [mostrarDatosExtra, setMostrarDatosExtra] = useState(false)

  // ── Datos paso 2: Historia ──
  const [motivo, setMotivo]               = useState('')
  const [sintomaPrincipal, setSintomaPrincipal] = useState('')
  const [antecMedicos, setAntecMedicos]   = useState<string[]>([])
  const [antecOculares, setAntecOculares] = useState<string[]>([])
  const [antecFamiliares, setAntecFamiliares] = useState<string[]>([])
  const [medicamentos, setMedicamentos]   = useState('')
  const [alergias, setAlergias]           = useState('')
  const [antecMedOtra, setAntecMedOtra]   = useState('')
  const [tieneMedicamentos, setTieneMedicamentos] = useState<boolean | null>(null)
  const [tieneAlergias, setTieneAlergias] = useState<boolean | null>(null)
  const [tieneFamiliares, setTieneFamiliares] = useState<boolean | null>(null)
  const [antecFamOtra, setAntecFamOtra]   = useState('')
  const [noOcular, setNoOcular]           = useState<string[]>([])

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
  const [editandoRx, setEditandoRx]     = useState(false)   // prescripción read-only por defecto

  // ── Toggles secciones opcionales paso 5 ──
  const [hizoLens, setHizoLens] = useState<boolean | null>(null)
  const [hizoAuto, setHizoAuto] = useState<boolean | null>(null)

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
      setRxOptometrista(u.nombre || 'Dr. Leyva')  // nombre completo, no apodo
    } catch {}
  }, [pacienteIdParam])

  // Pre-fill prescripción desde Rx subjetiva cuando llega al paso 8
  useEffect(() => {
    if (paso === 8) {
      setRxFinal({ od: { ...rxOd }, oi: { ...rxOi }, dp_od: rxDpOd, dp_oi: rxDpOi })
      setEditandoRx(false)  // siempre inicia en modo lectura
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
      setRecClinicas(sugeridas.map(r => ({ ...r, activa: true })))
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
          telefono: pTelefono ? `${pLada}${pTelefono}` : '',
          whatsapp: pWhatsapp ? pWhatsapp : (pTelefono ? `${pLada}${pTelefono}` : ''),
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
          antecedentes_medicos: Object.fromEntries(
            antecMedicos
              .map(x => x === '_otra' ? (antecMedOtra.trim() ? `Otra: ${antecMedOtra.trim()}` : 'Otra') : x)
              .filter(Boolean).map(k => [k, true])
          ),
          antecedentes_oculares: Object.fromEntries(antecOculares.map(k => [k, true])),
          antecedentes_familiares: Object.fromEntries(
            antecFamiliares
              .map(x => x === '_otra_fam' ? (antecFamOtra.trim() ? `Otra: ${antecFamOtra.trim()}` : 'Otra') : x)
              .filter(Boolean).map(k => [k, true])
          ),
          medicamentos: tieneMedicamentos === false ? 'Ninguno' : medicamentos,
          alergias: tieneAlergias === false ? 'Ninguna' : alergias,
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

      const siguiente = Math.min(paso + 1, 9)
      setPaso(siguiente)
      setPasoMaximo(p => Math.max(p, siguiente))
    } finally {
      setGuardando(false)
    }
  }

  // Avanzar sin guardar datos del paso actual
  const omitirPaso = async () => {
    // Paso 2: aunque se omita, necesitamos crear la consulta para que
    // los pasos posteriores (3-8) puedan hacer update por consultaId
    if (paso === 2 && !consultaId) {
      setGuardando(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('consultas').insert({
          paciente_id: pacienteId || pacienteIdParam,
          sucursal: getSucursalActual(),
          atendido_por: rxOptometrista,
          motivo: '',
          paso_actual: 3,
        }).select('id').single()
        if (error || !data) { alert('Error al continuar: ' + error?.message); return }
        setConsultaId(data.id)
      } finally {
        setGuardando(false)
      }
    }
    // Paso 1 (nuevo paciente): no avanzar — mostrar selector de tipo de consulta
    if (paso === 1) return
    const siguiente = Math.min(paso + 1, 9)
    setPaso(siguiente)
    setPasoMaximo(p => Math.max(p, siguiente))
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
    // Ir a nueva venta pre-cargada con las recomendaciones del paciente
    const pId = pacienteId || pacienteIdParam
    const nombre = encodeURIComponent(pacienteNombre || `${pNombre} ${pApellido}`)
    if (consultaId && pId) {
      router.push(`/dashboard/ventas/nueva?desde_consulta=${consultaId}&paciente_id=${pId}&nombre=${nombre}`)
    } else {
      router.push('/dashboard/expedientes')
    }
  }

  // ── Guardar consulta rápida (solo graduación) ──
  const guardarRapida = async () => {
    const pId = pacienteId
    if (!pId) return
    setGuardando(true)
    try {
      const supabase = createClient()
      await supabase.from('recetas').insert({
        paciente_id:   pId,
        fecha:         new Date().toISOString().split('T')[0],
        od_esfera:     rxOd.esfera    || null,
        od_cilindro:   rxOd.cilindro  || null,
        od_eje:        rxOd.eje       || null,
        od_add:        rxOd.add       || null,
        oi_esfera:     rxOi.esfera    || null,
        oi_cilindro:   rxOi.cilindro  || null,
        oi_eje:        rxOi.eje       || null,
        oi_add:        rxOi.add       || null,
        dp_od:         rxDpOd         || null,
        dp_oi:         rxDpOi         || null,
      })
      router.push('/dashboard/expedientes')
    } catch (err) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setGuardando(false)
    }
  }

  const puedeAvanzar = () => {
    if (paso === 1) return pNombre.trim().length > 0 && pApellido.trim().length > 0
    return true
  }

  // ─────────────────────────────────────────────
  // Render de cada paso
  // ─────────────────────────────────────────────

  const renderPaso = () => {
    // ── SELECTOR: Paciente creado, elegir tipo de consulta ──
    if (pacienteId && modoConsulta === null) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-800">¿Qué tipo de consulta realizarás?</h2>
            <p className="text-sm text-zinc-400 mt-0.5">Paciente registrado: <span className="font-semibold text-zinc-600">{pacienteNombre || `${pNombre} ${pApellido}`}</span></p>
          </div>

          <button
            onClick={() => { setModoConsulta('especializada'); setPaso(2); setPasoMaximo(2) }}
            className="w-full flex items-start gap-4 p-5 border-2 border-zinc-200 rounded-xl hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-100 group-hover:bg-[#0D9488]/10 flex items-center justify-center flex-shrink-0 transition-colors">
              <Eye className="w-5 h-5 text-zinc-500 group-hover:text-[#0D9488]" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-800">Consulta especializada</p>
              <p className="text-xs text-zinc-400 mt-1">Historia clínica completa · hábitos · síntomas · refracción · diagnóstico · prescripción · recomendaciones comerciales</p>
            </div>
          </button>

          <button
            onClick={() => setModoConsulta('rapida')}
            className="w-full flex items-start gap-4 p-5 border-2 border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-800">Consulta rápida</p>
              <p className="text-xs text-zinc-400 mt-1">Solo guardar graduación — ideal para cuando el paciente trae receta o ya se revisó en otro lugar</p>
            </div>
          </button>
        </div>
      )
    }

    switch (paso) {
      // ── PASO 1: Datos del paciente ─────────────
      case 1: return (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-bold text-zinc-800">Datos del paciente</h2>
            <p className="text-sm text-zinc-400 mt-0.5">Información básica para crear el expediente</p>
          </div>

          {/* Nombre y apellido */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *" value={pNombre} onChange={setPNombre} />
            <Field label="Apellido(s) *" value={pApellido} onChange={setPApellido} />
          </div>

          {/* Fecha, sexo */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Teléfono</label>
            <div className="flex gap-2">
              <select value={pLada} onChange={e => setPLada(e.target.value)}
                className="border border-zinc-200 rounded px-2 py-2 bg-zinc-50 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 cursor-pointer">
                {[
                  { code: '+52', label: 'MX +52' }, { code: '+1',   label: 'US +1'   },
                  { code: '+1',  label: 'CA +1'  }, { code: '+34',  label: 'ES +34'  },
                  { code: '+33', label: 'FR +33' }, { code: '+49',  label: 'DE +49'  },
                  { code: '+39', label: 'IT +39' }, { code: '+44',  label: 'UK +44'  },
                  { code: '+31', label: 'NL +31' }, { code: '+57',  label: 'CO +57'  },
                  { code: '+54', label: 'AR +54' }, { code: '+56',  label: 'CL +56'  },
                  { code: '+55', label: 'BR +55' }, { code: '+51',  label: 'PE +51'  },
                  { code: '+58', label: 'VE +58' }, { code: '+593', label: 'EC +593' },
                  { code: '+502',label: 'GT +502'}, { code: '+503', label: 'SV +503' },
                ].map((p, i) => <option key={i} value={p.code}>{p.label}</option>)}
              </select>
              <input
                type="tel"
                value={pTelefono}
                onChange={e => setPTelefono(e.target.value)}
                placeholder="6611234567"
                className="flex-1 border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
            </div>
          </div>

          {/* WhatsApp con botón copiar */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">WhatsApp</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={pWhatsapp}
                onChange={e => setPWhatsapp(e.target.value)}
                placeholder={pTelefono ? `${pLada}${pTelefono}` : '+526611234567'}
                className="flex-1 border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 font-mono"
              />
              {pTelefono && (
                <button
                  type="button"
                  onClick={() => setPWhatsapp(`${pLada}${pTelefono}`)}
                  className="px-3 py-2 border border-[#0D9488] text-[#0D9488] rounded text-xs font-semibold hover:bg-[#0D9488]/5 transition-all flex-shrink-0 whitespace-nowrap">
                  = mismo número
                </button>
              )}
            </div>
          </div>

          {/* Email */}
          <Field label="Correo electrónico" value={pEmail} onChange={setPEmail} type="email" />

          {/* Datos adicionales colapsables */}
          <div>
            <button
              type="button"
              onClick={() => setMostrarDatosExtra(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors">
              <div className={`w-4 h-4 border border-zinc-300 rounded flex items-center justify-center transition-transform ${mostrarDatosExtra ? 'bg-zinc-100' : ''}`}>
                <span className="text-zinc-500 leading-none">{mostrarDatosExtra ? '−' : '+'}</span>
              </div>
              Datos adicionales (dirección, ocupación, empresa) — opcional
            </button>
            {mostrarDatosExtra && (
              <div className="mt-3 space-y-4 pl-6 border-l-2 border-zinc-100">
                <Field label="Dirección" value={pDireccion} onChange={setPDireccion} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Ocupación" value={pOcupacion} onChange={setPOcupacion} />
                  <Field label="Empresa" value={pEmpresa} onChange={setPEmpresa} />
                </div>
              </div>
            )}
          </div>
        </div>
      )

      // ── PASO 2: Historia clínica ───────────────
      case 2: return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <SectionTitle>Historia clínica</SectionTitle>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded">Todos los campos son opcionales</span>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">¿Cuál es el motivo de tu visita hoy?</label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS.map(m => (
                <button key={m} onClick={() => setMotivo(motivo === m ? '' : m)}
                  className={`px-3 py-2 rounded border text-sm transition-all ${motivo === m ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Síntoma principal */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
              ¿Cuál es tu molestia principal? <span className="font-normal text-zinc-400">(con tus palabras)</span>
            </label>
            <textarea value={sintomaPrincipal} onChange={e => setSintomaPrincipal(e.target.value)} rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none"
              placeholder="Ej: veo borroso de lejos, me duele la cabeza al leer..." />
          </div>

          {/* Enfermedades */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">¿Tienes alguna enfermedad diagnosticada?</label>
            <div className="flex flex-wrap gap-2">
              {['Diabetes', 'Hipertensión', 'Enf. tiroideas', 'Migraña', 'Enf. autoinmunes'].map(e => (
                <button key={e} onClick={() => {
                  const sin = antecMedicos.filter(x => x !== 'Ninguna')
                  sin.includes(e) ? setAntecMedicos(sin.filter(x => x !== e)) : setAntecMedicos([...sin, e])
                }}
                  className={`px-3 py-2 rounded border text-sm transition-all ${antecMedicos.includes(e) ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  {e}
                </button>
              ))}
              <button onClick={() => {
                const tieneOtra = antecMedicos.includes('_otra')
                if (tieneOtra) { setAntecMedicos(antecMedicos.filter(x => x !== '_otra')); setAntecMedOtra('') }
                else setAntecMedicos([...antecMedicos.filter(x => x !== 'Ninguna'), '_otra'])
              }}
                className={`px-3 py-2 rounded border text-sm transition-all ${antecMedicos.includes('_otra') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                Otra
              </button>
              <button onClick={() => { setAntecMedicos(['Ninguna']); setAntecMedOtra('') }}
                className={`px-3 py-2 rounded border text-sm transition-all ${antecMedicos.includes('Ninguna') ? 'border-zinc-500 bg-zinc-100 text-zinc-700 font-semibold' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                Ninguna
              </button>
            </div>
            {antecMedicos.includes('_otra') && (
              <input className="mt-2 w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                placeholder="¿Cuál enfermedad?" value={antecMedOtra} onChange={e => setAntecMedOtra(e.target.value)} />
            )}
          </div>

          {/* Medicamentos */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">¿Tomas algún medicamento actualmente?</label>
            <div className="flex gap-2">
              <button onClick={() => setTieneMedicamentos(true)}
                className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tieneMedicamentos === true ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                Sí
              </button>
              <button onClick={() => { setTieneMedicamentos(false); setMedicamentos('') }}
                className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tieneMedicamentos === false ? 'border-zinc-500 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                No
              </button>
            </div>
            {tieneMedicamentos === true && (
              <input className="mt-2 w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                placeholder="¿Cuáles? Ej: metformina, losartán, omeprazol..." value={medicamentos} onChange={e => setMedicamentos(e.target.value)} />
            )}
          </div>

          {/* Alergias */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">¿Tienes alergia a algún medicamento?</label>
            <div className="flex gap-2">
              <button onClick={() => setTieneAlergias(true)}
                className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tieneAlergias === true ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                Sí
              </button>
              <button onClick={() => { setTieneAlergias(false); setAlergias('') }}
                className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tieneAlergias === false ? 'border-zinc-500 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                No
              </button>
            </div>
            {tieneAlergias === true && (
              <input className="mt-2 w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                placeholder="¿A cuál? Ej: penicilina, aspirina..." value={alergias} onChange={e => setAlergias(e.target.value)} />
            )}
          </div>

          {/* Antecedentes oculares */}
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-zinc-500">Antecedentes oculares</label>

            {/* ¿Usas lentes? */}
            <div>
              <p className="text-sm text-zinc-700 mb-2">¿Usas lentes actualmente?</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => toggleCheck(antecOculares, setAntecOculares, 'Usa lentes')}
                  className={`px-3 py-2 rounded border text-sm transition-all ${antecOculares.includes('Usa lentes') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  Sí, de medida
                </button>
                <button onClick={() => toggleCheck(antecOculares, setAntecOculares, 'Usa lentes de contacto')}
                  className={`px-3 py-2 rounded border text-sm transition-all ${antecOculares.includes('Usa lentes de contacto') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  Sí, de contacto
                </button>
                <button onClick={() => setAntecOculares(antecOculares.filter(x => x !== 'Usa lentes' && x !== 'Usa lentes de contacto'))}
                  className="px-3 py-2 rounded border border-zinc-200 text-sm text-zinc-500 hover:border-zinc-300">
                  No uso lentes
                </button>
              </div>
            </div>

            {/* Cirugías */}
            <div>
              <p className="text-sm text-zinc-700 mb-2">¿Has tenido alguna cirugía en los ojos?</p>
              <div className="flex gap-2">
                <button onClick={() => { setAntecOculares([...antecOculares.filter(x => x !== 'Cirugías'), 'Cirugías']); setNoOcular(noOcular.filter(x => x !== 'Cirugías')) }}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-all ${antecOculares.includes('Cirugías') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  Sí
                </button>
                <button onClick={() => { setAntecOculares(antecOculares.filter(x => x !== 'Cirugías')); setNoOcular([...noOcular.filter(x => x !== 'Cirugías'), 'Cirugías']) }}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-all ${noOcular.includes('Cirugías') ? 'border-zinc-500 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  No
                </button>
              </div>
            </div>

            {/* Traumatismos */}
            <div>
              <p className="text-sm text-zinc-700 mb-2">¿Has tenido algún golpe o traumatismo en los ojos?</p>
              <div className="flex gap-2">
                <button onClick={() => { setAntecOculares([...antecOculares.filter(x => x !== 'Traumatismos'), 'Traumatismos']); setNoOcular(noOcular.filter(x => x !== 'Traumatismos')) }}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-all ${antecOculares.includes('Traumatismos') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  Sí
                </button>
                <button onClick={() => { setAntecOculares(antecOculares.filter(x => x !== 'Traumatismos')); setNoOcular([...noOcular.filter(x => x !== 'Traumatismos'), 'Traumatismos']) }}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-all ${noOcular.includes('Traumatismos') ? 'border-zinc-500 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  No
                </button>
              </div>
            </div>

            {/* Ojo seco */}
            <div>
              <p className="text-sm text-zinc-700 mb-2">¿Te han diagnosticado ojo seco?</p>
              <div className="flex gap-2">
                <button onClick={() => { setAntecOculares([...antecOculares.filter(x => x !== 'Ojo seco'), 'Ojo seco']); setNoOcular(noOcular.filter(x => x !== 'Ojo seco')) }}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-all ${antecOculares.includes('Ojo seco') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  Sí
                </button>
                <button onClick={() => { setAntecOculares(antecOculares.filter(x => x !== 'Ojo seco')); setNoOcular([...noOcular.filter(x => x !== 'Ojo seco'), 'Ojo seco']) }}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-all ${noOcular.includes('Ojo seco') ? 'border-zinc-500 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  No
                </button>
              </div>
            </div>
          </div>

          {/* Historia heredofamiliar */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">¿Alguien en tu familia tiene o tuvo antecedentes oculares?</label>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setTieneFamiliares(true)}
                className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tieneFamiliares === true ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                Sí
              </button>
              <button onClick={() => { setTieneFamiliares(false); setAntecFamiliares([]) }}
                className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tieneFamiliares === false ? 'border-zinc-500 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                No
              </button>
            </div>
            {tieneFamiliares === true && (
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Glaucoma', 'Diabetes', 'Catarata', 'Miopía alta', 'Estrabismo'].map(f => (
                    <button key={f} onClick={() => toggleCheck(antecFamiliares, setAntecFamiliares, f)}
                      className={`px-3 py-2 rounded border text-sm transition-all ${antecFamiliares.includes(f) ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                      {f}
                    </button>
                  ))}
                  <button onClick={() => {
                    if (antecFamiliares.includes('_otra_fam')) { setAntecFamiliares(antecFamiliares.filter(x => x !== '_otra_fam')); setAntecFamOtra('') }
                    else setAntecFamiliares([...antecFamiliares, '_otra_fam'])
                  }}
                    className={`px-3 py-2 rounded border text-sm transition-all ${antecFamiliares.includes('_otra_fam') ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] font-semibold' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                    Otra
                  </button>
                </div>
                {antecFamiliares.includes('_otra_fam') && (
                  <input className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    placeholder="¿Cuál?" value={antecFamOtra} onChange={e => setAntecFamOtra(e.target.value)} />
                )}
              </div>
            )}
          </div>
        </div>
      )

      // ── PASO 3: Hábitos ────────────────────────
      case 3: return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <SectionTitle>Hábitos visuales</SectionTitle>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded">Todos los campos son opcionales</span>
          </div>
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
          <div className="flex items-center justify-between">
            <SectionTitle>Síntomas</SectionTitle>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded">Selecciona los que apliquen, o ninguno</span>
          </div>
          <div className="flex flex-wrap gap-2">
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

          {/* Lensómetro — solo si se realizó */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Lensómetro</p>
              <div className="flex items-center gap-0.5 bg-zinc-100 p-0.5 rounded-lg">
                <button onClick={() => setHizoLens(true)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${hizoLens === true ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  Sí
                </button>
                <button onClick={() => setHizoLens(false)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${hizoLens === false ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  No
                </button>
              </div>
            </div>
            {hizoLens === true  && <RxSection label="Lensómetro" od={lensOd} oi={lensOi} setOd={setLensOd} setOi={setLensOi} showAdd />}
            {hizoLens === false && <div className="text-xs text-zinc-400 bg-zinc-50 rounded-lg border border-zinc-200 px-4 py-3">No realizado</div>}
            {hizoLens === null  && <div className="text-xs text-zinc-400 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-center">Selecciona si se realizó el lensómetro</div>}
          </div>

          {/* Autorrefracción — solo si se realizó */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Autorrefracción</p>
              <div className="flex items-center gap-0.5 bg-zinc-100 p-0.5 rounded-lg">
                <button onClick={() => setHizoAuto(true)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${hizoAuto === true ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  Sí
                </button>
                <button onClick={() => setHizoAuto(false)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${hizoAuto === false ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  No
                </button>
              </div>
            </div>
            {hizoAuto === true  && <RxSection label="Autorrefracción" od={autoOd} oi={autoOi} setOd={setAutoOd} setOi={setAutoOi} />}
            {hizoAuto === false && <div className="text-xs text-zinc-400 bg-zinc-50 rounded-lg border border-zinc-200 px-4 py-3">No realizada</div>}
            {hizoAuto === null  && <div className="text-xs text-zinc-400 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-center">Selecciona si se realizó la autorrefracción</div>}
          </div>
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

          <div className="space-y-3">
            {diagnosticos.map((d, i) => {
              const info = DIAG_INFO[d.nombre]
              return (
                <div key={i}
                  onClick={() => setDiagnosticos(prev => prev.map((x, j) => j === i ? { ...x, confirmado: !x.confirmado } : x))}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${d.confirmado ? 'border-[#0D9488]/30 bg-[#0D9488]/5' : 'border-zinc-200 bg-zinc-50 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${d.confirmado ? 'border-[#0D9488] bg-[#0D9488]' : 'border-zinc-300'}`}>
                          {d.confirmado && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <p className={`text-sm font-bold ${d.confirmado ? 'text-zinc-800' : 'text-zinc-400 line-through'}`}>{d.nombre}</p>
                      </div>
                      {info && d.confirmado && (
                        <div className="ml-6 space-y-1.5">
                          <p className="text-xs text-zinc-600">{info.que_es}</p>
                          <p className="text-xs text-zinc-400"><span className="font-semibold text-zinc-500">¿Por qué ocurre?</span> {info.por_que}</p>
                        </div>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); setDiagnosticos(prev => prev.filter((_, j) => j !== i)) }}
                      className="text-zinc-300 hover:text-zinc-500 flex-shrink-0 mt-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
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
              <div key={i} className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${r.activa ? 'border-[#0D9488]/30 bg-[#0D9488]/5' : 'border-zinc-200 bg-zinc-50 opacity-50'}`}>
                <button onClick={() => setRecClinicas(prev => prev.map((x, j) => j === i ? { ...x, activa: !x.activa } : x))}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${r.activa ? 'border-[#0D9488] bg-[#0D9488]' : 'border-zinc-300'}`}>
                  {r.activa && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1">
                  {r.titulo ? (
                    <>
                      <p className="text-sm font-semibold text-zinc-800">{r.titulo}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{r.detalle}</p>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-700">{r.texto}</p>
                  )}
                </div>
                <button onClick={() => setRecClinicas(prev => prev.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-zinc-500 flex-shrink-0">
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
          <div className="flex items-start justify-between">
            <div>
              <SectionTitle>Prescripción</SectionTitle>
              <p className="text-sm text-zinc-400 mt-0.5">Pre-llenada desde la refracción subjetiva.</p>
            </div>
            {!editandoRx && (
              <button onClick={() => setEditandoRx(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded text-xs font-semibold text-zinc-500 hover:bg-zinc-50 transition-all mt-1">
                <Pencil className="w-3 h-3" /> Editar
              </button>
            )}
          </div>

          {/* Tipo de lente y optometrista — siempre visible */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de lente</label>
              <select value={rxTipo} onChange={e => setRxTipo(e.target.value)}
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30">
                {['Lejos','Cerca','Progresivo','Bifocal','Lentes de contacto'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Optometrista</label>
              <p className="px-3 py-2 text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded">{rxOptometrista}</p>
            </div>
          </div>

          {/* Tabla Rx — read-only o editable */}
          {!editandoRx ? (
            <div className="bg-[#0D9488]/5 rounded-lg border border-[#0D9488]/20 overflow-hidden">
              <div className="grid grid-cols-6 gap-0 px-4 py-2.5 border-b border-[#0D9488]/10">
                <div />
                {['Esfera','Cilindro','Eje','Add','D.P.'].map(h => (
                  <div key={h} className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</div>
                ))}
              </div>
              {([
                ['OD', rxFinal.od, rxFinal.dp_od],
                ['OI', rxFinal.oi, rxFinal.dp_oi],
              ] as [string, RxEye, string][]).map(([eye, rx, dp]) => (
                <div key={eye} className="grid grid-cols-6 gap-0 px-4 py-3 border-b border-[#0D9488]/10 last:border-0">
                  <div className="flex items-center font-bold text-sm text-zinc-700">{eye}</div>
                  {(['esfera','cilindro','eje','add'] as (keyof RxEye)[]).map(k => (
                    <div key={k} className="text-center text-sm font-mono text-zinc-800 py-1">{rx[k] || '—'}</div>
                  ))}
                  <div className="text-center text-sm font-mono text-zinc-800 py-1">{dp || '—'}</div>
                </div>
              ))}
            </div>
          ) : (
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
          )}

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
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              {habitos.horas_computadora > 0 && <span>{habitos.horas_computadora}h computadora</span>}
              {habitos.horas_celular > 0 && <span>{habitos.horas_celular}h celular</span>}
              {habitos.maneja_noche && <span>Maneja de noche</span>}
              {habitos.lentes_sol && <span>Usa lentes de sol</span>}
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
  // Layout consulta rápida
  // ─────────────────────────────────────────────
  if (modoConsulta === 'rapida') {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4">
          <button onClick={() => setModoConsulta(null)}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-600 text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Atrás
          </button>
          <div className="h-4 w-px bg-zinc-200" />
          <h1 className="text-sm font-bold text-zinc-700">
            Consulta rápida — {pacienteNombre || `${pNombre} ${pApellido}`}
          </h1>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          <div className="bg-white rounded-lg border border-zinc-200/80 p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-zinc-800">Graduación</h2>
              <p className="text-sm text-zinc-400 mt-0.5">Llena los datos que tengas. Todos los campos son opcionales.</p>
            </div>
            <RxSection label="Ojo derecho / Ojo izquierdo" od={rxOd} oi={rxOi} setOd={setRxOd} setOi={setRxOi} showAdd showDp dpOd={rxDpOd} dpOi={rxDpOi} setDpOd={setRxDpOd} setDpOi={setRxDpOi} highlight />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setModoConsulta(null)}
              className="px-4 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50 transition-all">
              Cancelar
            </button>
            <button
              onClick={guardarRapida}
              disabled={guardando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-500 disabled:opacity-40 transition-all">
              {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar graduación
            </button>
          </div>
        </div>
      </div>
    )
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
        {/* Steps indicator — ocultar en selector y en paso 1 */}
        <div className={`flex items-center gap-1 mb-6 overflow-x-auto pb-1 ${(pacienteId && modoConsulta === null) ? 'hidden' : ''}`}>
          {STEPS.map((s, idx) => {
            const done  = paso > s.id && s.id <= pasoMaximo
            const activ = paso === s.id
            const nav   = s.id !== paso && s.id <= pasoMaximo
            const Icon  = s.icon
            return (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { if (nav) setPaso(s.id) }}
                  disabled={!nav && !activ}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    activ ? 'bg-[#0B0E14] text-white' :
                    nav   ? 'bg-[#0D9488]/10 text-[#0D9488] hover:bg-[#0D9488]/20 cursor-pointer' :
                            'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  }`}>
                  {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && <div className={`w-4 h-px ${s.id < pasoMaximo ? 'bg-[#0D9488]/40' : 'bg-zinc-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* Contenido del paso */}
        <div className="bg-white rounded-lg border border-zinc-200/80 p-6 min-h-[400px]">
          {renderPaso()}
        </div>

        {/* Navegación — ocultar en selector */}
        <div className={`flex items-center justify-between mt-4 ${(pacienteId && modoConsulta === null) ? 'hidden' : ''}`}>
          <button
            onClick={() => setPaso(p => Math.max(p - 1, 1))}
            disabled={paso === 1}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          <div className="flex items-center gap-3">
            {PASOS_OMITIBLES.has(paso) && (
              <button
                onClick={omitirPaso}
                disabled={guardando}
                className="flex items-center gap-1 px-4 py-2.5 text-zinc-400 text-sm font-medium hover:text-zinc-600 disabled:opacity-30 transition-all">
                Omitir <ChevronRight className="w-4 h-4" />
              </button>
            )}

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
                <Check className="w-4 h-4" /> Finalizar e ir a venta
              </button>
            )}
          </div>
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
