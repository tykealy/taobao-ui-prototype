'use client';

import { useState } from 'react';
import { MobileDialog } from './MobileDialog';

// TypeScript Interfaces
interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  type: string;
  provider: string;
  isActive: boolean;
  supportedCurrencies: string[];
  minAmount: string;
  maxAmount: string;
  processingFee: string;
  processingFeePercent: string;
  availableForOrders: boolean;
  availableForTaobao: boolean;
  icon: string;
  description: string;
  displayOrder: number;
  organizationId: number;
  gatewayConfig: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface PaymentMethodsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  orderTotal: string;
  paymentMethods: PaymentMethod[];
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  isProcessing?: boolean;
}

// Type badge configuration
const TYPE_CONFIG: Record<string, {
  label: string;
  bg: string;
  text: string;
  icon: string;
}> = {
  qr_code: {
    label: 'QR Code',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    icon: '📱'
  },
  card: {
    label: 'Credit/Debit Card',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    icon: '💳'
  },
  bank_transfer: {
    label: 'Bank Transfer',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: '🏦'
  },
  ewallet: {
    label: 'E-Wallet',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    icon: '👛'
  },
  default: {
    label: 'Payment',
    bg: 'bg-gray-100 dark:bg-gray-700/30',
    text: 'text-gray-700 dark:text-gray-300',
    icon: '💰'
  }
};

export function PaymentMethodsDialog({
  isOpen,
  onClose,
  orderNumber,
  orderTotal,
  paymentMethods,
  onSelectPaymentMethod,
  isProcessing = false,
}: PaymentMethodsDialogProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  // Filter and sort payment methods
  const activePaymentMethods = paymentMethods
    .filter(method => method.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const selectedMethod = activePaymentMethods.find(m => m.id === selectedMethodId);

  const formatPrice = (priceString: string): string => {
    return `$${parseFloat(priceString).toFixed(2)}`;
  };

  const handleImageError = (methodId: number) => {
    setImageErrors(prev => new Set(prev).add(methodId));
  };

  const getTypeConfig = (type: string) => {
    return TYPE_CONFIG[type] || TYPE_CONFIG.default;
  };

  const hasProcessingFee = (method: PaymentMethod): boolean => {
    return parseFloat(method.processingFee) > 0 || parseFloat(method.processingFeePercent) > 0;
  };

  const formatProcessingFee = (method: PaymentMethod): string => {
    const fee = parseFloat(method.processingFee);
    const feePercent = parseFloat(method.processingFeePercent);
    
    if (fee > 0 && feePercent > 0) {
      return `$${fee.toFixed(2)} + ${feePercent}%`;
    } else if (fee > 0) {
      return `$${fee.toFixed(2)}`;
    } else if (feePercent > 0) {
      return `${feePercent}%`;
    }
    return 'Free';
  };

  const handleProceedWithPayment = () => {
    if (selectedMethod) {
      onSelectPaymentMethod(selectedMethod);
    }
  };

  // Custom header with order info
  const paymentHeader = (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        💳 Select Payment Method
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          Order: <span className="font-mono font-medium text-gray-900 dark:text-white">{orderNumber}</span>
        </span>
        <span className="text-gray-600 dark:text-gray-400">•</span>
        <span className="text-gray-600 dark:text-gray-400">
          Total: <span className="font-bold text-orange-600 dark:text-orange-500">{formatPrice(orderTotal)}</span>
        </span>
      </div>
    </div>
  );

  // Custom footer with action buttons
  const paymentFooter = (
    <div className="space-y-2">
      {/* Selected Method Summary */}
      {selectedMethod && (
        <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Selected:
              </span>
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                {selectedMethod.name}
              </span>
            </div>
            {hasProcessingFee(selectedMethod) && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Fee: {formatProcessingFee(selectedMethod)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          Cancel
        </button>
        <button
          onClick={handleProceedWithPayment}
          disabled={!selectedMethod || isProcessing}
          className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
        >
          {isProcessing ? (
            <>
              <span className="animate-spin">⟳</span>
              <span>Processing...</span>
            </>
          ) : (
            'Proceed with Payment'
          )}
        </button>
      </div>

      {/* Helper Text */}
      {!selectedMethod && activePaymentMethods.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
          Please select a payment method to continue
        </p>
      )}
    </div>
  );

  return (
    <MobileDialog
      isOpen={isOpen}
      onClose={onClose}
      title={paymentHeader}
      footer={paymentFooter}
      zIndex={70}
    >
      <div className="space-y-4">
          
          {/* Empty State */}
          {activePaymentMethods.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-6xl mb-4">💳</div>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                No payment methods available
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Please contact support for assistance
              </p>
            </div>
          )}

          {/* Payment Methods Grid */}
          {activePaymentMethods.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePaymentMethods.map((method) => {
                const isSelected = selectedMethodId === method.id;
                const typeConfig = getTypeConfig(method.type);
                const hasError = imageErrors.has(method.id);

                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethodId(method.id)}
                    disabled={isProcessing}
                    className={`
                      relative p-4 rounded-xl border-2 transition-all text-left
                      hover:shadow-lg active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      min-h-[200px]
                      ${isSelected 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700'
                      }
                    `}
                  >
                    {/* Selection Indicator */}
                    <div className="absolute top-3 right-3">
                      <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                        ${isSelected 
                          ? 'border-orange-500 bg-orange-500' 
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                        }
                      `}>
                        {isSelected && (
                          <span className="text-white text-sm">✓</span>
                        )}
                      </div>
                    </div>

                    {/* Payment Method Icon */}
                    <div className="flex items-center justify-center mb-3">
                      {!hasError && method.icon ? (
                        <img 
                          src={method.icon}
                          alt={method.name}
                          className="w-16 h-16 object-contain rounded-lg"
                          onError={() => handleImageError(method.id)}
                        />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center text-4xl bg-gray-100 dark:bg-gray-700 rounded-lg">
                          {typeConfig.icon}
                        </div>
                      )}
                    </div>

                    {/* Payment Method Name */}
                    <h3 className="text-center font-bold text-gray-900 dark:text-white mb-2 text-lg">
                      {method.name}
                    </h3>

                    {/* Type Badge */}
                    <div className="flex justify-center mb-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                        {typeConfig.icon} {typeConfig.label}
                      </span>
                    </div>

                    {/* Supported Currencies */}
                    <div className="flex justify-center gap-1 mb-3 flex-wrap">
                      {method.supportedCurrencies.map((currency) => (
                        <span 
                          key={currency}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium"
                        >
                          {currency}
                        </span>
                      ))}
                    </div>

                    {/* Processing Fee */}
                    {hasProcessingFee(method) && (
                      <div className="text-center text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Processing Fee: <span className="font-medium text-gray-900 dark:text-white">
                          {formatProcessingFee(method)}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {method.description && method.description.trim() && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center line-clamp-2 mt-2">
                        {method.description}
                      </p>
                    )}

                    {/* Amount Range (if relevant) */}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                      Range: ${parseFloat(method.minAmount).toFixed(2)} - ${parseFloat(method.maxAmount).toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </MobileDialog>
  );
}
