'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

// Helper function to format price display
// Price comes in CNY cents, so divide by 100 first to get yuan, then divide by ~7 to get USD
function formatPrice(priceInCNYCents: number) {
  const priceInYuan = priceInCNYCents / 100; // Convert cents to yuan
  const priceInUSD = priceInYuan / parseFloat(process.env.NEXT_PUBLIC_CNY_TO_USD_RATE || '6.1'); // Convert yuan to USD (approximately)
  return priceInUSD.toFixed(2);
}
 
export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('taobao_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    } else {
      setError('API key not found. Please set your API key on the search page.');
      setLoading(false);
    }
  }, []);

  // Fetch product details
  useEffect(() => {
    if (!apiKey || !itemId) return;

    const fetchProductDetail = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          id: itemId,
          language: 'en'
        });
        const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/item-detail?${params}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey
          }
        });

        const data = await response.json();
        console.log('📦 Item Detail API Response:', data);

        if (data.success && data.data) {
          setProduct(data.data);
          // Set initial selected image
          setSelectedImage(data.data.multi_language_info?.main_image_url || data.data.pic_urls?.[0] || '');
        } else {
          setError(data.message || 'Failed to fetch product details');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetail();
  }, [apiKey, itemId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  const priceInCNYCents = parseFloat(product.price || '0');
  const promotionPriceInCNYCents = product.promotion_price ? parseFloat(product.promotion_price) : undefined;
  const priceInCNY = priceInCNYCents / 100; // Convert cents to yuan
  const promotionPriceInCNY = promotionPriceInCNYCents ? promotionPriceInCNYCents / 100 : undefined;
  const priceInUSD = parseFloat(formatPrice(priceInCNYCents));
  const promotionPriceInUSD = promotionPriceInCNYCents ? parseFloat(formatPrice(promotionPriceInCNYCents)) : undefined;
  const hasPromotion = promotionPriceInUSD !== undefined && promotionPriceInUSD > 0 && promotionPriceInUSD < priceInUSD;
  const currentPrice = hasPromotion && promotionPriceInUSD ? promotionPriceInUSD : priceInUSD;
  const originalPrice = hasPromotion ? priceInUSD : undefined;
  const discount = hasPromotion && promotionPriceInUSD ? Math.round((1 - promotionPriceInUSD / priceInUSD) * 100) : 0;

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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 sm:p-8">
            {/* Left Column - Images */}
            <div className="space-y-4">
              {/* Main Image */}
              {selectedImage && (
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                  <img
                    src={selectedImage}
                    alt={product.multi_language_info?.title || product.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Thumbnail Gallery */}
              {product.property_image_list && product.property_image_list.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.property_image_list.slice(0, 8).map((img: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        selectedImage === img.image_url 
                          ? 'ring-2 ring-orange-500' 
                          : 'hover:ring-2 hover:ring-orange-300'
                      }`}
                      onClick={() => setSelectedImage(img.image_url)}
                    >
                      <img src={img.image_url} alt={`Property ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Product Info */}
            <div className="space-y-6">
              {/* Title */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                  {product.multi_language_info?.title || product.title || 'Product Title'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Item ID: {product.item_id}
                </p>
              </div>

              {/* Price Section */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-5 rounded-xl border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl sm:text-5xl font-bold text-orange-600 dark:text-orange-400">
                    ${currentPrice.toFixed(2)}
                  </span>
                  {originalPrice && (
                    <>
                      <span className="text-lg text-gray-400 line-through">
                        ${originalPrice.toFixed(2)}
                      </span>
                      {discount > 0 && (
                        <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                          -{discount}%
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600 dark:text-gray-400">
                  <span>¥{priceInCNY.toFixed(2)} CNY</span>
                  {product.inventory !== undefined && (
                    <span className={`px-3 py-1 rounded-full font-medium ${
                      product.inventory > 10 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : product.inventory > 0
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {product.inventory > 0 
                        ? `${product.inventory} in stock`
                        : 'Out of stock'
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* SKU Variants - MOVED HERE UNDER PRICE */}
              {product.sku_list && product.sku_list.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    Select Options ({product.sku_list.length} available)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {product.sku_list.map((sku: any, idx: number) => {
                      // Find multilanguage properties for this SKU if available
                      const mlSkuProps = product.multi_language_info?.sku_properties?.find(
                        (sp: any) => sp.sku_id === sku.sku_id
                      );
                      const displayProperties = mlSkuProps?.properties || sku.properties;

                      // Debug logging
                      console.log(`SKU ${idx}:`, {
                        price: sku.price,
                        promotion_price: sku.promotion_price,
                        coupon_price: sku.coupon_price,
                        hasPromotion: sku.promotion_price && parseFloat(sku.promotion_price) > 0 && parseFloat(sku.promotion_price) < parseFloat(sku.price)
                      });

                      return (
                         <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-orange-500 dark:hover:border-orange-500 transition-all hover:shadow-md cursor-pointer">
                          <div className="flex gap-3">
                            {sku.pic_url && (
                              <img src={sku.pic_url} alt="SKU" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="space-y-1 mb-2">
                                {displayProperties?.map((prop: any, pidx: number) => (
                                  <p key={pidx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    <span className="font-medium text-gray-900 dark:text-white">{prop.prop_name}:</span> {prop.value_name}
                                  </p>
                                ))}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-2">
                                  {sku.promotion_price && parseFloat(sku.promotion_price) > 0 && parseFloat(sku.promotion_price) < parseFloat(sku.price) ? (
                                    <>
                                      <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                                        ${formatPrice(parseFloat(sku.promotion_price))}
                                      </span>
                                      <span className="text-xs text-gray-400 line-through">
                                        ${formatPrice(parseFloat(sku.price))}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                                      ${formatPrice(parseFloat(sku.price || 0))}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {sku.quantity} left
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shop Info */}
              {product.shop_name && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {product.shop_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {product.shop_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Official Store</p>
                  </div>
                </div>
              )}

              {/* Promotions */}
              {product.promotion_displays && product.promotion_displays.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Special Offers</h3>
                  <div className="space-y-2">
                    {product.promotion_displays.map((display: any, idx: number) => (
                      <div key={idx} className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50/50 dark:bg-red-900/10">
                        <p className="font-medium text-red-600 dark:text-red-400 text-sm mb-1">
                          {display.type_name}
                        </p>
                        {display.promotion_info_list?.map((promo: any, pidx: number) => (
                          <p key={pidx} className="text-xs text-gray-600 dark:text-gray-400">
                            • {promo.promotion_name}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description Section - MOVED TO BOTTOM */}
          {(product.description || product.multi_language_info?.description) && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-6 sm:p-8">
              <h3 className="font-semibold text-gray-900 dark:text-white text-xl mb-4">Product Description</h3>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400"
                dangerouslySetInnerHTML={{ 
                  __html: (product.multi_language_info?.description || product.description || '').replace(/style="[^"]*"/g, '') 
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
