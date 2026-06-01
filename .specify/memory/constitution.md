<!--
SYNC IMPACT REPORT
Version: 0.0.0 → 1.0.0
Bump rationale: Initial ratification (MAJOR — establishes governance baseline).
Modified principles: N/A (initial creation)
Added sections: Core Principles, Technology & Product Constraints, Development Workflow, Governance
Removed sections: None
Templates requiring updates:
  ✅ .specify/templates/spec-template.md (no changes required)
  ✅ .specify/templates/plan-template.md (no changes required)
  ✅ .specify/templates/tasks-template.md (no changes required)
Follow-up TODOs: None
-->

# Activa SST Constitution

## Core Principles

### I. Mobile-First PWA (NON-NEGOTIABLE)

El producto se diseña, codifica y prueba primero para móvil. Toda interfaz MUST funcionar
como Progressive Web App instalable, con soporte offline básico y notificaciones push web.
Razón: los trabajadores reciben pausas activas durante su jornada, mayoritariamente desde
teléfono, sin garantía de instalar apps nativas en Colombia.

### II. Roles y Permisos Estrictos (RLS-First)

Cada acceso a datos MUST estar protegido por Row Level Security de Supabase y validado a
nivel de UI y API. Existen tres roles base: `prevencionista`, `trabajador`, `empresa_admin`.
Ningún rol puede ver datos que no le correspondan, ni siquiera por error de cliente.
Razón: los datos de salud ocupacional son sensibles y regulados por la Ley 1581 de 2012
(Habeas Data Colombia) y el SG-SST.

### III. Registro Auditable e Inmutable

Toda acción del trabajador sobre una pausa (hecho / rechazado / no respondido) MUST
generar un registro con timestamp servidor, no editable, con el id del trabajador, la
pausa programada, el resultado y, si aplica, motivo de rechazo. La tabla de registros
MUST ser append-only (sin UPDATE/DELETE para usuarios).
Razón: el prevencionista necesita evidencia legal y métricas para reportes ARL/SG-SST.

### IV. Contenido Reutilizable y Categorizado

Las pausas activas son entidades de contenido reutilizables: título, instrucciones,
duración estimada, imagen y/o video, y al menos una categoría de tipo de trabajo
(ej. `oficina`, `operativo`, `conduccion`, `bodega`, `ventas`). Una pausa NUNCA se duplica
por trabajador; se referencia desde la programación.
Razón: el prevencionista construye una vez y asigna a muchos; reduce fricción operativa.

### V. Notificaciones Resilientes

El sistema de alertas MUST combinar push web (canal principal) con banner in-app cuando
el trabajador abre la PWA, de modo que una pausa perdida siga siendo visible y respondible
durante la ventana de validez definida por el prevencionista. Si el navegador no soporta
push, el banner in-app MUST seguir funcionando.
Razón: en Colombia el soporte de push web en iOS Safari es parcial y variable; el banner
in-app garantiza que ningún trabajador quede fuera.

## Technology & Product Constraints

- **Stack frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui.
- **PWA**: vite-plugin-pwa con Workbox; `manifest.webmanifest` con iconos 192/512 y
  `display: standalone`; Service Worker para offline shell y cola de respuestas.
- **Backend / Datos**: Supabase (Auth, Postgres con RLS, Storage para imágenes/videos,
  Edge Functions para envío de push y cron de programaciones).
- **Notificaciones**: Web Push API + VAPID, suscripciones almacenadas en Supabase.
- **Despliegue**: Lovable sincronizado con GitHub (mismo flujo que SSTalent/SSTLink).
- **Independencia + integración**: el repo y el proyecto Supabase son independientes,
  pero la app MUST exponer un punto de integración (SSO o redirección autenticada) para
  ser embebida o linkeada desde SSTLink como módulo del ecosistema lablabsst.
- **Cumplimiento**: tratamiento de datos personales según Ley 1581 de 2012 y el
  Decreto 1377 de 2013; aviso de privacidad y autorización explícita del trabajador antes
  de recibir notificaciones o registrar respuestas.
- **Idioma**: español de Colombia por defecto en toda la UI y contenido.

## Development Workflow

- **Spec-Driven**: todo cambio funcional MUST pasar por spec → plan → tasks antes de
  implementarse. Commits sin spec asociado SHOULD ser rechazados en review.
- **Branching**: `main` protegida; features en `NNN-nombre-corto` siguiendo numeración
  secuencial de spec-kit.
- **Migraciones**: cada cambio de esquema Supabase MUST entregarse como migración SQL
  versionada dentro del repo (`supabase/migrations/`), nunca solo aplicada en consola.
- **RLS antes de UI**: una tabla nueva no se considera lista hasta que tenga RLS activo
  y políticas explícitas. La UI no se mergea contra una tabla sin RLS.
- **Calidad mínima por feature**: build verde, tipos TypeScript sin `any` no justificado,
  lighthouse mobile ≥ 80 en performance y ≥ 90 en accesibilidad en las rutas críticas
  (login trabajador, ejecución de pausa).

## Governance

Esta constitución prevalece sobre cualquier práctica ad-hoc. Las enmiendas requieren:

1. PR que modifique este archivo con justificación en la descripción.
2. Actualización del campo `Version` siguiendo SemVer:
   - MAJOR: eliminación o redefinición incompatible de principios o gobernanza.
   - MINOR: nuevo principio o sección expandida materialmente.
   - PATCH: aclaraciones, redacción, sin cambio semántico.
3. Revisión y aprobación del owner del producto (Daniela).
4. Sincronización de plantillas dependientes (`.specify/templates/*`) si aplica.

Toda revisión de código y plan MUST verificar cumplimiento explícito de los principios I–V.
La complejidad adicional (nuevas dependencias, nuevos canales de notificación, nuevos roles)
MUST justificarse contra estos principios.

**Version**: 1.0.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
