'use client';

import { useState, useEffect, useCallback } from 'react';
import { MobileDialog } from './MobileDialog';
import { PaymentMethodsDialog } from './PaymentMethodsDialog';
import { PaymentQRDialog } from './PaymentQRDialog';
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

interface Pagination {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface OrdersResponse {
  success: boolean;
  message: string;
  data: {
    orders: Order[];
    pagination: Pagination;
  };
}

type OrderStatus = 'pending' | 'payment' | 'shipping' | 'completed' | 'cancelled' | 'failed';
type SortField = 'total' | 'status' | 'updated_at';
type SortOrder = 'asc' | 'desc';

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  type: string;
  provider: string;
  supportedCurrencies: string[];
  minAmount: string;
  maxAmount: string;
  icon: string;
  description: string;
}

interface OrdersListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
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
  }
};

export function OrdersListDialog({ isOpen, onClose, apiKey }: OrdersListDialogProps) {
  // Component state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(new Set());

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Payment states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showPaymentQRDialog, setShowPaymentQRDialog] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

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

  const toggleOrder = (orderId: number) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // API Integration
  const fetchOrders = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        include: 'sub_orders,sub_orders.line_items',
        per_page: '10',
        page: page.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      
      if (selectedStatus) params.append('status', selectedStatus);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      
      const headers: Record<string, string> = {
        'X-API-Key': apiKey,
      };
      const accessToken = getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
       
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/orders?${params.toString()}`,
        { headers }
      );
      
      const data: OrdersResponse = await response.json();
      
      if (data.success) {
        setOrders(data.data.orders);
        setPagination(data.data.pagination);
      } else {
        setError(data.message || 'Failed to load orders');
      }
    } catch (err) {
      setError('An error occurred while loading orders');
      console.error('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, sortBy, sortOrder, selectedStatus, fromDate, toDate]);

  // Initial fetch on dialog open
  useEffect(() => {
    if (isOpen && apiKey) {
      fetchOrders(1);
    }
  }, [isOpen, apiKey, fetchOrders]);

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setExpandedOrderIds(new Set());
    fetchOrders(1);
  };

  const handleClearFilters = () => {
    setSelectedStatus('');
    setFromDate('');
    setToDate('');
    setSortBy('updated_at');
    setSortOrder('desc');
    setCurrentPage(1);
    setExpandedOrderIds(new Set());
    fetchOrders(1);
  };

  const handleRefresh = () => {
    fetchOrders(currentPage);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchOrders(newPage);
    setExpandedOrderIds(new Set()); // Collapse all on page change
  };

  // Action Handlers
  const handlePayNow = async (order: Order) => {
    setSelectedOrderForPayment(order);
    setLoadingPaymentMethods(true);
    setPaymentError('');
    
    try {
      const headers: Record<string, string> = {
        'X-API-Key': apiKey,
      };
      const accessToken = getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/orders/${order.number}/payment-methods`,
        { headers }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.data);
        setShowPaymentDialog(true);
      } else {
        setPaymentError(data.message || 'Failed to load payment methods');
        alert(`Error: ${data.message || 'Failed to load payment methods'}`);
      }
    } catch (err) {
      setPaymentError('An error occurred while loading payment methods');
      console.error('Payment methods fetch error:', err);
      alert('An error occurred while loading payment methods');
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleSelectPaymentMethod = async (method: any) => {
    if (!selectedOrderForPayment) return;
    
    setIsProcessingPayment(true);
    setPaymentError('');
    
    try {
      const headers: Record<string, string> = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      };
      const accessToken = getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/orders/${selectedOrderForPayment.number}/payment`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ payment_method_id: method.id })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok || data?.success === false) {
        setPaymentError(data?.message || 'Failed to create payment');
        alert(`Error: ${data.message || 'Failed to create payment'}`);
        return;
      }
      
      // Success: Store payment data and show QR dialog
      setPaymentData(data.data);
      
      // Close payment method dialog
      setShowPaymentDialog(false);
      setSelectedOrderForPayment(null);
      setPaymentError('');
      
      // Show QR/Deeplink dialog
      setShowPaymentQRDialog(true);
      
      // Refresh orders list to show updated status
      fetchOrders(currentPage);
      
    } catch (err) {
      setPaymentError('Failed to connect to payment service');
      console.error('Create payment error:', err);
      alert('Failed to connect to payment service');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancelOrder = (order: Order) => {
    if (confirm(`Are you sure you want to cancel order ${order.number}?`)) {
      console.log('Cancel order:', order.number);
      alert(`Cancel order API call for ${order.number} would be made here.`);
      // TODO: Call cancel API and refresh orders
    }
  };

  const handleViewReceipt = (order: Order) => {
    console.log('View receipt:', order.number);
    alert(`Receipt for order ${order.number} would be displayed here.`);
    // TODO: Open receipt modal or navigate to receipt page
  };

  const handleContactSeller = (order: Order) => {
    console.log('Contact seller for order:', order.number);
    alert(`Contact form or chat for order ${order.number} would open here.`);
    // TODO: Open chat or contact form
  };

  const getOrderActions = (order: Order) => {
    const actions = [];
    
    // Show "Pay Now" only if payment is not completed/paid and order is still in payment status
    if (order.status === 'payment' && order.paymentStatus && !['paid', 'completed', 'processing'].includes(order.paymentStatus)) {
      actions.push({
        label: 'Pay Now',
        onClick: () => handlePayNow(order),
        className: 'bg-orange-600 text-white hover:bg-orange-700',
        icon: '💳'
      });
    }
    
    if (!['completed', 'cancelled', 'failed'].includes(order.status)) {
      actions.push({
        label: 'Cancel Order',
        onClick: () => handleCancelOrder(order),
        className: 'border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
        icon: '❌'
      });
    }
    
    if (order.status === 'completed') {
      actions.push({
        label: 'View Receipt',
        onClick: () => handleViewReceipt(order),
        className: 'border border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20',
        icon: '🧾'
      });
    }
    
    actions.push({
      label: 'Contact Seller',
      onClick: () => handleContactSeller(order),
      className: 'border border-gray-400 text-gray-700 darååååååk:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
      icon: '💬'
    });
    
    return actions;
  };

  const hasActiveFilters = selectedStatus || fromDate || toDate || sortBy !== 'updated_at' || sortOrder !== 'desc';

  // Custom header with refresh button and count badge
  const ordersHeader = (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          📦 My Orders
        </h2>
        {pagination && (
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
            {pagination.total}
          </span>
        )}
      </div>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="
          p-2 -m-2
          hover:bg-gray-200 dark:hover:bg-gray-700
          active:scale-95
          rounded-full
          transition-all
          disabled:opacity-50
          min-w-[44px] min-h-[44px]
          flex items-center justify-center
        "
        title="Refresh orders"
      >
        <span className={loading ? 'inline-block animate-spin' : ''}>🔄</span>
      </button>
    </div>
  );

  // Custom footer with pagination
  const ordersFooter = pagination && pagination.total_pages > 0 ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Page {pagination.page} of {pagination.total_pages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.has_prev || loading}
            className="
              px-4 py-2 
              bg-white dark:bg-gray-800 
              border border-gray-300 dark:border-gray-600 
              rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 
              active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed 
              transition-all 
              text-sm font-medium 
              text-gray-700 dark:text-gray-300
              min-h-[44px]
            "
          >
            ← Prev
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pagination.has_next || loading}
            className="
              px-4 py-2 
              bg-white dark:bg-gray-800 
              border border-gray-300 dark:border-gray-600 
              rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 
              active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed 
              transition-all 
              text-sm font-medium 
              text-gray-700 dark:text-gray-300
              min-h-[44px]
            "
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  ) : undefined;

  return (
    <>
      <MobileDialog
        isOpen={isOpen}
        onClose={onClose}
        title={ordersHeader}
        footer={ordersFooter}
        zIndex={50}
      >
        <div className="space-y-4">
          {/* Filters Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="
              w-full flex items-center justify-between 
              px-4 py-3
              bg-white dark:bg-gray-800 
              border border-gray-300 dark:border-gray-600 
              rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 
              active:scale-[0.98]
              transition-all
              min-h-[44px]
            "
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              🔍 Filters {hasActiveFilters && '(active)'}
            </span>
            <span className="text-gray-500">{showFilters ? '▼' : '▶'}</span>
          </button>

          {/* Filters Panel */}
          {showFilters && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 rounded-lg space-y-3">
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | '')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="payment">Awaiting Payment</option>
                <option value="shipping">Shipping</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Date
                </label>
                <input
                  type="text"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="2025-12-20"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Date
                </label>
                <input
                  type="text"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="2025-12-20"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            {/* Sort Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortField)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                >
                  <option value="updated_at">Updated Date</option>
                  <option value="total">Total Amount</option>
                  <option value="status">Status</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort Order
                </label>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:bg-gray-800 dark:text-white font-medium"
                >
                  {sortOrder === 'asc' ? '⬆ Ascending' : '⬇ Descending'}
                </button>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors text-sm"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              <p className="text-red-800 dark:text-red-300">❌ {error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Empty State */}
          {!loading && orders.length === 0 && !error && (
            <div className="py-16 text-center">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                No orders found
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-blue-600 hover:underline"
                >
                  Clear filters to see all orders
                </button>
              )}
            </div>
          )}

          {/* Orders List */}
          {!loading && orders.map((order) => {
            const isExpanded = expandedOrderIds.has(order.id);
            const statusConfig = STATUS_CONFIG[order.status];
            const actions = getOrderActions(order);

            return (
              <div
                key={order.id}
                className="border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Order Card Header (Clickable) */}
                <button
                  onClick={() => toggleOrder(order.id)}
                  className="w-full p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/70 active:scale-[0.99] transition-all text-left min-h-[44px]"
                >
                  <div className="flex items-start gap-3">
                    {/* Expand Icon */}
                    <span className="text-gray-500 mt-1 flex-shrink-0">
                      {isExpanded ? '▼' : '▶'}
                    </span>

                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {/* Order Number */}
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded font-mono text-sm font-medium">
                          {order.number}
                        </span>

                        {/* Status Badge - Show payment status if order is in payment stage and has payment status */}
                        {order.status === 'payment' && order.paymentStatus && PAYMENT_STATUS_CONFIG[order.paymentStatus] ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${PAYMENT_STATUS_CONFIG[order.paymentStatus].bg} ${PAYMENT_STATUS_CONFIG[order.paymentStatus].text}`}>
                            {PAYMENT_STATUS_CONFIG[order.paymentStatus].icon} {PAYMENT_STATUS_CONFIG[order.paymentStatus].label}
                          </span>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.icon} {statusConfig.label}
                          </span>
                        )}

                        {/* Item Count */}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {order.lineItemCount} {order.lineItemCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center flex-wrap gap-2">
                        {/* Date */}
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(order.createdAt)}
                        </span>

                        {/* Total */}
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-500">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    {/* Order Summary */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Subtotal</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{formatPrice(order.subTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Delivery</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{formatPrice(order.chinaDeliveryFee)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Total</p>
                          <p className="font-bold text-orange-600 dark:text-orange-500">{formatPrice(order.total)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Sub-orders Section */}
                    <div className="p-4 space-y-4">
                      {order.sub_orders.map((subOrder) => {
                        const subStatusConfig = STATUS_CONFIG[subOrder.status];
                        
                        return (
                          <div
                            key={subOrder.id}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
                          >
                            {/* Seller Header */}
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                              <div className="flex justify-between items-center flex-wrap gap-2">
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
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                PO: {subOrder.purchaseOrderId}
                              </p>
                            </div>

                            {/* Line Items */}
                            <div className="p-3 space-y-3">
                              {subOrder.line_items.map((item) => {
                                const hasCoupon = parseFloat(item.couponPrice) > 0;
                                const savings = calculateSavings(item.price, item.promotionPrice);

                                return (
                                  <div
                                    key={item.id}
                                    className="flex gap-3 p-2 bg-gray-50 dark:bg-gray-800/30 rounded"
                                  >
                                    {/* Image */}
                                    <div className="w-16 h-16 flex-shrink-0">
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

                                      <div className="flex justify-between items-center flex-wrap gap-2">
                                        {/* Quantity */}
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          Qty: <span className="font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                                        </span>

                                        {/* Price */}
                                        <div className="text-right">
                                          {savings > 0 && (
                                            <div className="flex items-center gap-2">
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
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={action.onClick}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all active:scale-95 min-h-[44px] ${action.className}`}
                          >
                            {action.icon} {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </MobileDialog>

      {/* Payment Methods Dialog */}
      {showPaymentDialog && selectedOrderForPayment && (
        <PaymentMethodsDialog
          isOpen={showPaymentDialog}
          onClose={() => {
            setShowPaymentDialog(false);
            setSelectedOrderForPayment(null);
            setPaymentError('');
          }}
          orderNumber={selectedOrderForPayment.number}
          orderTotal={selectedOrderForPayment.total}
          paymentMethods={paymentMethods}
          onSelectPaymentMethod={handleSelectPaymentMethod}
          isProcessing={loadingPaymentMethods || isProcessingPayment}
        />
      )}

      {/* Payment QR/Deeplink Dialog */}
      <PaymentQRDialog
        isOpen={showPaymentQRDialog}
        onClose={() => {
          setShowPaymentQRDialog(false);
          setPaymentData(null);
        }}
        paymentData={paymentData}
      />
    </>
  );
}
