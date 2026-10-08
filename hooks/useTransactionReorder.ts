"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinancialEvent } from "@/lib/types";
import { getAtomicReorderUnits } from "@/lib/finance";

const HOLD_DELAY_MS = 300;
const TOUCH_MOVE_THRESHOLD_PX = 18;
const MOUSE_MOVE_THRESHOLD_PX = 8;

export interface UseTransactionReorderOptions {
  events: FinancialEvent[];
  viewMode: "card" | "ledger";
  disabled?: boolean;
  onReorder: (activeEventId: string, targetEventId: string, placement: "before" | "after") => void;
}

export function useTransactionReorder({
  events,
  viewMode,
  disabled = false,
  onReorder,
}: UseTransactionReorderOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [dropTargetUnitId, setDropTargetUnitId] = useState<string | null>(null);
  const [dropPlacement, setDropPlacement] = useState<"above" | "below" | null>(null);

  const units = useMemo(() => getAtomicReorderUnits(events), [events]);

  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointerTypeRef = useRef<string>("mouse");
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const activeUnitIdRef = useRef<string | null>(null);
  const dropTargetUnitIdRef = useRef<string | null>(null);
  const dropPlacementRef = useRef<"above" | "below" | null>(null);

  // Synchronize refs for event handlers
  useEffect(() => {
    activeUnitIdRef.current = activeUnitId;
  }, [activeUnitId]);

  useEffect(() => {
    dropTargetUnitIdRef.current = dropTargetUnitId;
  }, [dropTargetUnitId]);

  useEffect(() => {
    dropPlacementRef.current = dropPlacement;
  }, [dropPlacement]);

  const cancelHoldTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetDragState = useCallback(() => {
    cancelHoldTimer();
    setIsDragging(false);
    isDraggingRef.current = false;
    setActiveUnitId(null);
    setDropTargetUnitId(null);
    setDropPlacement(null);
    if (typeof document !== "undefined") {
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
    }
  }, [cancelHoldTimer]);

  const updateDragPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDraggingRef.current || !activeUnitIdRef.current) return;

      const elements = document.elementsFromPoint(clientX, clientY);
      let targetUnitId: string | null = null;

      for (const el of elements) {
        const matched = el.closest("[data-reorder-unit-id]");
        if (matched) {
          const uid = matched.getAttribute("data-reorder-unit-id");
          if (uid) {
            targetUnitId = uid;
            break;
          }
        }
      }

      if (targetUnitId && targetUnitId !== activeUnitIdRef.current) {
        const activeUnit = units.find((u) => u.id === activeUnitIdRef.current);
        const targetUnit = units.find((u) => u.id === targetUnitId);

        if (
          activeUnit &&
          targetUnit &&
          activeUnit.primaryEvent.date === targetUnit.primaryEvent.date
        ) {
          const allTargetElements = Array.from(
            document.querySelectorAll(`[data-reorder-unit-id="${targetUnitId}"]`)
          );
          let top = Infinity;
          let bottom = -Infinity;
          for (const el of allTargetElements) {
            const rect = el.getBoundingClientRect();
            if (rect.top < top) top = rect.top;
            if (rect.bottom > bottom) bottom = rect.bottom;
          }
          const mid = (top + bottom) / 2;
          const placement = clientY < mid ? "above" : "below";
          setDropTargetUnitId(targetUnitId);
          setDropPlacement(placement);
          return;
        }
      }

      setDropTargetUnitId(null);
      setDropPlacement(null);
    },
    [units]
  );

  const startHold = useCallback(
    (eventId: string, clientX: number, clientY: number, isTouch: boolean) => {
      if (disabled) return;

      const unit = units.find((u) => u.events.some((ev) => ev.id === eventId));
      if (!unit) return;

      cancelHoldTimer();
      startPosRef.current = { x: clientX, y: clientY };
      pointerTypeRef.current = isTouch ? "touch" : "mouse";
      suppressClickRef.current = false;

      timerRef.current = window.setTimeout(() => {
        suppressClickRef.current = true;
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
      }, HOLD_DELAY_MS);
    },
    [disabled, units, cancelHoldTimer]
  );

  const handlePointerDown = useCallback(
    (eventId: string, e: React.PointerEvent) => {
      if (disabled || e.button !== 0) return;
      // For non-touch (mouse/pen), start hold via pointerdown
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

  // Global listeners for movement and release
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (pointerTypeRef.current === "touch") return; // Touch handled by handleGlobalTouchMove

      // Mouse long-press tremor check
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

      // Actively dragging on mobile: prevent native scroll so card moves vertically or horizontally
      if (isDraggingRef.current) {
        if (e.cancelable) e.preventDefault();
        updateDragPosition(touch.clientX, touch.clientY);
        return;
      }

      // If waiting for 300ms hold timer
      if (timerRef.current !== null && startPosRef.current) {
        const dist = Math.hypot(touch.clientX - startPosRef.current.x, touch.clientY - startPosRef.current.y);
        if (dist > TOUCH_MOVE_THRESHOLD_PX) {
          // Intentional scroll: cancel timer and let page scroll normally
          cancelHoldTimer();
        } else {
          // Minor thumb jitter <= 18px: prevent scroll from stealing gesture prematurely
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    const handleDragEnd = () => {
      if (isDraggingRef.current) {
        suppressClickRef.current = true;
        // Keep suppressClick active for 250ms to swallow trailing synthetic click event
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 250);

        const currentActiveUnitId = activeUnitIdRef.current;
        const currentDropTargetUnitId = dropTargetUnitIdRef.current;
        const currentPlacement = dropPlacementRef.current;

        if (currentActiveUnitId && currentDropTargetUnitId && currentPlacement) {
          const activeUnit = units.find((u) => u.id === currentActiveUnitId);
          const targetUnit = units.find((u) => u.id === currentDropTargetUnitId);

          if (
            activeUnit &&
            targetUnit &&
            activeUnit.id !== targetUnit.id &&
            activeUnit.primaryEvent.date === targetUnit.primaryEvent.date
          ) {
            const canonicalPlacement: "before" | "after" =
              viewMode === "card"
                ? currentPlacement === "above"
                  ? "after"
                  : "before"
                : currentPlacement === "above"
                  ? "before"
                  : "after";

            onReorder(activeUnit.primaryEvent.id, targetUnit.primaryEvent.id, canonicalPlacement);
          }
        }
      }

      resetDragState();
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
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
      window.removeEventListener("touchcancel", handleDragEnd);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("selectstart", handleSelectStart);
    };
  }, [cancelHoldTimer, onReorder, resetDragState, units, updateDragPosition, viewMode]);

  const isEventActive = useCallback(
    (eventId: string): boolean => {
      if (!isDragging || !activeUnitId) return false;
      const activeUnit = units.find((u) => u.id === activeUnitId);
      return Boolean(activeUnit?.events.some((e) => e.id === eventId));
    },
    [activeUnitId, isDragging, units]
  );

  const shouldShowDropIndicator = useCallback(
    (eventId: string, position: "above" | "below", ledgerDirection?: "in" | "out"): boolean => {
      if (!isDragging || !dropTargetUnitId || dropPlacement !== position) return false;
      const targetUnit = units.find((u) => u.id === dropTargetUnitId);
      if (!targetUnit) return false;

      // Handle Expense with Cashback atomicity
      if (targetUnit.type === "expense-with-cashback") {
        if (viewMode === "card") {
          const cashback = targetUnit.events.find((e) => e.type === "income" && e.category === "Cashback");
          const expense = targetUnit.events.find((e) => e.type === "expense");
          if (position === "above") {
            return cashback ? cashback.id === eventId : targetUnit.primaryEvent.id === eventId;
          } else {
            return expense ? expense.id === eventId : targetUnit.primaryEvent.id === eventId;
          }
        } else {
          const expense = targetUnit.events.find((e) => e.type === "expense");
          const cashback = targetUnit.events.find((e) => e.type === "income" && e.category === "Cashback");
          if (position === "above") {
            return expense ? expense.id === eventId : targetUnit.primaryEvent.id === eventId;
          } else {
            return cashback ? cashback.id === eventId : targetUnit.primaryEvent.id === eventId;
          }
        }
      }

      // Handle Transfer atomicity (2 Ledger rows for 1 FinancialEvent)
      if (targetUnit.type === "transfer" && viewMode === "ledger") {
        if (targetUnit.primaryEvent.id !== eventId) return false;
        if (position === "above") {
          return ledgerDirection === "out";
        } else {
          return ledgerDirection === "in";
        }
      }

      // Single-event units (income, expense without cashback, refund, card transfer)
      return targetUnit.primaryEvent.id === eventId;
    },
    [dropPlacement, dropTargetUnitId, isDragging, units, viewMode]
  );

  const getItemProps = useCallback(
    (eventId: string) => {
      const unit = units.find((u) => u.events.some((e) => e.id === eventId));
      return {
        onPointerDown: (e: React.PointerEvent) => handlePointerDown(eventId, e),
        onTouchStart: (e: React.TouchEvent) => handleTouchStart(eventId, e),
        onClickCapture: (e: React.MouseEvent) => {
          if (suppressClickRef.current || isDraggingRef.current) {
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
    dropTargetUnitId,
    dropPlacement,
    isEventActive,
    shouldShowDropIndicator,
    getItemProps,
  };
}
