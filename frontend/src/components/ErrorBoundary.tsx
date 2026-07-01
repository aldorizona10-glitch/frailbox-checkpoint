import React from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  sectionName?: string;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught render failure', {
      section: this.props.sectionName,
      error,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const section = this.props.sectionName ?? 'section';

    return (
      <div className={this.props.compact ? 'error-boundary error-boundary-compact' : 'error-boundary'}>
        <div className="error-boundary-marker" />
        <div className="error-boundary-content">
          <h3>{section} unavailable</h3>
          <p>
            This part of the dashboard failed to render. The rest of the workspace is still available.
          </p>
          {this.state.errorMessage ? (
            <small>{this.state.errorMessage}</small>
          ) : null}
          <button type="button" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
