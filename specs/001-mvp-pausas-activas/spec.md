# Feature Specification: MVP Activa SST — Programación y Ejecución de Pausas Activas

**Feature Branch**: `001-mvp-pausas-activas`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "App de pausas activas. El prevencionista tiene la lista de trabajadores y crea alertas de notificación para que los trabajadores, a una hora definida por el prevencionista, hagan su pausa activa. El trabajador puede marcarla como hecha o rechazarla, y queda un registro. Cada pausa activa incluye instrucciones, una imagen o un video. Existe una biblioteca de pausas activas categorizadas por tipo de trabajo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Prevencionista programa una pausa activa para un grupo de trabajadores (Priority: P1)

El prevencionista entra a su panel, selecciona una pausa activa de la biblioteca (filtrando por tipo de trabajo), elige uno o más trabajadores de su lista, define la fecha/hora de la pausa y una ventana de validez (ej. 30 min), y publica la programación. Los trabajadores seleccionados reciben la notificación a esa hora.

**Why this priority**: Es el caso de uso central. Sin esto no hay producto. Activa el resto de las funciones (recepción, registro, reporte).

**Independent Test**: Crear una pausa, programarla para un único trabajador de prueba con notificación inmediata, verificar que llega y se ve en su PWA.

**Acceptance Scenarios**:

1. **Given** un prevencionista autenticado con al menos 1 trabajador y 1 pausa en biblioteca, **When** programa la pausa para ese trabajador con hora actual + 1 minuto, **Then** el trabajador recibe push web y/o banner in-app con título e instrucciones dentro de la ventana de validez.
2. **Given** una programación creada, **When** el prevencionista entra a su panel, **Then** ve la programación con estado "pendiente" y la lista de trabajadores asignados.
3. **Given** un prevencionista, **When** intenta programar una pausa para un trabajador que no pertenece a su empresa, **Then** el sistema lo rechaza con mensaje claro.

---

### User Story 2 — Trabajador recibe y responde una pausa activa (Priority: P1)

El trabajador recibe una notificación push web. Al abrirla (o al abrir la PWA dentro de la ventana de validez), ve la pausa con título, instrucciones y la imagen o video. Tiene dos acciones: "Hecha" o "Rechazar". Si rechaza, se le pide motivo (lista cerrada + texto libre opcional). Su respuesta queda registrada inmutable.

**Why this priority**: El bucle se cierra aquí. Sin respuesta no hay registro ni evidencia.

**Independent Test**: Abrir la PWA como trabajador con una pausa pendiente, marcar "Hecha", verificar que el estado cambia y queda registro con timestamp servidor.

**Acceptance Scenarios**:

1. **Given** una programación dentro de la ventana de validez, **When** el trabajador marca "Hecha", **Then** el registro se guarda con `estado=hecha`, `respondido_en` = ahora (servidor), y el banner desaparece.
2. **Given** una programación dentro de la ventana, **When** el trabajador marca "Rechazar" y selecciona un motivo, **Then** se guarda con `estado=rechazada` y `motivo` registrado.
3. **Given** una programación cuya ventana de validez ya expiró, **When** el trabajador la abre, **Then** ve estado "vencida" y no puede responder.
4. **Given** el trabajador sin conexión, **When** marca "Hecha", **Then** la respuesta se encola y se envía al reconectar (idempotente, no duplica).

---

### User Story 3 — Prevencionista construye una pausa activa desde cero (Priority: P2)

El prevencionista entra a la biblioteca, crea una nueva pausa con: título, instrucciones (texto), duración estimada (minutos), tipo de trabajo (al menos uno), y sube imagen o video (uno de los dos al menos). La pausa queda disponible para programar.

**Why this priority**: Necesario para que la biblioteca crezca, pero el MVP puede salir con 5–10 pausas precargadas. Es P2 porque se puede crear contenido por SQL inicial.

**Independent Test**: Crear una pausa con video desde el panel, verificar que aparece en la biblioteca filtrable por tipo de trabajo.

**Acceptance Scenarios**:

1. **Given** un prevencionista, **When** crea una pausa con título, instrucciones y una imagen, **Then** la pausa queda visible en la biblioteca para él y otros prevencionistas de su empresa.
2. **Given** un intento de creación, **When** falta tanto imagen como video, **Then** el sistema impide guardar y muestra error.
3. **Given** un video subido, **When** excede el tamaño máximo (ej. 50MB), **Then** el sistema rechaza con mensaje y sugiere comprimir.

---

### User Story 4 — Prevencionista descarga reporte mensual de cumplimiento (Priority: P1)

El prevencionista entra a `/prevencionista/reportes`, selecciona un mes (o rango de fechas) y opcionalmente un subgrupo de trabajadores, y ve métricas: total de pausas programadas, % hechas, % rechazadas (con motivos agregados), % vencidas, ranking de trabajadores por cumplimiento. Descarga el **reporte mensual en PDF** (evidencia legal de cumplimiento Resolución 0312 de 2019 SG-SST) y/o **CSV detallado**.

**Why this priority**: Sin reporte descargable mensual, la app no acredita cumplimiento ante ARL/SG-SST y pierde su valor diferencial frente a la competencia. Es entregable comercial obligatorio.

**Independent Test**: Con al menos 3 programaciones respondidas, descargar el PDF del mes y verificar: cabecera con empresa+NIT+periodo, totales agregados, tabla detallada por trabajador+pausa+estado, pie con firma de generación.

**Acceptance Scenarios**:

1. **Given** registros en el periodo, **When** el prevencionista filtra por mes, **Then** ve totales y porcentajes que cuadran con los registros visibles.
2. **Given** una solicitud de export CSV, **When** confirma, **Then** descarga un CSV con una fila por registro (fecha, cédula, nombre, tipo_trabajo, pausa, estado, respondido_en, motivo).
3. **Given** una solicitud de PDF mensual, **When** confirma, **Then** descarga un PDF A4 con encabezado (logo empresa, NIT, mes, leyenda "Evidencia de cumplimiento de pausas activas — Resolución 0312 de 2019 SST"), tabla resumen, tabla detallada y pie con timestamp de generación + nombre del prevencionista que lo emitió.

---

### User Story 5 — Prevencionista da de alta trabajadores (Priority: P1)

El prevencionista da de alta trabajadores por tres caminos: (a) **alta individual** con cédula, nombre, apellidos, correo corporativo y tipo(s) de trabajo; (b) **mini-pegado** de una lista corta `cédula,correo` (1 por línea) cuando solo conoce el dato mínimo; (c) **import CSV** completo. En los tres casos el sistema crea un pre-registro en `usuarios` con `estado=pendiente`, agrega el email al whitelist y envía magic link. La primera vez que el trabajador entra completa o confirma sus datos faltantes y acepta el consentimiento Habeas Data.

**Why this priority**: El whitelist es bloqueante para FR-019 (no se permite alta espontánea). Sin un alta cómoda, el prevencionista no puede operar la app con la empresa.

**Independent Test**: Pegar 3 filas `cédula,correo`, verificar que se crean 3 pre-registros, llegan los correos, cada trabajador completa el primer login y queda con `estado=activo`.

**Acceptance Scenarios**:

1. **Given** un prevencionista, **When** agrega 1 trabajador en modo individual con datos completos, **Then** se crea el pre-registro y se envía magic link al correo indicado.
2. **Given** un CSV válido, **When** se sube, **Then** se crean los trabajadores y se les envía correo de invitación.
3. **Given** un CSV con cédula duplicada dentro de la empresa, **When** se procesa, **Then** se omite ese registro y se reporta en el resumen.
4. **Given** un trabajador pre-registrado, **When** entra por primera vez con magic link, **Then** ve un formulario para completar/confirmar nombre, apellidos y tipo(s) de trabajo, y queda `activo` al guardar.
5. **Given** el cupo del plan está lleno, **When** el prevencionista intenta agregar un trabajador adicional, **Then** el sistema lo rechaza con mensaje "Has alcanzado el límite de tu plan ({max_trabajadores}). Actualiza tu plan para sumar más usuarios.".

---

### User Story 6 — Programación recurrente (Priority: P3)

El prevencionista programa una pausa que se repite (ej. todos los días laborales a las 10:00 y 15:00) durante un rango de fechas, en lugar de tener que crear cada ocurrencia.

**Why this priority**: Quality-of-life importante pero el MVP puede vivir con programaciones individuales o por día.

**Independent Test**: Crear una recurrencia lunes-viernes 10:00 por 1 semana, verificar 5 ocurrencias.

**Acceptance Scenarios**:

1. **Given** una recurrencia diaria laboral por 5 días, **When** se guarda, **Then** se generan 5 programaciones individuales con sus respectivos disparos.

---

### User Story 7 — Acceso solo por whitelist autorizado (Priority: P1)

Solo pueden iniciar sesión los correos que el prevencionista (o el empresa_admin) haya pre-registrado previamente. Cualquier intento de magic link con un correo no autorizado es rechazado silenciosamente (no se filtra existencia de cuentas). El prevencionista controla 100% del padrón de su empresa.

**Why this priority**: Es requisito de seguridad y compliance (Habeas Data + control de datos por empresa). Sin esto cualquier persona podría auto-registrarse en una empresa que no le corresponde. Bloqueante para piloto comercial.

**Independent Test**: Intentar pedir magic link con correo no registrado → no se envía. Pedir magic link con correo registrado por prevencionista → llega y permite login.

**Acceptance Scenarios**:

1. **Given** un correo `juan@empresa.com` NO pre-registrado, **When** lo escribe en `/login` y solicita magic link, **Then** el sistema responde con mensaje genérico "Si tu correo está autorizado, recibirás un enlace de acceso" SIN enviar correo.
2. **Given** un correo pre-registrado por el prevencionista, **When** solicita magic link, **Then** recibe el correo y al hacer click queda autenticado con el rol y empresa que le asignó el prevencionista.
3. **Given** un prevencionista crea un trabajador, **When** lo guarda, **Then** el correo queda activo en el whitelist (`usuarios.email`) listo para login.
4. **Given** un prevencionista elimina/desactiva un trabajador, **When** se confirma, **Then** el correo deja de funcionar para futuros magic links (sesiones activas pueden expirar al cerrar).

---

### User Story 8 — Planes y límite de cupo por empresa (Priority: P1)

Cada empresa tiene asignado un plan (gratis, starter, growth, business, enterprise) que define cuántos trabajadores activos puede tener simultáneamente. Al intentar agregar un trabajador cuando se alcanza el límite, el sistema lo rechaza y sugiere actualizar el plan. El prevencionista ve siempre el contador "X / Y trabajadores activos" en su panel.

**Why this priority**: Sin esto no hay modelo de monetización ni control de costos. Replicamos la estructura de planes por cantidad ya validada en SSTLink.

**Independent Test**: Empresa con plan gratis (5 cupos) ya tiene 5 trabajadores activos → intentar crear el 6° → rechazo claro.

**Acceptance Scenarios**:

1. **Given** una empresa con plan que permite N trabajadores y N activos, **When** el prevencionista intenta crear el N+1, **Then** el sistema rechaza con error explícito mencionando el límite del plan actual.
2. **Given** una empresa, **When** el prevencionista entra a `/prevencionista/trabajadores`, **Then** ve el contador "X / Y activos — Plan {nombre}" visible en la cabecera.
3. **Given** una empresa que sube de plan (gratis → starter), **When** se actualiza `empresas.plan_id`, **Then** el nuevo límite aplica inmediatamente sin tocar trabajadores existentes.
4. **Given** trabajadores desactivados (`estado=inactivo`), **When** se cuenta el cupo, **Then** NO se incluyen (solo cuentan `activo` y `pendiente`).

---

### Edge Cases

- Trabajador rechaza el permiso de notificaciones del navegador → la app MUST seguir mostrando banner in-app y un recordatorio para volver a habilitar.
- Trabajador en iOS Safari sin soporte completo de push → fallback a banner in-app y, opcionalmente, correo de cortesía.
- Cambio de zona horaria del dispositivo entre programación y disparo → la hora de disparo se evalúa en zona horaria de la empresa (no del dispositivo).
- Trabajador desactivado/desvinculado de la empresa después de programar → las programaciones futuras a ese trabajador se cancelan.
- Pausa con video pesado en conexión 3G → la app MUST mostrar primero instrucciones de texto y poster del video, y permitir reproducir bajo demanda.
- Misma pausa programada dos veces solapando ventanas → el trabajador ve dos tarjetas separadas y responde cada una; no se colapsan.
- Borrado de una pausa de biblioteca que tiene registros históricos → la pausa se marca `archivada=true` (soft delete); no se elimina para no romper reportes.
- Trabajador intenta login con correo NO pre-registrado → respuesta neutra (mismo mensaje que cuando sí existe) para no filtrar el padrón. No se envía correo.
- Cupo del plan se reduce (ej. downgrade) por debajo del número de trabajadores activos → no se desactiva a nadie; se bloquean futuras altas hasta que la empresa regularice (desactive o suba de plan). Banner persistente en el panel.
- Trabajador pre-registrado intenta confirmar datos después de que el prevencionista lo desactivó → se le muestra "Tu cuenta fue desactivada por el administrador. Contacta a tu prevencionista." y no se completa la activación.
- Reporte mensual con 0 pausas en el periodo → el PDF se genera igual con leyenda "Sin actividad registrada en el periodo" para que sirva como evidencia de que se consultó.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST soportar tres roles: `prevencionista`, `trabajador`, `empresa_admin`, con permisos diferenciados aplicados vía RLS de Supabase.
- **FR-002**: Un prevencionista MUST poder crear, editar y archivar pausas activas con: título, instrucciones (markdown ligero), duración estimada (min), una o más categorías de tipo de trabajo, y al menos un media (imagen o video).
- **FR-003**: El sistema MUST permitir filtrar la biblioteca de pausas por tipo de trabajo y por texto del título/instrucciones.
- **FR-004**: Un prevencionista MUST poder programar una pausa para uno o más trabajadores definiendo: fecha y hora de disparo, ventana de validez en minutos, y opcionalmente recurrencia.
- **FR-005**: El sistema MUST enviar notificación push web al trabajador a la hora programada cuando éste haya autorizado notificaciones.
- **FR-006**: El sistema MUST mostrar la pausa pendiente como banner in-app al abrir la PWA durante la ventana de validez, incluso si no se recibió o no se aceptó el push.
- **FR-007**: El trabajador MUST poder responder con "Hecha" o "Rechazar". Rechazar MUST requerir un motivo (lista cerrada + comentario opcional).
- **FR-008**: Toda respuesta MUST generar un registro inmutable (`pausa_registros`) con timestamp servidor, sin posibilidad de edición o borrado por usuario.
- **FR-009**: El sistema MUST cerrar automáticamente como `vencida` toda programación no respondida al expirar la ventana de validez.
- **FR-010**: Un trabajador MUST poder ver su historial personal de pausas (últimas 30 mínimo).
- **FR-011**: Un prevencionista MUST poder ver un reporte de cumplimiento filtrable por fechas y trabajadores, con métricas: total, % hechas, % rechazadas (con motivos agregados), % vencidas.
- **FR-012**: Un prevencionista MUST poder exportar el reporte a CSV.
- **FR-013**: Un prevencionista MUST poder dar de alta trabajadores en tres modos: (a) alta individual completa (cédula, nombre, apellidos, correo, tipos de trabajo); (b) mini-pegado `cédula,correo` por línea; (c) import CSV completo. Validación de duplicados por `(empresa_id, documento)` y `(empresa_id, email)`. Modos (b) y (c) crean pre-registros con `estado=pendiente` que el trabajador completa en su primer login.
- **FR-014**: El sistema MUST instalarse como PWA en Android e iOS con icono y splash, y funcionar offline para: ver pausa pendiente cacheada y encolar respuesta hasta reconectar.
- **FR-015**: El sistema MUST exponer un punto de entrada autenticado (link con sesión) consumible desde SSTLink para abrir la app del trabajador o el panel del prevencionista.
- **FR-016**: El sistema MUST registrar consentimiento explícito del trabajador (Habeas Data, Ley 1581) antes de almacenar respuestas o enviar notificaciones, y permitir revocarlo en cualquier momento.
- **FR-017**: Las respuestas en modo offline MUST ser idempotentes mediante un client-side `response_uuid` para evitar duplicados al sincronizar.
- **FR-018**: Las imágenes y videos MUST almacenarse en Supabase Storage con políticas que solo permitan lectura a trabajadores de la misma empresa que tengan al menos una programación de esa pausa.
- **FR-019**: El sistema MUST rechazar todo intento de magic link cuyo email no exista en `public.usuarios` con `estado IN ('pendiente','activo')`. La respuesta al cliente MUST ser neutra (mismo texto que cuando el email sí existe) para no filtrar el padrón.
- **FR-020**: Cada empresa MUST tener un `plan_id` asignado (default `gratis`). El sistema MUST tener una tabla `planes` con `slug`, `nombre`, `max_trabajadores`, `precio_mes_cop`, `activo`.
- **FR-021**: Un trigger BEFORE INSERT/UPDATE en `usuarios` MUST rechazar la operación si el conteo de trabajadores con `estado IN ('pendiente','activo')` para esa empresa excedería el `max_trabajadores` del plan vigente. El error MUST incluir el nombre del plan y el límite.
- **FR-022**: El sistema MUST exponer tres modos de alta de trabajadores con la misma semántica de whitelist + pre-registro: (a) individual, (b) mini-pegado `cédula,correo`, (c) CSV completo.
- **FR-023**: En el primer login de un trabajador `pendiente`, el sistema MUST presentar un formulario para completar/confirmar nombre, apellidos y tipos de trabajo, marcando `estado=activo` al guardar. El consentimiento Habeas Data (FR-016) MUST presentarse en el mismo flujo.
- **FR-024**: El sistema MUST permitir generar un **reporte mensual PDF** descargable por el prevencionista, con: cabecera (logo empresa + NIT + mes + leyenda "Evidencia de cumplimiento de pausas activas — Resolución 0312 de 2019 SST"), tabla resumen (total, % hechas/rechazadas/vencidas, top motivos), tabla detallada (fecha, cédula, nombre, tipo trabajo, pausa, estado, respondido_en, motivo), pie con timestamp de generación y prevencionista emisor. Generación client-side con `jsPDF` para MVP.

### Key Entities

- **Empresa**: cliente del producto. Atributos: nombre, NIT, zona horaria, configuración de notificaciones por defecto, **plan_id** (FK a `planes`), logo_url (para el PDF).
- **Plan**: tier comercial. Atributos: slug (`gratis|starter|growth|business|enterprise`), nombre, max_trabajadores, precio_mes_cop, activo. Estructura espejo de SSTLink.
- **Usuario**: cuenta de acceso (auth). Atributos base + rol + **estado** (`pendiente|activo|inactivo`). El email funciona como whitelist de login.
- **Prevencionista**: usuario con rol `prevencionista`, asociado a una o más empresas.
- **Trabajador**: usuario con rol `trabajador`, asociado a una empresa, con tipo de trabajo (1+), estado, suscripción push. Cuando es `pendiente` solo requiere `cédula+email`; completa el resto en su primer login.
- **Pausa**: contenido reutilizable. Atributos: título, instrucciones, duración, categorías (tipos de trabajo), media (image_url y/o video_url), creador, empresa propietaria, archivada.
- **TipoTrabajo**: catálogo (oficina, operativo, conducción, bodega, ventas, etc.).
- **Programación**: instancia agendada. Atributos: pausa, trabajadores asignados, disparo (timestamp), ventana_validez_min, recurrencia opcional, estado global, creador.
- **PausaRegistro**: respuesta individual. Atributos: programación, trabajador, estado (hecha/rechazada/vencida), respondido_en, motivo, response_uuid, dispositivo (user agent básico para auditoría).
- **SuscripcionPush**: endpoint y claves Web Push por dispositivo del trabajador.
- **Consentimiento**: registro de aceptación de tratamiento de datos por trabajador, con versión del aviso aceptado y timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un prevencionista nuevo puede crear su primera programación en menos de 5 minutos desde su primer login.
- **SC-002**: ≥ 70% de las pausas programadas son respondidas (hecha o rechazada) dentro de la ventana de validez por trabajadores activos en el primer mes piloto.
- **SC-003**: El tiempo desde que se dispara una programación hasta que el trabajador ve el banner in-app (al abrir la PWA) es ≤ 2 segundos en 4G.
- **SC-004**: 0 fugas de datos entre empresas: ninguna prueba de penetración o auditoría RLS encuentra acceso cruzado.
- **SC-005**: La PWA obtiene Lighthouse mobile ≥ 80 performance y ≥ 90 accesibilidad en las rutas de login trabajador y ejecución de pausa.
- **SC-006**: La exportación CSV de un mes de actividad de 100 trabajadores termina en < 10 segundos.
- **SC-007**: Tasa de respuestas duplicadas por sincronización offline = 0 (gracias a `response_uuid`).

## Assumptions

- El piloto inicial corre con empresas pequeñas (5–50 trabajadores) en Colombia, en español.
- Cada empresa configura una sola zona horaria (no se soporta multi-tz por empresa en MVP).
- Los trabajadores cuentan con un smartphone con navegador moderno (Chrome Android ≥ 100, Safari iOS ≥ 16.4 para push, fallback a banner in-app en versiones inferiores).
- El correo electrónico es el canal de invitación inicial (envío vía Supabase Auth / Resend).
- Supabase Storage es suficiente para media; no se requiere CDN externo en MVP (revisar si la biblioteca crece > 200 videos).
- La autenticación se maneja con Supabase Auth (email + magic link) **restringido por whitelist** (`public.usuarios.email`); no se permite auto-registro. No se incluye SSO empresarial en MVP.
- La integración con SSTLink se hace inicialmente vía link autenticado, no por SDK compartido.
- **Planes de pago**: el MVP define la estructura de planes (tabla `planes` + `empresas.plan_id` + límite por cupo) pero NO incluye pasarela de pago. Los planes se asignan manualmente por el equipo de Activa SST en MVP; la pasarela queda para iteración posterior.
- El reporte mensual PDF se genera client-side con `jsPDF` en MVP. Si crece la demanda o se requieren PDFs > 5MB, se migrará a generación server-side en Edge Function.
