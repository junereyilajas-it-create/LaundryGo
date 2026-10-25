import React, { useEffect, useState, useRef } from 'react';
import { 
  X, Smartphone, RefreshCw, Wifi, Battery, Signal, 
  ExternalLink, RotateCw, Monitor, Check 
} from 'lucide-react';

interface MobilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPath?: string;
  initialDevice?: 'android' | 'ios';
}

export default function MobilePreviewModal({
  isOpen,
  onClose,
  initialPath = window.location.pathname + window.location.search,
  initialDevice = 'ios'
}: MobilePreviewModalProps) {
  const [device, setDevice] = useState<'android' | 'ios'>(initialDevice);
  const [currentTime, setCurrentTime] = useState('9:41');
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync initialDevice when modal opens
  useEffect(() => {
    if (initialDevice) setDevice(initialDevice);
  }, [initialDevice, isOpen]);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const previewUrl = `${window.location.origin}${initialPath}`;

  const reloadIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="flex flex-col items-center max-h-[98vh] space-y-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Device Mode Switcher & Preview Controls */}
        <div className="flex items-center justify-between gap-3 w-full max-w-[420px] px-3 py-2 bg-gray-900/95 border border-gray-800 rounded-2xl text-white shadow-2xl">
          {/* OS Platform Switcher */}
          <div className="flex items-center gap-1 bg-gray-800/80 p-0.5 rounded-xl border border-gray-700/60">
            <button
              onClick={() => setDevice('ios')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                device === 'ios'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>iPhone 16 Pro</span>
            </button>
            <button
              onClick={() => setDevice('android')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                device === 'android'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>Pixel 8 (Android)</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={reloadIframe}
              title="Reload Preview"
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Close Preview (Esc)"
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Device Frame */}
        {device === 'ios' ? (
          /* Apple iPhone 16 Pro Frame with Dynamic Island */
          <div className="relative w-[393px] h-[780px] max-h-[85vh] bg-black rounded-[52px] p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_12px_#1f242d,0_0_0_14px_#333a46] border border-gray-800 flex flex-col overflow-hidden shrink-0 transition-all">
            
            {/* Screen */}
            <div className="relative w-full h-full bg-white dark:bg-gray-950 rounded-[42px] overflow-hidden flex flex-col">
              
              {/* iOS Status Bar + Dynamic Island */}
              <div className="relative z-30 h-10 w-full bg-transparent px-6 flex items-center justify-between text-black dark:text-white text-xs select-none pointer-events-none pt-1">
                <span className="font-semibold text-[13px] tracking-tight">{currentTime}</span>
                
                {/* Dynamic Island */}
                <div className="absolute left-1/2 -translate-x-1/2 top-2 h-6 w-24 bg-black rounded-full flex items-center justify-end px-2 space-x-1 shadow-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-900 border border-gray-800" />
                  <div className="w-2 h-2 rounded-full bg-blue-950/80" />
                </div>

                <div className="flex items-center gap-1.5">
                  <Signal className="w-3.5 h-3.5" />
                  <Wifi className="w-3.5 h-3.5" />
                  <Battery className="w-4 h-4 text-emerald-500" />
                </div>
              </div>

              {/* Viewport */}
              <div className="flex-1 w-full overflow-hidden bg-white dark:bg-gray-950">
                <iframe
                  key={`ios-${iframeKey}`}
                  ref={iframeRef}
                  src={previewUrl}
                  title="LaundriGo iOS Mobile View"
                  className="w-full h-full border-0 select-auto"
                />
              </div>

              {/* iOS Home Indicator Bar */}
              <div className="h-4 w-full bg-transparent flex items-center justify-center pointer-events-none select-none">
                <div className="w-32 h-1 bg-gray-400 dark:bg-gray-600 rounded-full" />
              </div>

            </div>

            {/* Hardware Accents */}
            <div className="absolute -left-[14px] top-28 w-[3px] h-12 bg-gray-600 rounded-l-sm" />
            <div className="absolute -left-[14px] top-44 w-[3px] h-12 bg-gray-600 rounded-l-sm" />
            <div className="absolute -right-[14px] top-32 w-[3px] h-16 bg-gray-600 rounded-r-sm" />
          </div>
        ) : (
          /* Google Pixel 8 Android Frame with Center Punch Hole */
          <div className="relative w-[393px] h-[780px] max-h-[85vh] bg-[#121418] rounded-[44px] p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_10px_#272b34,0_0_0_12px_#3f4552] border border-gray-700 flex flex-col overflow-hidden shrink-0 transition-all">
            
            {/* Screen */}
            <div className="relative w-full h-full bg-white dark:bg-gray-950 rounded-[34px] overflow-hidden flex flex-col">
              
              {/* Android Status Bar + Center Punch Hole */}
              <div className="relative z-30 h-8 w-full bg-transparent px-5 flex items-center justify-between text-black dark:text-white text-xs select-none pointer-events-none pt-0.5">
                <span className="font-medium text-[12px]">{currentTime}</span>
                
                {/* Center Camera Punch Hole */}
                <div className="absolute left-1/2 -translate-x-1/2 top-2 w-3.5 h-3.5 bg-black rounded-full border border-gray-800 shadow-inner" />

                <div className="flex items-center gap-1.5 text-[11px]">
                  <Signal className="w-3.5 h-3.5" />
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">92%</span>
                  <Battery className="w-4 h-4 text-emerald-500" />
                </div>
              </div>

              {/* Viewport */}
              <div className="flex-1 w-full overflow-hidden bg-white dark:bg-gray-950">
                <iframe
                  key={`android-${iframeKey}`}
                  ref={iframeRef}
                  src={previewUrl}
                  title="LaundriGo Android Mobile View"
                  className="w-full h-full border-0 select-auto"
                />
              </div>

              {/* Android Gesture Navigation Pill */}
              <div className="h-3.5 w-full bg-transparent flex items-center justify-center pointer-events-none select-none">
                <div className="w-20 h-1 bg-gray-400 dark:bg-gray-500 rounded-full" />
              </div>

            </div>

            {/* Hardware Accents */}
            <div className="absolute -right-[12px] top-24 w-[3px] h-10 bg-gray-500 rounded-r-sm" />
            <div className="absolute -right-[12px] top-38 w-[3px] h-14 bg-gray-500 rounded-r-sm" />
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Showing {device === 'ios' ? 'iOS (iPhone 16 Pro)' : 'Android (Google Pixel 8)'} responsive chassis preview.
        </p>
      </div>
    </div>
  );
}
