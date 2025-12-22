'use client';

import { useEffect, ReactNode } from 'react';
import { useSwipeGesture } from '@/lib/useSwipeGesture';

interface MobileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showSwipeIndicator?: boolean;
  zIndex?: 50 | 60 | 70 | 80; // Support nested dialogs
}

export function MobileDialog({
  isOpen,
  onClose,
  title,
  children,
  footer,
  showSwipeIndicator = true,
  zIndex = 50,
}: MobileDialogProps) {
  const { dragOffset, isDragging } = useSwipeGesture({
    onSwipeDown: onClose,
    threshold: 100,
    enabled: isOpen,
  });

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const dialogZIndex = `z-${zIndex}` as const;
  
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${dialogZIndex}`}
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Container */}
      <div
        className={`fixed inset-0 flex items-end sm:items-center sm:justify-center pointer-events-none ${dialogZIndex}`}
        style={{ zIndex: zIndex + 1 }}
      >
        {/* Dialog Panel */}
        <div
          className={`
            pointer-events-auto
            w-full sm:w-full sm:max-w-2xl
            bg-white dark:bg-gray-900
            flex flex-col
            shadow-2xl
            transition-all duration-300 ease-out
            ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
            
            /* Mobile: Full screen */
            h-full sm:h-auto
            rounded-none sm:rounded-xl
            
            /* Desktop: Max height */
            sm:max-h-[85vh]
            
            /* Apply drag offset on mobile only */
            ${isDragging ? 'transition-none' : ''}
          `}
          style={{
            transform: isDragging && window.innerWidth < 640 
              ? `translateY(${dragOffset}px)` 
              : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Swipe Indicator (mobile only) */}
          {showSwipeIndicator && (
            <div className="sm:hidden flex justify-center pt-3 pb-2 safe-top no-select">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
          )}

          {/* Header */}
          <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 safe-top">
            <div className="flex justify-between items-center">
              {typeof title === 'string' ? (
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              ) : (
                <div className="flex-1 pr-2">{title}</div>
              )}
              <button
                onClick={onClose}
                className="
                  p-2 -m-2
                  hover:bg-gray-200 dark:hover:bg-gray-700
                  active:scale-95
                  rounded-full
                  transition-all
                  text-gray-500 dark:text-gray-400
                  text-xl
                  leading-none
                  min-w-[44px] min-h-[44px]
                  flex items-center justify-center
                  flex-shrink-0
                "
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto momentum-scroll">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 safe-bottom">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
