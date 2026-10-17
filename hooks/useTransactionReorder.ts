"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinancialEvent, ReorderUnit } from "@/lib/types";
import { getAtomicReorderUnits, reorderFinancialEvents } from "@/lib/finance";

export const TOUCH_HOLD_DELAY_MS = 150;
export const MOUSE_HOLD_DELAY_MS = 50;
export const TOUCH_MOVE_CANCEL_PX = 10;
export const MOUSE_INSTANT_DRAG_PX = 4;
export const AUTO_SCROLL_EDGE_PX = 100;
export const MAX_SCROLL_SPEED_PX = 18;

export interface UseTransactionReorderOptions {
  events: FinancialEvent[];
  viewMode: "card" | "ledger";
  disabled?: boolean;
  onReorder: (activeEventId: string, targetEventId: string, placement: "before" | "after") => void;
}

export interface CachedSlot {
  unitId: string;
  top: number;
  bottom: number;
  mid: number;
}

/**
 * Checks whether the active unit has reached the visual boundary of its date.
 * Card view displays transactions newest first (reverse chronological order within date).
 * Ledger view displays transactions oldest first (chronological order within date).
 */
export function isAtDateBoundary(
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

/**
 * Calculates auto-scroll speed and direction based on pointer position relative to viewport edges.
 */
export function calculateAutoScrollSpeed(
  clientY: number,
  viewportHeight: number,
  edgePx = AUTO_SCROLL_EDGE_PX,
  maxSpeed = MAX_SCROLL_SPEED_PX
): { speed: number; dir: "up" | "down" | null } {
  let speed = 0;
  let dir: "up" | "down" | null = null;

  if (clientY < edgePx && clientY >= 0) {
    dir = "up";
    const intensity = Math.max(0, Math.min(1, (edgePx - clientY) / edgePx));
    speed = -Math.pow(intensity, 1.5) * maxSpeed;
  } else if (clientY > viewportHeight - edgePx && clientY <= viewportHeight) {
    dir = "down";
    const intensity = Math.max(
      0,
      Math.min(1, (clientY - (viewportHeight - edgePx)) / edgePx)
    );
    speed = Math.pow(intensity, 1.5) * maxSpeed;
  }

  return { speed, dir };
}

/**
 * Validates whether pointer position has breached the physical boundary of the date group.
 */
export function isPastDateGroupBounds(
  pointerPageY: number,
  dir: "up" | "down",
  dateGroupTop: number,
  dateGroupBottom: number,
  bufferPx = 20
): boolean {
  if (dir === "up" && pointerPageY <= dateGroupTop + bufferPx) return true;
  if (dir === "down" && pointerPageY >= dateGroupBottom - bufferPx) return true;
  return false;
}

/**
 * Pure array math: finds closest slot midpoint without layout queries.
 * Supports both (pointerPageY, slots) and (slots, pointerPageY) for maximum ergonomics.
 */
export function findClosestSlotIndex(
  arg1: number | CachedSlot[],
  arg2?: number | CachedSlot[]
): number {
  const pointerPageY = typeof arg1 === "number" ? arg1 : (arg2 as number);
  const slots = typeof arg1 === "number" ? (arg2 as CachedSlot[]) : (arg1 as CachedSlot[]);
  if (!slots || slots.length === 0) return -1;
  let bestSlotIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const dist = Math.abs(pointerPageY - slots[i].mid);
    if (dist < minDistance) {
      minDistance = dist;
      bestSlotIndex = i;
    }
  }
  return bestSlotIndex;
}

/**
 * Calculates visual and canonical placement based on slot movement direction and viewMode.
 */
export function calculateCanonicalPlacementFromSlot(
  isMovingUp: boolean,
  viewMode: "card" | "ledger"
): "before" | "after";
export function calculateCanonicalPlacementFromSlot(
  bestSlotIndex: number,
  originalVisualIndex: number,
  viewMode: "card" | "ledger"
): { placement: "above" | "below"; canonicalPlacement: "before" | "after" };
export function calculateCanonicalPlacementFromSlot(
  arg1: boolean | number,
  arg2: number | "card" | "ledger",
  arg3?: "card" | "ledger"
): "before" | "after" | { placement: "above" | "below"; canonicalPlacement: "before" | "after" } {
  if (typeof arg1 === "boolean") {
    const isMovingUp = arg1;
    const viewMode = arg2 as "card" | "ledger";
    if (viewMode === "card") {
      return isMovingUp ? "after" : "before";
    } else {
      return isMovingUp ? "before" : "after";
    }
  } else {
    const bestSlotIndex = arg1;
    const originalVisualIndex = arg2 as number;
    const viewMode = arg3 as "card" | "ledger";
    const isMovingUp = bestSlotIndex < originalVisualIndex;
    const placement: "above" | "below" = isMovingUp ? "above" : "below";
    const canonicalPlacement: "before" | "after" =
      viewMode === "card"
        ? placement === "above"
          ? "after"
          : "before"
        : placement === "above"
          ? "before"
          : "after";

    return { placement, canonicalPlacement };
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
  const [pressingEventId, setPressingEventId] = useState<string | null>(null);
  const [provisionalEvents, setProvisionalEvents] = useState<FinancialEvent[]>(events);

  const isDraggingRef = useRef(false);
  const activeUnitIdRef = useRef<string | null>(null);
  const pressingEventIdRef = useRef<string | null>(null);
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

  // Cached slot measurements & DOM references for zero layout thrashing
  const cachedSlotsRef = useRef<CachedSlot[]>([]);
  const visualUnitsRef = useRef<ReorderUnit[]>([]);
  const activeElementsRef = useRef<HTMLElement[]>([]);
  const dateGroupTopRef = useRef<number>(0);
  const dateGroupBottomRef = useRef<number>(0);
  const initialActiveTopRef = useRef<number>(0);
  const pointerOffsetYRef = useRef<number>(0);
  const currentSlotTopRef = useRef<number>(0);
  const currentTargetKeyRef = useRef<string | null>(null);

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
    pressingEventIdRef.current = pressingEventId;
  }, [pressingEventId]);

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
    setPressingEventId(null);
    pressingEventIdRef.current = null;
    setIsDragging(false);
    isDraggingRef.current = false;
    setActiveUnitId(null);
    activeUnitIdRef.current = null;
    lastReorderParamsRef.current = null;
    currentTargetKeyRef.current = null;
    cachedSlotsRef.current = [];
    visualUnitsRef.current = [];

    if (activeElementsRef.current.length > 0) {
      activeElementsRef.current.forEach((el) => {
        el.style.transform = "";
        el.style.willChange = "";
      });
      activeElementsRef.current = [];
    }

    if (typeof document !== "undefined") {
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
    }
  }, [cancelHoldTimer, stopAutoScroll]);

  const measureDateSlots = useCallback((unitId: string, clientY: number) => {
    const currentUnits = getAtomicReorderUnits(baseEventsRef.current);
    const activeUnit = currentUnits.find((u) => u.id === unitId);
    if (!activeUnit) return;

    const sameDateUnits = currentUnits.filter(
      (u) => u.primaryEvent.date === activeUnit.primaryEvent.date
    );
    const visualUnits =
      viewModeRef.current === "card" ? [...sameDateUnits].reverse() : sameDateUnits;

    const slots: CachedSlot[] = [];
    for (const u of visualUnits) {
      const elements = document.querySelectorAll(`[data-reorder-unit-id="${u.id}"]`);
      if (elements.length === 0) continue;
      let top = Infinity;
      let bottom = -Infinity;
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const pageTop = rect.top + window.scrollY;
        const pageBottom = rect.bottom + window.scrollY;
        if (pageTop < top) top = pageTop;
        if (pageBottom > bottom) bottom = pageBottom;
      });
      if (top !== Infinity && bottom !== -Infinity) {
        slots.push({
          unitId: u.id,
          top,
          bottom,
          mid: (top + bottom) / 2,
        });
      }
    }

    cachedSlotsRef.current = slots;
    visualUnitsRef.current = visualUnits;
    dateGroupTopRef.current = slots.length > 0 ? slots[0].top : 0;
    dateGroupBottomRef.current = slots.length > 0 ? slots[slots.length - 1].bottom : 0;

    const activeSlot = slots.find((s) => s.unitId === activeUnit.id);
    const pointerPageY = clientY + window.scrollY;
    initialActiveTopRef.current = activeSlot ? activeSlot.top : pointerPageY;
    pointerOffsetYRef.current = pointerPageY - initialActiveTopRef.current;
    currentSlotTopRef.current = initialActiveTopRef.current;
    currentTargetKeyRef.current = "base";

    // Cache active elements for direct zero-latency GPU transform
    activeElementsRef.current = Array.from(
      document.querySelectorAll(`[data-reorder-unit-id="${activeUnit.id}"]`)
    ) as HTMLElement[];

    activeElementsRef.current.forEach((el) => {
      el.style.transform = "translate3d(0, 0px, 0) scale(1.02)";
      el.style.willChange = "transform";
    });
  }, []);

  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !activeUnitIdRef.current) return;

    lastPointerPosRef.current = { clientX, clientY };

    const pointerPageY = clientY + window.scrollY;
    const desiredCardTop = pointerPageY - pointerOffsetYRef.current;
    const translateY = desiredCardTop - currentSlotTopRef.current;

    // Real-time zero-latency GPU transform on the held card
    if (activeElementsRef.current.length > 0) {
      activeElementsRef.current.forEach((el) => {
        el.style.transform = `translate3d(0, ${translateY}px, 0) scale(1.02)`;
      });
    }

    const slots = cachedSlotsRef.current;
    const visualUnits = visualUnitsRef.current;
    if (slots.length <= 1 || visualUnits.length <= 1) return;

    // Pure array math: find closest slot midpoint without layout queries
    const bestSlotIndex = findClosestSlotIndex(slots, pointerPageY);
    if (bestSlotIndex === -1) return;

    const originalVisualIndex = visualUnits.findIndex((u) => u.id === activeUnitIdRef.current);
    if (originalVisualIndex === -1) return;

    if (bestSlotIndex === originalVisualIndex) {
      if (currentTargetKeyRef.current !== "base") {
        currentTargetKeyRef.current = "base";
        currentSlotTopRef.current = slots[bestSlotIndex].top;
        provisionalEventsRef.current = baseEventsRef.current;
        setProvisionalEvents(baseEventsRef.current);
        lastReorderParamsRef.current = null;
      }
      return;
    }

    const targetUnit = visualUnits[bestSlotIndex];
    const { canonicalPlacement } = calculateCanonicalPlacementFromSlot(
      bestSlotIndex,
      originalVisualIndex,
      viewModeRef.current
    );

    const targetKey = `${targetUnit.id}:${canonicalPlacement}`;
    if (currentTargetKeyRef.current === targetKey) {
      // Slot hasn't changed; avoid expensive React re-render
      return;
    }

    currentTargetKeyRef.current = targetKey;
    currentSlotTopRef.current = slots[bestSlotIndex].top;

    const activeUnit = visualUnits[originalVisualIndex];
    const nextEvents = reorderFinancialEvents(
      baseEventsRef.current,
      activeUnit.primaryEvent.id,
      targetUnit.primaryEvent.id,
      canonicalPlacement
    );

    const hasChanged =
      nextEvents.length !== provisionalEventsRef.current.length ||
      nextEvents.some((ev, i) => ev.id !== provisionalEventsRef.current[i].id);

    if (hasChanged) {
      provisionalEventsRef.current = nextEvents;
      setProvisionalEvents(nextEvents);
      lastReorderParamsRef.current = {
        activeEventId: activeUnit.primaryEvent.id,
        targetEventId: targetUnit.primaryEvent.id,
        placement: canonicalPlacement,
      };
    }
  }, []);

  // Ensure active elements retain their GPU transform after React slot reconciliations
  useEffect(() => {
    if (isDraggingRef.current && activeUnitIdRef.current) {
      activeElementsRef.current = Array.from(
        document.querySelectorAll(`[data-reorder-unit-id="${activeUnitIdRef.current}"]`)
      ) as HTMLElement[];
      const pointerPageY = lastPointerPosRef.current.clientY + window.scrollY;
      const desiredCardTop = pointerPageY - pointerOffsetYRef.current;
      const translateY = desiredCardTop - currentSlotTopRef.current;
      activeElementsRef.current.forEach((el) => {
        el.style.transform = `translate3d(0, ${translateY}px, 0) scale(1.02)`;
        el.style.willChange = "transform";
      });
    }
  }, [provisionalEvents]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) return;

    const tick = () => {
      if (!isDraggingRef.current || !activeUnitIdRef.current) {
        autoScrollRafRef.current = null;
        return;
      }

      const { clientX, clientY } = lastPointerPosRef.current;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

      const { speed, dir } = calculateAutoScrollSpeed(clientY, viewportHeight);

      if (dir !== null && speed !== 0) {
        const atBoundary = isAtDateBoundary(
          provisionalEventsRef.current,
          activeUnitIdRef.current,
          dir,
          viewModeRef.current
        );

        // Same-Date Hard Stop: verify physical bounds so viewport never scrolls past the date group
        const pointerPageY = clientY + window.scrollY;
        const isPastBounds = isPastDateGroupBounds(
          pointerPageY,
          dir,
          dateGroupTopRef.current,
          dateGroupBottomRef.current
        );

        if (!atBoundary && !isPastBounds) {
          window.scrollBy({ top: speed, behavior: "auto" });
          updateDragPosition(clientX, clientY);
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, [updateDragPosition]);

  const triggerDragStart = useCallback(
    (eventId: string, clientX: number, clientY: number) => {
      cancelHoldTimer();
      const currentUnits = getAtomicReorderUnits(events);
      const unit = currentUnits.find((u) => u.events.some((ev) => ev.id === eventId));
      if (!unit) return;

      suppressClickRef.current = true;
      setPressingEventId(null);
      pressingEventIdRef.current = null;
      baseEventsRef.current = events;
      provisionalEventsRef.current = events;
      setProvisionalEvents(events);
      lastReorderParamsRef.current = null;

      setIsDragging(true);
      isDraggingRef.current = true;
      setActiveUnitId(unit.id);
      activeUnitIdRef.current = unit.id;

      // Pre-measure same-date slots once
      measureDateSlots(unit.id, clientY);

      // Haptic feedback lift: 40ms subtle vibration
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // Safe fallback if vibration is not allowed or supported
        }
      }

      // Lock page scroll once hold is triggered
      if (typeof document !== "undefined") {
        document.body.style.userSelect = "none";
        document.body.style.touchAction = "none";
      }

      startAutoScroll();
    },
    [events, cancelHoldTimer, measureDateSlots, startAutoScroll]
  );

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
      setPressingEventId(eventId);
      pressingEventIdRef.current = eventId;

      const delay = isTouch ? TOUCH_HOLD_DELAY_MS : MOUSE_HOLD_DELAY_MS;

      timerRef.current = window.setTimeout(() => {
        triggerDragStart(eventId, clientX, clientY);
      }, delay);
    },
    [disabled, events, cancelHoldTimer, triggerDragStart]
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
        if (dist >= MOUSE_INSTANT_DRAG_PX) {
          if (pressingEventIdRef.current) {
            triggerDragStart(pressingEventIdRef.current, e.clientX, e.clientY);
          }
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
        if (dist > TOUCH_MOVE_CANCEL_PX) {
          cancelHoldTimer();
          setPressingEventId(null);
          pressingEventIdRef.current = null;
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
  }, [cancelHoldTimer, handleDragEnd, stopAutoScroll, triggerDragStart, updateDragPosition]);

  const isEventActive = useCallback(
    (eventId: string): boolean => {
      if (!isDragging || !activeUnitId) return false;
      const baseUnits = getAtomicReorderUnits(baseEventsRef.current);
      const activeUnit = baseUnits.find((u) => u.id === activeUnitId);
      return Boolean(activeUnit?.events.some((e) => e.id === eventId));
    },
    [activeUnitId, isDragging]
  );

  const isEventPressed = useCallback(
    (eventId: string): boolean => {
      if (isDragging || !pressingEventId) return false;
      const currentUnits = getAtomicReorderUnits(events);
      const pressingUnit = currentUnits.find((u) => u.events.some((e) => e.id === eventId));
      return Boolean(pressingUnit?.events.some((e) => e.id === eventId));
    },
    [events, isDragging, pressingEventId]
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
    isEventPressed,
    getItemProps,
  };
}
