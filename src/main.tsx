import { Component, ReactNode, ErrorInfo, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'leaflet/dist/leaflet.css';
import { ToastProvider } from './components/ToastContainer.tsx';

// Global listener for Vite module preload errors on new deployment releases
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error detected, refreshing page for latest bundle assets...', event);
    window.location.reload();
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React render tree:", error, errorInfo);
    this.setState({ errorInfo });

    // Handle chunk/asset deployment mismatch by auto-reloading once
    const errorMsg = error?.message || '';
    const isChunkError =
      errorMsg.includes('dynamically imported module') ||
      errorMsg.includes('Loading chunk') ||
      errorMsg.includes('Importing a module script failed');

    if (isChunkError && typeof window !== 'undefined') {
      const reloadKey = 'last_chunk_error_reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(reloadKey, now.toString());
        window.location.reload();
      }
    }
  }

  private handleResetCacheAndReload = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove = [
          'babay_dee_cart',
          'babay_dee_wishlist',
          'products',
          'cached_products',
          'all_products',
          'categories',
          'last_tracking_id',
        ];
        keysToRemove.forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // ignore
          }
        });
        sessionStorage.clear();
      }
    } catch (e) {
      console.warn('Error clearing storage:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || '';
      const isSerializationOrHydration =
        errorMsg.includes('JSON') ||
        errorMsg.includes('undefined is not') ||
        errorMsg.includes('null is not') ||
        errorMsg.includes('Hydration') ||
        errorMsg.includes('serialize');

      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mb-4 text-3xl shadow-inner border border-amber-500/30">
            🌾
          </div>
          <h1 className="text-2xl font-bold mb-2">Babay Dee Atta Chakki</h1>
          <p className="text-slate-300 text-sm max-w-md mb-6">
            {isSerializationOrHydration
              ? "A data synchronization issue occurred. You can easily reload or reset cached local data to restore the app."
              : "Something unexpected occurred while rendering. Click below to refresh the application."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg transition-all cursor-pointer text-sm"
            >
              Reload Application
            </button>
            <button
              onClick={this.handleResetCacheAndReload}
              className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer text-sm"
            >
              Reset Cache & Recover
            </button>
          </div>

          {this.state.error && (
            <pre className="mt-6 text-left text-xs bg-slate-950 p-4 rounded-lg overflow-auto max-w-lg text-rose-300 border border-slate-800 font-mono">
              {this.state.error.toString()}
            </pre>
          )}
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
  </StrictMode>,
);

