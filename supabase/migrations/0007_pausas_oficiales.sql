-- 0007_pausas_oficiales.sql
-- Activa SST — Catálogo oficial de 12 pausas curadas + relaciones por tipo de trabajo.
-- Lectura pública para authenticated (US7). Cada empresa puede clonar a su propia tabla `pausas`.
-- Fuentes: Cartilla Pausas Saludables (Politécnico GC), AXA Colpatria SST, MINSALUD.

-- ============================================================
-- Enum: pack
-- ============================================================
do $$ begin
  create type pausa_oficial_pack as enum (
    'oficina_basico',
    'operativo_basico',
    'conduccion_basico',
    'universal'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tabla: pausas_oficiales
-- Sin empresa_id (catálogo global). Una `codigo` natural (P01..P12) para idempotencia.
-- ============================================================
create table if not exists public.pausas_oficiales (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique check (codigo ~ '^P[0-9]{2}$'),
  titulo        text not null check (char_length(titulo) between 2 and 200),
  instrucciones text not null,
  duracion_min  smallint not null check (duracion_min between 1 and 60),
  pack          pausa_oficial_pack not null,
  image_url     text,    -- path en bucket pausas-media/oficiales/ (a llenar cuando se suban los PNG)
  video_url     text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_pausas_of_pack on public.pausas_oficiales(pack);

comment on table public.pausas_oficiales is 'Catálogo global de pausas oficiales curadas. Lectura libre, escritura solo service_role.';

-- ============================================================
-- Tabla: pausas_oficiales_tipos_trabajo (N:M)
-- ============================================================
create table if not exists public.pausas_oficiales_tipos_trabajo (
  pausa_oficial_id uuid not null references public.pausas_oficiales(id) on delete cascade,
  tipo_id          uuid not null references public.tipos_trabajo(id) on delete restrict,
  primary key (pausa_oficial_id, tipo_id)
);

create index if not exists idx_potipos_tipo on public.pausas_oficiales_tipos_trabajo(tipo_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.pausas_oficiales                enable row level security;
alter table public.pausas_oficiales_tipos_trabajo  enable row level security;

drop policy if exists pof_select on public.pausas_oficiales;
create policy pof_select on public.pausas_oficiales
  for select to authenticated
  using (true);

drop policy if exists pof_tipos_select on public.pausas_oficiales_tipos_trabajo;
create policy pof_tipos_select on public.pausas_oficiales_tipos_trabajo
  for select to authenticated
  using (true);

-- INSERT/UPDATE/DELETE solo service_role (sin política para authenticated).

-- ============================================================
-- Seed: 12 pausas
-- Idempotente vía ON CONFLICT(codigo).
-- ============================================================
insert into public.pausas_oficiales (codigo, titulo, instrucciones, duracion_min, pack, image_url) values
('P01',
 'Movilidad de Cuello',
 E'1. Ponte de pie o siéntate con la espalda recta y los hombros relajados.\n2. Inclina la cabeza hacia la derecha llevando la oreja al hombro. Sostén 8 segundos. Regresa al centro.\n3. Repite hacia el lado izquierdo. Sostén 8 segundos.\n4. Lleva el mentón hacia el pecho suavemente. Sostén 5 segundos. Regresa.\n5. Gira la cabeza hacia la derecha como si miraras por encima del hombro. Sostén 5 segundos.\n6. Repite hacia el lado izquierdo. Sostén 5 segundos.\n7. Realiza 3 repeticiones completas de la secuencia. Respira profundo entre cada movimiento.\n\n⚠️ Si tienes problema articular en el cuello, realiza los movimientos con precaución o evítalos.',
 5, 'oficina_basico', 'oficiales/p01-movilidad-cuello.svg'),

('P02',
 'Relajación Visual 20-20-20',
 E'1. Aleja la vista de la pantalla.\n2. Busca un punto lejano a más de 6 metros de distancia (una ventana, la pared del fondo).\n3. Enfoca ese punto durante 20 segundos. Parpadea normalmente.\n4. Cierra los ojos suavemente y cúbrelos con las palmas sin hacer presión. Mantén 10 segundos.\n5. Abre los ojos ampliamente y luego ciérralos con fuerza. Repite 5 veces.\n6. Mueve los ojos de lado a lado (derecha-izquierda) 5 veces lentamente, sin mover la cabeza.\n7. Mueve los ojos arriba-abajo 5 veces lentamente.\n8. Realiza 3 círculos con los ojos en cada dirección.\n\n💡 Aplica la regla 20-20-20: cada 20 minutos de pantalla, mira 20 segundos a 6 metros.',
 5, 'oficina_basico', 'oficiales/p02-relajacion-visual.svg'),

('P03',
 'Estiramiento de Hombros y Brazos',
 E'1. De pie, eleva ambos hombros hacia las orejas. Sostén 5 segundos. Bájalos con fuerza. Repite 5 veces.\n2. Realiza rotaciones de hombros hacia adelante: 5 círculos grandes y lentos.\n3. Repite las rotaciones hacia atrás: 5 círculos grandes y lentos.\n4. Lleva el brazo derecho por encima de la cabeza con el codo doblado. Con la mano izquierda empuja el codo suavemente hacia atrás. Sostén 10 segundos. Cambia de lado.\n5. Lleva el brazo derecho extendido al frente a la altura del hombro. Con la mano izquierda jala el brazo hacia el pecho. Sostén 10 segundos. Cambia de lado.\n6. Entrelaza los dedos, estira los brazos al frente con las palmas hacia afuera. Sostén 8 segundos. Relaja.',
 5, 'oficina_basico', 'oficiales/p03-estiramiento-hombros.svg'),

('P04',
 'Ejercicios de Manos y Muñecas',
 E'1. Abre las manos completamente, separa todos los dedos. Cierra en puño. Repite 5 veces.\n2. Con el puño cerrado, mueve las muñecas hacia arriba y hacia abajo. 5 repeticiones.\n3. Realiza rotaciones de muñeca: 5 círculos hacia la derecha y 5 hacia la izquierda con cada mano.\n4. Extiende el brazo al frente con la palma hacia afuera. Con la otra mano jala los dedos hacia atrás suavemente. Sostén 8 segundos. Cambia de mano.\n5. Lleva el dedo pulgar a tocar cada uno de los otros dedos en secuencia: índice, medio, anular, meñique. Repite 4 veces con cada mano.\n6. Sacude las manos suavemente durante 10 segundos para relajar los músculos.\n\n⚠️ Si realizas trabajo de digitación intensivo, haz esta pausa cada 60 minutos.',
 5, 'oficina_basico', 'oficiales/p04-ejercicios-manos.svg'),

('P05',
 'Pausa Mental y Respiración',
 E'1. Siéntate o párate con la espalda recta. Cierra los ojos si puedes.\n2. Inhala profundamente por la nariz contando hasta 4. Siente cómo el abdomen se expande.\n3. Sostén el aire 2 segundos.\n4. Exhala lentamente por la boca contando hasta 6, como si soplaras una vela a lo lejos.\n5. Repite el ciclo de respiración 5 veces.\n6. Abre los ojos lentamente. Mueve el cuello suavemente de lado a lado 3 veces.\n7. Estira los brazos al techo, empínate en puntas de pies y bosteza fuerte si sientes la necesidad.\n\n💡 Esta pausa ayuda a reducir el estrés y mejorar la concentración después de tareas intensas.',
 5, 'oficina_basico', 'oficiales/p05-respiracion.svg'),

('P06',
 'Estiramiento de Espalda Baja',
 E'1. De pie con los pies separados al ancho de los hombros y rodillas levemente dobladas.\n2. Entrelaza los dedos y estira los brazos al frente con las palmas hacia afuera. Lleva la cadera hacia adelante arqueando suavemente la espalda. Sostén 10 segundos. Relaja.\n3. Pon las manos en la cintura y realiza 5 rotaciones de cadera lentas hacia la derecha, luego 5 hacia la izquierda. Mantén el tronco recto.\n4. Con las manos en las rodillas, dobla ligeramente el tronco hacia adelante y redondea la espalda como un arco. Sostén 8 segundos. Vuelve a posición recta.\n5. Párate derecho y lleva una rodilla al pecho con las manos. Sostén 8 segundos. Cambia de pierna.\n6. Repite 2 veces toda la secuencia. Respira durante cada movimiento.\n\n⚠️ No hagas este estiramiento si tienes dolor lumbar agudo. Consulta con tu médico.',
 5, 'operativo_basico', 'oficiales/p06-espalda-baja.svg'),

('P07',
 'Activación de Piernas y Tobillos',
 E'1. De pie, apóyate en una superficie si necesitas equilibrio.\n2. Levanta los talones del piso 10 veces (elevaciones de pantorrilla). Hazlo lento y controlado.\n3. Camina en el puesto alternando puntas de pie y talones durante 20 segundos.\n4. Levanta una rodilla al frente (cadera a 90°) y balancéala hacia atrás. Alterna con la otra pierna: 5 repeticiones por lado.\n5. Sin apoyar el pie en el piso, realiza 3 rotaciones de tobillo hacia la izquierda y 3 hacia la derecha con cada pie.\n6. Con la espalda recta, haz sentadillas superficiales (45°): baja y sube lentamente. 7 repeticiones.\n\n💡 Ideal para quienes trabajan de pie por tiempo prolongado.',
 5, 'operativo_basico', 'oficiales/p07-activacion-piernas.svg'),

('P08',
 'Estiramiento de Piernas',
 E'1. De pie cerca de una pared para apoyo si lo necesitas.\n2. Dobla la rodilla derecha y toma el tobillo con la mano derecha por detrás. Jala el pie hacia los glúteos. Mantén la rodilla apuntando hacia el suelo. Sostén 10 segundos. Cambia de pierna.\n3. Da un paso largo hacia adelante con la pierna derecha. Dobla la rodilla delantera a 90°. La rodilla trasera apunta hacia el piso. Sostén 8 segundos. Cambia de lado. (Estocada estática)\n4. Apoya el talón derecho en el suelo con la rodilla extendida. Inclínate levemente hacia adelante con la espalda recta hasta sentir la tensión en la pantorrilla. Sostén 10 segundos. Cambia de pierna.\n5. Realiza 5 pasadas laterales: desliza el cuerpo hacia la derecha doblando esa rodilla mientras la pierna izquierda se estira. Sostén 5 segundos y cambia.',
 5, 'operativo_basico', 'oficiales/p08-estiramiento-piernas.svg'),

('P09',
 'Fortalecimiento de Hombros y Espalda Alta',
 E'1. De pie con los brazos a los lados, sube los hombros hacia las orejas. Sostén 10 segundos con tensión. Bájalos y sostén 10 segundos más abajo. Relaja. Repite 3 veces.\n2. Lleva las manos a los hombros. Con los codos dibuja 5 círculos grandes hacia adelante y 5 hacia atrás.\n3. Extiende los brazos al frente a la altura del hombro. Cierra los puños y flexiona los codos llevando las manos al pecho (remo). Extiende de nuevo. 8 repeticiones.\n4. Con los brazos cruzados al frente y puños cerrados, llévalos hacia atrás y abajo abriendo las manos con las palmas hacia afuera. Repite 5 veces.\n5. Lleva los brazos a la espalda, entrelaza los dedos y estira llevando los brazos hacia atrás y arriba. Sostén 8 segundos. Relaja.',
 5, 'operativo_basico', 'oficiales/p09-hombros-espalda.svg'),

('P10',
 'Pausa del Conductor — Estiramiento Completo',
 E'1. 🛑 Detén el vehículo en un lugar seguro antes de iniciar.\n2. Sal del vehículo. De pie, realiza 5 respiraciones profundas estirando los brazos al techo.\n3. Gira la cabeza hacia la derecha y hacia la izquierda lentamente. 5 veces por lado.\n4. Pon las manos en la cintura y rota la cadera en círculos: 5 veces a cada lado.\n5. Haz sentadillas superficiales con la espalda recta: 10 repeticiones lentas.\n6. Apoya la mano en el vehículo. Dobla una rodilla y jala el tobillo hacia los glúteos. Sostén 10 segundos por pierna.\n7. Estira los brazos al frente entrelazando los dedos. Lleva la cadera hacia adelante arqueando la espalda. Sostén 10 segundos.\n8. Camina alrededor del vehículo durante 2 minutos antes de retomar la conducción.\n\n✅ Realiza esta pausa cada 2 horas de conducción continua. Es obligatoria por normativa de SST.',
 10, 'conduccion_basico', 'oficiales/p10-pausa-conductor.svg'),

('P11',
 'Calentamiento General — Inicio de Jornada',
 E'1. De pie con los pies separados al ancho de hombros. Realiza 3 respiraciones profundas para activar.\n2. Cuello: gira la cabeza en semicírculo de derecha a izquierda (solo por el frente, no hacia atrás). 5 repeticiones.\n3. Hombros: rotaciones alternas hacia adelante y hacia atrás. 5 repeticiones cada dirección.\n4. Codos: con las manos en los hombros, dibuja 5 círculos adelante y 5 atrás con los codos.\n5. Cadera: manos en la cintura, rotaciones de cadera. 5 veces a cada lado.\n6. Rodillas: con las manos en las rodillas, dóblalas levemente y realiza pequeñas rotaciones. 5 veces.\n7. Tobillos: levanta un pie y rota el tobillo 3 veces a cada lado. Cambia de pie.\n8. Activación final: camina en el puesto levantando las rodillas durante 20 segundos.\n\n💡 Esta rutina completa prepara el cuerpo para la jornada y reduce lesiones desde el primer momento.',
 10, 'universal', 'oficiales/p11-calentamiento-general.svg'),

('P12',
 'Levántate y Muévete — Pausa Antiestática',
 E'1. Levántate de la silla. De pie junto a tu puesto.\n2. Estira todo el cuerpo: entrelaza los dedos, sube los brazos al techo y empínate en puntas de pie. Sostén 8 segundos. Repite 2 veces.\n3. Camina al menos 50 pasos (ve al baño, al comedor, o simplemente da una vuelta).\n4. Al regresar, de pie, haz 10 elevaciones de talones lentas.\n5. Realiza 5 sentadillas suaves (hasta 45°) con la espalda recta antes de volver a sentarte.\n6. Antes de sentarte, ajusta la postura: espalda recta apoyada en el espaldar, pies bien apoyados en el piso, pantalla a la altura de los ojos.\n\n⏰ Realiza esta pausa cada 2 horas si tu trabajo es sedentario. Recuerda: cada máximo 2 horas debes cambiar de postura.',
 5, 'universal', 'oficiales/p12-antiestatica.svg')

on conflict (codigo) do update set
  titulo = excluded.titulo,
  instrucciones = excluded.instrucciones,
  duracion_min = excluded.duracion_min,
  pack = excluded.pack,
  image_url = excluded.image_url;

-- ============================================================
-- Relaciones N:M con tipos_trabajo (idempotente)
-- ============================================================
with mapping(codigo, slugs) as (
  values
    ('P01'::text, array['oficina','ventas','atencion_cliente']),
    ('P02', array['oficina','ventas','atencion_cliente']),
    ('P03', array['oficina','ventas','atencion_cliente','bodega']),
    ('P04', array['oficina','ventas','atencion_cliente']),
    ('P05', array['oficina','ventas','atencion_cliente']),
    ('P06', array['operativo','bodega','conduccion']),
    ('P07', array['operativo','bodega','conduccion']),
    ('P08', array['operativo','bodega','conduccion']),
    ('P09', array['operativo','bodega']),
    ('P10', array['conduccion']),
    ('P11', array['oficina','operativo','conduccion','bodega','ventas','atencion_cliente']),
    ('P12', array['oficina','ventas','atencion_cliente'])
)
insert into public.pausas_oficiales_tipos_trabajo (pausa_oficial_id, tipo_id)
select p.id, t.id
from mapping m
join public.pausas_oficiales p on p.codigo = m.codigo
join public.tipos_trabajo t on t.slug = any(m.slugs)
on conflict do nothing;
