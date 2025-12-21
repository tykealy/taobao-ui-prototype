'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CartDialog } from '@/components/CartDialog';
import { getAccessToken } from '@/lib/auth-service';

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  
  // SKU Selection and Cart state
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState<{show: boolean; message: string; type: 'success' | 'error'}>({
    show: false,
    message: '',
    type: 'success'
  });

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    } else {
      setError('API key not found. Please set your API key on the search page.');
      setLoading(false);
    }
    // Note: accessToken is retrieved directly in API calls via getAccessToken()
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

        const headers: HeadersInit = {
          'X-API-Key': apiKey,
        };
        
        const accessToken = getAccessToken();
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers
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

  // Auto-select SKU if only one exists
  useEffect(() => {
    if (product?.sku_list && product.sku_list.length === 1) {
      setSelectedSku(product.sku_list[0]);
    }
  }, [product]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ ...toast, show: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Add to cart function
  const addToCart = async () => {
    const accessToken = getAccessToken();
    if (!selectedSku || !accessToken) return;

    setIsAddingToCart(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          itemId: String(product.item_id),
          skuId: String(selectedSku.sku_id),
          quantity: quantity
        })
      });

      const data = await response.json();

      if (data.success) {
        setToast({ show: true, message: 'Added to cart!', type: 'success' });
        setShowQuantityModal(false);
        setQuantity(1);
      } else {
        setToast({ show: true, message: data.message || 'Failed to add to cart', type: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Error adding to cart', type: 'error' });
    } finally {
      setIsAddingToCart(false);
    }
  };

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

  // Use pre-calculated USD prices from API
  const priceInUSD = parseFloat(product.price_usd || '0');
  const promotionPriceInUSD = product.promotion_price_usd ? parseFloat(product.promotion_price_usd) : undefined;
  const hasPromotion = promotionPriceInUSD !== undefined && promotionPriceInUSD > 0 && promotionPriceInUSD < priceInUSD;
  const currentPrice = hasPromotion && promotionPriceInUSD ? promotionPriceInUSD : priceInUSD;
  const originalPrice = hasPromotion ? priceInUSD : undefined;
  const discount = hasPromotion && promotionPriceInUSD ? Math.round((1 - promotionPriceInUSD / priceInUSD) * 100) : 0;
  
  // CNY prices for display (converted from cents to yuan)
  const priceInCNYCents = parseFloat(product.price || '0');
  const priceInCNY = priceInCNYCents / 100;

  // Calculate SKU price for modal
  const getSkuPrice = (sku: any) => {
    const hasPromotion = sku.promotion_price_usd && 
                         parseFloat(sku.promotion_price_usd) > 0 && 
                         parseFloat(sku.promotion_price_usd) < parseFloat(sku.price_usd);
    return hasPromotion ? parseFloat(sku.promotion_price_usd) : parseFloat(sku.price_usd || 0);
  };

  const selectedSkuPrice = selectedSku ? getSkuPrice(selectedSku) : 0;
  const totalPrice = selectedSkuPrice * quantity;

  // Get SKU summary for modal
  const getSkuSummary = (sku: any) => {
    const mlSkuProps = product.multi_language_info?.sku_properties?.find(
      (sp: any) => sp.sku_id === sku.sku_id
    );
    const displayProperties = mlSkuProps?.properties || sku.properties;
    return displayProperties?.map((prop: any) => prop.value_name).join(', ') || 'Default';
  };

  const isAddToCartDisabled = !selectedSku || !getAccessToken() || (selectedSku?.quantity || 0) === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <span>{toast.type === 'success' ? '✓' : '✕'}</span>
            <span className="font-medium">{toast.message}</span>
            <button 
              onClick={() => setToast({ ...toast, show: false })}
              className="ml-2 hover:opacity-80 transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Quantity Modal */}
      {showQuantityModal && selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Quantity</h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* SKU Info */}
              <div className="flex gap-4">
                {selectedSku.pic_url && (
                  <img 
                    src={selectedSku.pic_url} 
                    alt="SKU" 
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {product.multi_language_info?.title || product.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {getSkuSummary(selectedSku)}
                  </p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    ${selectedSkuPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quantity
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantity(Math.min(Math.max(1, val), selectedSku.quantity));
                    }}
                    min="1"
                    max={selectedSku.quantity}
                    className="w-20 h-10 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(selectedSku.quantity, quantity + 1))}
                    disabled={quantity >= selectedSku.quantity}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedSku.quantity} available
                  </span>
                </div>
              </div>

              {/* Total Price */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-3">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setQuantity(1);
                }}
                disabled={isAddingToCart}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={addToCart}
                disabled={isAddingToCart}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingToCart ? 'Adding...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
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
                         <div 
                          key={idx} 
                          onClick={() => setSelectedSku(sku)}
                          className={`border rounded-lg p-3 transition-all hover:shadow-md cursor-pointer ${
                            selectedSku?.sku_id === sku.sku_id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-500'
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700'
                          }`}
                        >
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
                                  {sku.promotion_price_usd && parseFloat(sku.promotion_price_usd) > 0 && parseFloat(sku.promotion_price_usd) < parseFloat(sku.price_usd) ? (
                                    <>
                                      <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                                        ${parseFloat(sku.promotion_price_usd).toFixed(2)}
                                      </span>
                                      <span className="text-xs text-gray-400 line-through">
                                        ${parseFloat(sku.price_usd).toFixed(2)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                                      ${parseFloat(sku.price_usd || 0).toFixed(2)}
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

        {/* Sticky Add to Cart Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40">
          <div className="max-w-7xl mx-auto">
            {!getAccessToken() ? (
              <button
                disabled
                className="w-full py-4 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed"
              >
                Please login to add items to cart
              </button>
            ) : !selectedSku ? (
              <button
                disabled
                className="w-full py-4 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed"
              >
                Select a variant first
              </button>
            ) : selectedSku.quantity === 0 ? (
              <button
                disabled
                className="w-full py-4 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed"
              >
                Out of stock
              </button>
            ) : (
              <button
                onClick={() => setShowQuantityModal(true)}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="text-xl">🛒</span>
                <span>Add to Cart</span>
                <span className="text-sm opacity-90">- ${selectedSkuPrice.toFixed(2)}</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
