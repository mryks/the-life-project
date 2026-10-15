import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  calculateIndicatorPosition,
  calculateSnappedTabIndex,
  type TabButtonRect,
} from "@/lib/swipe-tabs";

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
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const tabNavRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevActiveTabRef = useRef<T>(activeTab);
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Measure tab button offsets and continuously interpolate indicator position (1:1 motion)
  const updateIndicator = useCallback(() => {
    const carousel = carouselRef.current;
    const indicator = indicatorRef.current;
    if (!carousel || !indicator || tabButtonsRef.current.length === 0) return;

    const buttonRects: TabButtonRect[] = tabButtonsRef.current
      .filter((btn): btn is HTMLButtonElement => btn !== null)
      .map((btn) => ({
        offsetLeft: btn.offsetLeft,
        offsetWidth: btn.offsetWidth,
      }));

    if (buttonRects.length !== tabs.length) return;

    const { left, width } = calculateIndicatorPosition(
      buttonRects,
      carousel.scrollLeft,
      carousel.clientWidth
    );

    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.width = `${width}px`;
  }, [tabs.length]);

  // Programmatic scroll to specific tab
  const goToTab = useCallback(
    (tab: T, smooth = true) => {
      const targetIndex = tabs.indexOf(tab);
      if (targetIndex === -1) return;

      const carousel = carouselRef.current;
      if (!carousel) return;

      const clientWidth = carousel.clientWidth;
      const targetLeft = targetIndex * clientWidth;

      if (Math.abs(carousel.scrollLeft - targetLeft) < 1) {
        updateIndicator();
        return;
      }

      isProgrammaticScrollRef.current = true;

      if (smooth) {
        carousel.scrollTo({ left: targetLeft, behavior: "smooth" });

        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          updateIndicator();
        }, 400);
      } else {
        carousel.scrollLeft = targetLeft;
        isProgrammaticScrollRef.current = false;
        updateIndicator();
      }
    },
    [tabs, updateIndicator]
  );

  // Handle scroll events with rAF for indicator motion and settle detection for tab change
  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      updateIndicator();
    });

    if (isProgrammaticScrollRef.current) return;

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce to detect snap settle
    scrollTimeoutRef.current = window.setTimeout(() => {
      const carousel = carouselRef.current;
      if (!carousel) return;

      const settledIndex = calculateSnappedTabIndex(
        carousel.scrollLeft,
        carousel.clientWidth,
        tabs.length
      );
      const targetTab = tabs[settledIndex];

      if (targetTab && targetTab !== activeTab) {
        onTabChange(targetTab);
      }
    }, 70);
  }, [activeTab, onTabChange, tabs, updateIndicator]);

  // Set individual button ref callback
  const setTabButtonRef = useCallback((index: number) => {
    return (el: HTMLButtonElement | null) => {
      tabButtonsRef.current[index] = el;
    };
  }, []);

  // Attach carousel scroll listener
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      carousel.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (scrollTimeoutRef.current !== null) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleScroll]);

  // Prevent horizontal trackpad swipe from switching tabs on desktop PC
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleWheel = (e: WheelEvent) => {
      if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
        if (Math.abs(e.deltaX) > 0) {
          e.preventDefault();
        }
      }
    };

    carousel.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      carousel.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Handle window resize or orientation changes
  useEffect(() => {
    const handleResize = () => {
      const carousel = carouselRef.current;
      if (!carousel) return;

      const activeIndex = tabs.indexOf(activeTab);
      if (activeIndex !== -1) {
        carousel.scrollLeft = activeIndex * carousel.clientWidth;
      }
      updateIndicator();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTab, tabs, updateIndicator]);

  // Synchronize carousel when activeTab prop changes externally
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      goToTab(activeTab, true);
    }
  }, [activeTab, goToTab]);

  // Initial positioning without animation on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      goToTab(activeTab, false);
      updateIndicator();
    }, 20);

    return () => window.clearTimeout(timer);
  }, [activeTab, goToTab, updateIndicator]);

  return {
    carouselRef,
    tabNavRef,
    indicatorRef,
    setTabButtonRef,
    goToTab,
    isMounted,
    updateIndicator,
  };
}
