'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Printer, MessageCircle, ArrowLeft, Eye } from 'lucide-react'

type Receta = {
  id: string
  fecha: string
  tipo: string
  optometrista: string
  od_esfera: string; od_cilindro: string; od_eje: string; od_add: string
  oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_add: string
  dp_od: string; dp_oi: string
  diagnostico: string
  observaciones: string
}

type Consulta = {
  id: string
  created_at: string
  motivo: string
  sintoma_principal: string
  diagnosticos: string[]
  rec_clinicas: string[]
  rec_comerciales: { producto: string; razon: string; prioridad: string }[]
}

type Paciente = {
  id: string
  nombre: string
  apellido: string
  fecha_nacimiento: string
  telefono: string
  whatsapp: string
  email: string
}

function calcEdad(fechaNac: string) {
  if (!fechaNac) return null
  const hoy = new Date(); const nac = new Date(fechaNac)
  let e = hoy.getFullYear() - nac.getFullYear()
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) e--
  return e
}

function formatFecha(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const DIAG_INFO: Record<string, { que_es: string; por_que: string }> = {
  'Miopía': {
    que_es: 'El ojo ve bien de cerca pero borroso a distancia.',
    por_que: 'El globo ocular es un poco más largo de lo normal, haciendo que la imagen se forme antes de llegar a la retina.',
  },
  'Hipermetropía': {
    que_es: 'Dificultad para enfocar de cerca y posible cansancio visual al leer.',
    por_que: 'El globo ocular es ligeramente más corto; la imagen se forma detrás de la retina.',
  },
  'Astigmatismo': {
    que_es: 'Visión borrosa o distorsionada en todas las distancias.',
    por_que: 'La córnea tiene forma ligeramente ovalada, haciendo que la luz se enfoque en dos puntos distintos.',
  },
  'Astigmatismo miópico compuesto': {
    que_es: 'Visión borrosa a distancia con deformación adicional por la forma ovalada de la córnea.',
    por_que: 'El ojo es más largo de lo normal y además tiene forma ovalada.',
  },
  'Astigmatismo mixto': {
    que_es: 'La visión se ve borrosa en todos los rangos de distancia.',
    por_que: 'La córnea tiene dos curvaturas opuestas: una genera miopía y la otra hipermetropía.',
  },
  'Astigmatismo hipermetrópico compuesto': {
    que_es: 'Cansancio visual frecuente con córnea ovalada.',
    por_que: 'El ojo es corto y además tiene forma ovalada.',
  },
  'Astigmatismo con la regla': {
    que_es: 'Tipo de astigmatismo donde el eje de mayor curvatura es vertical. El más común.',
    por_que: 'El meridiano vertical de la córnea tiene ligeramente más curvatura.',
  },
  'Astigmatismo contra la regla': {
    que_es: 'El eje de mayor curvatura es horizontal.',
    por_que: 'El meridiano horizontal tiene mayor curvatura, lo contrario a lo habitual.',
  },
  'Presbicia': {
    que_es: 'Dificultad para ver de cerca: celular, libros, menús. Se aleja el papel para leer.',
    por_que: 'Con la edad el cristalino pierde elasticidad. Ocurre naturalmente alrededor de los 40 años.',
  },
  'Anisometropía': {
    que_es: 'Los dos ojos tienen graduaciones muy diferentes entre sí.',
    por_que: 'Cada ojo se desarrolló distinto; puede causar dolor de cabeza o imagen desnivelada.',
  },
  'Fatiga visual digital': {
    que_es: 'Los ojos se cansan, irritan o duelen después de usar pantallas.',
    por_que: 'Al mirar pantallas parpadeamos mucho menos, resecando la superficie del ojo. La luz azul también contribuye.',
  },
  'Sospecha de ojo seco': {
    que_es: 'Los ojos se sienten secos, arenosos o con ardor.',
    por_que: 'La capa de lágrimas es insuficiente o se evapora rápido. Pantallas y aire acondicionado lo agravan.',
  },
}

export default function ResumenPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [receta, setReceta]     = useState<Receta | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient()
      const [{ data: p }, { data: r }, { data: c }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('recetas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }).limit(1).single(),
        supabase.from('consultas').select('id,created_at,motivo,sintoma_principal,diagnosticos,rec_clinicas,rec_comerciales').eq('paciente_id', id).order('created_at', { ascending: false }).limit(1).single(),
      ])
      setPaciente(p as Paciente)
      setReceta(r as Receta)
      setConsulta(c as Consulta)
      setCargando(false)
    }
    cargar()
  }, [id])

  const compartirWhatsApp = () => {
    if (!paciente || !receta) return
    const diags = consulta?.diagnosticos?.join(', ') || receta.diagnostico
    const recs = consulta?.rec_clinicas?.slice(0, 3).join('\n• ') || ''
    const texto = `*Resultados de tu consulta — GON Óptica*
📋 ${paciente.nombre} ${paciente.apellido}
📅 ${formatFecha(receta.fecha)}

*Diagnóstico:*
${diags}

*Tu receta de lentes (${receta.tipo}):*
OD: ${receta.od_esfera} / ${receta.od_cilindro} / ${receta.od_eje}°${receta.od_add ? ` ADD ${receta.od_add}` : ''}
OI: ${receta.oi_esfera} / ${receta.oi_cilindro} / ${receta.oi_eje}°${receta.oi_add ? ` ADD ${receta.oi_add}` : ''}
${receta.dp_od ? `D.P.: OD ${receta.dp_od} mm / OI ${receta.dp_oi} mm` : ''}

${recs ? `*Recomendaciones:*\n• ${recs}` : ''}

_Atendido por ${receta.optometrista}_
_GON Óptica_`

    const wa = paciente.whatsapp?.replace(/\D/g, '') || paciente.telefono?.replace(/\D/g, '')
    if (wa) {
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
    }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!paciente || !receta) return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <Eye className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
      <p className="text-zinc-500">No se encontró receta para este paciente.</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-[#0D9488] hover:underline">Volver</button>
    </div>
  )

  const edad = calcEdad(paciente.fecha_nacimiento)
  const diagsArray: string[] = consulta?.diagnosticos?.length
    ? consulta.diagnosticos
    : (receta.diagnostico ? receta.diagnostico.split(', ') : [])

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Barra de acciones — se oculta al imprimir */}
      <div className="print:hidden bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex-1" />
        <button onClick={compartirWhatsApp}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-600 transition-colors">
          <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-zinc-800 transition-colors">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      {/* Hoja clínica — diseño imprimible */}
      <div className="max-w-2xl mx-auto p-8 print:p-6">
        {/* Encabezado */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-zinc-200">
          <div>
            <p className="text-xs font-bold text-[#0D9488] uppercase tracking-widest mb-1">GON Óptica</p>
            <h1 className="text-2xl font-bold text-zinc-900">{paciente.nombre} {paciente.apellido}</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {edad !== null && `${edad} años`}
              {paciente.fecha_nacimiento && ` · Nacido ${formatFecha(paciente.fecha_nacimiento)}`}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-400">
            <p className="font-semibold text-zinc-600">{formatFecha(receta.fecha)}</p>
            {consulta?.motivo && <p className="mt-0.5">{consulta.motivo}</p>}
            <p className="mt-0.5">Atendido por {receta.optometrista}</p>
          </div>
        </div>

        {/* Diagnóstico */}
        {diagsArray.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Diagnóstico</h2>
            <div className="space-y-3">
              {diagsArray.map((d, i) => {
                const info = DIAG_INFO[d.trim()]
                return (
                  <div key={i} className="bg-white border border-zinc-100 rounded-lg p-4">
                    <p className="text-sm font-bold text-zinc-800">{d.trim()}</p>
                    {info && (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-xs text-zinc-600">{info.que_es}</p>
                        <p className="text-xs text-zinc-400"><span className="font-semibold">Por qué ocurre:</span> {info.por_que}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Prescripción */}
        <section className="mb-6">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Prescripción — {receta.tipo}
          </h2>
          <div className="bg-white border border-zinc-100 rounded-lg overflow-hidden">
            <div className="grid grid-cols-6 text-center text-[11px] font-bold text-zinc-400 uppercase px-4 py-2 border-b border-zinc-100">
              <div />
              <div>Esfera</div><div>Cilindro</div><div>Eje</div><div>Adición</div><div>D.P.</div>
            </div>
            {[
              { label: 'OD', esf: receta.od_esfera, cil: receta.od_cilindro, eje: receta.od_eje, add: receta.od_add, dp: receta.dp_od },
              { label: 'OI', esf: receta.oi_esfera, cil: receta.oi_cilindro, eje: receta.oi_eje, add: receta.oi_add, dp: receta.dp_oi },
            ].map(row => (
              <div key={row.label} className="grid grid-cols-6 text-center px-4 py-3 border-b border-zinc-50 last:border-0">
                <div className="font-bold text-sm text-zinc-700 text-left">{row.label}</div>
                <div className="font-mono text-sm text-zinc-800">{row.esf || '—'}</div>
                <div className="font-mono text-sm text-zinc-800">{row.cil || '—'}</div>
                <div className="font-mono text-sm text-zinc-800">{row.eje ? `${row.eje}°` : '—'}</div>
                <div className="font-mono text-sm text-zinc-800">{row.add || '—'}</div>
                <div className="font-mono text-sm text-zinc-800">{row.dp ? `${row.dp} mm` : '—'}</div>
              </div>
            ))}
          </div>
          {receta.observaciones && (
            <p className="text-xs text-zinc-400 mt-2 px-1">{receta.observaciones}</p>
          )}
        </section>

        {/* Recomendaciones */}
        {consulta?.rec_clinicas && consulta.rec_clinicas.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Recomendaciones</h2>
            <div className="space-y-2">
              {consulta.rec_clinicas.map((r, i) => (
                <div key={i} className="flex items-start gap-3 bg-white border border-zinc-100 rounded-lg p-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0D9488] flex-shrink-0 mt-1.5" />
                  <p className="text-xs text-zinc-600">{r}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pie */}
        <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
          <p>GON Óptica · Hermosillo, Sonora</p>
          <p>Este documento es válido como prescripción óptica</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          @page { margin: 20mm; }
        }
      `}</style>
    </div>
  )
}
