import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, ArrowRight, RotateCw } from 'lucide-react';

export interface TransactionFeedbackModalProps {
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  confirmText?: string;
  onTryAgain?: () => void;
}

export default function TransactionFeedbackModal({
  isOpen,
  type,
  title,
  message,
  onClose,
  confirmText,
  onTryAgain
}: TransactionFeedbackModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSuccess = type === 'success';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              isSuccess 
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {isSuccess ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <AlertCircle className="w-7 h-7" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {title}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {isSuccess ? 'Transaction Completed' : 'Transaction Alert'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          {onTryAgain && !isSuccess && (
            <button
              type="button"
              onClick={onTryAgain}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              <RotateCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 text-white ${
              isSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
            }`}
          >
            <span>{confirmText || (isSuccess ? 'OK' : 'Close')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
