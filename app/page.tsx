'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { extractProductId, isUrl, isShortenedTaobaoUrl, extractUrlFromText } from '@/lib/extract-product-id';
import { authenticateWithBearerToken, storeTokens, getAccessToken } from '@/lib/auth-service';
import { uploadImageForSearch, createImagePreview, revokeImagePreview } from '@/lib/upload-image';

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
  price_usd: number;
  coupon_price_usd?: number;
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
  // Use USD prices directly from API (no conversion needed)
  const price = formatToTwoDecimals(item.price_usd || 0);
  const couponPrice = item.coupon_price_usd !== undefined 
    ? formatToTwoDecimals(item.coupon_price_usd) 
    : undefined;
  
  const hasCoupon = couponPrice !== undefined && couponPrice > 0;
  const hasPromotion = hasCoupon && couponPrice < price;
  
  // Always display price_usd, never show coupon_price_usd as main price
  const currentPrice = price;
  const originalPrice: number | undefined = undefined; // Remove strikethrough price display
  
  // Calculate discount percentage and savings amount
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


import { CartDialog } from '@/components/CartDialog';
import { OrdersListDialog } from '@/components/OrdersListDialog';

// ... existing interfaces ...

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<ProductData[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Image search states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [searchMode, setSearchMode] = useState<'keyword' | 'image' | null>(null);
  
  const router = useRouter();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Save API key and authenticate with bearer token
  const saveApiKey = async (key: string, token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiKey', key);
      
      if (token) {
        setIsAuthenticating(true);
        setError('');
        try {
          const response = await authenticateWithBearerToken(key, token);
          storeTokens(response.data.accessToken, response.data.refreshToken);
          setShowApiKeyInput(false);
          setBearerToken(''); // Clear bearer token input after successful auth
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
          setIsAuthenticating(false);
        }
      } else {
        setShowApiKeyInput(false);
      }
    }
  };

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedApiKey = localStorage.getItem('apiKey');
      if (storedApiKey) {
        setApiKey(storedApiKey);
        setShowApiKeyInput(false);
      }
      // Note: accessToken is retrieved directly in API calls via getAccessToken()
    }
  }, []);

  // Restore search state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSearchState = sessionStorage.getItem('searchState');
      if (savedSearchState) {
        try {
          const { 
            searchMode: savedMode, 
            keyword: savedKeyword, 
            items: savedItems, 
            pageNo: savedPageNo,
            hasMore: savedHasMore 
          } = JSON.parse(savedSearchState);
          
          if (savedItems && savedItems.length > 0) {
            setSearchMode(savedMode);
            setKeyword(savedKeyword || '');
            setItems(savedItems);
            setPageNo(savedPageNo || 1);
            setHasMore(savedHasMore !== undefined ? savedHasMore : true);
          }
        } catch (err) {
          console.error('Failed to restore search state:', err);
        }
      }
    }
  }, []);

  // Save search state to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && items.length > 0) {
      sessionStorage.setItem('searchState', JSON.stringify({
        searchMode,
        keyword,
        items,
        pageNo,
        hasMore
      }));
    }
  }, [searchMode, keyword, items, pageNo, hasMore]);

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
      
      const accessToken = getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/item-search?keyword=${encodeURIComponent(searchKeyword)}&page_no=${page}&language=en`, {
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
  }, [apiKey]);

  // Fetch products by image from API
  const fetchProductsByImage = useCallback(async (imageUrl: string) => {
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
      
      const accessToken = getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Same endpoint, but with pic_url instead of keyword
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/item-search?pic_url=${encodeURIComponent(imageUrl)}&language=en`, {
        method: 'GET',
        headers,
      });

      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to search by image');
      }

      if (result.success && result.data?._body?.data?.data) {
        const newItems = result.data._body.data.data;
        setItems(newItems);
        setHasMore(false); // Image search doesn't support pagination
        setSearchMode('image');
      } else {
        throw new Error(result.message || 'No products found for this image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  // Handle search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !apiKey) return;
    
    // Auto-extract URL from mixed text (e.g., shared from Taobao app)
    const cleanedInput = extractUrlFromText(keyword.trim());
    
    // Check if input is a product URL
    if (isUrl(cleanedInput)) {
      // Check if it's a shortened link that needs resolution
      if (isShortenedTaobaoUrl(cleanedInput)) {
        setIsNavigating(true);
        setError('');
        
        try {
          const response = await fetch(`/api/resolve-url?url=${encodeURIComponent(cleanedInput)}`);
          const result = await response.json();
          
          if (result.success && result.data?.productId) {
            router.push(`/product/${result.data.productId}`);
            return;
          } else {
            setError(result.message || 'Could not resolve the shortened URL. Please try opening the link in Taobao app first and copy the full URL.');
            setIsNavigating(false);
            return;
          }
        } catch (err) {
          setError('Failed to resolve URL. Please try again or use the full product URL.');
          setIsNavigating(false);
          return;
        }
      }
      
      // Try to extract product ID from regular URL
      const productId = extractProductId(cleanedInput);
      
      if (productId) {
        // Show loading state and navigate to product page
        setIsNavigating(true);
        setError('');
        router.push(`/product/${productId}`);
        return;
      } else {
        // Show error if URL detected but ID couldn't be extracted
        setError('Could not extract product ID from the URL. Please check the link and try again.');
        return;
      }
    }
    
    // Existing keyword search logic
    setPageNo(1);
    setItems([]);
    setHasMore(true);
    setSearchMode('keyword');
    fetchProducts(1, keyword);
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size exceeds 10MB limit');
      return;
    }

    // Clear any previous errors
    setError('');
    
    // Set selected image and create preview
    setSelectedImage(file);
    const previewUrl = createImagePreview(file);
    setImagePreview(previewUrl);
    
    // Clear text keyword when image is selected
    setKeyword('');
  };

  // Handle image search/upload
  const handleImageSearch = async () => {
    if (!selectedImage || !apiKey) {
      setError('Please select an image and ensure API key is set');
      return;
    }

    setIsImageUploading(true);
    setError('');

    try {
      const accessToken = getAccessToken();
      const result = await uploadImageForSearch(selectedImage, apiKey, accessToken || undefined);

      if (result.success && result.data) {
        const imageUrl = result.data;
        
        // Search for products using the uploaded image
        await fetchProductsByImage(imageUrl);
        
        // Clear the image selection after search completes
        clearImageSelection();
      } else {
        throw new Error(result.message || 'Failed to upload image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      
      // If we have the image URL but search failed, show it in alert for retry
      if (err instanceof Error && err.message.includes('search')) {
        // Search failed but upload succeeded - could add retry logic here
      }
    } finally {
      setIsImageUploading(false);
    }
  };

  // Clear image selection
  const clearImageSelection = () => {
    if (imagePreview) {
      revokeImagePreview(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Open file picker
  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  // Cleanup image preview on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) {
        revokeImagePreview(imagePreview);
      }
    };
  }, [imagePreview]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    // Only enable infinite scroll for keyword search
    if (loading || !hasMore || searchMode !== 'keyword') return;

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
  }, [loading, hasMore, pageNo, keyword, items.length, fetchProducts, searchMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      <CartDialog 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        apiKey={apiKey}
      />
      <OrdersListDialog
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        apiKey={apiKey}
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
                  console.log('🛒 Cart button clicked', { apiKey: apiKey ? 'exists' : 'missing' });
                  setIsCartOpen(true);
                }}
                className="px-3 py-2 text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors flex items-center gap-1"
                >
                🛒 Cart
                </button>
                <button
                onClick={() => setIsOrdersOpen(true)}
                className="px-3 py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                📦 Orders
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

      {/* Mobile Search - Sticky at top */}
      <div className="sm:hidden sticky top-[52px] z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md safe-top">
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
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="Third-Party Bearer Token"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white min-h-[44px]"
                />
                <button
                  onClick={() => saveApiKey(apiKey, bearerToken)}
                  disabled={!apiKey || isAuthenticating}
                  className="w-full px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  {isAuthenticating ? 'Authenticating...' : 'Save'}
                </button>
              </div>
            </div>
          )}
          
          {/* Image Preview (Mobile) */}
          {imagePreview && selectedImage && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <img 
                  src={imagePreview} 
                  alt="Selected" 
                  className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {selectedImage.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearImageSelection}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Search Form (Mobile) */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    // Clear image selection when user types in keyword
                    if (e.target.value && selectedImage) {
                      clearImageSelection();
                    }
                  }}
                  placeholder="Search or paste link..."
                  className="w-full px-4 py-2.5 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white min-h-[44px]"
                />
                {/* Paste button for mobile */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setKeyword(text);
                      // Clear image selection when pasting text
                      if (selectedImage) {
                        clearImageSelection();
                      }
                    } catch (err) {
                      console.error('Failed to read clipboard:', err);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  📋
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || !keyword.trim() || !apiKey || isNavigating}
                className="px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold shadow-md text-sm min-h-[44px]"
              >
                {isNavigating ? 'Resolving...' : loading && items.length === 0 ? '...' : '🔍'}
              </button>
            </div>
            
            {/* Image Search Controls (Mobile) */}
            <div className="flex gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={openImagePicker}
                disabled={isImageUploading}
                className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px] flex items-center justify-center gap-2"
              >
                📷 {selectedImage ? 'Change Image' : 'Camera/Upload'}
              </button>
              {selectedImage && (
                <button
                  type="button"
                  onClick={handleImageSearch}
                  disabled={isImageUploading || !apiKey}
                  className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-sm min-h-[44px]"
                >
                  {isImageUploading ? 'Uploading...' : 'Search by Image'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

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
                  type="text"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="Third-Party Bearer Token"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
                <button
                  onClick={() => saveApiKey(apiKey, bearerToken)}
                  disabled={!apiKey || isAuthenticating}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {isAuthenticating ? 'Authenticating...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Image Preview (Desktop) */}
          {imagePreview && selectedImage && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-4">
                <img 
                  src={imagePreview} 
                  alt="Selected" 
                  className="w-20 h-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {selectedImage.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearImageSelection}
                  className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors font-medium text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  // Clear image selection when user types in keyword
                  if (e.target.value && selectedImage) {
                    clearImageSelection();
                  }
                }}
                placeholder="Search products or paste product link..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || !keyword.trim() || !apiKey || isNavigating}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold shadow-md min-h-[44px]"
              >
                {isNavigating ? 'Resolving link...' : loading && items.length === 0 ? 'Searching...' : 'Search'}
              </button>
            </div>
            
            {/* Image Search Controls (Desktop) */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openImagePicker}
                disabled={isImageUploading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm flex items-center gap-2"
              >
                📷 {selectedImage ? 'Change Image' : 'Upload Image'}
              </button>
              {selectedImage && (
                <button
                  type="button"
                  onClick={handleImageSearch}
                  disabled={isImageUploading || !apiKey}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-sm"
                >
                  {isImageUploading ? 'Uploading...' : 'Search by Image'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <main className="max-w-7xl mx-auto pb-8 px-0 sm:px-4 lg:px-6 pt-4">

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
                        </div>
                        {priceInfo.hasCoupon && priceInfo.savings > 0 && (
                          <div className="inline-block mt-1">
                            <span className="text-[9px] sm:text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">
                              Save ${priceInfo.savings.toFixed(2)}
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
    </div>
  );
}
