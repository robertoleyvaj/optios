-- ============================================================
-- OptiOS — Esquema completo de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Extensiones ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── PACIENTES ────────────────────────────────────────────────
create table if not exists pacientes (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  nombre              text not null,
  apellido            text not null,
  telefono            text default '',
  email               text default '',
  fecha_nacimiento    date,
  sucursal_principal  text default '',
  notas               text default ''
);

-- ── RECETAS ──────────────────────────────────────────────────
create table if not exists recetas (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  paciente_id     uuid references pacientes(id) on delete cascade not null,
  fecha           date not null,
  tipo            text not null check (tipo in ('Lejos','Cerca','Progresivo','Bifocal')),
  od_esfera       text default '',
  od_cilindro     text default '',
  od_eje          text default '',
  od_add          text default '',
  oi_esfera       text default '',
  oi_cilindro     text default '',
  oi_eje          text default '',
  oi_add          text default '',
  dp              text default '',
  optometrista    text default '',
  observaciones   text default ''
);

-- ── VENTAS ───────────────────────────────────────────────────
create table if not exists ventas (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  folio             text not null,           -- V-0001, V-0002 …
  paciente_id       uuid references pacientes(id),
  paciente_nombre   text default '',          -- denormalizado
  paciente_telefono text default '',
  sucursal          text not null,
  subtotal          numeric(10,2) not null default 0,
  total             numeric(10,2) not null default 0,
  anticipo          numeric(10,2) default 0,
  saldo             numeric(10,2) default 0,
  metodo_pago       text default 'efectivo',
  estado            text default 'activa' check (estado in ('activa','cancelada')),
  es_cotizacion     boolean default false,
  fecha_entrega     date,
  atendido_por      text default '',
  notas             text default ''
);

-- ── VENTAS ITEMS ─────────────────────────────────────────────
create table if not exists ventas_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid references ventas(id) on delete cascade not null,
  nombre          text not null,
  sku             text default '',
  precio_unitario numeric(10,2) not null,
  cantidad        integer not null default 1,
  descuento       integer default 0,          -- porcentaje 0-100
  subtotal        numeric(10,2) not null
);

-- ── ORDENES DE LABORATORIO ───────────────────────────────────
create table if not exists ordenes_lab (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  folio               text not null,           -- L-0001, L-0002 …
  folio_venta         text default '',
  venta_id            uuid references ventas(id),
  paciente            text not null,
  telefono            text default '',
  sucursal            text not null,
  laboratorio         text default '',
  tipo_mica           text default '',
  armazon             text default 'comprado' check (armazon in ('propio','comprado')),
  descripcion_armazon text default '',
  od                  text default '',
  oi                  text default '',
  add_graduacion      text default '',
  dp                  text default '',
  altura              text default '',
  tratamiento         text default 'ninguno',
  color_tratamiento   text default '',
  urgente             boolean default false,
  fecha_ingreso       text default '',
  fecha_promesa       text default '',
  fecha_entrega       text default '',
  fecha_envio_lab     text default '',
  fecha_recogida_lab  text default '',
  pagado_lab          boolean default false,
  fecha_pago_lab      text default '',
  metodo_pago_lab     text default '',
  estado              text default 'recibido' check (estado in ('recibido','en_laboratorio','en_camino','listo','entregado','problema')),
  costo_lab           numeric(10,2) default 0,
  precio_cliente      numeric(10,2) default 0,
  anticipo            numeric(10,2) default 0,
  notas               text default ''
);

-- ── MOVIMIENTOS DE CAJA ──────────────────────────────────────
create table if not exists caja_movimientos (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  tipo            text not null check (tipo in ('ingreso','egreso')),
  concepto        text not null,
  monto           numeric(10,2) not null,
  sucursal        text not null,
  metodo_pago     text default '',
  referencia      text default '',             -- folio V-XXXX o L-XXXX
  registrado_por  text default ''
);

-- ── CORTES DE CAJA ───────────────────────────────────────────
create table if not exists cortes_caja (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  fecha               date not null,
  sucursal            text not null,
  usuario             text not null default '',
  total_ventas        numeric(10,2) default 0,
  efectivo_sistema    numeric(10,2) default 0,
  efectivo_contado    numeric(10,2) default 0,
  diferencia          numeric(10,2) default 0,
  fondo               numeric(10,2) default 0,
  entrega             numeric(10,2) default 0,
  notas               text default '',
  cerrado             boolean default false,
  unique(fecha, sucursal)
);

-- ── CHECK-INS DIARIOS ────────────────────────────────────────
create table if not exists check_ins (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  usuario_nombre  text not null,
  sucursal        text not null,
  fecha           date not null,
  unique(usuario_nombre, fecha)
);

-- ── ÍNDICES ──────────────────────────────────────────────────
create index if not exists idx_recetas_paciente     on recetas(paciente_id);
create index if not exists idx_ventas_items_venta   on ventas_items(venta_id);
create index if not exists idx_ordenes_venta        on ordenes_lab(venta_id);
create index if not exists idx_ordenes_estado       on ordenes_lab(estado);
create index if not exists idx_caja_sucursal        on caja_movimientos(sucursal);
create index if not exists idx_caja_tipo            on caja_movimientos(tipo);

-- ── RLS — desactivado para demo (activar en producción) ──────
alter table pacientes          disable row level security;
alter table recetas            disable row level security;
alter table ventas             disable row level security;
alter table ventas_items       disable row level security;
alter table ordenes_lab        disable row level security;
alter table caja_movimientos   disable row level security;
alter table cortes_caja        disable row level security;
alter table check_ins          disable row level security;

-- ── FUNCIÓN: siguiente folio ──────────────────────────────────
-- Uso: select siguiente_folio('V') → 'V-0042'
create or replace function siguiente_folio(prefijo text)
returns text language plpgsql as $$
declare
  n integer;
  tabla text;
begin
  if prefijo = 'V' then tabla := 'ventas';
  elsif prefijo = 'L' then tabla := 'ordenes_lab';
  else return prefijo || '-0001';
  end if;

  execute format(
    'select coalesce(max(cast(substring(folio from %L) as integer)), 0) + 1 from %I',
    '\\d+', tabla
  ) into n;

  return prefijo || '-' || lpad(n::text, 4, '0');
end;
$$;
