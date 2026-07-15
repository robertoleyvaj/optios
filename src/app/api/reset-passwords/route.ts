import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// RUTA TEMPORAL — borrar después de usar
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const usuarios = [
    { id: 'a8f3fb03-7b6c-4450-93d9-a1265272431d', password: 'Lago8312' },
    { id: '53a85eca-f6d3-4dfe-92c2-8f8a4876c4c7', password: 'Pino4729' },
    { id: '91392593-852c-4c44-bc0b-d04ebb59047e', password: 'Miel6483' },
    { id: '8d0bec8f-47eb-4a53-a472-ec5e685d4877', password: 'Roca2957' },
    { id: 'f811baf3-133b-4d10-822d-c07353cd3eb3', password: 'Vela7124' },
    { id: '4be31e42-0967-46c7-8f5c-d6e862877521', password: 'Arco5638' },
  ]

  const resultados = []
  for (const u of usuarios) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, { password: u.password })
    resultados.push({ id: u.id, ok: !error, error: error?.message })
  }

  return NextResponse.json({ resultados })
}
