'use client';

import { useState, useEffect } from 'react';
import { MobileDialog } from './MobileDialog';
import { getAccessToken } from '@/lib/auth-service';

// TypeScript Interfaces
interface OrderLineItem {
  id: number;
  quantity: number;
  price: string;
  promotionPrice: string;
  couponPrice: string;
  skuId: string;
  itemId: string;
  mpItemId: string;
  mpSkuId: string;
  itemTitle: string;
  skuTitle: string;
  picUrl: string;
  taobao_sub_order_id: number;
  taobao_order_id: number;
  orderLineNo: string;
  subPurchaseOrderId: string;
  createdAt: string;
  updatedAt: string;
}

interface SubOrder {
  id: number;
  taobaoOrderId: number;
  orderNumber: string;
  status: OrderStatus;
  total: string;
  subTotal: string;
  chinaDeliveryFee: string;
  customerNumber: string;
  purchaseOrderId: string;
  sellerId: string;
  sellerNick: string;
  costPrice: string;
  lineItemCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  line_items: OrderLineItem[];
}

interface Order {
  id: number;
  customerNumber: string;
  status: OrderStatus;
  subTotal: string;
  chinaDeliveryFee: string;
  total: string;
  number: string;
  lineItemCount: number;
  costPrice: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  paymentStatus: string;
  sub_orders: SubOrder[];
}

interface OrderDetailsResponse {
  success: boolean;
  message: string;
  data: Order;
}

type OrderStatus = 'pending' | 'payment' | 'shipping' | 'completed' | 'cancelled' | 'failed';

interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  apiKey: string;
  onRefreshList?: () => void;
}

// Status Configuration
const STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: string;
}> = {
  pending: {
    label: 'Pending',
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    icon: '⏳'
  },
  payment: {
    label: 'Awaiting Payment',
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
    icon: '💳'
  },
  shipping: {
    label: 'Shipping',
    bg: 'bg-purple-100 dark:bg-purple-900/20',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    icon: '🚚'
  },
  completed: {
    label: 'Completed',
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
    icon: '✅'
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    icon: '❌'
  },
  failed: {
    label: 'Failed',
    bg: 'bg-gray-100 dark:bg-gray-700/20',
    text: 'text-gray-800 dark:text-gray-300',
    border: 'border-gray-300 dark:border-gray-600',
    icon: '⚠️'
  }
};

// Payment Status Configuration
const PAYMENT_STATUS_CONFIG: Record<string, {
  label: string;
  bg: string;
  text: string;
  icon: string;
}> = {
  checkout: {
    label: 'Checkout',
    bg: 'bg-yellow-100 dark:bg-yellow-900/20',
    text: 'text-yellow-800 dark:text-yellow-300',
    icon: '🛒'
  },
  processing: {
    label: 'Processing',
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-300',
    icon: '⏳'
  },
  pending: {
    label: 'Pending',
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-800 dark:text-orange-300',
    icon: '⏱️'
  },
  paid: {
    label: 'Paid',
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-300',
    icon: '✅'
  },
  completed: {
    label: 'Paid',
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-300',
    icon: '✅'
  },
  failed: {
    label: 'Payment Failed',
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-300',
    icon: '❌'
  },
  credit_owed: {
    label: 'Paid (Credit)',
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-300',
    icon: '✅'
  }
};

export function OrderDetailsDialog({ 
  isOpen, 
  onClose, 
  orderNumber, 
  apiKey,
  onRefreshList 
}: OrderDetailsDialogProps) {
  // Component state
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper Functions
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (priceString: string): string => {
    return `$${parseFloat(priceString).toFixed(2)}`;
  };

  const calculateSavings = (price: string, promotionPrice: string): number => {
    const original = parseFloat(price);
    const promo = parseFloat(promotionPrice);
    return original - promo;
  };

  // Fetch order details
  const fetchOrderDetails = async () => {
    if (!orderNumber) return;
    
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        include: 'sub_orders,sub_orders.line_items',
      });
      
      const headers: Record<string, string> = {
        'X-API-Key': apiKey,
      };
      const accessToken = getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
       
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/orders/${orderNumber}?${params.toString()}`,
        { headers }
      );
      
      const data: OrderDetailsResponse = await response.json();
      
      if (data.success) {
        setOrderData(data.data);
      } else {
        setError(data.message || 'Failed to load order details');
      }
    } catch (err) {
      setError('An error occurred while loading order details');
      console.error('Order details fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch order details when dialog opens
  useEffect(() => {
    if (isOpen && orderNumber) {
      fetchOrderDetails();
    }
  }, [isOpen, orderNumber]);

  // Action Handlers
  const handlePayNow = async () => {
    alert('Pay Now functionality - This would initiate payment flow');
    // TODO: Implement payment flow
  };

  const handleCancelOrder = () => {
    if (orderData && confirm(`Are you sure you want to cancel order ${orderData.number}?`)) {
      console.log('Cancel order:', orderData.number);
      alert(`Cancel order API call for ${orderData.number} would be made here.`);
      // TODO: Call cancel API and refresh
    }
  };

  const handleViewReceipt = () => {
    if (orderData) {
      console.log('View receipt:', orderData.number);
      alert(`Receipt for order ${orderData.number} would be displayed here.`);
      // TODO: Open receipt modal or navigate to receipt page
    }
  };

  const handleContactSeller = () => {
    if (orderData) {
      console.log('Contact seller for order:', orderData.number);
      alert(`Contact form or chat for order ${orderData.number} would open here.`);
      // TODO: Open chat or contact form
    }
  };

  const getOrderActions = (order: Order) => {
    const actions = [];
    
    // Show "Pay Now" only if payment is not completed/paid and order is still in payment status
    if (order.status === 'payment' && order.paymentStatus && !['paid', 'completed', 'processing', 'credit_owed'].includes(order.paymentStatus)) {
      actions.push({
        label: 'Pay Now',
        onClick: handlePayNow,
        className: 'bg-orange-600 text-white hover:bg-orange-700',
        icon: '💳'
      });
    }
    
    if (!['completed', 'cancelled', 'failed'].includes(order.status)) {
      actions.push({
        label: 'Cancel Order',
        onClick: handleCancelOrder,
        className: 'border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
        icon: '❌'
      });
    }
    
    if (order.status === 'completed') {
      actions.push({
        label: 'View Receipt',
        onClick: handleViewReceipt,
        className: 'border border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20',
        icon: '🧾'
      });
    }
    
    actions.push({
      label: 'Contact Seller',
      onClick: handleContactSeller,
      className: 'border border-gray-400 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
      icon: '💬'
    });
    
    return actions;
  };

  if (!isOpen) return null;

  const statusConfig = orderData ? STATUS_CONFIG[orderData.status] : null;
  const actions = orderData ? getOrderActions(orderData) : [];

  // Custom header
  const detailsHeader = (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        📄 Order Details
      </h2>
      {orderData && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Order #{orderData.number}
        </p>
      )}
    </div>
  );

  // Custom footer with action buttons
  const detailsFooter = orderData && actions.length > 0 ? (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className={`flex-1 min-w-[140px] px-4 py-2 rounded-lg font-medium text-sm transition-all active:scale-95 min-h-[44px] ${action.className}`}
          >
            {action.icon} {action.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all active:scale-95 min-h-[44px]"
      >
        Back to Orders
      </button>
    </div>
  ) : (
    <button
      onClick={onClose}
      className="w-full py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all active:scale-95 min-h-[44px]"
    >
      Back to Orders
    </button>
  );

  return (
    <MobileDialog
      isOpen={isOpen}
      onClose={onClose}
      title={detailsHeader}
      footer={detailsFooter}
      zIndex={70}
    >
      <div className="p-4 space-y-4">
        {/* Loading State */}
        {loading && (
          <div className="py-16 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading order details...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="py-16 text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
            <button
              onClick={fetchOrderDetails}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all active:scale-95"
            >
              Retry
            </button>
          </div>
        )}

        {/* Order Details Content */}
        {orderData && !loading && !error && (
          <>
            {/* Order Status Card */}
            <div className={`p-4 rounded-lg border-2 ${statusConfig?.border} ${statusConfig?.bg}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{statusConfig?.icon}</span>
                  <div>
                    <p className="font-semibold text-lg text-gray-900 dark:text-white">
                      {statusConfig?.label}
                    </p>
                    {orderData.status === 'payment' && orderData.paymentStatus && PAYMENT_STATUS_CONFIG[orderData.paymentStatus] && (
                      <p className={`text-sm ${PAYMENT_STATUS_CONFIG[orderData.paymentStatus].text}`}>
                        {PAYMENT_STATUS_CONFIG[orderData.paymentStatus].icon} {PAYMENT_STATUS_CONFIG[orderData.paymentStatus].label}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-500">
                    {formatPrice(orderData.total)}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Created</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(orderData.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Updated</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(orderData.updatedAt)}
                  </p>
                </div>
                {orderData.completedAt && (
                  <div className="col-span-2">
                    <p className="text-gray-600 dark:text-gray-400">Completed</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatDate(orderData.completedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                📊 Order Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Order Number</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {orderData.number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Customer Number</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {orderData.customerNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Items Count</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {orderData.lineItemCount}
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatPrice(orderData.subTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400">China Delivery Fee</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatPrice(orderData.chinaDeliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-300 dark:border-blue-700">
                    <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-500">
                      {formatPrice(orderData.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-orders Section */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                📦 Order Items ({orderData.sub_orders.length} {orderData.sub_orders.length === 1 ? 'seller' : 'sellers'})
              </h3>
              
              <div className="space-y-4">
                {orderData.sub_orders.map((subOrder) => {
                  const subStatusConfig = STATUS_CONFIG[subOrder.status];
                  
                  return (
                    <div
                      key={subOrder.id}
                      className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
                    >
                      {/* Seller Header */}
                      <div className="p-3 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">👤</span>
                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                              {subOrder.sellerNick}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${subStatusConfig.bg} ${subStatusConfig.text}`}>
                              {subStatusConfig.icon} {subStatusConfig.label}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatPrice(subOrder.total)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>
                            <span>PO: </span>
                            <span className="font-mono">{subOrder.purchaseOrderId}</span>
                          </div>
                          <div>
                            <span>Seller ID: </span>
                            <span className="font-mono">{subOrder.sellerId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Line Items */}
                      <div className="p-3 space-y-3">
                        {subOrder.line_items.map((item) => {
                          const hasCoupon = parseFloat(item.couponPrice) > 0;
                          const savings = calculateSavings(item.price, item.promotionPrice);

                          return (
                            <div
                              key={item.id}
                              className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              {/* Image */}
                              <div className="w-20 h-20 flex-shrink-0">
                                {item.picUrl ? (
                                  <img 
                                    src={item.picUrl} 
                                    alt={item.itemTitle}
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
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                                  {item.itemTitle}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
                                  {item.skuTitle}
                                </p>

                                <div className="flex justify-between items-end flex-wrap gap-2">
                                  {/* Quantity */}
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    Qty: <span className="font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                                  </div>

                                  {/* Price */}
                                  <div className="text-right">
                                    {savings > 0 && (
                                      <div className="flex items-center gap-2 justify-end mb-1">
                                        <span className="text-xs text-gray-400 line-through">
                                          {formatPrice((parseFloat(item.price) * item.quantity).toString())}
                                        </span>
                                        {hasCoupon && (
                                          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
                                            -{formatPrice(item.couponPrice)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    <span className="text-sm font-bold text-orange-600 dark:text-orange-500">
                                      {formatPrice((parseFloat(item.promotionPrice) * item.quantity).toString())}
                                    </span>
                                  </div>
                                </div>

                                {/* Item IDs */}
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <div>Item ID: <span className="font-mono">{item.itemId}</span></div>
                                    <div>SKU ID: <span className="font-mono">{item.skuId}</span></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Sub-order Summary */}
                        <div className="pt-2 border-t-2 border-gray-300 dark:border-gray-600">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatPrice(subOrder.subTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">China Delivery</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatPrice(subOrder.chinaDeliveryFee)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                            <span className="font-semibold text-gray-900 dark:text-white">Seller Total</span>
                            <span className="font-bold text-orange-600 dark:text-orange-500">
                              {formatPrice(subOrder.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </MobileDialog>
  );
}
