import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;

export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPull(Math.min(delta, THRESHOLD * 1.5));
      }
    };
    const onEnd = async () => {
      if (startY.current === null) return;
      const final = pull;
      startY.current = null;
      if (final >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, refreshing, onRefresh]);

  return { pull, refreshing, threshold: THRESHOLD };
}

export function PullIndicator({
  pull,
  refreshing,
  threshold,
}: {
  pull: number;
  refreshing: boolean;
  threshold: number;
}) {
  if (pull === 0 && !refreshing) return null;
  const ready = pull >= threshold || refreshing;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center transition"
      style={{ transform: `translateY(${Math.min(pull, threshold)}px)` }}
    >
      <div className="rounded-full bg-background/95 border border-border px-3 py-1 text-xs text-muted-foreground shadow">
        {refreshing ? "Actualizando…" : ready ? "Suelta para actualizar" : "Tira para actualizar"}
      </div>
    </div>
  );
}
