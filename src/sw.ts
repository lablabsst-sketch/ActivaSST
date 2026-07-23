/// <reference lib="webworker" />
// Service Worker de Activa SST.
// Contrato de payload push (acordado con backend send-push):
// {
//   title: string,
//   body: string,
//   data: {
//     url: string,                  // ruta a abrir, ej: /trabajador/pausa/<id>
//     programacion_id: string,      // uuid, se usa como tag para deduplicar
//     ventana_min: number,
//     tipo: "pausa" | string
//   }
// }
declare const self: ServiceWorkerGlobalScope;

const DEFAULT_URL = "/trabajador";
const ICON = "/icon-192.svg";
const BADGE = "/icon-192.svg";

type PushPayload = {
  title?: string;
  body?: string;
  data?: {
    url?: string;
    programacion_id?: string;
    ventana_min?: number;
    tipo?: string;
    [k: string]: unknown;
  };
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Chrome (Android/desktop) exige que el Service Worker tenga un handler `fetch`
// para considerar la PWA instalable y disparar `beforeinstallprompt` (el banner
// de instalación). No cacheamos nada: sin `event.respondWith()` el navegador
// procesa cada petición con normalidad (network passthrough). En iOS la
// instalación es siempre manual (Compartir → Agregar a inicio) y no depende
// de esto.
self.addEventListener("fetch", () => {
  // Passthrough intencional.
});

function parsePush(event: PushEvent): PushPayload {
  if (!event.data) return {};
  try {
    return event.data.json() as PushPayload;
  } catch {
    try {
      const text = event.data.text();
      return { title: "Activa SST", body: text };
    } catch {
      return {};
    }
  }
}

self.addEventListener("push", (event: PushEvent) => {
  const payload = parsePush(event);
  const title = payload.title ?? "Activa SST";
  const data = payload.data ?? {};
  const body = payload.body ?? "Tienes una pausa activa pendiente.";
  const tag = data.programacion_id ?? "activa-sst-default";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
      icon: ICON,
      badge: BADGE,
      tag,
      // renotify: false (default). Se omite porque el tipo NotificationOptions del lib DOM no lo declara.
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const data = (event.notification.data ?? {}) as { url?: string };
  const targetUrl = typeof data.url === "string" && data.url.length > 0 ? data.url : DEFAULT_URL;

  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const sameOrigin = allClients.find((c) => c.url.startsWith(scope));
      if (sameOrigin) {
        try {
          await sameOrigin.focus();
        } catch {
          // ignore focus errors
        }
        try {
          // navigate() puede no estar disponible en todos los navegadores
          if ("navigate" in sameOrigin && typeof sameOrigin.navigate === "function") {
            await sameOrigin.navigate(targetUrl);
          }
        } catch {
          // ignore navigation errors
        }
        return;
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});

export {};
