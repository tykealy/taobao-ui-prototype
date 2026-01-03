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
  const [selectedProperties, setSelectedProperties] = useState<Record<string, string>>({});
  const [propertyGroups, setPropertyGroups] = useState<Array<{
    propName: string;
    propId: number;
    options: Array<{
      valueName: string;
      valueId: number;
      image?: string;
      availableSkus: any[];
    }>;
    showImages?: boolean;
  }>>([]);
  const [hasSkuProperties, setHasSkuProperties] = useState(true);
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

  // Auto-select SKU if only one exists OR if no properties exist
  useEffect(() => {
    if (!product?.sku_list || product.sku_list.length === 0) return;
    
    // Auto-select if only one SKU exists
    if (product.sku_list.length === 1) {
      setSelectedSku(product.sku_list[0]);
      return;
    }
    
    // Auto-select first available SKU if no properties exist
    if (!hasSkuProperties && product.sku_list.length > 0) {
      const firstAvailableSku = product.sku_list.find((sku: any) => sku.quantity > 0);
      setSelectedSku(firstAvailableSku || product.sku_list[0]);
    }
  }, [product, hasSkuProperties]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ ...toast, show: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Extract property groups from SKU list
  useEffect(() => {
    if (!product?.sku_list || product.sku_list.length === 0) return;

    const groups = new Map<string, {
      propName: string;
      propId: number;
      options: Map<string, {
        valueName: string;
        valueId: number;
        image?: string;
        availableSkus: any[];
      }>;
    }>();

    // Build property image map from property_image_list
    // Maps "prop_id:value_id" -> image_url
    const propertyImageMap = new Map<string, string>();
    
    product.property_image_list?.forEach((item: any) => {
      if (!item.properties || !item.image_url) return;
      
      const propertyPairs = item.properties.split(';');
      
      if (propertyPairs.length === 1) {
        // Single property - always use it (highest priority)
        const key = propertyPairs[0].trim();
        if (key) {
          propertyImageMap.set(key, item.image_url);
        }
      } else if (propertyPairs.length > 1) {
        // Multiple properties - only use first property, and only if not already set
        const firstPair = propertyPairs[0].trim();
        if (firstPair && !propertyImageMap.has(firstPair)) {
          propertyImageMap.set(firstPair, item.image_url);
        }
      }
    });

    // Process each SKU and its properties
    product.sku_list.forEach((sku: any) => {
      // Use multi-language properties if available
      const mlSkuProps = product.multi_language_info?.sku_properties?.find(
        (sp: any) => sp.sku_id === sku.sku_id
      );
      const displayProperties = mlSkuProps?.properties || sku.properties;

      displayProperties?.forEach((prop: any) => {
        // Initialize property group if it doesn't exist
        if (!groups.has(prop.prop_name)) {
          groups.set(prop.prop_name, {
            propName: prop.prop_name,
            propId: prop.prop_id,
            options: new Map()
          });
        }

        const group = groups.get(prop.prop_name)!;
        
        // Initialize option if it doesn't exist
        if (!group.options.has(prop.value_name)) {
          // Look up property-specific image from property_image_list
          const imageKey = `${prop.prop_id}:${prop.value_id}`;
          const propertyImage = propertyImageMap.get(imageKey);
          
          group.options.set(prop.value_name, {
            valueName: prop.value_name,
            valueId: prop.value_id,
            image: propertyImage || sku.pic_url, // Prioritize property image, fallback to SKU image
            availableSkus: []
          });
        }

        // Add this SKU to the option's available SKUs
        group.options.get(prop.value_name)!.availableSkus.push(sku);
      });
    });

    // Convert to array format and sort by number of options (ascending)
    const propertyGroupsArray = Array.from(groups.values())
      .map(group => {
        const options = Array.from(group.options.values());
        
        // Check if this property has unique images for different options
        const imagesAvailable = options.filter(opt => opt.image).length;
        const uniqueImages = new Set(options.map(opt => opt.image).filter(Boolean));
        const hasVisualDifferences = imagesAvailable > 0 && uniqueImages.size > 1;
        
        return {
          propName: group.propName,
          propId: group.propId,
          options: options,
          showImages: hasVisualDifferences
        };
      })
      .sort((a, b) => a.options.length - b.options.length); // Render props with fewer options first

    setPropertyGroups(propertyGroupsArray);
    setHasSkuProperties(propertyGroupsArray.length > 0);
  }, [product]);

  // Auto-match SKU when properties are selected
  useEffect(() => {
    // Skip property matching if SKUs don't have properties
    if (!hasSkuProperties) {
      return;
    }
    
    if (!product?.sku_list || Object.keys(selectedProperties).length === 0) {
      setSelectedSku(null);
      return;
    }

    // Check if all properties are selected
    if (Object.keys(selectedProperties).length !== propertyGroups.length) {
      setSelectedSku(null);
      return;
    }

    // Find matching SKU
    const matchingSku = product.sku_list.find((sku: any) => {
      // Use multi-language properties if available
      const mlSkuProps = product.multi_language_info?.sku_properties?.find(
        (sp: any) => sp.sku_id === sku.sku_id
      );
      const displayProperties = mlSkuProps?.properties || sku.properties;

      // Check if all properties match
      return displayProperties?.every((prop: any) => 
        selectedProperties[prop.prop_name] === prop.value_name
      );
    });

    setSelectedSku(matchingSku || null);

    // Update main image if SKU has one
    if (matchingSku?.pic_url) {
      setSelectedImage(matchingSku.pic_url);
    }
  }, [selectedProperties, product, propertyGroups.length, hasSkuProperties]);

  // Helper function to check if an option is available
  const isOptionAvailable = (propName: string, valueName: string): boolean => {
    if (!product?.sku_list) return false;

    // Find all SKUs that have this specific property value
    const matchingSkus = product.sku_list.filter((sku: any) => {
      const mlSkuProps = product.multi_language_info?.sku_properties?.find(
        (sp: any) => sp.sku_id === sku.sku_id
      );
      const displayProperties = mlSkuProps?.properties || sku.properties;

      return displayProperties?.some((prop: any) => 
        prop.prop_name === propName && prop.value_name === valueName
      );
    });

    // Check if any of these SKUs also match other selected properties
    const availableSkus = matchingSkus.filter((sku: any) => {
      const mlSkuProps = product.multi_language_info?.sku_properties?.find(
        (sp: any) => sp.sku_id === sku.sku_id
      );
      const displayProperties = mlSkuProps?.properties || sku.properties;

      // Check if this SKU matches all other selected properties (excluding current one)
      const otherSelectedProps = Object.entries(selectedProperties).filter(
        ([key]) => key !== propName
      );

      const matchesOtherProps = otherSelectedProps.every(([key, value]) =>
        displayProperties?.some((prop: any) => 
          prop.prop_name === key && prop.value_name === value
        )
      );

      // Also check if SKU has stock
      return matchesOtherProps && sku.quantity > 0;
    });

    return availableSkus.length > 0;
  };

  // Handle property selection (toggle behavior)
  const handlePropertySelect = (propName: string, valueName: string) => {
    setSelectedProperties(prev => {
      // If clicking the already selected option, remove it (unselect)
      if (prev[propName] === valueName) {
        const { [propName]: removed, ...rest } = prev;
        return rest;
      }
      // Otherwise, select the new option
      return {
        ...prev,
        [propName]: valueName
      };
    });
  };

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
  // If SKU is selected, use SKU prices; otherwise use product base prices
  const priceInUSD = selectedSku 
    ? parseFloat(selectedSku.price_usd || '0')
    : parseFloat(product.price_usd || '0');
  const promotionPriceInUSD = selectedSku
    ? (selectedSku.promotion_price_usd ? parseFloat(selectedSku.promotion_price_usd) : undefined)
    : (product.promotion_price_usd ? parseFloat(product.promotion_price_usd) : undefined);
  const hasPromotion = promotionPriceInUSD !== undefined && promotionPriceInUSD > 0 && promotionPriceInUSD < priceInUSD;
  const currentPrice = hasPromotion && promotionPriceInUSD ? promotionPriceInUSD : priceInUSD;
  const originalPrice = hasPromotion ? priceInUSD : undefined;
  const discount = hasPromotion && promotionPriceInUSD ? Math.round((1 - promotionPriceInUSD / priceInUSD) * 100) : 0;
  
  // CNY prices for display (converted from cents to yuan)
  const priceInCNYCents = selectedSku
    ? parseFloat(selectedSku.price || '0')
    : parseFloat(product.price || '0');
  const priceInCNY = priceInCNYCents / 100;

  // Stock display - use SKU quantity if selected, otherwise product inventory
  const displayInventory = selectedSku ? selectedSku.quantity : product.inventory;

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
                  {displayInventory !== undefined && (
                    <span className={`px-3 py-1 rounded-full font-medium ${
                      displayInventory > 10 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : displayInventory > 0
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {displayInventory > 0 
                        ? `${displayInventory} in stock`
                        : 'Out of stock'
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* Simple SKU Selector - for SKUs without properties */}
              {!hasSkuProperties && product.sku_list && product.sku_list.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    Select Option
                  </h3>
                  
                  {/* Visual SKU Cards with images */}
                  <div className="flex flex-col gap-2">
                    {product.sku_list.map((sku: any, idx: number) => {
                      const isSelected = selectedSku?.sku_id === sku.sku_id;
                      const isAvailable = sku.quantity > 0;
                      const skuPrice = parseFloat(sku.price_usd || sku.promotion_price_usd || '0');
                      
                      return (
                        <button
                          key={sku.sku_id}
                          onClick={() => setSelectedSku(sku)}
                          disabled={!isAvailable}
                          className={`
                            flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left
                            ${isSelected 
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-500' 
                              : isAvailable
                              ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-900/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-40 cursor-not-allowed'
                            }
                          `}
                        >
                          {/* SKU Image if available */}
                          {sku.pic_url && (
                            <img 
                              src={sku.pic_url} 
                              alt={`Option ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0"
                            />
                          )}
                          
                          {/* SKU Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                              Option {idx + 1}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              SKU: {sku.sku_id}
                            </p>
                          </div>
                          
                          {/* Price & Stock */}
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-bold ${isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                              ${skuPrice.toFixed(2)}
                            </p>
                            <p className={`text-xs ${isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isAvailable ? `${sku.quantity} available` : 'Out of stock'}
                            </p>
                          </div>
                          
                          {/* Selected Indicator */}
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Selected Summary */}
                  {selectedSku && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Selected: Option {product.sku_list.findIndex((s: any) => s.sku_id === selectedSku.sku_id) + 1}
                        </p>
                        <div className="text-right">
                          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            ${parseFloat(selectedSku.price_usd || selectedSku.promotion_price_usd || '0').toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedSku.quantity} available
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Property Selector - only show when properties exist */}
              {hasSkuProperties && propertyGroups.length > 0 && (
                <div className="space-y-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    Select Options
                  </h3>
                  
                  {propertyGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-3">
                      <label className="block text-base font-bold text-gray-900 dark:text-white">
                        {group.propName}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {group.options.map((option, optionIdx) => {
                          const isSelected = selectedProperties[group.propName] === option.valueName;
                          const isAvailable = isOptionAvailable(group.propName, option.valueName);
                          
                          return (
                            <button
                              key={optionIdx}
                              onClick={() => handlePropertySelect(group.propName, option.valueName)}
                              disabled={!isAvailable}
                              className={`
                                ${group.showImages 
                                  ? 'flex flex-row items-center gap-3 p-3 min-w-[120px]'
                                  : 'px-5 py-3 min-w-[80px]'
                                }
                                rounded-lg border-2 transition-all text-sm
                                ${isSelected 
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-500 font-bold text-orange-600 dark:text-orange-400' 
                                  : isAvailable
                                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 text-gray-900 dark:text-white font-medium'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-600 line-through'
                                }
                              `}
                            >
                              {group.showImages && option.image ? (
                                <>
                                  <img 
                                    src={option.image} 
                                    alt={option.valueName}
                                    className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-md border border-gray-200 dark:border-gray-700 flex-shrink-0"
                                  />
                                  <span className="text-xs sm:text-sm font-medium text-left">{option.valueName}</span>
                                </>
                              ) : (
                                <span>{option.valueName}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Selection Summary */}
                  {Object.keys(selectedProperties).length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Selected:
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {Object.entries(selectedProperties).map(([key, value]) => `${value}`).join(' / ')}
                            </p>
                          </div>
                          {selectedSku && (
                            <div className="text-right">
                              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                ${getSkuPrice(selectedSku).toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {selectedSku.quantity} available
                              </p>
                            </div>
                          )}
                        </div>
                        {!selectedSku && Object.keys(selectedProperties).length < propertyGroups.length && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Please select all options to continue
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shop Info */}
              {product.shop_name && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  {/* Shop Name with Avatar */}
                  <div className="flex items-center gap-4">
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
                  
                  {/* View Shop Button */}
                  <button 
                    onClick={() => router.push(`/shop/${product.shop_id}`)}
                    className="w-full py-2.5 px-4 bg-white dark:bg-gray-700 border-2 border-orange-500 dark:border-orange-600 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors font-semibold text-sm"
                  >
                    View Shop
                  </button>
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
                {hasSkuProperties ? 'Select all options' : 'Please select an option'}
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
