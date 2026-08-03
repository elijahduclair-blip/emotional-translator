import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Touch pull-to-refresh hook — attaches to window scroll.
 * Returns pullDistance (px) for indicator rendering, and refreshing boolean.
 */
export function usePullToRefresh(onRefresh, { threshold = 70, enabled = true } = {}) {
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e) => {
    if (!enabled || refreshing) return;
    if (window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, [enabled, refreshing]);

  const onTouchMove = useCallback((e) => {
    if (!pullingRef.current || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) { setPullDistance(0); return; }
    setPullDistance(Math.min(delta * 0.4, threshold * 1.5));
  }, [refreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(0);
      try { await onRefresh(); } finally { setRefreshing(false); }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd, enabled]);

  return { pullDistance, refreshing };
}