import React from 'react';
import { createLogger } from '../../utils/logger';
import { performMobileCleanup } from '../../utils/mobileStability';
import { resetPersistedState } from '../../store/logic/storageKeys';
import { getDeviceCapabilities } from '../../utils/capabilities';
import { useStore } from '../../store';

interface MobileErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface MobileErrorBoundaryProps {
  children: React.ReactNode;
}

export class MobileErrorBoundary extends React.Component<MobileErrorBoundaryProps, MobileErrorBoundaryState> {
  private log = createLogger('ui/mobile-error-boundary');
  constructor(props: MobileErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MobileErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.log.error('Caught error', error);
    this.log.error('Error info', errorInfo);
    this.log.error('Component stack', errorInfo.componentStack);

    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

      this.log.error('Full error details', JSON.stringify(errorDetails, null, 2));

    this.setState({ error, errorInfo });

    performMobileCleanup();
  }

  handleReset = () => {
    useStore.getState().stopAllAudioActivity();
    performMobileCleanup();

    try {
      resetPersistedState();
    } catch (e) {
      this.log.warn('Failed to clean localStorage', e);
    }

    this.setState({ hasError: false, error: undefined, errorInfo: undefined });

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  handleReload = () => {
    useStore.getState().stopAllAudioActivity();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isMobile = getDeviceCapabilities().isMobile;

      return (
        <div className="fixed inset-0 bg-gray-900 text-white p-4 flex flex-col items-center justify-center">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-5xl mb-2">!</div>
            <h1 className="text-xl font-bold">App error</h1>
            <p className="text-gray-300 text-sm">
              {isMobile
                ? 'The app hit an error on this device. This can happen when memory is low or graphics fail.'
                : 'The app hit an unexpected error.'}
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Reset and Reload
              </button>

              <button
                onClick={this.handleReload}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Reload
              </button>
            </div>

            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs bg-gray-800 p-3 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
