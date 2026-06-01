/// <reference lib="webworker" />
// Custom Service Worker para Activa SST.
// Handlers vacíos de push y notificationclick listos para extender.
declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (_event: PushEvent) => {
  // TODO: parsear payload y mostrar notificación con self.registration.showNotification(...)
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  // TODO: enfocar/abrir ventana con event.waitUntil(self.clients.openWindow("/"))
});

export {};
