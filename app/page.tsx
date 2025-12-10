'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// API Response Types based on taobao-api-response-type.md
interface ProductProperty {
  prop_name: string;
  prop_id: number;
  value_id: number;
  value_name: string;
}

interface ProductSkuItem {
  mp_skuId: number;
  sku_id: number;
  quantity: number;
  price: number;
  promotion_price: number;
  coupon_price: number;
  postFee: number;
  pic_url: string;
  status: string;
  properties: ProductProperty[];
}

interface PromotionDisplay {
  type_name: string;
  promotion_info_list: {
    promotion_name: string;
    activity_code: string;
  }[];
}

interface ProductData {
  item_id: number;
  shop_name: string;
  title: string;
  main_image_url: string;
  multi_language_info?: {
    main_image_url: string;
    language: string;
    title: string;
  };
  price: string;
  coupon_price?: string;
  promotion_displays: PromotionDisplay[];
  inventory: number;
  tags: unknown[];
}

interface ApiResponse {
  success: boolean
  message: string;
  data: {
    _body?: {
      data?: {
        data?: ProductData[];
      };
    };
  } | null;
}

// Helper function to truncate a number to 2 decimal places without rounding up
function truncateToTwoDecimals(num: number): number {
  return Math.floor(num * 100) / 100;
}

// Helper function to determine stock status
function getStockStatus(inventory: number): { label: string; color: string } {
  if (inventory === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' };
  if (inventory < 10) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' };
  return { label: 'In Stock', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' };
}

// Helper function to format price display
function formatPrice(item: ProductData) {
  const CNY_TO_USD_RATE = parseFloat(process.env.NEXT_PUBLIC_CNY_TO_USD_RATE || '6.1');
  
  const priceInCNY = parseFloat(item.price);
  const couponPriceInCNY = item.coupon_price ? parseFloat(item.coupon_price) : undefined;
  
  // Convert to USD and truncate to 2 decimal places
  const price = truncateToTwoDecimals(priceInCNY / CNY_TO_USD_RATE);
  const couponPrice = couponPriceInCNY ? truncateToTwoDecimals(couponPriceInCNY / CNY_TO_USD_RATE) : undefined;
  
  const hasCoupon = couponPrice !== undefined && couponPrice > 0;
  const hasPromotion = hasCoupon && couponPrice < price;
  
  const currentPrice = hasPromotion && couponPrice ? couponPrice : price;
  const originalPrice = hasPromotion ? price : undefined;
  const discount = hasPromotion && couponPrice
    ? Math.round((1 - couponPrice / price) * 100)
    : 0;
  
  return {
    current: currentPrice,
    original: originalPrice,
    hasCoupon,
    discount
  };
}


import { CartDialog } from '@/components/CartDialog';

// ... existing interfaces ...

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<ProductData[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const router = useRouter();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Save API key to localStorage
  const saveApiKey = (key: string, token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiKey', key);
      localStorage.setItem('authToken', token);
      setShowApiKeyInput(false);
    }
  };

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedApiKey = localStorage.getItem('apiKey');
      const storedAuthToken = localStorage.getItem('authToken');
      if (storedApiKey) {
        setApiKey(storedApiKey);
        setShowApiKeyInput(false);
      }
      if (storedAuthToken) {
        setAuthToken(storedAuthToken);
      }
    }
  }, []);

  // Fetch products from API
  const fetchProducts = useCallback(async (page: number, searchKeyword: string) => {
    if (!apiKey) {
      setError('Please set your API key first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const headers: HeadersInit = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`http://localhost:3000/api/v1/taobao/item-search?keyword=${encodeURIComponent(searchKeyword)}&page_no=${page}&language=en`, {
        method: 'GET',
        headers,
      });

      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch products');
      }

      if (result.success && result.data?._body?.data?.data) {
        const newItems = result.data._body.data.data;
        
        if (page === 1) {
          setItems(newItems);
        } else {
          setItems(prev => [...prev, ...newItems]);
        }
        
        setHasMore(newItems.length > 0);
      } else {
        throw new Error(result.message || 'No data returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey, authToken]);

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !apiKey) return;
    
    setPageNo(1);
    setItems([]);
    setHasMore(true);
    fetchProducts(1, keyword);
  };

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (loading || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && items.length > 0) {
          const nextPage = pageNo + 1;
          setPageNo(nextPage);
          fetchProducts(nextPage, keyword);
        }
      },
      { threshold: 0.1 }
    );

    const currentLoadMoreRef = loadMoreRef.current;
    if (currentLoadMoreRef) {
      observerRef.current.observe(currentLoadMoreRef);
    }

    return () => {
      if (observerRef.current && currentLoadMoreRef) {
        observerRef.current.unobserve(currentLoadMoreRef);
      }
    };
  }, [loading, hasMore, pageNo, keyword, items.length, fetchProducts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      <CartDialog 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        apiKey={apiKey}
        authToken={authToken}
      />
      {/* Simple Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Product Search
            </h1>
            <div className="flex items-center gap-2">
                <button
                onClick={() => {
                  console.log('🛒 Cart button clicked', { apiKey: apiKey ? 'exists' : 'missing', authToken: authToken ? 'exists' : 'missing' });
                  setIsCartOpen(true);
                }}
                className="px-3 py-2 text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors flex items-center gap-1"
                >
                🛒 Cart
                </button>
                <button
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                {apiKey ? '🔑 Key Set' : '⚙️ Set Key'}
                </button>
            </div>
          </div>
        </div>
      </header>


      {/* Desktop Search */}
      <div className="hidden sm:block sticky top-[52px] sm:top-[60px] z-40 bg-white dark:bg-gray-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* API Key Input */}
          {showApiKeyInput && (
            <div className="mb-4 p-4 bg-orange-50 dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                API Configuration
              </h2>
              <div className="space-y-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="X-API-Key"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Authorization Bearer Token (optional)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
                <button
                  onClick={() => saveApiKey(apiKey, authToken)}
                  disabled={!apiKey}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search products..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || !keyword.trim() || !apiKey}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold shadow-md min-h-[44px]"
              >
                {loading && items.length === 0 ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <main className="max-w-7xl mx-auto pb-24 sm:pb-8 px-0 sm:px-4 lg:px-6 pt-4">

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-300 font-medium">❌ {error}</p>
          </div>
        )}

        {/* Results Grid - Mobile First: 2 cols, Tablet: 3 cols, Desktop: 4 cols */}
        {items.length > 0 && (
          <div>
            <div className="px-3 sm:px-0 mb-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
              {items.map((item, index) => {
                const priceInfo = formatPrice(item);
                const stockStatus = getStockStatus(item.inventory);
                const promotions = item.promotion_displays?.flatMap(
                  display => display.promotion_info_list.map(promo => promo.promotion_name)
                ).slice(0, 1) || [];
                const isLowStock = item.inventory > 0 && item.inventory < 10;

                return (
                  <div
                    key={`${item.item_id}-${index}`}
                    onClick={() => router.push(`/product/${item.item_id}`)}
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-sm hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 overflow-hidden active:scale-95 cursor-pointer"
                  >
                    {/* Product Image */}
                    {item.main_image_url && (
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative">
                        <img
                          src={item.main_image_url}
                          alt={item.multi_language_info?.title || item.title || 'Product'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        
                        {/* Discount Badge - Taobao Style */}
                        {priceInfo.discount > 0 && (
                          <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
                            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-bold shadow-lg">
                              -{priceInfo.discount}%
                            </div>
                          </div>
                        )}
                        
                        {/* Low Stock Urgency Badge */}
                        {isLowStock && (
                          <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                            <div className="bg-orange-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold shadow-md">
                              🔥 {item.inventory} left
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Product Info - Compact Mobile Design */}
                    <div className="p-2 sm:p-3">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1.5 sm:mb-2 leading-tight">
                        {item.multi_language_info?.title || item.title || 'No title'}
                      </h3>
                      
                      {/* Price - USD */}
                      <div className="mb-1.5 sm:mb-2">
                        <div className="flex items-baseline gap-1.5 sm:gap-2">
                          <span className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-500 font-bold">$</span>
                          <span className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-500">
                            {priceInfo.current.toFixed(2).split('.')[0]}
                          </span>
                          <span className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-500 font-bold">
                            .{priceInfo.current.toFixed(2).split('.')[1]}
                          </span>
                          {priceInfo.original && (
                            <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 line-through ml-1">
                              ${priceInfo.original.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {priceInfo.hasCoupon && (
                          <div className="inline-block mt-1">
                            <span className="text-[9px] sm:text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">
                              🎟️ Coupon
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Shop and Stock Info - Taobao Style */}
                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span className="font-medium">
                          {item.inventory} in stock
                        </span>
                        {item.shop_name && (
                          <span className="truncate ml-2 max-w-[60%]">
                            {item.shop_name}
                          </span>
                        )}
                      </div>
                      
                      {/* Promotions - Compact */}
                      {promotions.length > 0 && (
                        <div className="mt-1.5">
                          <span className="inline-block px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[9px] sm:text-[10px] rounded border border-red-200 dark:border-red-800 font-medium">
                            {promotions[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading More Indicator */}
        {loading && items.length > 0 && (
          <div className="mt-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-10 mt-8" />

        {/* No More Results */}
        {!hasMore && items.length > 0 && (
          <div className="mt-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No more items to load</p>
          </div>
        )}

        {/* No Results */}
        {!loading && items.length === 0 && !error && keyword && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No results found for &quot;{keyword}&quot;
            </p>
          </div>
        )}

        {/* Initial State */}
        {!loading && items.length === 0 && !keyword && !error && (
          <div className="text-center py-12 sm:py-16 px-4">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🛍️</div>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-lg">
              Search to discover products
            </p>
          </div>
        )}
      </main>

      {/* Mobile Bottom Sticky Search Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 safe-area-inset-bottom">
        <div className="p-3">
          {/* API Key Input (Mobile) */}
          {showApiKeyInput && (
            <div className="mb-3 p-3 bg-orange-50 dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-gray-700">
              <div className="space-y-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="X-API-Key"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white min-h-[44px]"
                />
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Bearer Token (optional)"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white min-h-[44px]"
                />
                <button
                  onClick={() => saveApiKey(apiKey, authToken)}
                  disabled={!apiKey}
                  className="w-full px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  Save
                </button>
              </div>
            </div>
          )}
          
          {/* Search Form (Mobile) */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search products..."
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white min-h-[44px]"
              />
              <button
                type="submit"
                disabled={loading || !keyword.trim() || !apiKey}
                className="px-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-md min-h-[44px] min-w-[70px]"
              >
                {loading && items.length === 0 ? '...' : 'Search'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
