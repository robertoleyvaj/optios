// Vista de Sergio (repartidor): categorías de gastos extra y textos compartidos
// entre su app (/dashboard/ruta) y Finanzas.

export const CATEGORIAS_RUTA = [
  { key: 'material',    label: 'Material'    },
  { key: 'lente_extra', label: 'Lente extra' },
  { key: 'armazones',   label: 'Armazones'   },
  { key: 'estuches',    label: 'Estuches'    },
  { key: 'sprays',      label: 'Sprays'      },
  { key: 'otros',       label: 'Otro'        },
] as const

export type CategoriaRuta = typeof CATEGORIAS_RUTA[number]['key']
export const LABEL_RUTA: Record<string, string> = Object.fromEntries(CATEGORIAS_RUTA.map(c => [c.key, c.label]))

export type Encargo = {
  id: number
  created_at: string
  descripcion: string
  sucursal: string
  nota: string | null
  estado: 'pendiente' | 'comprado' | 'cancelado'
  creado_por: string | null
  monto: number | null
  metodo_pago: string | null
  comprado_at: string | null
}

export const SUCURSALES_RUTA = ['Baja Visión', '5 de Mayo', 'Plaza Laureles', 'General']
