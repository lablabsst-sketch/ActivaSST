# Implementation Plan: MVP Activa SST

**Branch**: `001-mvp-pausas-activas` | **Date**: 2026-05-28 | **Spec**: ./spec.md

## Summary

PWA mobile-first para que prevencionistas SST agenden pausas activas y los trabajadores las reciban (push web + banner in-app), respondan (hecha/rechazada) y dejen registro auditable. Stack: TanStack Start + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase gestionado).

## Technical Context

> **Actualizado 2026-06-01:** Lovable scaffoldeó con **TanStack Start** (no Vite+React Router 6) y **Bun** (no npm). Stack adaptado preservando todos los principios de la constitución. Render mode: **SPA puro (sin SSR)** para simplificar Service Worker + offline.

- **Lenguaje/Runtime**: TypeScript 5.8, React 19, navegador moderno (runtime).
- **Framework**: TanStack Start con TanStack Router (file-based routes en `src/routes/`). Modo SPA: SSR deshabilitado.
- **Bundler**: Vite 7 (bajo TanStack Start, vía `@lovable.dev/vite-tanstack-config`).
- **Package manager**: Bun. Lock file: `bun.lock`.
- **UI**: Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (radix-ui), lucide-react, sonner.
- **Estado/datos**: TanStack Query. Forms: react-hook-form + zod + `@hookform/resolvers`.
- **PWA**: `vite-plugin-pwa` con `injectManifest`, SW custom en `src/sw.ts`, registro condicional en `src/lib/pwa.ts` (guard anti-iframe/preview: solo activo en build de producción).
- **Offline**: `idb` para cola de respuestas en IndexedDB.
- **Backend**: **Lovable Cloud** (Supabase gestionado por Lovable). Auth + Postgres con RLS + Storage. Dashboard accesible vía Lovable, no directo.
- **Cliente Supabase**: `@supabase/supabase-js` desde `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key, embebida en bundle, protegida por RLS).
- **Notificaciones**: Web Push API + VAPID. Suscripciones en tabla `push_subscriptions`. Envío desde Edge Function `send-push`.
- **Scheduler**: TBD según capacidades de Lovable Cloud. Plan A: `pg_cron` invoca `tick-scheduler` cada minuto. Plan B (fallback): GitHub Actions cron → RPC público de Supabase. Decisión se toma en Phase 3 (T034–T035).
- **Validación**: zod en formularios y payloads.
- **i18n**: español de Colombia hardcodeado en MVP.
- **Testing**: Vitest + React Testing Library (unit), Playwright (1 E2E crítico).
- **CI**: GitHub Actions con `bun install`, lint, typecheck, build. Deploy lo hace Lovable.
- **Despliegue**: Lovable conectado al repo GitHub.
- **Repo**: `lablabsst-sketch/ActivaSST` (público, creado por Lovable). Repo anterior `lablabsst-sketch/activa-sst` queda archivado.

## Constitution Check

| Principio | Cumplimiento |
|-----------|--------------|
| I. Mobile-first PWA | vite-plugin-pwa + manifest + SW desde el día 1; todas las pantallas se diseñan ≤ 390px ancho primero. ✅ |
| II. Roles y RLS-first | Migraciones SQL crean tablas con RLS habilitado y políticas explícitas antes de cualquier UI. ✅ |
| III. Registro auditable | `pausa_registros` con políticas que solo permiten INSERT (sin UPDATE/DELETE); columna `respondido_en` siempre `now()` server-side. ✅ |
| IV. Contenido reutilizable | `pausas` separado de `programaciones`; relación `programacion_trabajadores` para fan-out sin duplicar contenido. ✅ |
| V. Notificaciones resilientes | Push web + banner in-app obligatorios; sin push, in-app sigue funcionando. ✅ |

Sin violaciones a la constitución que requieran justificación.

## Project Structure

```
ActivaSST/
├── .specify/                    # spec-kit
├── .claude/skills/              # skills spec-kit
├── .lovable/                    # config de Lovable (auto-gestionado)
├── specs/001-mvp-pausas-activas/
│   ├── spec.md
│   ├── plan.md (este archivo)
│   ├── tasks.md
│   ├── data-model.md            # (a crear en T010)
│   └── contracts/               # contratos de RPC/Edge Functions
├── supabase/
│   ├── config.toml              # config Lovable Cloud
│   ├── migrations/              # SQL versionado (a crear en T010+)
│   ├── functions/
│   │   ├── send-push/
│   │   ├── tick-scheduler/
│   │   └── import-workers/
│   └── seed.sql
├── public/
│   ├── icons/                   # PWA icons 192/512 (SVG por ahora)
│   └── manifest.webmanifest
├── src/
│   ├── routes/                  # TanStack Router file-based routes
│   │   ├── __root.tsx
│   │   ├── index.tsx            # /
│   │   ├── login.tsx
│   │   ├── magic-link.tsx
│   │   ├── prevencionista.tsx   # layout
│   │   ├── prevencionista/
│   │   │   ├── biblioteca.tsx
│   │   │   ├── trabajadores.tsx
│   │   │   ├── programaciones.tsx
│   │   │   └── reportes.tsx
│   │   ├── trabajador.tsx       # layout (con banner in-app)
│   │   └── trabajador/
│   │       ├── pausa.$id.tsx
│   │       └── historial.tsx
│   ├── routeTree.gen.ts         # generado por TanStack Router (no editar)
│   ├── router.tsx               # config router
│   ├── app/                     # app shell, providers
│   ├── components/
│   │   ├── ui/                  # shadcn
│   │   ├── app-shell.tsx        # nav inferior mobile
│   │   ├── PausaCard.tsx
│   │   ├── PausaPlayer.tsx
│   │   ├── BannerInApp.tsx
│   │   └── ConsentDialog.tsx
│   ├── features/
│   │   ├── pausas/
│   │   ├── programaciones/
│   │   ├── trabajadores/
│   │   ├── registros/
│   │   ├── push/                # subscribe, unsubscribe, VAPID (abstrae web vs fcm)
│   │   └── offline-queue/       # IndexedDB + sync
│   ├── hooks/
│   ├── integrations/            # cliente Supabase
│   ├── lib/
│   │   ├── pwa.ts               # registro condicional del SW
│   │   ├── tz.ts
│   │   ├── validators.ts
│   │   └── csv.ts
│   ├── styles.css               # Tailwind v4 + tokens
│   ├── sw.ts                    # service worker custom (push, notificationclick)
│   ├── server.ts                # entrypoint server (TanStack Start)
│   └── start.ts                 # entrypoint client (TanStack Start)
├── tests/                       # (a crear)
│   ├── unit/
│   └── e2e/
├── vite.config.ts
├── tsconfig.json
├── components.json              # shadcn
├── eslint.config.js
├── .prettierrc
├── bun.lock
├── bunfig.toml
└── package.json
```

## Data Model (resumen — detalle en data-model.md)

Tablas Supabase (todas con RLS):

- `empresas` (id, nombre, nit, tz, created_at)
- `usuarios` (id = auth.users.id, empresa_id, rol, nombre, documento, activo)
- `tipos_trabajo` (id, slug, nombre)
- `usuario_tipos_trabajo` (usuario_id, tipo_id) — N:M
- `pausas` (id, empresa_id, titulo, instrucciones, duracion_min, image_url, video_url, creador_id, archivada, created_at)
- `pausa_tipos_trabajo` (pausa_id, tipo_id) — N:M
- `programaciones` (id, empresa_id, pausa_id, disparo_at, ventana_min, recurrencia_json, creador_id, created_at)
- `programacion_trabajadores` (programacion_id, trabajador_id, estado_inicial)
- `pausa_registros` (id, programacion_id, trabajador_id, estado, respondido_en, motivo, response_uuid UNIQUE, user_agent, created_at) — append-only
- `push_subscriptions` (id, usuario_id, tipo `web|fcm`, endpoint UNIQUE, p256dh, auth, fcm_token, user_agent, created_at) — `tipo` reservado para futuro wrap con Capacitor; MVP solo inserta `web`.
- `consentimientos` (id, usuario_id, version_aviso, aceptado_at, revocado_at)

Índices clave: `programaciones(disparo_at)` para el scheduler, `pausa_registros(programacion_id, trabajador_id)`.

## Edge Functions

1. **`tick-scheduler`** (cron cada 1 min):
   - Busca `programaciones` con `disparo_at` entre `now() - 1m` y `now() + 1m` no procesadas.
   - Para cada `programacion_trabajadores`, invoca `send-push` y crea fila `pausa_registros` con estado `pendiente` (para que aparezca como banner).
   - Cierra como `vencida` los registros pendientes cuya ventana ya pasó.
2. **`send-push`** (invocada por scheduler):
   - Recibe `{ trabajador_id, programacion_id }`.
   - Lee `push_subscriptions` del trabajador.
   - Envía Web Push con VAPID (lib `web-push` portada a Deno o equivalente).
3. **`import-workers`** (invocada desde UI):
   - Recibe CSV, valida, hace upsert idempotente, dispara magic links de Supabase Auth para nuevos.

## Decisiones técnicas clave

| Decisión | Elegido | Alternativa descartada | Razón |
|----------|---------|------------------------|-------|
| Estado servidor | TanStack Query | Zustand global | Cache + revalidación + offline queue se integran mejor con React Query. |
| Service Worker | injectManifest | generateSW | Necesitamos handler custom para `push` y cola IndexedDB. |
| Cron | `pg_cron` en Supabase | Cron externo (GH Actions) | Menos infra; ya está en Postgres. |
| Push backend | `web-push` en Edge Function | OneSignal / Firebase | Sin vendor lock, sin costos por mensaje. |
| Forms | react-hook-form + zod | Formik | Standard moderno; mejor DX y bundle. |
| Routing | TanStack Router (file-based) | React Router 6 | Decisión de Lovable; misma familia que TanStack Query, type-safe, mejor DX. |
| SSR | Deshabilitado (SPA puro) | SSR de TanStack Start | Service Worker + offline son más simples sin SSR; rutas críticas son post-login. |
| Auth | Supabase Magic Link | Email+password | Menor fricción para trabajadores; mismo flujo en SSTalent. |
| Análisis offline | IndexedDB via `idb` | localStorage | Necesitamos guardar payloads y cola de mutaciones. |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Push web inestable en iOS < 16.4 | Banner in-app + correo de cortesía opcional. |
| Trabajadores no instalan PWA | Onboarding incluye paso "Instalar app" con detección de evento `beforeinstallprompt` y guía visual para iOS. |
| Videos pesados | Límite 50MB, poster obligatorio, lazy load del `<video>`. Considerar Cloudinary si crece. |
| Cron de Supabase con drift | Verificación de ventana ±1 min, idempotencia por `(programacion_id, trabajador_id)` en `pausa_registros`. |
| Fuga RLS | Tests de RLS por tabla en Vitest (crear 2 empresas, intentar cross-read). |
| Adopción de consentimiento Habeas Data | Diálogo bloqueante en primer login del trabajador + log en `consentimientos`. |

## Integration with SSTLink

Punto de entrada autenticado: SSTLink redirige a `https://app.activa-sst.co/from-sstlink?token=<jwt-corto>`, que valida y crea sesión Supabase. JWT firmado con secret compartido entre los dos backends. Implementación fuera del MVP funcional, pero el endpoint se reserva desde el día 1.

## Out of scope (MVP)

- SSO empresarial (SAML/OIDC).
- Multi-zona horaria por empresa.
- App nativa iOS/Android (ver "Escalabilidad" más abajo — preparada vía Capacitor para una iteración posterior).
- Facturación in-app y planes.
- Gamificación / streaks.
- Integraciones con Slack / Teams.
- Dashboard de empresa_admin (solo se crea el rol; UI en iteración siguiente).

## Escalabilidad: ruta a App Store y Play Store

El MVP nace como PWA, pero el código se estructura para permitir un wrap con **Capacitor** sin reescritura cuando haya tracción que lo justifique. Implicaciones desde el día 1:

- `features/push/` MUST abstraer el canal: la UI llama `subscribeToPush()` sin saber si por debajo es Web Push o FCM/APNs.
- `push_subscriptions.tipo` (enum `web` | `fcm`) reservada en el esquema desde la migración inicial, aunque MVP solo use `web`.
- Edge Function `send-push` se diseña con un `dispatcher` por tipo, listo para sumar FCM HTTP v1 API después.
- Identificador de app único reservado: `co.activasst.app`.
- Deep links: las rutas críticas (`/trabajador/pausa/:id`, `/from-sstlink`) se mantienen estables porque también funcionarán como deep links nativos.
- Sin APIs Web exclusivas que rompan en WebView: no usar features que Capacitor no soporte bien en su WKWebView/Android WebView.

Las tareas concretas para llevarlo a tiendas viven en **Phase 10** de `tasks.md`, marcadas como post-MVP opcionales.
