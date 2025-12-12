/**
 * Extract product ID from Taobao/Tmall URLs
 * 
 * Supported formats:
 * - https://detail.tmall.com/item.htm?id=950772981369&...
 * - https://item.taobao.com/item.htm?id=123456789
 * - http://world.taobao.com/item/123456789.htm
 * - https://m.intl.taobao.com/detail/detail.html?id=123456789
 * - detail.tmall.com/item.htm?id=123456789 (without protocol)
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
  
  // Extract ID from query parameter (id=XXXXXXX)
  // Matches: ?id=123456789 or &id=123456789
  const queryParamMatch = input.match(/[?&]id=(\d+)/i);
  if (queryParamMatch && queryParamMatch[1]) {
    return queryParamMatch[1];
  }
  
  // Extract ID from path pattern (world.taobao.com/item/XXXXXXX.htm)
  const pathMatch = input.match(/\/item\/(\d+)/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }
  
  return null;
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
