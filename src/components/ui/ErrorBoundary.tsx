import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('Application ErrorBoundary caught error:', error);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleClearLocalCacheOnly = (): void => {
    // Strictly clears only device-local browser storage; never mutates server/Firestore records.
    localStorage.removeItem('kc_council_local_store_v1');
    localStorage.removeItem('kc_council_local_session_uid_v1');
    localStorage.removeItem('kc_council_backend_mode_v1');
    localStorage.removeItem('commonground_local_store_v1');
    localStorage.removeItem('commonground_local_session_uid_v1');
    localStorage.removeItem('commonground_backend_mode_v1');
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-[#F5EDFC] to-[#E2C9F8] dark:bg-none dark:bg-[#120A1C] text-[#261D33] dark:text-[#E7DFF2] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-[#1B1029] border border-[#DFD1EE] dark:border-[#372352] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 text-[#9F1239] dark:text-[#FDA4AF]">
            <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
              Something interrupted the display
            </h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#5B506B] dark:text-[#B7A8CC]">
            You can safely reload the page without losing any saved petitions or signatures. If a corrupted local browser draft is preventing the app from loading, you can reset only your local device cache below.
          </p>
          <div className="mt-4 rounded-lg bg-[#F2ECF8] dark:bg-[#26173A] p-3 text-xs font-mono text-[#261D33] dark:text-[#E7DFF2] break-words">
            {this.state.errorMessage}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] dark:bg-[#7E22CE] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Reload application
            </button>
            <button
              type="button"
              onClick={this.handleClearLocalCacheOnly}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2.5 text-sm font-medium text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Reset local browser cache only
            </button>
          </div>
        </div>
      </div>
    );
  }
}
