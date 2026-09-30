"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinancialEvent } from "@/lib/types";
import { getAtomicReorderUnits } from "@/lib/finance";

const HOLD_DELAY_MS = 500;
const MOVE_THRESHOLD_PX = 8;

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
  const isDraggingRef = useRef(false);
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

  const handlePointerDown = useCallback(
    (eventId: string, e: React.PointerEvent) => {
      if (disabled || e.button !== 0) return;

      const unit = units.find((u) => u.events.some((ev) => ev.id === eventId));
      if (!unit) return;

      cancelHoldTimer();
      startPosRef.current = { x: e.clientX, y: e.clientY };

      timerRef.current = window.setTimeout(() => {
        setIsDragging(true);
        isDraggingRef.current = true;
        setActiveUnitId(unit.id);

        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(50);
          } catch {
            // Safe fallback if vibration is not allowed
          }
        }

        if (typeof document !== "undefined") {
          document.body.style.userSelect = "none";
          document.body.style.touchAction = "none";
        }
      }, HOLD_DELAY_MS);
    },
    [disabled, units, cancelHoldTimer]
  );

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      // If waiting for long-press timer, cancel if moved beyond threshold (enables normal scrolling)
      if (!isDraggingRef.current && timerRef.current !== null && startPosRef.current) {
        const dist = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);
        if (dist > MOVE_THRESHOLD_PX) {
          cancelHoldTimer();
        }
        return;
      }

      // If actively dragging, resolve drop target
      if (isDraggingRef.current && activeUnitIdRef.current) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
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
            const placement = e.clientY < mid ? "above" : "below";
            setDropTargetUnitId(targetUnitId);
            setDropPlacement(placement);
          } else {
            setDropTargetUnitId(null);
            setDropPlacement(null);
          }
        } else {
          setDropTargetUnitId(null);
          setDropPlacement(null);
        }
      }
    };

    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
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
            // In Card view (DESC), visual "above" means placing after in canonical recording order.
            // In Ledger view (ASC), visual "above" means placing before in canonical recording order.
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
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", resetDragState);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("selectstart", handleSelectStart);

    return () => {
      cancelHoldTimer();
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", resetDragState);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("selectstart", handleSelectStart);
    };
  }, [cancelHoldTimer, onReorder, resetDragState, units, viewMode]);

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
          // Card view is DESC: Cashback is at top (first visual), Expense is at bottom (last visual)
          const cashback = targetUnit.events.find((e) => e.type === "income" && e.category === "Cashback");
          const expense = targetUnit.events.find((e) => e.type === "expense");
          if (position === "above") {
            return cashback ? cashback.id === eventId : targetUnit.primaryEvent.id === eventId;
          } else {
            return expense ? expense.id === eventId : targetUnit.primaryEvent.id === eventId;
          }
        } else {
          // Ledger view is ASC: Expense is at top (first visual), Cashback is at bottom (last visual)
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
        // First visual row is 'out', second visual row is 'in'
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
        "data-reorder-event-id": eventId,
        "data-reorder-unit-id": unit?.id ?? "",
      };
    },
    [handlePointerDown, units]
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
