"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMotionValue, animate, type PanInfo } from "framer-motion";
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
  const [settledTab, setSettledTab] = useState<T>(activeTab);

  // Dedicated MotionValue for continuous hardware-accelerated X translation
  const x = useMotionValue(0);
  const isGestureActiveRef = useRef(false);

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

  // Spring animation transition sync (for button clicks, window resize, or external tab changes)
  useEffect(() => {
    // If a gesture release animation is currently driving x with touch velocity, do not override it
    if (isGestureActiveRef.current) return;

    const w = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 390);
    if (w <= 0) return;

    const targetX = -currentTabIndex * w;
    const controls = animate(x, targetX, {
      type: "spring",
      stiffness: 280,
      damping: 32,
      mass: 0.8,
      onComplete: () => {
        setSettledTab(activeTab);
      },
    });

    return () => controls.stop();
  }, [activeTab, currentTabIndex, containerWidth, x]);

  const goToTab = useCallback(
    (tab: T) => {
      if (tab !== activeTab) {
        isGestureActiveRef.current = false;
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

  const handleDragStart = useCallback(() => {
    isGestureActiveRef.current = true;
  }, []);

  // Strictly enforce SINGLE-STEP pagination invariant with FLUID TOUCH VELOCITY HANDOFF
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const w = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 390);
      const deltaX = info.offset.x;
      const releaseVelocity = info.velocity.x; // in px/second

      const targetIndex = calculateBoundedSwipeTarget({
        startIndex: currentTabIndex,
        deltaX,
        velocity: Math.abs(releaseVelocity) / 1000,
        clientWidth: w,
        totalTabs: tabs.length,
      });

      const targetX = -targetIndex * w;
      isGestureActiveRef.current = true;

      // Silky smooth momentum handoff: project real touch velocity into spring!
      animate(x, targetX, {
        type: "spring",
        stiffness: 280,
        damping: 32,
        mass: 0.8,
        velocity: releaseVelocity,
        onComplete: () => {
          isGestureActiveRef.current = false;
          setSettledTab(tabs[targetIndex] || activeTab);
        },
      });

      const targetTab = tabs[targetIndex];
      if (targetTab && targetTab !== activeTab) {
        onTabChange(targetTab);
      }
    },
    [activeTab, containerWidth, currentTabIndex, onTabChange, tabs, x]
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
    settledTab,
    x,
    dragConstraints,
    handleDragStart,
    handleDragEnd,
    updateIndicator,
  };
}
