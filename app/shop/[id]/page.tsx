'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAccessToken } from '@/lib/auth-service';

// API Response Types
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
  shop_id: number;
  shop_name: string;
  title: string;
  main_image_url: string;
  multi_language_info?: {
    main_image_url: string;
    language: string;
    title: string;
  };
  price_usd: number;
  coupon_price_usd?: number;
  promotion_displays: PromotionDisplay[];
  inventory: number;
  tags: unknown[];
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: {
    _body?: {
      data?: {
        data?: ProductData[];
      };
    };
  } | null;
}

// Helper function to format a number to 2 decimal places
function formatToTwoDecimals(num: number): number {
  return parseFloat(num.toFixed(2));
}

// Helper function to determine stock status
function getStockStatus(inventory: number): { label: string; color: string } {
  if (inventory === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' };
  if (inventory < 10) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' };
  return { label: 'In Stock', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' };
}

// Helper function to format price display
function formatPrice(item: ProductData) {
  const price = formatToTwoDecimals(item.price_usd || 0);
  const couponPrice = item.coupon_price_usd !== undefined 
    ? formatToTwoDecimals(item.coupon_price_usd) 
    : undefined;
  
  const hasCoupon = couponPrice !== undefined && couponPrice > 0;
  const hasPromotion = hasCoupon && couponPrice < price;
  
  const currentPrice = price;
  const originalPrice: number | undefined = undefined;
  
  const discount = hasPromotion && couponPrice
    ? Math.round((1 - couponPrice / price) * 100)
    : 0;
  const savings = hasPromotion && couponPrice
    ? formatToTwoDecimals(price - couponPrice)
    : 0;
  
  return {
    current: currentPrice,
    original: originalPrice,
    hasCoupon,
    discount,
    savings
  };
}

export default function ShopPage() {
  const router = useRouter();
  const params = useParams();
  const shopId = params?.id as string;

  const [products, setProducts] = useState<ProductData[]>([]);
  const [shopName, setShopName] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Load API key from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedApiKey = localStorage.getItem('apiKey');
      if (storedApiKey) {
        setApiKey(storedApiKey);
      } else {
        setError('API key not found. Please set your API key on the search page.');
        setLoading(false);
      }
    }
  }, []);

  // Restore state from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && shopId) {
      const savedState = sessionStorage.getItem(`shopPage_${shopId}`);
      if (savedState) {
        try {
          const { products: savedProducts, shopName: savedShopName, pageNo: savedPageNo, hasMore: savedHasMore } = JSON.parse(savedState);
          
          if (savedProducts && savedProducts.length > 0) {
            setProducts(savedProducts);
            setShopName(savedShopName || '');
            setPageNo(savedPageNo || 1);
            setHasMore(savedHasMore !== undefined ? savedHasMore : true);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Failed to restore shop state:', err);
        }
      }
    }
  }, [shopId]);

  // Save state to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && shopId && products.length > 0) {
      sessionStorage.setItem(`shopPage_${shopId}`, JSON.stringify({
        products,
        shopName,
        pageNo,
        hasMore
      }));
    }
  }, [shopId, products, shopName, pageNo, hasMore]);

  // Fetch shop products
  const fetchShopProducts = useCallback(async (page: number) => {
    if (!apiKey || !shopId) {
      setError('Missing API key or shop ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const headers: HeadersInit = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      };
      
      const accessToken = getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/item-search?shop_id=${encodeURIComponent(shopId)}&page_no=${page}&language=en&locale=en`,
        {
          method: 'GET',
          headers,
        }
      );

      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch shop products');
      }

      if (result.success && result.data?._body?.data?.data) {
        const newProducts = result.data._body.data.data;
        
        // Extract shop name from first product
        if (newProducts.length > 0 && !shopName) {
          setShopName(newProducts[0].shop_name || 'Unknown Shop');
        }
        
        if (page === 1) {
          setProducts(newProducts);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
        }
        
        setHasMore(newProducts.length > 0);
      } else {
        throw new Error(result.message || 'No products found for this shop');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey, shopId, shopName]);

  // Initial fetch when API key is available and no saved state
  useEffect(() => {
    if (apiKey && shopId && products.length === 0 && !error) {
      fetchShopProducts(1);
    }
  }, [apiKey, shopId, fetchShopProducts, products.length, error]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (loading || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && products.length > 0) {
          const nextPage = pageNo + 1;
          setPageNo(nextPage);
          fetchShopProducts(nextPage);
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
  }, [loading, hasMore, pageNo, products.length, fetchShopProducts]);

  // Loading state (initial)
  if (loading && products.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading shop products...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && products.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
          </div>
        </header>

        {/* Empty State */}
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              No Products Available
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This shop doesn&apos;t have any products at the moment.
            </p>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
        </div>
      </header>

      {/* Shop Info Banner - Gradient Design */}
      <div className="bg-gradient-to-r from-orange-400 to-red-500 p-4 sm:p-6 mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Large Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-2xl sm:text-3xl border-2 border-white/30 flex-shrink-0">
              {shopName.charAt(0).toUpperCase()}
            </div>
            
            {/* Shop Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 truncate">
                {shopName}
              </h1>
              <p className="text-white/90 text-sm sm:text-base">
                Official Store
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto pb-8 px-0 sm:px-4 lg:px-6">
        {/* Products Grid */}
        {products.length > 0 && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 px-3 sm:px-0">
              {products.map((item, index) => {
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
                        
                        {/* Discount Badge */}
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
                    
                    {/* Product Info */}
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
                        </div>
                        {priceInfo.hasCoupon && priceInfo.savings > 0 && (
                          <div className="inline-block mt-1">
                            <span className="text-[9px] sm:text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">
                              Save ${priceInfo.savings.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Stock Info */}
                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span className="font-medium">
                          {item.inventory} in stock
                        </span>
                      </div>
                      
                      {/* Promotions */}
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
        {loading && products.length > 0 && (
          <div className="mt-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        )}

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-10 mt-8" />

        {/* No More Results */}
        {!hasMore && products.length > 0 && (
          <div className="mt-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No more products to load</p>
          </div>
        )}
      </main>
    </div>
  );
}
