# Tasks: MVP Activa SST

**Input**: spec.md + plan.md de `001-mvp-pausas-activas`

Convenciones:
- `[P]` = se puede paralelizar con la tarea anterior si no tienen archivos en común.
- Cada tarea es accionable, con archivos concretos.
- Orden: Setup → Foundational (RLS/Auth/PWA shell) → User Story 1 → US2 → US3 → US4 → US5 → US6 → Polish.

---

## Phase 1 — Setup (proyecto base)

> **Estado al 2026-06-01:** Lovable se encargó del scaffold con TanStack Start + Bun + Lovable Cloud. T001–T008 quedaron cubiertos por Lovable con diferencias mínimas vs el plan original (TanStack Start en lugar de Vite+React Router 6; Bun en lugar de npm; Lovable Cloud en lugar de Supabase standalone).

- [x] **T001** Repo creado: `lablabsst-sketch/ActivaSST` (público). Repo `lablabsst-sketch/activa-sst` queda archivado.
- [x] **T002** Scaffold TanStack Start + React 19 + TS por Lovable. Dependencias instaladas: Tailwind v4, shadcn (radix-ui), lucide, @tanstack/react-router, @tanstack/react-query, react-hook-form, zod, @supabase/supabase-js, idb, vite-plugin-pwa, workbox-window.
- [x] **T003** Tailwind v4 (`@tailwindcss/vite`) + shadcn configurados. Paleta verde institucional (#15803d) + azul. Estilos base en `src/styles.css`.
- [x] **T004** PWA: `vite-plugin-pwa` con `injectManifest`, `src/sw.ts` con handlers vacíos `push`/`notificationclick`, registro condicional en `src/lib/pwa.ts` (guard anti-iframe/preview, solo activo en build de producción), `public/manifest.webmanifest` con iconos SVG 192/512.
- [x] **T005** ESLint + Prettier configurados por Lovable. tsconfig strict.
- [ ] **T006** [P] GitHub Actions: workflow `ci.yml` con `bun install`, lint, typecheck, build en cada PR. **Pendiente — Lovable no lo incluyó.**
- [x] **T007** Lovable Cloud activado. `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key, pública). Acceso al dashboard de Supabase se hace vía Lovable.
- [x] **T008** Repo sincronizado con Lovable; preview funcionando.

## Phase 2 — Foundational (bloqueante para todas las US)

- [ ] **T010** Migración SQL `0001_init.sql`: tablas `empresas`, `usuarios`, `tipos_trabajo`, `usuario_tipos_trabajo`, sin RLS aún. Seed `tipos_trabajo` (oficina, operativo, conducción, bodega, ventas, atención al cliente).
- [ ] **T011** Migración `0002_pausas.sql`: tablas `pausas`, `pausa_tipos_trabajo`. Bucket Storage `pausas-media` (público con políticas).
- [ ] **T012** Migración `0003_programaciones.sql`: tablas `programaciones`, `programacion_trabajadores`, `pausa_registros` (con UNIQUE en `response_uuid`).
- [ ] **T013** Migración `0004_push_y_consent.sql`: tablas `push_subscriptions`, `consentimientos`.
- [ ] **T014** Migración `0005_rls.sql`: habilitar RLS y políticas para todas las tablas según roles `prevencionista`, `trabajador`, `empresa_admin`. Incluir test SQL en comentario.
- [ ] **T015** Migración `0006_audit.sql`: trigger que impide UPDATE/DELETE en `pausa_registros` salvo desde rol `service_role`.
- [ ] **T016** [P] `src/lib/supabase.ts`: cliente tipado con `Database` types generados (`supabase gen types`).
- [ ] **T017** Rutas auth: `/login`, `/magic-link` con Supabase Auth (`signInWithOtp`). Layout `(auth)` shadcn.
- [ ] **T018** Hook `useSession()` + guard de rutas. Redirección por rol al loguearse: prevencionista → `/prevencionista`, trabajador → `/trabajador`.
- [ ] **T019** [P] Service Worker base (`src/sw.ts`): precaché del shell, handler `push` que muestra `Notification`, handler `notificationclick` que abre `/trabajador/pausa/<id>`.
- [ ] **T020** [P] `ConsentDialog.tsx`: bloqueante en primer login del trabajador; inserta en `consentimientos`. Texto Habeas Data + versión.
- [ ] **T021** [P] Tests RLS en `tests/unit/rls.spec.ts`: 2 empresas, 2 prevencionistas, intentar cross-read y verificar deny.

## Phase 3 — User Story 1: Programar pausa para trabajadores (P1)

- [ ] **T030** [P] Página `/prevencionista/biblioteca`: lista de pausas filtrable por tipo de trabajo y búsqueda. Query con react-query.
- [ ] **T031** [P] Página `/prevencionista/trabajadores`: lista de trabajadores con búsqueda y multiselección.
- [ ] **T032** Página `/prevencionista/programaciones/nueva`: form con pausa, trabajadores (multi), fecha+hora, ventana_min. Validación zod. Inserta en `programaciones` + `programacion_trabajadores`.
- [ ] **T033** Página `/prevencionista/programaciones`: lista con estado (pendiente/disparada/cerrada) y conteo de respuestas.
- [ ] **T034** Edge Function `tick-scheduler` (Deno) en `supabase/functions/tick-scheduler/index.ts`: ver plan.md. Tests con datos mock.
- [ ] **T035** Cron Supabase: `pg_cron` que invoca `tick-scheduler` cada minuto.
- [ ] **T036** Edge Function `send-push`: lee `push_subscriptions`, envía via `web-push` con VAPID. Maneja `410 Gone` desactivando suscripción.
- [ ] **T037** Generar par VAPID, guardar en secrets de Supabase y `VITE_VAPID_PUBLIC_KEY` en frontend.
- [ ] **T038** [P] E2E checkpoint: prevencionista programa pausa con disparo +1 min a un trabajador de prueba; el push llega y crea `pausa_registros` pendiente. Documentar en `tests/e2e/us1.spec.ts`.

## Phase 4 — User Story 2: Trabajador recibe y responde (P1)

- [ ] **T040** Página `/trabajador`: home con banner in-app que lee `pausa_registros` con `estado=pendiente` y ventana vigente.
- [ ] **T041** Página `/trabajador/pausa/[id]`: vista detallada con título, instrucciones (markdown), `PausaPlayer` (image o video con poster), botones "Hecha" / "Rechazar".
- [ ] **T042** `PausaPlayer.tsx`: muestra imagen con `loading=lazy` o video con `<video>` + poster + controles; sin autoplay.
- [ ] **T043** Mutación "Hecha": UPDATE `pausa_registros` (vía RPC SECURITY DEFINER que solo permite cambiar `estado` de `pendiente` a `hecha` y setea `respondido_en=now()`). Envía `response_uuid`.
- [ ] **T044** Modal "Rechazar" con motivos cerrados (Estoy en reunión / Estoy fuera del puesto / Indisposición / Otro) + comentario opcional. Mutación equivalente con `estado=rechazada` y `motivo`.
- [ ] **T045** Solicitar permiso de notificaciones y suscribir Push API al entrar a `/trabajador` por primera vez. Guardar en `push_subscriptions`.
- [ ] **T046** Cola offline en IndexedDB: si la mutación falla por red, encola `{ response_uuid, programacion_id, estado, motivo }` y la reintenta en `online` y cuando el SW lo notifica.
- [ ] **T047** [P] Página `/trabajador/historial`: últimas 30 respuestas del trabajador.
- [ ] **T048** [P] E2E `tests/e2e/us2.spec.ts`: trabajador marca "Hecha" y queda registro.
- [ ] **T049** [P] Test offline: marcar "Hecha" sin red, reconectar, verificar única inserción.

## Phase 5 — User Story 3: Crear pausa desde cero (P2)

- [ ] **T050** Página `/prevencionista/biblioteca/nueva`: form con título, instrucciones, duración, tipos de trabajo (multi), upload de imagen o video al bucket `pausas-media`.
- [ ] **T051** Validación: al menos uno de imagen/video; tamaño max video 50MB; tipos permitidos jpg/png/webp y mp4/webm.
- [ ] **T052** Edición y archivado (soft delete) de pausa propia.
- [ ] **T053** Policy Storage: lectura permitida a trabajadores de la misma empresa que tengan al menos un registro o programación pendiente referenciando esa pausa.
- [ ] **T054** [P] Seed `seed.sql` con 8 pausas precargadas (2 por tipo de trabajo principal) para que el MVP arranque con biblioteca útil.

## Phase 6 — User Story 4: Reportes (P2)

- [ ] **T060** Página `/prevencionista/reportes`: filtros (rango fechas, trabajadores opcional). Vista summary: total, % hecha, % rechazada (top motivos), % vencida.
- [ ] **T061** Vista detalle: tabla paginada de registros con join a pausa y trabajador.
- [ ] **T062** Export CSV: cliente arma el CSV desde la query (≤ 5000 filas) o llama función `export-csv` para volúmenes mayores.
- [ ] **T063** [P] Tests unitarios de agregaciones en `tests/unit/reportes.spec.ts`.

## Phase 7 — User Story 5: Importar trabajadores (P2)

- [ ] **T070** Página `/prevencionista/trabajadores/importar`: dropzone CSV, vista previa con validación zod, conteo de duplicados.
- [ ] **T071** Edge Function `import-workers`: upsert idempotente por `(empresa_id, documento)`; envía magic link a nuevos vía Supabase Auth Admin.
- [ ] **T072** UI de resultado: creados / actualizados / omitidos con motivos.

## Phase 8 — User Story 6: Recurrencia (P3)

- [ ] **T080** Extender form de programación con sección "Repetir": diario, días específicos, hasta fecha, hasta N ocurrencias.
- [ ] **T081** Generación de ocurrencias al guardar (no por cron) hasta máximo 90 días en adelante.
- [ ] **T082** Vista de "serie": mostrar como una sola fila con expansión a ocurrencias.

## Phase 9 — Polish y lanzamiento

- [ ] **T090** Onboarding del trabajador: 3 pantallas (qué es, permiso de notificaciones, instalar PWA con detección iOS/Android).
- [ ] **T091** Página pública landing `/` con CTA login (mobile-first).
- [ ] **T092** [P] Lighthouse mobile en rutas críticas; ajustes hasta cumplir ≥80 performance / ≥90 accesibilidad.
- [ ] **T093** [P] Aviso de privacidad `/privacidad` y `/terminos` (basados en plantilla de SSTalent con ajustes).
- [ ] **T094** [P] `/from-sstlink` endpoint reservado para integración futura (devuelve 501 si no hay token compartido configurado).
- [ ] **T095** Smoke test E2E completo: registrar empresa demo, programar, responder, ver reporte, exportar CSV.
- [ ] **T096** Documentación `README.md`: setup local, variables de entorno, comandos.
- [ ] **T097** Tag `v0.1.0-mvp` y release notes.

## Phase 10 — Escalado a tiendas con Capacitor (post-MVP, opcional)

> Objetivo: publicar Activa SST en App Store y Google Play reusando 100% del código React. Esta fase NO bloquea el MVP web/PWA; se activa cuando haya tracción que justifique el esfuerzo y los costos ($99/año Apple + $25 único Google).

- [ ] **T100** Instalar Capacitor: `npm i @capacitor/core @capacitor/cli` y `npx cap init "Activa SST" co.activasst.app --web-dir=dist`.
- [ ] **T101** Agregar plataformas: `npx cap add ios` y `npx cap add android`. Verificar que el build de Vite (`npm run build`) carga correctamente envuelto.
- [ ] **T102** [P] Plugin `@capacitor/push-notifications`: reemplazar Web Push por FCM (Android) + APNs (iOS) detectando `Capacitor.isNativePlatform()`. La lógica de suscripción se abstrae detrás de `features/push/` para que la app web siga usando Web Push.
- [ ] **T103** [P] Plugin `@capacitor/app` + `@capacitor/status-bar` + `@capacitor/splash-screen`: configurar splash, color de barra y deep links a `/trabajador/pausa/<id>`.
- [ ] **T104** Configurar Firebase project para FCM. Guardar `google-services.json` (Android) y `GoogleService-Info.plist` (iOS) — fuera del repo, en secrets.
- [ ] **T105** Configurar APNs en Apple Developer + clave `.p8`. Subir a Firebase para que FCM enrute también a iOS.
- [ ] **T106** Edge Function `send-push` ampliada: si la `push_subscriptions` es de tipo `web`, usa Web Push; si es `fcm`, usa FCM HTTP v1 API. Agregar columna `tipo` y `fcm_token`.
- [ ] **T107** Cuenta Apple Developer ($99/año) y Google Play Console ($25 único). Crear app records con bundle `co.activasst.app`.
- [ ] **T108** Iconos y assets nativos (1024x1024 para tiendas + splash). Generar con `@capacitor/assets`.
- [ ] **T109** Build iOS: `npx cap open ios` → Xcode → archive → TestFlight (interno).
- [ ] **T110** Build Android: `npx cap open android` → Android Studio → bundle `.aab` → Play Console (testing interno).
- [ ] **T111** [P] Política de privacidad alojada en `/privacidad` (requerida por ambas tiendas) + ficha de Data Safety en Play Console y App Privacy en App Store Connect.
- [ ] **T112** [P] Capturas de pantalla mobile (mínimo 3 por tienda, en español) + descripción corta y larga + keywords.
- [ ] **T113** Pipeline CI extendido: workflow `mobile.yml` que valida build iOS+Android (sin publicar). Publicación queda manual en MVP+1.
- [ ] **T114** Submit a TestFlight y Play Console (closed testing) con 5–10 prevencionistas piloto.
- [ ] **T115** Submit a producción. Plan de rollback: si la review tarda, la PWA sigue siendo el canal principal.

---

## Dependencias entre fases

- Phase 2 bloquea todas las siguientes.
- US1 (Phase 3) y US3 (Phase 5) pueden trabajarse en paralelo después de Phase 2, pero US1 debe terminar antes que US2.
- US2 depende de US1.
- US4 (reportes) depende de US2 (sin registros no hay reporte).
- US5 y US6 son independientes una vez Phase 2 está lista.

## Definition of Done por tarea

- Código mergeado a `main` vía PR.
- Migraciones SQL aplicadas en prod Supabase.
- Build verde en CI.
- Tipos TypeScript sin `any` no justificado.
- Si tocó tabla nueva: RLS habilitado + test RLS verde.
- Si tocó UI crítica del trabajador: probado en Chrome Android e iOS Safari real (no solo emulador).
