/**
 * Extract URL from text that may contain additional content
 * Handles cases where users paste share text from Taobao app
 * 
 * @param input - User input string that may contain URL and other text
 * @returns Extracted URL or original input if no URL pattern found
 */
export function extractUrlFromText(input: string): string {
  // Match http(s) URLs
  const urlPattern = /https?:\/\/[^\s\u4e00-\u9fa5]+/gi;
  const matches = input.match(urlPattern);
  
  if (matches && matches.length > 0) {
    // Return the first URL found
    return matches[0];
  }
  
  // If no URL pattern found, return original input
  return input;
}

/**
 * Extract product ID from Taobao/Tmall URLs
 * 
 * Supported formats:
 * - https://detail.tmall.com/item.htm?id=950772981369&...
 * - https://item.taobao.com/item.htm?id=123456789
 * - http://world.taobao.com/item/123456789.htm
 * - https://m.intl.taobao.com/detail/detail.html?id=123456789
 * - detail.tmall.com/item.htm?id=123456789 (without protocol)
 * - https://assets-tmw.taobao.com/...?targetId=123456789 (share page format)
 * 
 * Shortened link formats (requires server-side resolution):
 * - https://click.world.taobao.com/_b.xxxxx (redirect link)
 * - https://s.click.taobao.com/xxxxx (short link)
 * 
 * @param input - User input string (URL or keyword)
 * @returns Product ID as string, or null if not found
 */
export function extractProductId(input: string): string | null {
  // Check if input contains common Taobao/Tmall domains
  const isTaobaoUrl = /taobao\.com|tmall\.com/i.test(input);
  
  if (!isTaobaoUrl) {
    return null;
  }
  
  // Priority 1: Extract ID from targetId parameter (share page format)
  // Matches: ?targetId=123456789 or &targetId=123456789
  const targetIdMatch = input.match(/[?&]targetId=(\d+)/i);
  if (targetIdMatch && targetIdMatch[1]) {
    return targetIdMatch[1];
  }
  
  // Priority 2: Extract ID from query parameter (id=XXXXXXX)
  // Matches: ?id=123456789 or &id=123456789
  const queryParamMatch = input.match(/[?&]id=(\d+)/i);
  if (queryParamMatch && queryParamMatch[1]) {
    return queryParamMatch[1];
  }
  
  // Priority 3: Extract ID from path pattern (world.taobao.com/item/XXXXXXX.htm)
  const pathMatch = input.match(/\/item\/(\d+)/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }
  
  // Priority 4: Try to extract from URL-encoded targetUrl parameter
  // Some share links encode the actual product URL in a parameter
  const targetUrlMatch = input.match(/[?&]targetUrl=([^&]+)/i);
  if (targetUrlMatch && targetUrlMatch[1]) {
    try {
      const decodedUrl = decodeURIComponent(targetUrlMatch[1]);
      // Recursively try to extract from the decoded URL
      const nestedId = extractProductId(decodedUrl);
      if (nestedId) {
        return nestedId;
      }
    } catch (e) {
      // If decoding fails, continue to next attempt
    }
  }
  
  return null;
}

/**
 * Check if URL is a shortened Taobao/Tmall redirect link
 * 
 * @param input - User input string (URL)
 * @returns true if input is a shortened link that needs resolution
 */
export function isShortenedTaobaoUrl(input: string): boolean {
  // Patterns for shortened Taobao links:
  // - https://click.world.taobao.com/_b.xxxxx
  // - https://s.click.taobao.com/xxxxx
  // - https://uland.taobao.com/xxxxx (Taobao Union short link)
  return /click\.world\.taobao\.com|s\.click\.taobao\.com|uland\.taobao\.com/i.test(input);
}

/**
 * Check if input string is likely a Taobao/Tmall URL
 * 
 * @param input - User input string
 * @returns true if input appears to be a URL
 */
export function isUrl(input: string): boolean {
  // Check for HTTP(S) protocol OR Taobao/Tmall domain
  return /^https?:\/\//i.test(input) || 
         /taobao\.com|tmall\.com/i.test(input);
}
