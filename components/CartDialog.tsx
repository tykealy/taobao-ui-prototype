'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface CartItem {
  id: string;
  cartId: number;
  itemId: string;
  skuId: string;
  mpItemId: string;
  mpSkuId: string;
  quantity: number;
  price: string;
  promotionPrice: string;
  couponPrice: string;
  picUrl: string;
  itemTitle: string;
  skuTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface GroupedCartItem {
  itemId: string;
  itemTitle: string;
  skus: CartItem[];
}

interface CartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  authToken: string;
}

export function CartDialog({ isOpen, onClose, apiKey, authToken }: CartDialogProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingSkuIds, setUpdatingSkuIds] = useState<Set<string>>(new Set());

  const groupedItems = useMemo(() => {
    const groups: Record<string, GroupedCartItem> = {};
    
    items.forEach(item => {
      if (!groups[item.itemId]) {
        groups[item.itemId] = {
          itemId: item.itemId,
          itemTitle: item.itemTitle,
          skus: []
        };
      }
      groups[item.itemId].skus.push(item);
    });
    
    // Sort groups by itemId and SKUs within groups by skuId to prevent flickering
    return Object.values(groups)
      .sort((a, b) => a.itemId.localeCompare(b.itemId))
      .map(group => ({
        ...group,
        skus: group.skus.sort((a, b) => a.skuId.localeCompare(b.skuId))
      }));
  }, [items]);

  const fetchCart = useCallback(async () => {
    console.log('🛒 fetchCart called', { apiKey: apiKey ? 'exists' : 'missing', authToken: authToken ? 'exists' : 'missing' });
    
    if (!apiKey) {
      console.log('❌ No API key found');
      setError('API key is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'X-API-Key': apiKey };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      console.log('📡 Fetching cart from http://localhost:3000/api/v1/taobao/cart with headers:', headers);
      const res = await fetch('http://localhost:3000/api/v1/taobao/cart', { headers });
      console.log('📥 Response status:', res.status);
      
      const data = await res.json();
      console.log('📦 Cart data received:', data);

      if (data.success) {
        setItems(data.data.lineItems || []);
        console.log('✅ Cart items set:', data.data.lineItems?.length || 0, 'items');
      } else {
        setError(data.message || 'Failed to load cart');
        console.log('❌ Cart fetch failed:', data.message);
      }
    } catch (err) {
      setError('An error occurred while loading cart');
      console.error('❌ Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, authToken]);

  // Fetch cart items when dialog opens
  useEffect(() => {
    console.log('🔄 CartDialog useEffect triggered', { isOpen, apiKey: apiKey ? 'exists' : 'missing' });
    if (isOpen && apiKey) {
      console.log('✅ Calling fetchCart...');
      fetchCart();
    } else {
      console.log('⏭️ Skipping fetchCart:', { isOpen, hasApiKey: !!apiKey });
    }
  }, [isOpen, apiKey, fetchCart]);

  const updateQuantity = async (skuId: string, newQuantity: number) => {
    if (newQuantity <= 0) return; // Or handle remove
    
    // Optimistic update - update UI immediately
    const previousItems = items;
    setItems(prev => 
      prev.map(item => 
        item.skuId === skuId 
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
    
    // Mark as updating
    setUpdatingSkuIds(prev => new Set(prev).add(skuId));
    
    try {
        const headers: Record<string, string> = { 
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch('http://localhost:3000/api/v1/taobao/cart', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ skuId, quantity: newQuantity })
        });
        const data = await res.json();
        
        if (!data.success) {
            // Revert on failure
            setItems(previousItems);
            setError(data.message || 'Failed to update quantity');
        }
    } catch (err) {
        // Revert on error
        setItems(previousItems);
        setError('Failed to update quantity');
    } finally {
        // Remove updating indicator
        setUpdatingSkuIds(prev => {
            const next = new Set(prev);
            next.delete(skuId);
            return next;
        });
    }
  };

  const removeItem = async (skuId: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;

    try {
        const headers: Record<string, string> = { 
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch('http://localhost:3000/api/v1/taobao/cart', {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ skuId })
        });
        const data = await res.json();
        
        if (data.success) {
            fetchCart();
        } else {
            setError(data.message || 'Failed to remove item');
        }
    } catch {
        setError('Failed to remove item');
    }
  };

  const total = items.reduce((sum, item) => sum + ((parseFloat(item.promotionPrice) || 0) * item.quantity), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            🛒 Shopping Cart
            <span className="text-sm font-normal text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {items.length} items
            </span>
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <p className="text-4xl mb-2">🛒</p>
              <p>Your cart is empty</p>
            </div>
          ) : (
            groupedItems.map((group) => (
              <div 
                key={group.itemId} 
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Product Header */}
                <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {group.itemTitle}
                  </h3>
                </div>
                
                {/* SKU Variants List */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {group.skus.map((sku) => (
                    <div 
                      key={sku.id} 
                      className="flex gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
                    >
                      {/* SKU Image */}
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-md flex-shrink-0 overflow-hidden">
                        {sku.picUrl ? (
                          <img 
                            src={sku.picUrl} 
                            alt={sku.skuTitle || 'Product variant'} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            Img
                          </div>
                        )}
                      </div>
                      
                      {/* SKU Details */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        {/* SKU Title */}
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {sku.skuTitle}
                        </p>
                        
                        {/* Price and Controls */}
                        <div className="flex justify-between items-center mt-2 gap-2 flex-wrap">
                          {/* Price */}
                          <div className="font-bold text-orange-600 dark:text-orange-500 text-sm">
                            ${(parseFloat(sku.promotionPrice) * sku.quantity).toFixed(2)}
                            {sku.quantity > 1 && (
                              <span className="text-xs font-normal text-gray-400 ml-1">
                                (${parseFloat(sku.promotionPrice).toFixed(2)} each)
                              </span>
                            )}
                          </div>
                          
                          {/* Quantity Controls + Remove Button */}
                          <div className="flex items-center gap-2">
                            {/* Quantity Stepper */}
                            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                              <button 
                                onClick={() => updateQuantity(sku.skuId, sku.quantity - 1)}
                                disabled={updatingSkuIds.has(sku.skuId) || sku.quantity <= 1}
                                className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span className="px-2 text-sm font-medium text-gray-900 dark:text-white min-w-[24px] text-center">
                                {updatingSkuIds.has(sku.skuId) ? (
                                  <span className="inline-block animate-spin">⟳</span>
                                ) : (
                                  sku.quantity
                                )}
                              </span>
                              <button 
                                onClick={() => updateQuantity(sku.skuId, sku.quantity + 1)}
                                disabled={updatingSkuIds.has(sku.skuId)}
                                className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                            
                            {/* Remove Button */}
                            <button 
                              onClick={() => removeItem(sku.skuId)}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors text-sm"
                              title="Remove item"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Total</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">${total.toFixed(2)}</span>
            </div>
            <button 
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={items.length === 0}
            >
                Checkout Now
            </button>
        </div>
      </div>
    </div>
  );
}
