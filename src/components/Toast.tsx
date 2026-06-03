import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, CheckCircle, Info } from 'lucide-react';

type ToastType = 'error' | 'success' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  showError: (error: any) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const showError = useCallback((error: any) => {
    console.error("Intercepted Error:", error);
    let msg = "An unexpected error occurred.";
    if (typeof error === 'string') {
      msg = error;
    } else if (error instanceof Error) {
      if (error.message.startsWith('{')) {
        try {
          const parsed = JSON.parse(error.message);
          msg = parsed.error || parsed.message || error.message;
        } catch {
          msg = error.message;
        }
      } else {
        msg = error.message;
      }
    }
    showToast(msg, 'error');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showError }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 pixel-corners flex items-center gap-3 shadow-lg min-w-[300px] max-w-sm border-2 ${
                toast.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-500' :
                toast.type === 'success' ? 'bg-green-500/10 border-green-500 text-green-500' :
                'bg-blue-500/10 border-blue-500 text-blue-500'
              }`}
            >
              {toast.type === 'error' ? <AlertCircle size={20} /> :
               toast.type === 'success' ? <CheckCircle size={20} /> :
               <Info size={20} />}
              <p className="text-sm font-bold flex-1">{toast.message}</p>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
