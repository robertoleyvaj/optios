'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MapPin, CheckCircle2 } from 'lucide-react'

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

export default function CheckInModal() {
  const [visible, setVisible]     = useState(false)
  const [nombre, setNombre]       = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho]         = useState(false)

  useEffect(() => {
    const verificar = async () => {
      try {
        const raw = localStorage.getItem('optios_demo_user')
        if (!raw) return
        const u = JSON.parse(raw)
        if (!u.nombre) return
        setNombre(u.nombre)

        // Verificar si ya hay check-in hoy
        const sb = createClient()
        const hoy = new Date().toISOString().split('T')[0]
        const { data } = await sb
          .from('check_ins')
          .select('id, sucursal')
          .eq('usuario_nombre', u.nombre)
          .eq('fecha', hoy)
          .single()

        if (data) {
          // Ya hizo check-in — actualizar localStorage con sucursal actual
          const updated = { ...u, sucursal: data.sucursal }
          localStorage.setItem('optios_demo_user', JSON.stringify(updated))
        } else {
          // No hay check-in hoy → mostrar modal
          setVisible(true)
        }
      } catch { /* noop */ }
    }
    verificar()
  }, [])

  const confirmar = async (sucursal: string) => {
    setGuardando(true)
    try {
      const sb = createClient()
      const hoy = new Date().toISOString().split('T')[0]
      await sb.from('check_ins').upsert(
        { usuario_nombre: nombre, sucursal, fecha: hoy },
        { onConflict: 'usuario_nombre,fecha' }
      )
      // Actualizar localStorage
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        localStorage.setItem('optios_demo_user', JSON.stringify({ ...u, sucursal }))
      }
      setHecho(true)
      setTimeout(() => setVisible(false), 800)
    } catch {
      setGuardando(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {hecho ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-slate-700 font-semibold text-lg">¡Listo!</p>
          </div>
        ) : (
          <>
            <div className="bg-[#0B1A35] px-6 py-5">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-[#2BBFB3]" />
                <span className="text-[#2BBFB3] text-sm font-semibold">Check-in del día</span>
              </div>
              <h2 className="text-white text-xl font-bold">
                Buenos días, {nombre.split(' ')[0]} 👋
              </h2>
              <p className="text-white/50 text-sm mt-1">¿En qué sucursal estás hoy?</p>
            </div>

            <div className="p-5 space-y-3">
              {SUCURSALES.map(s => (
                <button
                  key={s}
                  onClick={() => confirmar(s)}
                  disabled={guardando}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 hover:border-[#2BBFB3] hover:bg-[#2BBFB3]/5 transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-[#2BBFB3]/10 flex items-center justify-center transition-colors">
                    <MapPin className="w-4 h-4 text-slate-400 group-hover:text-[#2BBFB3] transition-colors" />
                  </div>
                  <span className="text-slate-800 font-medium group-hover:text-[#2BBFB3] transition-colors">{s}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
