'use client'

// ─── Hoja del paciente — documento imprimible / WhatsApp ─────────────────────
// Esta es la hoja bonita para el paciente, no el expediente clínico interno.
// Para el expediente interno ve a /dashboard/expedientes/[id]/resumen

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Printer, MessageCircle, ArrowLeft } from 'lucide-react'
import { SUCURSAL_CONFIG } from '@/lib/sucursales'

type Receta = {
  id: string; fecha: string; tipo: string; optometrista: string
  od_esfera: string; od_cilindro: string; od_eje: string; od_add: string
  oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_add: string
  dp_od: string; dp_oi: string; diagnostico: string; observaciones: string
}
type Consulta = {
  id: string; motivo: string; sucursal: string; atendido_por: string
  diagnosticos: string[]; rec_clinicas: string[]
}
type Paciente = {
  id: string; nombre: string; apellido: string; fecha_nacimiento: string
  telefono: string; whatsapp: string; email: string; ocupacion: string
  sexo: string; direccion: string
}

function calcEdad(f: string) {
  if (!f) return null
  const hoy = new Date(); const nac = new Date(f)
  let e = hoy.getFullYear() - nac.getFullYear()
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) e--
  return e
}
function formatFecha(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fv(v: string) { return v && v !== '0.00' && v !== '' ? v : '—' }

const DIAG_INFO: Record<string, string> = {
  'Miopía': 'Ve bien de cerca pero borroso a distancia.',
  'Hipermetropía': 'Cansancio al leer; el ojo hace un esfuerzo extra.',
  'Astigmatismo': 'Imágenes borrosas o distorsionadas en todas las distancias.',
  'Astigmatismo miópico compuesto': 'Visión borrosa a distancia con córnea ovalada.',
  'Astigmatismo mixto': 'Borroso de lejos y de cerca por curvatura irregular.',
  'Astigmatismo hipermetrópico compuesto': 'Cansancio visual con córnea ovalada.',
  'Astigmatismo simple': 'Borroso en un solo eje de la córnea.',
  'Astigmatismo con la regla': 'Tipo más común — curvatura mayor en eje vertical.',
  'Astigmatismo contra la regla': 'Curvatura mayor en eje horizontal.',
  'Astigmatismo oblicuo': 'Curvatura mayor en eje diagonal.',
  'Presbicia': 'Dificultad para ver de cerca, natural a partir de los 40 años.',
  'Anisometropía': 'Los dos ojos tienen graduaciones distintas entre sí.',
  'Fatiga visual digital': 'Ojos cansados, secos o irritados por uso de pantallas.',
  'Sospecha de ojo seco': 'Sensación de arenilla, ardor o lagrimeo excesivo.',
}

// ── Diagnóstico refractivo profesional por ojo, derivado de la graduación ──
// Convención de cilindro negativo (la usual en las recetas). Es una sugerencia
// clínica automática a partir de los datos; el optometrista la valida.
function diagRefractivo(sphS: string, cylS: string, axisS: string): string {
  const S = parseFloat(sphS)
  const C = parseFloat(cylS)
  const A = parseFloat(axisS)
  if (Number.isNaN(S)) return ''
  const casi = (n: number) => Math.abs(n) < 0.25
  const hasCyl = !Number.isNaN(C) && Math.abs(C) >= 0.25
  if (!hasCyl) {
    if (casi(S)) return 'Emétrope (sin error refractivo)'
    return S > 0 ? 'Hipermetropía' : 'Miopía'
  }
  const m1 = S, m2 = S + C
  const s1 = casi(m1) ? 0 : (m1 > 0 ? 1 : -1)
  const s2 = casi(m2) ? 0 : (m2 > 0 ? 1 : -1)
  let tipo = 'Astigmatismo'
  if ((s1 === 0 && s2 < 0) || (s1 < 0 && s2 === 0)) tipo = 'Astigmatismo miópico simple'
  else if ((s1 === 0 && s2 > 0) || (s1 > 0 && s2 === 0)) tipo = 'Astigmatismo hipermetrópico simple'
  else if (s1 < 0 && s2 < 0) tipo = 'Astigmatismo miópico compuesto'
  else if (s1 > 0 && s2 > 0) tipo = 'Astigmatismo hipermetrópico compuesto'
  else if (s1 * s2 < 0) tipo = 'Astigmatismo mixto'
  let regla = ''
  if (!Number.isNaN(A)) {
    const a = ((A % 180) + 180) % 180
    const conRegla = C < 0 ? (a <= 30 || a >= 150) : (a >= 60 && a <= 120)
    const contraRegla = C < 0 ? (a >= 60 && a <= 120) : (a <= 30 || a >= 150)
    regla = conRegla ? 'con la regla' : contraRegla ? 'contra la regla' : 'oblicuo'
  }
  return regla ? `${tipo} ${regla}` : tipo
}

function recomendacionLente(od: string, oi: string, hasAdd: boolean): string {
  const t = (od + ' ' + oi).toLowerCase()
  const miope = t.includes('miop'), hyper = t.includes('hipermetro')
  const astig = t.includes('astigmatismo'), mixto = t.includes('mixto')
  let base = ''
  if (mixto) base = 'Lentes tóricas (corrección esfero-cilíndrica)'
  else if (astig) base = `Lentes ${miope ? 'divergentes (cóncavas)' : hyper ? 'convergentes (convexas)' : 'esfero-cilíndricas'} con corrección cilíndrica (tóricas)`
  else if (miope) base = 'Lentes divergentes (cóncavas / negativas)'
  else if (hyper) base = 'Lentes convergentes (convexas / positivas)'
  else base = 'Corrección según valoración del especialista'
  if (hasAdd) base += ', con adición para visión cercana (progresivo o bifocal)'
  return base
}

function IcoRegla() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function IcoGota() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><path d="M12 2C6 10 4 14 4 17a8 8 0 0016 0c0-3-2-7-8-15z"/></svg> }
function IcoSol() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function IcoCal() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }

const RECS_ICONOS: Record<string, React.ReactElement> = {
  'Regla 20-20-20': <IcoRegla />, 'Lubricantes oculares': <IcoGota />,
  'Usar lentes de sol': <IcoSol />, 'Revisión anual': <IcoCal />,
}
function getIconoRec(t: string) {
  for (const [k, v] of Object.entries(RECS_ICONOS)) if (t.toLowerCase().includes(k.toLowerCase())) return v
  return <IcoCal />
}

// Diagrama del lente que se adapta a la graduación real del paciente
function LensDiagram({ sph, hasCyl, hasAdd }: { sph: number | null; hasCyl: boolean; hasAdd: boolean }) {
  const sphTxt = sph === null ? 'Ajusta el enfoque.'
    : sph > 0 ? 'Corrige la hipermetropía.'
    : sph < 0 ? 'Corrige la miopía.'
    : 'Sin defecto esférico.'
  return (
    <svg viewBox="0 0 230 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[230px]">
      <ellipse cx="90" cy="100" rx="52" ry="80" fill="rgba(147,197,253,0.25)" stroke="#93C5FD" strokeWidth="2"/>
      {/* eje de astigmatismo — solo si hay cilindro */}
      {hasCyl && <ellipse cx="90" cy="100" rx="30" ry="80" fill="rgba(13,148,136,0.10)" stroke="#0D9488" strokeWidth="1" strokeDasharray="4 3"/>}

      {/* ESFERA — siempre */}
      <circle cx="90" cy="56" r="4" fill="#4F46E5"/>
      <line x1="94" y1="56" x2="145" y2="42" stroke="#4F46E5" strokeWidth="1.2"/>
      <text x="148" y="38" fontSize="10" fill="#4F46E5" fontWeight="700">Esfera (SPH)</text>
      <text x="148" y="51" fontSize="9" fill="#6B7280">{sphTxt}</text>

      {/* CILINDRO — solo si aplica */}
      {hasCyl && <>
        <circle cx="60" cy="100" r="4" fill="#0D9488"/>
        <line x1="56" y1="100" x2="145" y2="96" stroke="#0D9488" strokeWidth="1.2" strokeDasharray="4 2"/>
        <text x="148" y="93" fontSize="10" fill="#0D9488" fontWeight="700">Cilindro (CYL) y Eje</text>
        <text x="148" y="105" fontSize="9" fill="#6B7280">Corrige el astigmatismo.</text>
      </>}

      {/* ADD — solo si hay adición */}
      {hasAdd && <>
        <circle cx="90" cy="155" r="4" fill="#F43F5E"/>
        <line x1="94" y1="155" x2="145" y2="158" stroke="#F43F5E" strokeWidth="1.2"/>
        <text x="148" y="154" fontSize="10" fill="#F43F5E" fontWeight="700">ADD</text>
        <text x="148" y="166" fontSize="9" fill="#6B7280">Adición para ver de cerca.</text>
      </>}
    </svg>
  )
}

export default function HojaPage() {
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
        supabase.from('pacientes').select('id,nombre,apellido,fecha_nacimiento,telefono,whatsapp,email,ocupacion,sexo,direccion').eq('id', id).single(),
        supabase.from('recetas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }).limit(1).single(),
        supabase.from('consultas').select('id,motivo,sucursal,atendido_por,diagnosticos,rec_clinicas').eq('paciente_id', id).order('created_at', { ascending: false }).limit(1).single(),
      ])
      setPaciente(p as Paciente); setReceta(r as Receta); setConsulta(c as Consulta)
      setCargando(false)
    }
    cargar()
  }, [id])

  const compartirWhatsApp = () => {
    if (!paciente || !receta) return
    const diags = (consulta?.diagnosticos ?? []).join(', ') || receta.diagnostico
    const texto = `*Resumen de tu consulta — Grupo Óptico del Noroeste*\n\n👤 ${paciente.nombre} ${paciente.apellido}\n📅 ${formatFecha(receta.fecha)}\n\n*Diagnóstico:* ${diags}\n\n*Prescripción (${receta.tipo}):*\nOD: ${receta.od_esfera} / ${receta.od_cilindro} / ${receta.od_eje}°${receta.od_add ? ` ADD ${receta.od_add}` : ''}\nOI: ${receta.oi_esfera} / ${receta.oi_cilindro} / ${receta.oi_eje}°${receta.oi_add ? ` ADD ${receta.oi_add}` : ''}${receta.dp_od ? `\nD.P.: ${receta.dp_od} mm / ${receta.dp_oi} mm` : ''}\n\n_Atendido por ${consulta?.atendido_por || receta.optometrista} — Grupo Óptico del Noroeste_`
    const wa = paciente.whatsapp?.replace(/\D/g, '') || paciente.telefono?.replace(/\D/g, '')
    window.open(`https://wa.me/${wa ? wa : ''}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  if (cargando) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" /></div>
  if (!paciente || !receta) return <div className="max-w-2xl mx-auto p-8 text-center text-zinc-400"><p className="mb-4">Sin receta disponible.</p><button onClick={() => router.back()} className="text-sm text-[#0D9488] hover:underline">Volver</button></div>

  const edad     = calcEdad(paciente.fecha_nacimiento)
  const diagsArr = consulta?.diagnosticos?.length ? consulta.diagnosticos : (receta.diagnostico ? receta.diagnostico.split(', ') : [])
  const recs     = consulta?.rec_clinicas ?? []
  const sucursal = consulta?.sucursal || ''
  const sucCfg   = SUCURSAL_CONFIG[sucursal]
  const sucNombre = sucCfg ? (sucCfg.nombreLinea2 ? `${sucCfg.nombreLinea1} · ${sucCfg.nombreLinea2}` : sucCfg.nombreLinea1) : (sucursal || 'Grupo Óptico del Noroeste')
  const opto     = consulta?.atendido_por || receta.optometrista
  const tieneAdd = receta.od_add || receta.oi_add
  // Valores para que la ilustración se adapte a la graduación
  const sphRaw = receta.od_esfera || receta.oi_esfera || ''
  const sphParsed = fv(sphRaw) !== '—' ? parseFloat(sphRaw) : NaN
  const sphVal = Number.isNaN(sphParsed) ? null : sphParsed
  const hasCyl = fv(receta.od_cilindro) !== '—' || fv(receta.oi_cilindro) !== '—'
  const hasAddDiag = !!tieneAdd
  // Diagnóstico profesional por ojo + recomendación de lente, derivados de la graduación
  const dxOD = diagRefractivo(receta.od_esfera, receta.od_cilindro, receta.od_eje)
  const dxOI = diagRefractivo(receta.oi_esfera, receta.oi_cilindro, receta.oi_eje)
  const recLente = recomendacionLente(dxOD, dxOI, hasAddDiag)
  const dxPorOjo = (dxOD || dxOI) ? [
    dxOD ? { ojo: 'Ojo derecho (OD)', dx: dxOD } : null,
    dxOI ? { ojo: 'Ojo izquierdo (OI)', dx: dxOI } : null,
    hasAddDiag ? { ojo: 'Ambos ojos', dx: 'Presbicia (dificultad para ver de cerca)' } : null,
  ].filter(Boolean) as { ojo: string; dx: string }[] : []

  return (
    <>
      <div className="print:hidden bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"><ArrowLeft className="w-4 h-4" /> Volver al expediente</button>
        <div className="flex-1" />
        <button onClick={compartirWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-600 transition-colors"><MessageCircle className="w-4 h-4" /> Enviar por WhatsApp</button>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-zinc-800 transition-colors"><Printer className="w-4 h-4" /> Imprimir</button>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ fontFamily: "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif", color: '#1E293B', background: '#F8FAFC', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gon-logo.png" alt="Grupo Óptico del Noroeste" style={{ height: 54, width: 'auto' }} />
            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0B0E14', lineHeight: 1.2 }}>Grupo Óptico<br />del Noroeste</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#0B0E14' }}>Resumen de tu consulta</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{sucNombre} · {opto}</div>
          </div>
          <div style={{ textAlign: 'right', background: '#EEF2FF', borderRadius: 12, padding: '10px 16px', minWidth: 140 }}>
            <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Fecha de consulta</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginTop: 2 }}>{formatFecha(receta.fecha)}</div>
          </div>
        </div>

        {/* Tarjeta paciente */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#6366F1"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0B0E14', marginBottom: 8 }}>{paciente.nombre} {paciente.apellido}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 24px', fontSize: 12 }}>
              {paciente.fecha_nacimiento && <InfoItem icon="📅" label={`${paciente.fecha_nacimiento.split('-').reverse().join('/')} · ${edad} años`} />}
              {paciente.sexo && <InfoItem icon="⚥" label={paciente.sexo} />}
              {paciente.telefono && <InfoItem icon="📞" label={paciente.telefono} />}
              {paciente.whatsapp && <InfoItem icon="💬" label={paciente.whatsapp} />}
              {paciente.email && <InfoItem icon="✉️" label={paciente.email} />}
              {paciente.ocupacion && <InfoItem icon="💼" label={paciente.ocupacion} />}
              {paciente.direccion && <InfoItem icon="📍" label={paciente.direccion} />}
            </div>
          </div>
        </div>

        {/* Prescripción */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: 1 }}>Prescripción Final</span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ background: '#0B0E14', color: 'white', padding: '10px 14px', textAlign: 'left', borderRadius: '8px 0 0 0', fontSize: 12 }}></th>
                    {['ESFERA', 'CILINDRO', 'EJE', ...(tieneAdd ? ['ADD'] : [])].map(h => (
                      <th key={h} style={{ background: '#0B0E14', color: 'white', padding: '10px 14px', textAlign: 'center', fontSize: 11, letterSpacing: 1 }}>{h}</th>
                    ))}
                    <th style={{ background: '#0B0E14', color: 'white', padding: '10px 14px', textAlign: 'center', borderRadius: '0 8px 0 0', fontSize: 11, letterSpacing: 1 }}>D.P.</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { eye: 'OD', label: 'Ojo Derecho', bg: '#EEF2FF', esf: receta.od_esfera, cil: receta.od_cilindro, eje: receta.od_eje, add: receta.od_add, dp: receta.dp_od },
                    { eye: 'OI', label: 'Ojo Izquierdo', bg: '#F0FDF4', esf: receta.oi_esfera, cil: receta.oi_cilindro, eje: receta.oi_eje, add: receta.oi_add, dp: receta.dp_oi },
                  ].map(row => (
                    <tr key={row.eye}>
                      <td style={{ background: row.bg, padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0B0E14' }}>{row.eye}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>({row.label})</div>
                      </td>
                      {[row.esf, row.cil, row.eje ? `${row.eje}°` : '—', ...(tieneAdd ? [row.add || '—'] : [])].map((v, i) => (
                        <td key={i} style={{ padding: '14px', textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#1E293B', background: row.bg, borderTop: '1px solid #F1F5F9' }}>{fv(v || '')}</td>
                      ))}
                      <td style={{ padding: '14px', textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#1E293B', background: row.bg, borderTop: '1px solid #F1F5F9' }}>{row.dp ? `${row.dp} mm` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, marginTop: 8, background: '#E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <DPBox label="D.P. OD" value={receta.dp_od ? `${receta.dp_od} mm` : '—'} />
                <DPBox label="D.P. OI" value={receta.dp_oi ? `${receta.dp_oi} mm` : '—'} />
                <DPBox label="Tipo de lente" value={receta.tipo || '—'} big />
              </div>
            </div>
            <div style={{ width: 230, flexShrink: 0 }}><LensDiagram sph={sphVal} hasCyl={hasCyl} hasAdd={hasAddDiag} /></div>
          </div>
          {receta.observaciones && <p style={{ marginTop: 12, fontSize: 11, color: '#64748B', fontStyle: 'italic', paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>Observaciones: {receta.observaciones}</p>}
        </div>

        {/* 3 columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <ColHeader icon="🔬" label="Diagnóstico" color="#0D9488" />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dxPorOjo.length > 0 ? dxPorOjo.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div>
                    <div style={{ fontSize: 10, color: '#0D9488', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{d.ojo}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{d.dx}</div>
                  </div>
                </div>
              )) : diagsArr.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{d}</div>
                    {DIAG_INFO[d] && <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{DIAG_INFO[d]}</div>}
                  </div>
                </div>
              ))}
              {dxPorOjo.length === 0 && diagsArr.length === 0 && <p style={{ fontSize: 12, color: '#94A3B8' }}>Sin diagnósticos.</p>}
              {recLente && dxPorOjo.length > 0 && (
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 10, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Corrección recomendada</div>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.4 }}>{recLente}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <ColHeader icon="💡" label="Recomendaciones" color="#2563EB" />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recs.length > 0 ? recs.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{getIconoRec(r)}</div>
                  <p style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>{r}</p>
                </div>
              )) : <>
                <RecItem icon={<IcoRegla />} texto="Regla 20-20-20 para pantallas." />
                <RecItem icon={<IcoSol />} texto="Usa lentes con protección UV." />
                <RecItem icon={<IcoCal />} texto="Revisión optométrica anual." />
              </>}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <ColHeader icon="🔔" label="Notas importantes" color="#F43F5E" />
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 28, color: '#FCA5A5', lineHeight: 1, marginBottom: 4 }}>"</div>
              <p style={{ fontSize: 11, color: '#334155', lineHeight: 1.6, marginBottom: 14 }}>El uso constante de lentes con la prescripción adecuada mejorará tu visión y reducirá la fatiga ocular.</p>
              <p style={{ fontSize: 11, color: '#334155', lineHeight: 1.6 }}>Si experimentas dolor, visión doble o cualquier molestia visual inusual, acude de inmediato con tu especialista.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)', borderRadius: 16, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24, color: 'white' }}>
          <div style={{ flex: 1, fontSize: 11, lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>¿Tienes dudas o necesitas agendar tu próxima cita?</div>
            <div style={{ fontWeight: 500 }}>{sucNombre}</div>
            {sucCfg?.direccion && <div>📍 {sucCfg.direccion}</div>}
            <div>
              {sucCfg?.telefono && <span>📞 {sucCfg.telefono}</span>}
              {sucCfg?.whatsapp && <span>{'   '}💬 WhatsApp {sucCfg.whatsapp}</span>}
            </div>
            {sucCfg?.horario && <div style={{ opacity: 0.85 }}>🕐 {sucCfg.horario}{sucCfg.web ? `  ·  ${sucCfg.web}` : ''}</div>}
          </div>
          <div style={{ textAlign: 'right', fontStyle: 'italic', opacity: 0.9 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" style={{ marginBottom: 4 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Gracias por confiar en nosotros</div>
            <div style={{ fontSize: 11 }}>para cuidar tu visión.</div>
          </div>
        </div>

      </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 8mm 10mm; size: letter; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: white !important; margin: 0; }
          aside, header { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; height: auto !important; }
          .flex.h-screen { display: block !important; height: auto !important; }
          .flex-1.flex.flex-col.overflow-hidden { display: block !important; overflow: visible !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  )
}

function InfoItem({ icon, label }: { icon: string; label: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}><span style={{ fontSize: 13 }}>{icon}</span><span style={{ fontSize: 12 }}>{label}</span></div>
}
function DPBox({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return <div style={{ background: 'white', padding: '10px 14px' }}><div style={{ fontSize: 10, color: '#64748B' }}>{label}</div><div style={{ fontSize: big ? 15 : 14, fontWeight: 700, color: '#0B0E14' }}>{value}</div></div>
}
function ColHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottom: `2px solid ${color}22` }}><span style={{ fontSize: 15 }}>{icon}</span><span style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span></div>
}
function RecItem({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><div style={{ flexShrink: 0, marginTop: 1 }}>{icon}</div><p style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>{texto}</p></div>
}
