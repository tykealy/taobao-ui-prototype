import { useEffect, useRef, useState } from 'react';

interface SwipeGestureOptions {
  onSwipeDown?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture({
  onSwipeDown,
  threshold = 100,
  enabled = true,
}: SwipeGestureOptions) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let touchStartY = 0;
    let scrollTop = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const scrollableParent = findScrollableParent(target);
      
      touchStartY = e.touches[0].clientY;
      startYRef.current = touchStartY;
      scrollTop = scrollableParent?.scrollTop || 0;

      // Only allow swipe if we're at the top of the scroll
      if (scrollTop <= 0) {
        setIsDragging(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      const currentY = e.touches[0].clientY;
      currentYRef.current = currentY;
      const diff = currentY - startYRef.current;

      // Only track downward swipes
      if (diff > 0) {
        setDragOffset(diff);
        
        // Prevent default scrolling while dragging
        if (diff > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;

      const diff = currentYRef.current - startYRef.current;

      if (diff > threshold && onSwipeDown) {
        onSwipeDown();
      }

      // Reset state
      setIsDragging(false);
      setDragOffset(0);
      startYRef.current = 0;
      currentYRef.current = 0;
    };

    // Find the nearest scrollable parent
    function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
      if (!element) return null;
      
      const isScrollable = element.scrollHeight > element.clientHeight;
      const overflowY = window.getComputedStyle(element).overflowY;
      const isOverflowScrollable = overflowY === 'auto' || overflowY === 'scroll';

      if (isScrollable && isOverflowScrollable) {
        return element;
      }

      return findScrollableParent(element.parentElement);
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isDragging, threshold, onSwipeDown]);

  return {
    dragOffset,
    isDragging,
  };
}
