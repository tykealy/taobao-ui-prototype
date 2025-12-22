/**
 * Utility function to detect if the user is on a mobile device
 * @returns true if mobile device, false if desktop
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent || (window as any).opera || '';
  
  // Mobile regex patterns
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
  
  // Check user agent
  if (mobileRegex.test(userAgent.toLowerCase())) {
    return true;
  }
  
  // Check for touch support and small screen
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSmallScreen = window.innerWidth <= 768;
  
  return hasTouchScreen && hasSmallScreen;
}

/**
 * Get device type as string
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
