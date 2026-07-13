'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fecha'
import { MapPin, CheckCircle2 } from 'lucide-react'

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

export default function CheckInModal() {
  const [visible, setVisible]     = useState(false)
  const [nombre, setNombre]       = useState('')
  const [apodo,  setApodo]        = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho]         = useState(false)

  useEffect(() => {
    const verificar = async () => {
      try {
        const raw = localStorage.getItem('optios_demo_user')
        if (!raw) return
        const u = JSON.parse(raw)
        if (!u.nombre) return
        if (u.rol === 'repartidor') return
        setNombre(u.nombre)
        setApodo(u.apodo ?? u.nombre.split(' ')[0])

        const hoy = hoyLocal()

        // Primero revisar localStorage — si ya hizo check-in hoy, no mostrar modal
        if (u.checkInDate === hoy && u.sucursal) return

        // Intentar verificar en DB (best-effort, puede fallar si la tabla no existe)
        try {
          const sb = createClient()
          const { data } = await sb
            .from('check_ins')
            .select('id, sucursal')
            .eq('usuario_nombre', u.nombre)
            .eq('fecha', hoy)
            .single()
          if (data) {
            localStorage.setItem('optios_demo_user', JSON.stringify({ ...u, sucursal: data.sucursal, checkInDate: hoy }))
            return
          }
        } catch { /* tabla no existe aún, ignorar */ }

        // No hay check-in hoy → mostrar modal
        setVisible(true)
      } catch { /* noop */ }
    }
    verificar()
  }, [])

  const confirmar = async (sucursal: string) => {
    setGuardando(true)
    try {
      const sb = createClient()
      const hoy = hoyLocal()
      await sb.from('check_ins').upsert(
        { usuario_nombre: nombre, sucursal, fecha: hoy },
        { onConflict: 'usuario_nombre,fecha' }
      )
      // Guardar sucursal + fecha en localStorage (evita el loop al recargar)
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        const hoy = hoyLocal()
        localStorage.setItem('optios_demo_user', JSON.stringify({ ...u, sucursal, checkInDate: hoy }))
      }
      setHecho(true)
      setTimeout(() => window.location.reload(), 800)
    } catch {
      setGuardando(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-zinc-200 w-full max-w-sm overflow-hidden">

        {hecho ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#059669]" />
            </div>
            <p className="text-zinc-800 font-semibold text-base">¡Listo!</p>
          </div>
        ) : (
          <>
            <div className="bg-[#0B0E14] px-6 py-5">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2DD4BF]" />
                <span className="text-[#2DD4BF] text-xs font-semibold tracking-wide uppercase">Check-in del día</span>
              </div>
              <h2 className="text-white text-xl font-semibold tracking-tight">
                Buenos días, {apodo}
              </h2>
              <p className="text-white/40 text-[13px] mt-1">¿En qué sucursal estás hoy?</p>
            </div>

            <div className="p-4 space-y-2">
              {SUCURSALES.map(s => (
                <button
                  key={s}
                  onClick={() => confirmar(s)}
                  disabled={guardando}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-zinc-200 hover:border-[#0D9488]/40 hover:bg-[#0D9488]/[0.04] transition-colors text-left group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 group-hover:bg-[#0D9488]/10 flex items-center justify-center transition-colors flex-shrink-0">
                    <MapPin className="w-[18px] h-[18px] text-zinc-400 group-hover:text-[#0D9488] transition-colors" />
                  </div>
                  <span className="text-zinc-900 text-[15px] font-semibold group-hover:text-[#0D9488] transition-colors">{s}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
