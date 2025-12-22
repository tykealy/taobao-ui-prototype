'use client';

import { useState, useEffect } from 'react';
import { MobileDialog } from './MobileDialog';
import { isMobileDevice } from '@/lib/detect-device';

// TypeScript Interfaces
interface ExternalPayment {
  status: {
    code: string;
    message: string;
    tran_id: string;
  };
  description: string;
  qrString: string;
  qrImage: string;
  abapay_deeplink: string;
  app_store: string;
  play_store: string;
}

interface PaymentData {
  payment: {
    id: number;
    transactionId: string;
    amount: string;
    currency: string;
    status: string;
  };
  order: {
    id: number;
    number: string;
    total: string;
  };
  externalPayment: ExternalPayment;
}

interface PaymentQRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: PaymentData | null;
}

export function PaymentQRDialog({
  isOpen,
  onClose,
  paymentData,
}: PaymentQRDialogProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  if (!isOpen || !paymentData) return null;

  const { payment, order, externalPayment } = paymentData;

  const handleCopyTransactionId = async () => {
    try {
      await navigator.clipboard.writeText(payment.transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenDeeplink = () => {
    window.location.href = externalPayment.abapay_deeplink;
  };

  // Custom header
  const paymentHeader = (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        💳 Payment Ready
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {isMobile ? 'Open ABA Pay app to complete payment' : 'Scan QR code with ABA Pay app'}
      </p>
    </div>
  );

  // Custom footer
  const paymentFooter = (
    <div className="space-y-2">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="w-full py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all active:scale-95 min-h-[44px]"
      >
        Close
      </button>

      {/* Helper Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {isMobile 
          ? "Tap 'Open ABA Pay' button above to complete payment"
          : 'Open ABA Pay app on your phone and scan the QR code'}
      </p>
    </div>
  );

  return (
    <MobileDialog
      isOpen={isOpen}
      onClose={onClose}
      title={paymentHeader}
      footer={paymentFooter}
      zIndex={80}
    >
      <div className="space-y-4">
        {/* Payment Details Card */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Order Number</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{order.number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
              <span className="font-bold text-orange-600 dark:text-orange-500">${order.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Transaction ID</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-900 dark:text-white">{payment.transactionId}</span>
                <button
                  onClick={handleCopyTransactionId}
                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
                  title="Copy Transaction ID"
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                {payment.status}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Status from External Provider */}
        {externalPayment.status && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300 font-medium text-sm">
                ✓ {externalPayment.status.message}
              </span>
            </div>
          </div>
        )}

        {/* Mobile: Deeplink Button */}
        {isMobile ? (
          <div className="space-y-3">
            <button
              onClick={handleOpenDeeplink}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              <span className="text-2xl">📱</span>
              <span>Open ABA Pay</span>
            </button>

            {/* App Store Links */}
            <div className="flex gap-2">
              <a
                href={externalPayment.app_store}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-center text-xs font-medium transition-colors flex items-center justify-center gap-1 min-h-[44px]"
              >
                <span>🍎</span>
                <span>App Store</span>
              </a>
              <a
                href={externalPayment.play_store}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-center text-xs font-medium transition-colors flex items-center justify-center gap-1 min-h-[44px]"
              >
                <span>▶️</span>
                <span>Play Store</span>
              </a>
            </div>

            {/* Fallback: Show QR anyway for desktop scanning */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Or scan QR code from another device
              </summary>
              <div className="mt-3 flex justify-center">
                <div className="bg-white p-3 rounded-lg shadow-md">
                  <img 
                    src={externalPayment.qrImage}
                    alt="Payment QR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>
              </div>
            </details>
          </div>
        ) : (
          /* Desktop: QR Code Display */
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-200 dark:border-blue-800">
                <img 
                  src={externalPayment.qrImage}
                  alt="Payment QR Code"
                  className="w-80 h-80 object-contain"
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">
                How to pay:
              </h3>
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Open ABA Pay app on your mobile phone</li>
                <li>Tap the scan icon</li>
                <li>Scan this QR code</li>
                <li>Confirm the payment in the app</li>
              </ol>
            </div>

            {/* Mobile App Download Links */}
            <div className="flex gap-2">
              <a
                href={externalPayment.app_store}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-center text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <span>🍎</span>
                <span>Download on App Store</span>
              </a>
              <a
                href={externalPayment.play_store}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-center text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <span>▶️</span>
                <span>Get it on Play Store</span>
              </a>
            </div>
          </div>
        )}

        {/* Important Notice */}
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-300">
            ⚠️ <strong>Important:</strong> Please complete the payment within the app. 
            Your order will be processed once payment is confirmed.
          </p>
        </div>
      </div>
    </MobileDialog>
  );
}
