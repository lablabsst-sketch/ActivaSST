
-- ============ consentimientos: campos adicionales ============
ALTER TABLE public.consentimientos
  ADD COLUMN IF NOT EXISTS ip_origen text,
  ADD COLUMN IF NOT EXISTS finalidades_aceptadas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS revocado_motivo text;

-- ============ politicas_tratamiento ============
CREATE TABLE IF NOT EXISTS public.politicas_tratamiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  contenido_md text NOT NULL,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.politicas_tratamiento TO anon, authenticated;
GRANT ALL ON public.politicas_tratamiento TO service_role;

ALTER TABLE public.politicas_tratamiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS politicas_public_read ON public.politicas_tratamiento;
CREATE POLICY politicas_public_read ON public.politicas_tratamiento
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============ solicitudes_arco ============
DO $$ BEGIN
  CREATE TYPE public.arco_tipo AS ENUM ('acceso','rectificacion','cancelacion','oposicion','revocacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.arco_estado AS ENUM ('pendiente','en_revision','resuelta','rechazada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.solicitudes_arco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo public.arco_tipo NOT NULL,
  descripcion text NOT NULL,
  estado public.arco_estado NOT NULL DEFAULT 'pendiente',
  respuesta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resuelta_at timestamptz,
  resuelta_por uuid REFERENCES public.usuarios(id)
);

CREATE INDEX IF NOT EXISTS solicitudes_arco_empresa_estado_idx
  ON public.solicitudes_arco(empresa_id, estado);
CREATE INDEX IF NOT EXISTS solicitudes_arco_usuario_idx
  ON public.solicitudes_arco(usuario_id);

GRANT SELECT, INSERT, UPDATE ON public.solicitudes_arco TO authenticated;
GRANT ALL ON public.solicitudes_arco TO service_role;

ALTER TABLE public.solicitudes_arco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arco_select_self ON public.solicitudes_arco;
CREATE POLICY arco_select_self ON public.solicitudes_arco
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS arco_select_staff ON public.solicitudes_arco;
CREATE POLICY arco_select_staff ON public.solicitudes_arco
  FOR SELECT TO authenticated
  USING (
    empresa_id = current_empresa_id()
    AND current_rol() IN ('prevencionista','empresa_admin')
  );

DROP POLICY IF EXISTS arco_insert_self ON public.solicitudes_arco;
CREATE POLICY arco_insert_self ON public.solicitudes_arco
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND empresa_id = current_empresa_id()
    AND estado = 'pendiente'
  );

DROP POLICY IF EXISTS arco_update_staff ON public.solicitudes_arco;
CREATE POLICY arco_update_staff ON public.solicitudes_arco
  FOR UPDATE TO authenticated
  USING (
    empresa_id = current_empresa_id()
    AND current_rol() IN ('prevencionista','empresa_admin')
  )
  WITH CHECK (
    empresa_id = current_empresa_id()
    AND current_rol() IN ('prevencionista','empresa_admin')
  );

-- ============ Semilla: política v1 ============
INSERT INTO public.politicas_tratamiento (version, contenido_md, vigente, vigente_desde)
VALUES (
  'v1-2026-06',
  $POL$
# Política de Tratamiento de Datos Personales — Activa SST

**Versión:** v1-2026-06
**Última actualización:** 12 de junio de 2026

## 1. Responsable del tratamiento

**Razón social:** Lab Lab SAS (operador de la plataforma Activa SST).
**NIT:** [editable desde el perfil de empresa]
**Dirección:** Bogotá D.C., Colombia.
**Correo de tratamiento de datos:** tratamiento@activasst.co
**Teléfono:** (+57) 601 000 0000

## 2. Marco legal

Esta política se rige por la **Ley 1581 de 2012**, el **Decreto 1377 de 2013**,
la **Resolución 0312 de 2019** del Ministerio del Trabajo (estándares mínimos
del SG-SST) y demás normas concordantes en materia de protección de datos
personales y seguridad y salud en el trabajo.

## 3. Finalidades del tratamiento

Los datos personales del titular se tratan con las siguientes finalidades:

1. Gestionar la programación, ejecución y registro de **pausas activas** dentro
   del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST).
2. Cumplir las obligaciones derivadas de la **Resolución 0312 de 2019** y demás
   normas SST aplicables a la empresa contratante.
3. Generar indicadores y reportes de **adherencia** y cobertura para el
   prevencionista y la empresa.
4. Enviar comunicaciones operativas: recordatorios de pausa, notificaciones
   de cambio de programación y respuesta a solicitudes del titular.
5. Atender auditorías legales o requerimientos de autoridades competentes.
6. Conservar el histórico de cumplimiento como **soporte probatorio** del SG-SST.

## 4. Tipos de datos tratados

- **Identificación:** nombre, apellidos, documento de identidad, correo electrónico.
- **Laboral:** empresa, cargo o tipo de trabajo asignado.
- **Datos sensibles (salud ocupacional):** registro de pausas completadas,
  postpuestas u omitidas, indicadores de adherencia y eventos relacionados
  con la prevención de desórdenes musculoesqueléticos.

> El titular reconoce que los datos del numeral anterior incluyen **datos
> sensibles** en los términos del artículo 5 de la Ley 1581 de 2012, y
> autoriza expresamente su tratamiento para las finalidades aquí descritas.

## 5. Derechos del titular

Como titular de los datos, usted tiene derecho a:

- **Conocer, actualizar y rectificar** sus datos personales.
- **Solicitar prueba** del consentimiento otorgado.
- **Ser informado** sobre el uso dado a sus datos.
- **Presentar quejas** ante la Superintendencia de Industria y Comercio (SIC).
- **Revocar** el consentimiento y/o **solicitar la supresión** del dato,
  siempre que no exista un deber legal o contractual de conservación.
- **Acceder de forma gratuita** a sus datos.

## 6. Canales para ejercer sus derechos

1. Dentro de la aplicación: sección **Mi perfil → Mis derechos (Habeas Data)**.
2. Correo electrónico: **tratamiento@activasst.co**.

La empresa responderá en un plazo máximo de **diez (10) días hábiles**
prorrogables hasta por cinco (5) días hábiles adicionales, conforme al
artículo 14 de la Ley 1581 de 2012.

## 7. Tiempo de conservación

Los datos se conservan mientras la relación laboral del titular con la
empresa contratante se mantenga vigente, y por un período adicional de
**veinte (20) años** como soporte del SG-SST, conforme a la Resolución
0312 de 2019 y al artículo 28 del Decreto 1072 de 2015.

## 8. Transferencias y transmisiones

La información se almacena en la infraestructura de **Supabase, Inc.**
(servidores ubicados en Estados Unidos). El titular autoriza expresamente
esta transferencia internacional, entendiendo que el proveedor cumple con
estándares equivalentes de seguridad de la información (SOC 2 Tipo II,
cifrado en tránsito y reposo).

## 9. Medidas de seguridad

Activa SST implementa controles técnicos y administrativos para proteger
los datos: autenticación por enlace mágico de un solo uso, cifrado TLS
1.2+, control de acceso por rol y políticas de aislamiento por empresa
(Row-Level Security).

## 10. Vigencia y modificaciones

La presente política rige a partir de su publicación. Cualquier modificación
sustancial será comunicada a través de la aplicación y exigirá una nueva
aceptación del titular en su próximo inicio de sesión.
$POL$,
  true,
  now()
)
ON CONFLICT (version) DO NOTHING;
