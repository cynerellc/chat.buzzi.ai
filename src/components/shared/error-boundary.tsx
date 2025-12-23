"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "../ui";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-default-500 mb-4 max-w-md">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="text-xs text-left bg-default-100 p-4 rounded-lg mb-4 max-w-full overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <Button leftIcon={RefreshCw} onPress={this.handleReset}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error display for caught errors
export interface ErrorMessageProps {
  error: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ error, onRetry, className }: ErrorMessageProps) {
  if (!error) return null;

  const message = typeof error === "string" ? error : error.message;

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center ${className}`}>
      <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-danger" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Error</h3>
      <p className="text-default-500 mb-4">{message}</p>
      {onRetry && (
        <Button size="sm" leftIcon={RefreshCw} onPress={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
