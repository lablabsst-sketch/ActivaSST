# Activa SST

PWA mobile-first para que prevencionistas SST programen pausas activas y los trabajadores las reciban (push web + banner in-app), respondan y queden registros auditables.

## Stack

TanStack Start (React 19 + TS) · Tailwind v4 · shadcn/ui · TanStack Query · TanStack Router · Lovable Cloud (Supabase: Auth + Postgres con RLS + Storage) · PWA (vite-plugin-pwa, SW custom) · Bun · Deploy en Lovable.

## Documentación viva (spec-driven)

Estructurado con [spec-kit](https://github.com/github/spec-kit). Todo cambio funcional pasa por estos artefactos antes de implementarse:

- [Constitución del proyecto](./.specify/memory/constitution.md) — principios no negociables.
- [Spec MVP](./specs/001-mvp-pausas-activas/spec.md) — qué se construye y por qué.
- [Plan técnico](./specs/001-mvp-pausas-activas/plan.md) — cómo se construye.
- [Tareas](./specs/001-mvp-pausas-activas/tasks.md) — siguiente paso accionable.

## Desarrollo

```bash
bun install
bun run dev          # preview local
bun run build        # build de producción (genera SW en /dist)
bun run preview      # sirve el build
```

Variables de entorno: ver `.env` (anon key pública, gestionada por Lovable Cloud).

## Ruta a tiendas (post-MVP)

PWA en MVP; wrap con Capacitor para App Store + Play Store (Phase 10 en `tasks.md`). Bundle id reservado: `co.activasst.app`.
