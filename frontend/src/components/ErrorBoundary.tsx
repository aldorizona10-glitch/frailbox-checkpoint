import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title: string;
  message?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const fallbackStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 12,
  color: '#f8fafc',
  padding: '1rem',
};

const fallbackTitleStyle: React.CSSProperties = {
  color: '#f8fafc',
  fontSize: '1rem',
  marginBottom: '0.35rem',
};

const fallbackMessageStyle: React.CSSProperties = {
  color: '#94a3b8',
  margin: 0,
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI section failed to render', error, errorInfo);
  }

  render() {
    const { children, title, message } = this.props;

    if (this.state.hasError) {
      return (
        <div role="alert" style={fallbackStyle}>
          <h3 style={fallbackTitleStyle}>{title}</h3>
          <p style={fallbackMessageStyle}>
            {message ?? 'This section is temporarily unavailable.'}
          </p>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
