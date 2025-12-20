'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // @ts-ignore - iOS specific
      const isIOSInstalled = window.navigator.standalone === true;
      
      if (isStandalone || isIOSInstalled) {
        setIsInstalled(true);
        return;
      }

      // Check if previously dismissed
      const dismissed = localStorage.getItem('installPromptDismissed');
      if (dismissed) {
        return;
      }

      // Detect iOS
      const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      setIsIOS(iOS);

      // Listen for beforeinstallprompt event (Android/Desktop)
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      // Show prompt after 30 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 30000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        clearTimeout(timer);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-2xl overflow-hidden max-w-md mx-auto">
        <div className="p-4">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>

          <div className="flex items-start gap-3 pr-8">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl">
              🛍️
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg mb-1">
                Install Taobao Proto
              </h3>
              <p className="text-white/90 text-sm mb-3">
                {isIOS 
                  ? 'Tap the Share button and select "Add to Home Screen"'
                  : 'Add to your home screen for quick access and a better experience'
                }
              </p>

              {/* iOS Instructions */}
              {isIOS ? (
                <div className="flex items-center gap-2 text-white/90 text-xs bg-white/10 rounded-lg p-2">
                  <span className="text-lg">⬆️</span>
                  <span>Share → Add to Home Screen</span>
                </div>
              ) : (
                /* Android/Desktop Install Button */
                deferredPrompt && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full bg-white text-orange-600 font-semibold py-3 px-4 rounded-lg hover:bg-orange-50 transition-colors active:scale-95"
                  >
                    Install App
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
