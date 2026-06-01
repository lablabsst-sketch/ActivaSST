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

### User Story 4 — Prevencionista ve reporte de cumplimiento (Priority: P2)

El prevencionista entra a la sección de reportes, selecciona un rango de fechas y/o un grupo de trabajadores, y ve métricas: total de pausas programadas, % hechas, % rechazadas (con motivos agregados), % vencidas, ranking de trabajadores por cumplimiento. Puede exportar a CSV.

**Why this priority**: Es el entregable comercial para ARL/SG-SST. Sin esto el producto pierde valor, pero el MVP puede salir con reporte básico (sin export).

**Independent Test**: Con al menos 3 programaciones respondidas, verificar que el reporte muestra conteos correctos.

**Acceptance Scenarios**:

1. **Given** registros en el periodo, **When** el prevencionista filtra por mes, **Then** ve totales y porcentajes que cuadran con los registros visibles.
2. **Given** una solicitud de export, **When** confirma, **Then** descarga un CSV con una fila por registro.

---

### User Story 5 — Prevencionista importa lista de trabajadores (Priority: P2)

El prevencionista importa trabajadores por CSV (nombre, documento, correo, tipo de trabajo) o los agrega uno a uno. Cada trabajador recibe un correo con un enlace mágico para registrarse y autorizar notificaciones la primera vez.

**Why this priority**: Reduce la fricción de onboarding. Sin esto el prevencionista debe agregar de uno en uno (manejable para empresas pequeñas, crítico desde ~20 trabajadores).

**Independent Test**: Subir un CSV con 3 filas válidas, verificar que se crean 3 trabajadores y reciben correo.

**Acceptance Scenarios**:

1. **Given** un CSV válido, **When** se sube, **Then** se crean los trabajadores y se les envía correo de invitación.
2. **Given** un CSV con un documento duplicado dentro de la empresa, **When** se procesa, **Then** se omite ese registro y se reporta en el resumen.

---

### User Story 6 — Programación recurrente (Priority: P3)

El prevencionista programa una pausa que se repite (ej. todos los días laborales a las 10:00 y 15:00) durante un rango de fechas, en lugar de tener que crear cada ocurrencia.

**Why this priority**: Quality-of-life importante pero el MVP puede vivir con programaciones individuales o por día.

**Independent Test**: Crear una recurrencia lunes-viernes 10:00 por 1 semana, verificar 5 ocurrencias.

**Acceptance Scenarios**:

1. **Given** una recurrencia diaria laboral por 5 días, **When** se guarda, **Then** se generan 5 programaciones individuales con sus respectivos disparos.

---

### Edge Cases

- Trabajador rechaza el permiso de notificaciones del navegador → la app MUST seguir mostrando banner in-app y un recordatorio para volver a habilitar.
- Trabajador en iOS Safari sin soporte completo de push → fallback a banner in-app y, opcionalmente, correo de cortesía.
- Cambio de zona horaria del dispositivo entre programación y disparo → la hora de disparo se evalúa en zona horaria de la empresa (no del dispositivo).
- Trabajador desactivado/desvinculado de la empresa después de programar → las programaciones futuras a ese trabajador se cancelan.
- Pausa con video pesado en conexión 3G → la app MUST mostrar primero instrucciones de texto y poster del video, y permitir reproducir bajo demanda.
- Misma pausa programada dos veces solapando ventanas → el trabajador ve dos tarjetas separadas y responde cada una; no se colapsan.
- Borrado de una pausa de biblioteca que tiene registros históricos → la pausa se marca `archivada=true` (soft delete); no se elimina para no romper reportes.

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
- **FR-013**: Un prevencionista MUST poder importar trabajadores vía CSV con validación de duplicados por documento dentro de su empresa.
- **FR-014**: El sistema MUST instalarse como PWA en Android e iOS con icono y splash, y funcionar offline para: ver pausa pendiente cacheada y encolar respuesta hasta reconectar.
- **FR-015**: El sistema MUST exponer un punto de entrada autenticado (link con sesión) consumible desde SSTLink para abrir la app del trabajador o el panel del prevencionista.
- **FR-016**: El sistema MUST registrar consentimiento explícito del trabajador (Habeas Data, Ley 1581) antes de almacenar respuestas o enviar notificaciones, y permitir revocarlo en cualquier momento.
- **FR-017**: Las respuestas en modo offline MUST ser idempotentes mediante un client-side `response_uuid` para evitar duplicados al sincronizar.
- **FR-018**: Las imágenes y videos MUST almacenarse en Supabase Storage con políticas que solo permitan lectura a trabajadores de la misma empresa que tengan al menos una programación de esa pausa.

### Key Entities

- **Empresa**: cliente del producto. Atributos: nombre, NIT, zona horaria, configuración de notificaciones por defecto.
- **Usuario**: cuenta de acceso (auth). Atributos base + rol.
- **Prevencionista**: usuario con rol `prevencionista`, asociado a una o más empresas.
- **Trabajador**: usuario con rol `trabajador`, asociado a una empresa, con tipo de trabajo (1+), estado activo/inactivo, suscripción push.
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
- La autenticación se maneja con Supabase Auth (email + magic link); no se incluye SSO empresarial en MVP.
- La integración con SSTLink se hace inicialmente vía link autenticado, no por SDK compartido.
- La facturación / planes de pago se diseñan en una iteración posterior; el MVP asume cuentas creadas manualmente por el equipo de Activa SST.
