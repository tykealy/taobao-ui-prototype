'use client';

import { useState } from 'react';

interface OrderItem {
  sku_id: string;
  mp_sku_id: string;
  item_id: string;
  mp_item_id: string;
  item_title: string;
  sku_title: string;
  pic_url: string;
  quantity: number;
  price_usd: number;
  promotion_price_usd: number;
  coupon_price_usd: number;
  subtotal_usd: number;
  is_available: boolean;
  available_quantity?: number | null;
  unavailable_reason?: string;
  error_code?: string;
}

interface OrderSummaryData {
  success: boolean;
  message: string;
  data: {
    summary: {
      total_items: number;
      available_items: number;
      unavailable_items: number;
      total_shipping_fee_usd: number;
    };
    items: OrderItem[];
  };
}

interface OrderSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: OrderSummaryData;
  onProceedToCreateOrder: () => void;
  onRemoveUnavailable: () => void;
  onReCalculate: (skuIds: string[]) => Promise<void>;
  apiKey: string;
  authToken: string;
}

export function OrderSummaryDialog({
  isOpen,
  onClose,
  data,
  onProceedToCreateOrder,
  onRemoveUnavailable,
  onReCalculate,
  apiKey,
  authToken,
}: OrderSummaryDialogProps) {
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, number>>({});
  const [isRecalculating, setIsRecalculating] = useState(false);

  if (!isOpen) return null;

  const { summary, items } = data.data;
  
  // Categorize items into 3 groups
  const availableItems = items.filter(item => item.is_available);
  
  const insufficientStockItems = items.filter(item => 
    !item.is_available && 
    item.available_quantity !== null && 
    item.available_quantity !== undefined &&
    item.available_quantity > 0
  );
  
  const unavailableItems = items.filter(item => 
    !item.is_available && 
    (item.available_quantity === null || 
     item.available_quantity === undefined ||
     item.available_quantity === 0)
  );

  const hasAdjustments = Object.keys(adjustedQuantities).length > 0;
  const availableTotal = availableItems.reduce((sum, item) => sum + item.subtotal_usd, 0);
  const grandTotal = availableTotal + summary.total_shipping_fee_usd;

  // Generate dynamic header message
  const getHeaderMessage = () => {
    if (data.success && insufficientStockItems.length === 0) {
      return '✅ All Items Available';
    }
    
    const parts = [];
    if (insufficientStockItems.length > 0) {
      parts.push(`${insufficientStockItems.length} item(s) have insufficient stock`);
    }
    if (unavailableItems.length > 0) {
      parts.push(`${unavailableItems.length} item(s) unavailable`);
    }
    return `⚠️ ${parts.join(', ')}`;
  };

  const handleQuantityAdjust = (skuId: string, newQuantity: number, maxQuantity: number) => {
    const validQuantity = Math.max(0, Math.min(newQuantity, maxQuantity));
    setAdjustedQuantities(prev => ({
      ...prev,
      [skuId]: validQuantity
    }));
  };

  const handleQuickAdjust = (skuId: string, maxQuantity: number) => {
    setAdjustedQuantities(prev => ({
      ...prev,
      [skuId]: maxQuantity
    }));
  };

  const handleReCalculate = async () => {
    setIsRecalculating(true);
    
    try {
      // Step 1: Update cart quantities for adjusted items
      for (const [skuId, quantity] of Object.entries(adjustedQuantities)) {
        if (quantity === 0) continue; // Skip zero quantities
        
        const headers: Record<string, string> = {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        await fetch('http://localhost:3000/api/v1/taobao/cart', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ skuId, quantity })
        });
      }

      // Step 2: Collect SKU IDs for re-validation (exclude zero quantities)
      const skuIdsToValidate = [
        ...availableItems.map(item => item.sku_id),
        ...insufficientStockItems
          .map(item => item.sku_id)
          .filter(skuId => {
            const adjustedQty = adjustedQuantities[skuId];
            return adjustedQty === undefined || adjustedQty > 0;
          })
      ];

      // Step 3: Re-validate with render-order API
      await onReCalculate(skuIdsToValidate);
      
      // Reset adjustments after successful re-calculation
      setAdjustedQuantities({});
    } catch (err) {
      console.error('Re-calculation failed:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                Order Summary
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{getHeaderMessage()}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Summary Stats Card - 4 Categories */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Items</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary.total_items}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Shipping Fee</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-500">
                  ${summary.total_shipping_fee_usd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-green-700 dark:text-green-400">✓ Available</p>
                <p className="text-xl sm:text-2xl font-semibold text-green-700 dark:text-green-400">
                  {availableItems.length}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">⚠ Insufficient Stock</p>
                <p className="text-xl sm:text-2xl font-semibold text-orange-600 dark:text-orange-400">
                  {insufficientStockItems.length}
                </p>
              </div>
              {unavailableItems.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">✗ Unavailable</p>
                  <p className="text-xl sm:text-2xl font-semibold text-red-700 dark:text-red-400">
                    {unavailableItems.length}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Available Items Section */}
          {availableItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                ✓ Available Items ({availableItems.length})
              </h3>
              <div className="space-y-3">
                {availableItems.map((item) => (
                  <div 
                    key={item.sku_id} 
                    className="flex gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    {/* Image */}
                    <div className="w-16 h-16 flex-shrink-0">
                      {item.pic_url ? (
                        <img 
                          src={item.pic_url} 
                          alt={item.item_title}
                          className="w-full h-full rounded object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs">
                          No img
                        </div>
                      )}
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">
                        {item.item_title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {item.sku_title}
                      </p>
                      
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Qty: <span className="font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                        </span>
                        <div className="text-right">
                          {item.promotion_price_usd < item.price_usd && (
                            <span className="text-xs text-gray-400 line-through mr-2">
                              ${(item.price_usd * item.quantity).toFixed(2)}
                            </span>
                          )}
                          <span className="font-semibold text-orange-600 dark:text-orange-500">
                            ${item.subtotal_usd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Available Items Total */}
              <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-900 dark:text-green-300">Subtotal ({availableItems.length} items)</span>
                  <span className="font-bold text-lg text-green-900 dark:text-green-300">${availableTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Insufficient Stock Items Section - NEW */}
          {insufficientStockItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                ⚠️ Insufficient Stock ({insufficientStockItems.length})
              </h3>
              <div className="space-y-3">
                {insufficientStockItems.map((item) => {
                  const adjustedQty = adjustedQuantities[item.sku_id];
                  const currentQty = adjustedQty !== undefined ? adjustedQty : item.quantity;
                  
                  return (
                    <div 
                      key={item.sku_id} 
                      className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700"
                    >
                      {/* Image - slight opacity */}
                      <div className="w-16 h-16 flex-shrink-0 opacity-80">
                        {item.pic_url ? (
                          <img 
                            src={item.pic_url} 
                            alt={item.item_title}
                            className="w-full h-full rounded object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs">
                            No img
                          </div>
                        )}
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">
                          {item.item_title}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {item.sku_title}
                        </p>
                        
                        {/* Stock info - prominent display */}
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Requested:</span>
                            <span className="font-bold text-gray-900 dark:text-white ml-1">{item.quantity}</span>
                          </div>
                          <div>
                            <span className="text-orange-600 dark:text-orange-400">Available:</span>
                            <span className="font-bold text-orange-700 dark:text-orange-300 ml-1 text-lg">
                              {item.available_quantity}
                            </span>
                          </div>
                        </div>
                        
                        {/* Warning message - simple & clear */}
                        <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900/40 rounded">
                          <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
                            ⚠️ Only {item.available_quantity} available
                          </p>
                        </div>

                        {/* Quantity Adjustment Controls */}
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <label className="text-sm text-gray-600 dark:text-gray-400">Adjust to:</label>
                          <input 
                            type="number"
                            min="0"
                            max={item.available_quantity!}
                            value={currentQty}
                            onChange={(e) => handleQuantityAdjust(item.sku_id, parseInt(e.target.value) || 0, item.available_quantity!)}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">max: {item.available_quantity}</span>
                          <button
                            onClick={() => handleQuickAdjust(item.sku_id, item.available_quantity!)}
                            className="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors font-medium"
                          >
                            Use Max
                          </button>
                          {adjustedQty === 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                              (will be excluded from order)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unavailable Items Section - Only truly unavailable */}
          {unavailableItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                ✗ Unavailable Items ({unavailableItems.length})
              </h3>
              <div className="space-y-3">
                {unavailableItems.map((item) => (
                  <div 
                    key={item.sku_id} 
                    className="flex gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                  >
                    {/* Image - with opacity to show unavailable */}
                    <div className="w-16 h-16 flex-shrink-0 opacity-60">
                      {item.pic_url ? (
                        <img 
                          src={item.pic_url} 
                          alt={item.item_title}
                          className="w-full h-full rounded object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs">
                          No img
                        </div>
                      )}
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">
                        {item.item_title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {item.sku_title}
                      </p>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Requested Qty: <span className="font-medium">{item.quantity}</span>
                      </div>
                      
                      {/* Error Details */}
                      <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                          {item.unavailable_reason || 'Item unavailable'}
                        </p>
                        {item.error_code && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Error Code: {item.error_code}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer with Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2">
          
          {/* Grand Total (only if available items exist and no pending adjustments) */}
          {availableItems.length > 0 && !hasAdjustments && (
            <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Items Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">${availableTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Shipping Fee</span>
                <span className="font-medium text-gray-900 dark:text-white">${summary.total_shipping_fee_usd.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-orange-300 dark:border-orange-700 flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">Grand Total</span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-500">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Helper text if adjustments needed */}
          {insufficientStockItems.length > 0 && !hasAdjustments && (
            <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300 text-center">
              Please adjust quantities above to proceed with order
            </div>
          )}

          {/* Re-Calculate Button (if adjustments made) */}
          {hasAdjustments && (
            <button 
              onClick={handleReCalculate}
              disabled={isRecalculating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg shadow-lg active:scale-[0.98] transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRecalculating ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>Re-Calculating...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Re-Calculate Order</span>
                </>
              )}
            </button>
          )}

          {/* Create Order Button (only if no adjustments pending and has available items) */}
          {availableItems.length > 0 && !hasAdjustments && insufficientStockItems.length === 0 && (
            <button
              onClick={onProceedToCreateOrder}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg active:scale-[0.98] transition-all"
            >
              Create Order ({availableItems.length} {availableItems.length === 1 ? 'item' : 'items'})
            </button>
          )}
          
          {/* Remove Unavailable Button (only truly unavailable items) */}
          {unavailableItems.length > 0 && (
            <button
              onClick={onRemoveUnavailable}
              className="w-full py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 font-medium rounded-lg transition-colors"
            >
              Remove Unavailable ({unavailableItems.length} {unavailableItems.length === 1 ? 'item' : 'items'})
            </button>
          )}
          
          {/* Back to Cart Button */}
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
          >
            Back to Cart
          </button>
        </div>

      </div>
    </div>
  );
}
