import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './components/Toast';
import React from 'react';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-red-900/20 border-2 border-red-500 p-8 max-w-xl w-full">
            <h1 className="text-red-500 text-2xl font-bold mb-4 uppercase">System Malfunction</h1>
            <p className="text-red-300 font-mono mb-4 text-sm">{this.state.error?.message.substring(0, 150)}...</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-500 text-white px-6 py-2 uppercase font-bold hover:bg-red-600 transition-colors"
            >
              Reboot System
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
