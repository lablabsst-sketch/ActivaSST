import { useEffect, useState } from "react";

export type SwState =
  | "unsupported"
  | "unregistered"
  | "installing"
  | "waiting"
  | "activating"
  | "activated"
  | "redundant";

export interface ServiceWorkerInfo {
  state: SwState;
  scope: string | null;
  scriptURL: string | null;
  registrationDate: string | null;
  updateViaCache: ServiceWorkerRegistration["updateViaCache"] | null;
  isPreview: boolean;
}

export function useServiceWorkerStatus(): ServiceWorkerInfo {
  const [info, setInfo] = useState<ServiceWorkerInfo>(() => {
    const isPreviewHost = (() => {
      if (typeof window === "undefined") return false;
      const host = window.location.hostname;
      return (
        host.startsWith("id-preview--") ||
        host.startsWith("preview--") ||
        host.endsWith("lovableproject.com") ||
        host.endsWith("lovableproject-dev.com")
      );
    })();

    return {
      state: "unregistered",
      scope: null,
      scriptURL: null,
      registrationDate: null,
      updateViaCache: null,
      isPreview: isPreviewHost,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setInfo((prev) => ({ ...prev, state: "unsupported" }));
      return;
    }

    let cancelled = false;

    const update = async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      const reg = regs[0];

      if (!reg) {
        if (!cancelled) {
          setInfo((prev) => ({
            ...prev,
            state: "unregistered",
            scope: null,
            scriptURL: null,
            registrationDate: null,
            updateViaCache: null,
          }));
        }
        return;
      }

      const sw = reg.installing || reg.waiting || reg.active;
      const state: SwState = sw?.state ?? "unregistered";

      if (!cancelled) {
        setInfo((prev) => ({
          ...prev,
          state,
          scope: reg.scope,
          scriptURL: sw?.scriptURL ?? null,
          registrationDate: reg.scope ? new Date().toISOString() : null,
          updateViaCache: reg.updateViaCache,
        }));
      }
    };

    update();

    const onControllerChange = () => update();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "sw-state-change") update();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Poll every 3s as fallback
    const interval = setInterval(update, 3000);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      clearInterval(interval);
    };
  }, []);

  return info;
}
