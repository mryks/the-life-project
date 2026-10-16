"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PanInfo } from "framer-motion";
import { calculateBoundedSwipeTarget } from "@/lib/swipe-tabs";

const emptySubscribe = () => () => {};

export interface UseSwipeableTabsOptions<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function useSwipeableTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: UseSwipeableTabsOptions<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const tabNavRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateSize = () => {
      const el = containerRef.current || carouselRef.current;
      if (el) {
        setContainerWidth(el.clientWidth);
      }
      const hasTouch =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches;
      setIsTouchDevice(hasTouch);
    };
    updateSize();
    // Re-check after mount to ensure layout is settled
    const timer = setTimeout(updateSize, 50);
    window.addEventListener("resize", updateSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const currentTabIndex = useMemo(() => {
    const idx = tabs.indexOf(activeTab);
    return idx === -1 ? 0 : idx;
  }, [activeTab, tabs]);

  const goToTab = useCallback(
    (tab: T) => {
      if (tab !== activeTab) {
        onTabChange(tab);
      }
    },
    [activeTab, onTabChange]
  );

  // Dynamic gesture boundary clamping: finger cannot physically drag past ±1 adjacent tab
  const dragConstraints = useMemo(() => {
    const w = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 390);
    const maxScroll = -((tabs.length - 1) * w);
    return {
      left: Math.max(maxScroll, -(currentTabIndex + 1) * w),
      right: Math.min(0, -(currentTabIndex - 1) * w),
    };
  }, [containerWidth, currentTabIndex, tabs.length]);

  // Strictly enforce SINGLE-STEP pagination invariant (max ±1 tab per swipe gesture)
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const w = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 390);
      const deltaX = info.offset.x;
      const velocity = Math.abs(info.velocity.x) / 1000;

      const targetIndex = calculateBoundedSwipeTarget({
        startIndex: currentTabIndex,
        deltaX,
        velocity,
        clientWidth: w,
        totalTabs: tabs.length,
      });

      const targetTab = tabs[targetIndex];
      if (targetTab && targetTab !== activeTab) {
        onTabChange(targetTab);
      }
    },
    [activeTab, containerWidth, currentTabIndex, onTabChange, tabs]
  );

  const setTabButtonRef = useCallback((index: number) => {
    return (el: HTMLButtonElement | null) => {
      tabButtonsRef.current[index] = el;
    };
  }, []);

  const updateIndicator = useCallback(() => {}, []);

  return {
    containerRef,
    carouselRef,
    tabNavRef,
    indicatorRef,
    setTabButtonRef,
    goToTab,
    isMounted,
    isTouchDevice,
    containerWidth,
    currentTabIndex,
    dragConstraints,
    handleDragEnd,
    updateIndicator,
  };
}
