import React, { useEffect, useState } from 'react';
import { 
  Download, Smartphone, Share, PlusSquare, MoreVertical, 
  CheckCircle2, X, Sparkles, ExternalLink, AlertCircle, Info,
  ChevronRight, ArrowRight, Laptop
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onInstallAccepted?: () => void;
  onOpenPreview?: (platform: 'android' | 'ios') => void;
}

export default function InstallAppModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallAccepted,
  onOpenPreview
}: InstallAppModalProps) {
  // Selected device state: 'android' | 'ios'
  const [selectedDevice, setSelectedDevice] = useState<'android' | 'ios' | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop');
  const [isStandalone, setIsStandalone] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'prompting' | 'manual_instructions' | 'accepted' | 'dismissed'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    // Check if running in standalone mode
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // Detect actual device platform
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      setDetectedPlatform('ios');
      setSelectedDevice('ios');
    } else if (/Android/i.test(ua)) {
      setDetectedPlatform('android');
      setSelectedDevice('android');
    } else {
      setDetectedPlatform('desktop');
      // Default to android on desktop if nothing selected, or leave null to require explicit selection
      setSelectedDevice(null);
    }
  }, [isOpen]);

  // Escape key handler
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

  // Handle "Confirm and Install"
  const handleConfirmAndInstall = async () => {
    if (!selectedDevice) {
      setStatusMessage('Please select either Android or iPhone/iOS to proceed.');
      return;
    }

    if (selectedDevice === 'android') {
      if (deferredPrompt) {
        setInstallStatus('prompting');
        try {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            setInstallStatus('accepted');
            setStatusMessage('LaundriGo was successfully installed to your home screen!');
            if (onInstallAccepted) onInstallAccepted();
            setTimeout(() => {
              onClose();
            }, 1800);
          } else {
            setInstallStatus('dismissed');
            setStatusMessage('Installation was dismissed. You can install anytime using Chrome menu (⋮) → "Install app".');
          }
        } catch (err) {
          console.error('PWA install error:', err);
          setInstallStatus('manual_instructions');
          setStatusMessage('Native prompt was blocked. Follow the Android manual instructions below.');
        }
      } else {
        // Native prompt unavailable (common on desktop or when already prompted)
        setInstallStatus('manual_instructions');
        setStatusMessage('Follow the quick 3-step Android installation steps below in your browser.');
      }
    } else if (selectedDevice === 'ios') {
      // iOS doesn't support beforeinstallprompt; explain Safari's Add to Home Screen
      setInstallStatus('manual_instructions');
      setStatusMessage('iOS requires adding LaundriGo via Safari\'s Share menu. Follow the instructions below:');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Install LaundriGo App
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  PWA
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Poblacion, Lagonglong • Fast, offline-ready laundry pickup & tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Standalone Installed Notice */}
        {isStandalone && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                LaundriGo is Installed & Active
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                You are currently running the standalone app with full offline support.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Clickable Device Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
              1. Choose Your Device:
            </label>
            {detectedPlatform !== 'desktop' && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Detected: {detectedPlatform === 'ios' ? 'Apple iOS' : 'Android'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Android Option */}
            <div
              onClick={() => {
                setSelectedDevice('android');
                setInstallStatus('idle');
                setStatusMessage('');
              }}
              className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center text-center relative ${
                selectedDevice === 'android'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500 shadow-md shadow-blue-500/10'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
              }`}
            >
              {selectedDevice === 'android' && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`p-3 rounded-2xl mb-2 ${
                selectedDevice === 'android' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                Android
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Samsung, Google Pixel, Xiaomi, Oppo
              </p>
            </div>

            {/* iOS Option */}
            <div
              onClick={() => {
                setSelectedDevice('ios');
                setInstallStatus('idle');
                setStatusMessage('');
              }}
              className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center text-center relative ${
                selectedDevice === 'ios'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500 shadow-md shadow-blue-500/10'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
              }`}
            >
              {selectedDevice === 'ios' && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`p-3 rounded-2xl mb-2 ${
                selectedDevice === 'ios' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                iPhone / iPad
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Apple iOS & iPadOS (Safari)
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Device-Specific Instructions */}
        {selectedDevice && (
          <div className="space-y-3 bg-gray-50/70 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Installation Instructions for {selectedDevice === 'android' ? 'Android' : 'iOS'}:
              </span>
              {selectedDevice === 'android' && deferredPrompt && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 1-Click Available
                </span>
              )}
            </div>

            {selectedDevice === 'android' && (
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                {deferredPrompt ? (
                  <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/50 font-medium">
                    ✨ Tap <strong>Confirm and Install</strong> below to trigger the direct browser install prompt.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <p>Open <strong>Chrome</strong> or <strong>Samsung Internet</strong> on your phone.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <p>Tap the <strong>Three-Dots Menu (⋮)</strong> in the top-right corner.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <p>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> and confirm.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedDevice === 'ios' && (
              <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>Tap the Safari Share button</span>
                      <Share className="w-3.5 h-3.5 text-blue-600" />
                    </p>
                    <p className="text-[11px] text-gray-500">Square with an upward arrow at the bottom of the screen.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>Choose "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-blue-600" />
                    </p>
                    <p className="text-[11px] text-gray-500">Scroll down the Share action list and select it.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Tap "Add" in the top-right</p>
                    <p className="text-[11px] text-gray-500">The LaundriGo icon will appear on your iPhone Home Screen.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Message / Notification */}
        {statusMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
            installStatus === 'accepted' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : installStatus === 'dismissed'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}>
            {installStatus === 'accepted' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            )}
            <p className="leading-relaxed">{statusMessage}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          {onOpenPreview && selectedDevice ? (
            <button
              type="button"
              onClick={() => {
                onOpenPreview(selectedDevice);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Preview {selectedDevice === 'android' ? 'Pixel UI' : 'iPhone UI'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAndInstall}
              disabled={!selectedDevice || installStatus === 'accepted'}
              className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Confirm and Install</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
