"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinancialEvent } from "@/lib/types";
import { getAtomicReorderUnits, reorderFinancialEvents } from "@/lib/finance";

const HOLD_DELAY_MS = 300;
const TOUCH_MOVE_THRESHOLD_PX = 18;
const MOUSE_MOVE_THRESHOLD_PX = 8;
const AUTO_SCROLL_EDGE_PX = 100;
const MAX_SCROLL_SPEED_PX = 18;

export interface UseTransactionReorderOptions {
  events: FinancialEvent[];
  viewMode: "card" | "ledger";
  disabled?: boolean;
  onReorder: (activeEventId: string, targetEventId: string, placement: "before" | "after") => void;
}

/**
 * Checks whether the active unit has reached the visual boundary of its date.
 * Card view displays transactions newest first (reverse chronological order within date).
 * Ledger view displays transactions oldest first (chronological order within date).
 */
function isAtDateBoundary(
  currentEvents: FinancialEvent[],
  activeId: string,
  direction: "up" | "down",
  mode: "card" | "ledger"
): boolean {
  const currentUnits = getAtomicReorderUnits(currentEvents);
  const activeUnit = currentUnits.find((u) => u.id === activeId);
  if (!activeUnit) return true;

  const sameDateUnits = currentUnits.filter(
    (u) => u.primaryEvent.date === activeUnit.primaryEvent.date
  );
  if (sameDateUnits.length <= 1) return true;

  const visualUnits = mode === "card" ? [...sameDateUnits].reverse() : sameDateUnits;
  const activeIndex = visualUnits.findIndex((u) => u.id === activeId);
  if (activeIndex === -1) return true;

  if (direction === "up") {
    return activeIndex === 0;
  } else {
    return activeIndex === visualUnits.length - 1;
  }
}

export function useTransactionReorder({
  events,
  viewMode,
  disabled = false,
  onReorder,
}: UseTransactionReorderOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [provisionalEvents, setProvisionalEvents] = useState<FinancialEvent[]>(events);

  const isDraggingRef = useRef(false);
  const activeUnitIdRef = useRef<string | null>(null);
  const provisionalEventsRef = useRef<FinancialEvent[]>(events);
  const baseEventsRef = useRef<FinancialEvent[]>(events);
  const viewModeRef = useRef(viewMode);
  const onReorderRef = useRef(onReorder);

  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerPosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const pointerTypeRef = useRef<string>("mouse");
  const suppressClickRef = useRef(false);
  const lastDragEndTimeRef = useRef<number>(0);
  const autoScrollRafRef = useRef<number | null>(null);
  const lastReorderParamsRef = useRef<{
    activeEventId: string;
    targetEventId: string;
    placement: "before" | "after";
  } | null>(null);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);

  useEffect(() => {
    activeUnitIdRef.current = activeUnitId;
  }, [activeUnitId]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setProvisionalEvents(events);
      provisionalEventsRef.current = events;
      baseEventsRef.current = events;
    }
  }, [events]);

  const units = useMemo(() => getAtomicReorderUnits(events), [events]);

  const cancelHoldTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const resetDragState = useCallback(() => {
    cancelHoldTimer();
    stopAutoScroll();
    setIsDragging(false);
    isDraggingRef.current = false;
    setActiveUnitId(null);
    lastReorderParamsRef.current = null;
    if (typeof document !== "undefined") {
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
    }
  }, [cancelHoldTimer, stopAutoScroll]);

  const updateDragPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDraggingRef.current || !activeUnitIdRef.current) return;

      lastPointerPosRef.current = { clientX, clientY };

      const elements = document.elementsFromPoint(clientX, clientY);
      let targetUnitId: string | null = null;

      for (const el of elements) {
        const matched = el.closest("[data-reorder-unit-id]");
        if (matched) {
          const uid = matched.getAttribute("data-reorder-unit-id");
          // Filter activeUnitId out so the lifted card doesn't occlude hit targets underneath
          if (uid && uid !== activeUnitIdRef.current) {
            targetUnitId = uid;
            break;
          }
        }
      }

      if (!targetUnitId) return;

      const baseUnits = getAtomicReorderUnits(baseEventsRef.current);
      const activeUnit = baseUnits.find((u) => u.id === activeUnitIdRef.current);
      const targetUnit = baseUnits.find((u) => u.id === targetUnitId);

      // Strictly enforce Same-Date Constraint: hit-test only accepts targets where dates match
      if (
        !activeUnit ||
        !targetUnit ||
        activeUnit.primaryEvent.date !== targetUnit.primaryEvent.date
      ) {
        return;
      }

      const allTargetElements = Array.from(
        document.querySelectorAll(`[data-reorder-unit-id="${targetUnitId}"]`)
      );
      if (allTargetElements.length === 0) return;

      let top = Infinity;
      let bottom = -Infinity;
      for (const el of allTargetElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top < top) top = rect.top;
        if (rect.bottom > bottom) bottom = rect.bottom;
      }
      const mid = (top + bottom) / 2;
      const placement = clientY < mid ? "above" : "below";
      const canonicalPlacement: "before" | "after" =
        viewModeRef.current === "card"
          ? placement === "above"
            ? "after"
            : "before"
          : placement === "above"
            ? "before"
            : "after";

      const nextEvents = reorderFinancialEvents(
        baseEventsRef.current,
        activeUnit.primaryEvent.id,
        targetUnit.primaryEvent.id,
        canonicalPlacement
      );

      const isSameAsBase =
        nextEvents.length === baseEventsRef.current.length &&
        nextEvents.every((ev, i) => ev.id === baseEventsRef.current[i].id);

      const hasChanged =
        nextEvents.length !== provisionalEventsRef.current.length ||
        nextEvents.some((ev, i) => ev.id !== provisionalEventsRef.current[i].id);

      if (hasChanged) {
        provisionalEventsRef.current = nextEvents;
        setProvisionalEvents(nextEvents);
        if (isSameAsBase) {
          lastReorderParamsRef.current = null;
        } else {
          lastReorderParamsRef.current = {
            activeEventId: activeUnit.primaryEvent.id,
            targetEventId: targetUnit.primaryEvent.id,
            placement: canonicalPlacement,
          };
        }
      }
    },
    []
  );

  const startAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) return;

    const tick = () => {
      if (!isDraggingRef.current || !activeUnitIdRef.current) {
        autoScrollRafRef.current = null;
        return;
      }

      const { clientX, clientY } = lastPointerPosRef.current;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

      let speed = 0;
      let dir: "up" | "down" | null = null;

      if (clientY < AUTO_SCROLL_EDGE_PX && clientY >= 0) {
        dir = "up";
        const intensity = Math.max(0, Math.min(1, (AUTO_SCROLL_EDGE_PX - clientY) / AUTO_SCROLL_EDGE_PX));
        speed = -Math.pow(intensity, 1.5) * MAX_SCROLL_SPEED_PX;
      } else if (clientY > viewportHeight - AUTO_SCROLL_EDGE_PX && clientY <= viewportHeight) {
        dir = "down";
        const intensity = Math.max(0, Math.min(1, (clientY - (viewportHeight - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX));
        speed = Math.pow(intensity, 1.5) * MAX_SCROLL_SPEED_PX;
      }

      if (dir !== null && speed !== 0) {
        const atBoundary = isAtDateBoundary(
          provisionalEventsRef.current,
          activeUnitIdRef.current,
          dir,
          viewModeRef.current
        );

        if (!atBoundary) {
          window.scrollBy({ top: speed, behavior: "auto" });
          updateDragPosition(clientX, clientY);
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, [updateDragPosition]);

  const startHold = useCallback(
    (eventId: string, clientX: number, clientY: number, isTouch: boolean) => {
      if (disabled) return;

      const currentUnits = getAtomicReorderUnits(events);
      const unit = currentUnits.find((u) => u.events.some((ev) => ev.id === eventId));
      if (!unit) return;

      cancelHoldTimer();
      startPosRef.current = { x: clientX, y: clientY };
      lastPointerPosRef.current = { clientX, clientY };
      pointerTypeRef.current = isTouch ? "touch" : "mouse";
      suppressClickRef.current = false;

      timerRef.current = window.setTimeout(() => {
        suppressClickRef.current = true;
        baseEventsRef.current = events;
        provisionalEventsRef.current = events;
        setProvisionalEvents(events);
        lastReorderParamsRef.current = null;

        setIsDragging(true);
        isDraggingRef.current = true;
        setActiveUnitId(unit.id);

        // Haptic feedback lift: 40ms subtle vibration
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(40);
          } catch {
            // Safe fallback if vibration is not allowed or supported
          }
        }

        // Lock page scroll once 300ms hold is officially triggered
        if (typeof document !== "undefined") {
          document.body.style.userSelect = "none";
          document.body.style.touchAction = "none";
        }

        startAutoScroll();
      }, HOLD_DELAY_MS);
    },
    [disabled, events, cancelHoldTimer, startAutoScroll]
  );

  const handlePointerDown = useCallback(
    (eventId: string, e: React.PointerEvent) => {
      if (disabled || e.button !== 0) return;
      if (e.pointerType !== "touch") {
        startHold(eventId, e.clientX, e.clientY, false);
      }
    },
    [disabled, startHold]
  );

  const handleTouchStart = useCallback(
    (eventId: string, e: React.TouchEvent) => {
      if (disabled) return;
      if (e.touches.length > 0) {
        startHold(eventId, e.touches[0].clientX, e.touches[0].clientY, true);
      }
    },
    [disabled, startHold]
  );

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();

    if (isDraggingRef.current) {
      lastDragEndTimeRef.current = Date.now();
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 400);

      const params = lastReorderParamsRef.current;
      if (params) {
        onReorderRef.current(params.activeEventId, params.targetEventId, params.placement);
      } else {
        setProvisionalEvents(events);
        provisionalEventsRef.current = events;
      }
    }

    resetDragState();
  }, [events, resetDragState, stopAutoScroll]);

  useEffect(() => {
    const handleGlobalClickCapture = (e: MouseEvent) => {
      const timeSinceDragEnd = Date.now() - lastDragEndTimeRef.current;
      if (suppressClickRef.current || isDraggingRef.current || timeSinceDragEnd < 400) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (pointerTypeRef.current === "touch") return;

      if (!isDraggingRef.current && timerRef.current !== null && startPosRef.current) {
        const dist = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);
        if (dist > MOUSE_MOVE_THRESHOLD_PX) {
          cancelHoldTimer();
        }
        return;
      }

      if (isDraggingRef.current) {
        updateDragPosition(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];

      if (isDraggingRef.current) {
        if (e.cancelable) e.preventDefault();
        updateDragPosition(touch.clientX, touch.clientY);
        return;
      }

      if (timerRef.current !== null && startPosRef.current) {
        const dist = Math.hypot(touch.clientX - startPosRef.current.x, touch.clientY - startPosRef.current.y);
        if (dist > TOUCH_MOVE_THRESHOLD_PX) {
          cancelHoldTimer();
        } else {
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
      }
    };

    const handleSelectStart = (e: Event) => {
      if (timerRef.current !== null || isDraggingRef.current) {
        e.preventDefault();
      }
    };

    window.addEventListener("click", handleGlobalClickCapture, true);
    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("pointercancel", handleDragEnd);
    window.addEventListener("touchmove", handleGlobalTouchMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
    window.addEventListener("touchcancel", handleDragEnd);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("selectstart", handleSelectStart);

    return () => {
      cancelHoldTimer();
      stopAutoScroll();
      window.removeEventListener("click", handleGlobalClickCapture, true);
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
      window.removeEventListener("touchcancel", handleDragEnd);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("selectstart", handleSelectStart);
    };
  }, [cancelHoldTimer, handleDragEnd, stopAutoScroll, updateDragPosition]);

  const isEventActive = useCallback(
    (eventId: string): boolean => {
      if (!isDragging || !activeUnitId) return false;
      const baseUnits = getAtomicReorderUnits(baseEventsRef.current);
      const activeUnit = baseUnits.find((u) => u.id === activeUnitId);
      return Boolean(activeUnit?.events.some((e) => e.id === eventId));
    },
    [activeUnitId, isDragging]
  );

  const getItemProps = useCallback(
    (eventId: string) => {
      const unit = units.find((u) => u.events.some((e) => e.id === eventId));
      return {
        onPointerDown: (e: React.PointerEvent) => handlePointerDown(eventId, e),
        onTouchStart: (e: React.TouchEvent) => handleTouchStart(eventId, e),
        onClickCapture: (e: React.MouseEvent) => {
          const timeSinceDragEnd = Date.now() - lastDragEndTimeRef.current;
          if (suppressClickRef.current || isDraggingRef.current || timeSinceDragEnd < 400) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        style: {
          touchAction: isDragging ? ("none" as const) : ("pan-y" as const),
        },
        "data-reorder-event-id": eventId,
        "data-reorder-unit-id": unit?.id ?? "",
      };
    },
    [handlePointerDown, handleTouchStart, isDragging, units]
  );

  return {
    isDragging,
    activeUnitId,
    provisionalEvents,
    isEventActive,
    getItemProps,
  };
}
